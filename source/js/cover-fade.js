/**
 * 首页大横幅遮罩揭开（配合 cover-fade.styl）
 * ------------------------------------------------------------------
 * 首页大横幅是 CSS background，图片下载好会直接闪现。样式层在横幅上
 * 盖了一层与底色相同的遮罩（#page-header.full_page::after），本脚本
 * 在确认横幅图片解码完成后给 header 加上 .hero-ready 类，遮罩淡出，
 * 视觉上就是横幅从底色中渐显出来。
 *
 * 图片地址优先复用 head 中的 LCP 预加载链接（浏览器已在高优先级下载，
 * 这里大概率直接命中缓存），取不到时再解析计算样式中的背景图。
 * 4 秒兜底：网络再慢也不让遮罩一直盖着。
 */
(() => {
  var header = document.getElementById("page-header");
  if (!header || !header.classList.contains("full_page")) return;

  var finished = false;
  function ready() {
    if (finished) return;
    finished = true;
    header.classList.add("hero-ready");
  }

  var url = "";
  var preload = document.querySelector('link[rel="preload"][as="image"]');
  if (preload && preload.href) {
    url = preload.href;
  } else {
    try {
      var bg = window.getComputedStyle(header).backgroundImage || "";
      var m = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (m) url = m[1];
    } catch (e) {
      url = "";
    }
  }

  // 无背景图（纯色横幅）：直接就绪
  if (!url || url === "none") {
    ready();
    return;
  }

  var img = new Image();
  img.onload = ready;
  img.onerror = ready;
  img.src = url;
  // 已在缓存中：同步完成，直接揭开
  if (img.complete && img.naturalWidth > 0) {
    ready();
    return;
  }
  // 兜底：最多等 4 秒
  setTimeout(ready, 4000);
})();
