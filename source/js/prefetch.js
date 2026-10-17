/**
 * 子页面智能预加载（prefetch）
 * ------------------------------------------------------------------
 * 调度算法（三波次 + 评分队列 + 空闲驱动）：
 *
 *   第一波「文档」：把可能访问的子页面 HTML 按重要性抓进 HTTP 缓存
 *     tier 0  分页"下一页"（首页 page/2、归档下一页……）
 *     tier 1  文章页"上一篇 / 下一篇"
 *     tier 2  正文区文章链接（严格从上到下）
 *     tier 3  顶部导航菜单（归档 / 分类 / 标签 / 关于……）
 *     tier 4  其余同站链接兜底（限量）
 *     同 tier 内按元素在文档中的纵坐标 Y 从上到下排序。
 *
 *   第二波「媒体」：文档波收尾后开始，文章封面图从上到下分批预取，
 *     每批 3 张，批之间等待浏览器空闲 + 最小间隔；用户正在滚动时
 *     自动推迟（把带宽让给懒加载的可见图片）。
 *
 *   第三波「二级收获」：解析已缓存的"下一页" HTML，提前取出它的
 *     文章封面（翻页时封面秒出），插到媒体队列最前面。
 *
 *   抢跑通道：鼠标悬停 65ms / 手指触摸链接时无视波次立刻预取。
 *
 * 零干扰保障：
 * - 页面 load 完成后才启动，且只在浏览器空闲时工作
 * - 全部使用 <link rel="prefetch">（最低网络优先级）+ fetchpriority=low
 * - 并发按网络自适应：4G 为 4 路，3G 为 3 路，其余 2 路
 * - 省流量 / 2G 弱网不做空闲预取；页面切后台自动暂停
 */
(() => {
  // ================= 配置 =================
  var DOC_CONCURRENCY_4G = 4;
  var DOC_CONCURRENCY_3G = 3;
  var DOC_CONCURRENCY_OTHER = 2;
  var MAX_DOCS = 24; // 文档波最多预取多少个页面
  var MAX_IMAGES = 15; // 媒体波最多预取多少张封面
  var MEDIA_BATCH = 3; // 媒体每批几张
  var MEDIA_BATCH_GAP = 1200; // 媒体批间最小间隔（毫秒）
  var MISC_CAP = 10; // tier4 兜底链接上限
  var HARVEST_COVERS = 6; // 从下一页收获封面最多几张
  var HOVER_DELAY = 65; // 悬停抢跑延迟（毫秒）
  var SCROLL_QUIET = 800; // 滚动停止多久后才发媒体批（毫秒）
  var SLOT_TIMEOUT = 20000; // 单个预取槽位超时（毫秒）

  // ================= 状态 =================
  var doneDoc = new Set(); // 已预取的文档
  var doneImg = new Set(); // 已预取的图片
  var docQueue = []; // 文档任务：{ url, score }
  var imgQueue = []; // 媒体任务：{ url, score }
  var inflightDoc = 0; // 文档在途数
  var inflightImg = 0; // 媒体在途数
  var mediaStarted = false; // 媒体波是否已启动
  var nextPageUrls = []; // tier0 的下一页地址（供第三波解析）
  var lastScrollAt = 0; // 最近一次滚动时间

  var SKIP_EXT =
    /\.(zip|rar|7z|tar|gz|pdf|doc|docx|xls|xlsx|ppt|pptx|mp3|mp4|avi|mov|exe|dmg|apk|xml|json|txt|rss)$/i;

  function conn() {
    return (
      navigator.connection ||
      navigator.mozConnection ||
      navigator.webkitConnection ||
      null
    );
  }

  /** 弱网 / 省流量：跳过一切空闲预取（抢跑通道保留） */
  function isRestrictedNetwork() {
    var c = conn();
    return (
      !!c &&
      (c.saveData === true || /^(slow-2g|2g)$/.test(c.effectiveType || ""))
    );
  }

  /** 按当前网络返回文档并发路数 */
  function docConcurrency() {
    var c = conn();
    var et = c ? c.effectiveType || "" : "";
    if (et === "4g") return DOC_CONCURRENCY_4G;
    if (et === "3g") return DOC_CONCURRENCY_3G;
    // 未知网络按较快处理（桌面端通常无该 API），弱网早已在门禁拦下
    if (!et) return DOC_CONCURRENCY_4G;
    return DOC_CONCURRENCY_OTHER;
  }

  // ================= 归一化 =================

  /** 文档只允许同源（文章页、分页、归档等都在本站） */
  function normalizeDoc(href) {
    if (!href || href.charAt(0) === "#") return "";
    if (/^(javascript|mailto|tel|sms|data|blob):/i.test(href)) return "";
    var url;
    try {
      url = new URL(href, location.href);
    } catch (e) {
      return "";
    }
    if (url.origin !== location.origin) return "";
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    if (SKIP_EXT.test(url.pathname)) return "";
    url.hash = "";
    var clean = url.href;
    if (clean === location.href.split("#")[0]) return "";
    if (doneDoc.has(clean)) return "";
    return clean;
  }

  /**
   * 图片允许跨域 CDN（本站封面在图床域名下）。
   * <link rel="prefetch"> 是 no-cors 模式，响应可被 <img> 直接复用。
   */
  function normalizeImg(src, base) {
    if (!src || src.charAt(0) === "#") return "";
    if (/^(data|blob|javascript):/i.test(src)) return "";
    var url;
    try {
      url = new URL(src, base || location.href);
    } catch (e) {
      return "";
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    url.hash = "";
    var clean = url.href;
    if (doneImg.has(clean)) return "";
    return clean;
  }

  /** 元素在文档中的纵坐标（用于从上到下排序） */
  function docY(el) {
    var top = el.getBoundingClientRect().top + (window.scrollY || 0);
    return top < 0 ? 0 : top;
  }

  // ================= 预取原语 =================

  function insertPrefetch(url, as) {
    var link = document.createElement("link");
    link.rel = "prefetch";
    if (as) link.as = as;
    link.href = url;
    // 双保险声明最低优先级（不支持的浏览器会忽略）
    link.setAttribute("fetchpriority", "low");
    document.head.appendChild(link);
    return link;
  }

  function prefetchDoc(url) {
    if (!url || doneDoc.has(url)) return;
    doneDoc.add(url);
    inflightDoc += 1;
    var link = insertPrefetch(url, "document");
    var released = false;
    var release = () => {
      if (released) return;
      released = true;
      inflightDoc = Math.max(0, inflightDoc - 1);
      pumpDocs();
      maybeStartMedia();
    };
    link.onload = release;
    link.onerror = release;
    setTimeout(release, SLOT_TIMEOUT);
  }

  function prefetchImg(url) {
    if (!url || doneImg.has(url)) return;
    doneImg.add(url);
    inflightImg += 1;
    var link = insertPrefetch(url, "image");
    var released = false;
    var release = () => {
      if (released) return;
      released = true;
      inflightImg = Math.max(0, inflightImg - 1);
    };
    link.onload = release;
    link.onerror = release;
    setTimeout(release, SLOT_TIMEOUT);
  }

  // ================= 第一波：文档 =================

  function enqueueDoc(url, tier, el) {
    if (!url || doneDoc.has(url)) return;
    if (docQueue.length >= MAX_DOCS) return;
    for (var i = 0; i < docQueue.length; i++) {
      if (docQueue[i].url === url) return;
    }
    // 评分 = tier 主序 + 纵坐标次序：tier 内严格从上到下
    var y = el ? docY(el) : 0;
    docQueue.push({ url: url, score: tier * 1000000 + y });
  }

  function collectDocs() {
    var i, url;

    // tier 0：分页"下一页"（并记录，供第三波解析封面）
    var next = document.querySelectorAll(
      '#pagination a.extend.next, #pagination a[rel="next"]',
    );
    for (i = 0; i < next.length; i++) {
      url = normalizeDoc(next[i].getAttribute("href"));
      if (url) {
        enqueueDoc(url, 0, next[i]);
        nextPageUrls.push(url);
      }
    }

    // tier 1：文章页"上一篇 / 下一篇"
    var postNav = document.querySelectorAll(
      "#pagination.pagination-post a, .pagination-post a, #post-nav a, .post-nav a",
    );
    for (i = 0; i < postNav.length; i++) {
      url = normalizeDoc(postNav[i].getAttribute("href"));
      if (url) enqueueDoc(url, 1, postNav[i]);
    }

    // tier 2：正文区文章链接（从上到下）
    var articles = document.querySelectorAll(
      "#recent-posts .recent-post-item a, #recent-posts .recent-post-info a, " +
        ".recent-post-item a, #content-inner article a, .post-title a",
    );
    for (i = 0; i < articles.length; i++) {
      url = normalizeDoc(articles[i].getAttribute("href"));
      if (url) enqueueDoc(url, 2, articles[i]);
    }

    // tier 3：顶部导航菜单
    var nav = document.querySelectorAll(
      "#nav a, #menus a, .menus a, #site-nav a, .site-page",
    );
    for (i = 0; i < nav.length; i++) {
      url = normalizeDoc(nav[i].getAttribute("href"));
      if (url) enqueueDoc(url, 3, nav[i]);
    }

    // tier 4：其余同站链接兜底（限量）
    var count = 0;
    var misc = document.querySelectorAll(
      "#recent-posts a, #content-inner a, #body-wrap a",
    );
    for (i = 0; i < misc.length && count < MISC_CAP; i++) {
      url = normalizeDoc(misc[i].getAttribute("href"));
      if (url) {
        enqueueDoc(url, 4, misc[i]);
        count += 1;
      }
    }

    // 按评分排序：tier 优先，同 tier 从上到下
    docQueue.sort((a, b) => a.score - b.score);
  }

  function pumpDocs() {
    if (document.hidden) return;
    var budget = docConcurrency();
    while (inflightDoc < budget && docQueue.length > 0) {
      var task = docQueue.shift();
      if (doneDoc.has(task.url)) continue;
      prefetchDoc(task.url);
    }
  }

  // ================= 第二波：媒体（分批 + 从上到下） =================

  function enqueueImg(url, score, front) {
    if (!url || doneImg.has(url)) return;
    if (imgQueue.length >= MAX_IMAGES) return;
    for (var i = 0; i < imgQueue.length; i++) {
      if (imgQueue[i].url === url) return;
    }
    var task = { url: url, score: score };
    if (front) imgQueue.unshift(task);
    else imgQueue.push(task);
  }

  function collectImages() {
    // 文章卡片封面（兼容懒加载的 data-src / data-lazy-src）
    var imgs = document.querySelectorAll(
      "#recent-posts .recent-post-item img, .recent-post-item img, " +
        "#content-inner article img, .pagination-post img",
    );
    var list = [];
    for (var i = 0; i < imgs.length; i++) {
      var img = imgs[i];
      // 已经显示出来的图浏览器已有缓存，跳过
      if (img.complete && img.naturalWidth > 0) continue;
      var src =
        img.getAttribute("data-src") ||
        img.getAttribute("data-lazy-src") ||
        img.getAttribute("data-original") ||
        img.currentSrc ||
        img.src;
      var url = normalizeImg(src);
      if (url) list.push({ url: url, y: docY(img) });
    }
    // 从上到下排序后入队
    list.sort((a, b) => a.y - b.y);
    for (var j = 0; j < list.length; j++) {
      enqueueImg(list[j].url, list[j].y, false);
    }
  }

  /** 在浏览器空闲时执行回调（带超时兜底） */
  function runIdle(fn, timeout) {
    if ("requestIdleCallback" in window) {
      requestIdleCallback(
        () => {
          fn();
        },
        { timeout: timeout || 3000 },
      );
    } else {
      setTimeout(fn, 600);
    }
  }

  /** 发一批媒体（MEDIA_BATCH 张），发完等待间隔 + 空闲再发下一批 */
  function pumpMediaBatch() {
    if (document.hidden) {
      // 后台时暂停，回到前台由 visibilitychange 恢复
      return;
    }
    // 用户正在滚动：把带宽让给懒加载，稍后重试
    if (Date.now() - lastScrollAt < SCROLL_QUIET) {
      setTimeout(pumpMediaBatch, SCROLL_QUIET);
      return;
    }
    var sent = 0;
    while (sent < MEDIA_BATCH && imgQueue.length > 0) {
      var task = imgQueue.shift();
      if (doneImg.has(task.url)) continue;
      prefetchImg(task.url);
      sent += 1;
    }
    if (imgQueue.length > 0) {
      setTimeout(() => {
        runIdle(pumpMediaBatch, 5000);
      }, MEDIA_BATCH_GAP);
    }
  }

  /** 文档波收尾（队列空 + 在途少）时启动媒体波 */
  function maybeStartMedia() {
    if (mediaStarted) return;
    if (docQueue.length > 0 || inflightDoc > 1) return;
    mediaStarted = true;
    collectImages();
    harvestNextPageCovers();
    runIdle(pumpMediaBatch, 5000);
  }

  // ================= 第三波：解析下一页，收获它的封面 =================

  function harvestNextPageCovers() {
    if (nextPageUrls.length === 0) return;
    var pageUrl = nextPageUrls[0];
    // 文档波已把它抓进缓存，这里大概率命中缓存，不产生真实网络开销
    var doHarvest = () => {
      var p;
      try {
        // low 优先级：支持的浏览器（Chromium）会低优先级抓取，不支持的忽略该参数
        p = fetch(pageUrl, { credentials: "same-origin", priority: "low" });
      } catch (e) {
        try {
          p = fetch(pageUrl, { credentials: "same-origin" });
        } catch (e2) {
          return;
        }
      }
      p.then((resp) => {
        if (!resp.ok) return null;
        return resp.text();
      })
        .then((html) => {
          if (!html || html.length < 500) return;
          var doc;
          try {
            doc = new DOMParser().parseFromString(html, "text/html");
          } catch (e) {
            return;
          }
          var imgs = doc.querySelectorAll(".recent-post-item img, article img");
          var n = 0;
          for (var i = 0; i < imgs.length && n < HARVEST_COVERS; i++) {
            var src =
              imgs[i].getAttribute("data-src") ||
              imgs[i].getAttribute("data-lazy-src") ||
              imgs[i].getAttribute("src");
            var url = normalizeImg(src, pageUrl);
            if (url) {
              // 下一页封面价值最高，插到媒体队列最前面
              enqueueImg(url, -1000 + i, true);
              n += 1;
            }
          }
        })
        .catch(() => {
          /* 解析失败不影响主流程 */
        });
    };
    // 等文档波的预取大概率完成后（命中缓存）再解析
    setTimeout(() => {
      runIdle(doHarvest, 5000);
    }, 2500);
  }

  // ================= 抢跑通道：悬停 / 触摸 =================

  function bindIntentPrefetch() {
    var timer = null;

    document.addEventListener(
      "mouseover",
      (e) => {
        var a = e.target && e.target.closest ? e.target.closest("a") : null;
        if (!a) return;
        var url = normalizeDoc(a.getAttribute("href"));
        if (!url) return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          prefetchDoc(url);
        }, HOVER_DELAY);
      },
      { passive: true },
    );

    document.addEventListener(
      "mouseout",
      (e) => {
        var a = e.target && e.target.closest ? e.target.closest("a") : null;
        if (a) clearTimeout(timer);
      },
      { passive: true },
    );

    // 移动端：手指按下立刻预取，点击跳转时大概率已在缓存中
    document.addEventListener(
      "touchstart",
      (e) => {
        var a = e.target && e.target.closest ? e.target.closest("a") : null;
        if (!a) return;
        var url = normalizeDoc(a.getAttribute("href"));
        if (url) prefetchDoc(url);
      },
      { passive: true },
    );
  }

  // ================= 启动门禁 =================

  function boot() {
    bindIntentPrefetch();

    document.addEventListener(
      "scroll",
      () => {
        lastScrollAt = Date.now();
      },
      { passive: true },
    );

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) return;
      // 回到前台：继续文档波；媒体波若已启动则续发下一批
      pumpDocs();
      if (mediaStarted && imgQueue.length > 0) {
        runIdle(pumpMediaBatch, 3000);
      } else {
        maybeStartMedia();
      }
    });

    // 弱网 / 省流量：只保留抢跑通道
    if (isRestrictedNetwork()) return;

    var start = () => {
      collectDocs();
      // 启动也等待一个空闲窗口，确保 load 后续任务（如统计、评论）优先
      runIdle(pumpDocs, 4000);
      // 兜底：万一文档波长期不收尾（如某链接 hang 住），超时后强制启动媒体波
      setTimeout(maybeStartMedia, 30000);
    };

    if (document.readyState === "complete") {
      start();
    } else {
      window.addEventListener("load", start);
    }
  }

  boot();
})();
