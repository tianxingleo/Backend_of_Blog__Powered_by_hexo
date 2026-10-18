(function () {
  // 静态 AI 摘要脚本：摘要与问答在构建期写入页面，本脚本只负责
  // 打字动画、重新播放、相关文章推荐与介绍，不发起任何网络请求。
  const conf = (window.GLOBAL_CONFIG && GLOBAL_CONFIG.postHeadAiDescription) || {};
  const gptName = conf.gptName || "AI";

  const post_ai = document.querySelector(".post-ai-description");
  if (!post_ai) return;

  const aiTitleRefreshIcon = post_ai.querySelector(".ai-title .anzhiyu-icon-arrow-rotate-right");
  const explanation = post_ai.querySelector(".ai-explanation");
  if (!explanation) return;

  const summaryText = (explanation.textContent || "").trim();

  let aiStr = "";
  let aiStrLength = 0;
  let refreshNum = 0;
  let animationRunning = true;
  let delayInit = 600;
  let indexI = 0;
  let indexJ = 0;
  let timeouts = [];
  let elapsed = 0;

  const observer = createIntersectionObserver();
  const aiFunctions = [introduce, replaySummary, aiRecommend, aiGoHome];

  const aiBtnList = post_ai.querySelectorAll(".ai-btn-item");
  aiBtnList.forEach((item, index) => {
    const fn = aiFunctions[index] || replaySummary;
    item.addEventListener("click", () => fn());
  });

  const aiTag = document.getElementById("ai-tag");
  if (aiTag) aiTag.addEventListener("click", onAiTagClick);
  if (aiTitleRefreshIcon) aiTitleRefreshIcon.addEventListener("click", replaySummary);

  startAI(summaryText);

  function createIntersectionObserver() {
    return new IntersectionObserver(
      entries => {
        let isVisible = entries[0].isIntersecting;
        animationRunning = isVisible;
        if (animationRunning) {
          delayInit = indexI === 0 ? 200 : 20;
          timeouts[1] = setTimeout(() => {
            if (indexJ) {
              indexI = 0;
              indexJ = 0;
            }
            if (indexI === 0) {
              explanation.innerHTML = aiStr.charAt(0);
            }
            requestAnimationFrame(animate);
          }, delayInit);
        }
      },
      { threshold: 0 }
    );
  }

  function animate(timestamp) {
    if (!animationRunning) {
      return;
    }
    if (!animate.start) animate.start = timestamp;
    elapsed = timestamp - animate.start;
    if (elapsed >= 20) {
      animate.start = timestamp;
      if (indexI < aiStrLength - 1) {
        let char = aiStr.charAt(indexI + 1);
        let delay = /[,.，。!?！？]/.test(char) ? 150 : 20;
        if (explanation.firstElementChild) {
          explanation.removeChild(explanation.firstElementChild);
        }
        explanation.innerHTML += char;
        let div = document.createElement("div");
        div.className = "ai-cursor";
        explanation.appendChild(div);
        indexI++;
        if (delay === 150) {
          const cursor = post_ai.querySelector(".ai-explanation .ai-cursor");
          if (cursor) cursor.style.opacity = "0.2";
        }
        if (indexI === aiStrLength - 1) {
          observer.disconnect();
          if (explanation.firstElementChild) explanation.removeChild(explanation.firstElementChild);
        }
        timeouts[0] = setTimeout(() => {
          requestAnimationFrame(animate);
        }, delay);
      }
    } else {
      requestAnimationFrame(animate);
    }
  }

  function clearTimeouts() {
    if (timeouts.length) {
      timeouts.forEach(item => {
        if (item) {
          clearTimeout(item);
        }
      });
    }
  }

  function startAI(str, df = true) {
    indexI = 0;
    indexJ = 1;
    clearTimeouts();
    animationRunning = false;
    elapsed = 0;
    observer.disconnect();
    explanation.innerHTML = df ? "生成中. . ." : "请等待. . .";
    aiStr = str;
    aiStrLength = aiStr.length;
    observer.observe(post_ai);
  }

  function replaySummary() {
    if (aiTitleRefreshIcon) {
      aiTitleRefreshIcon.style.opacity = "0.2";
      aiTitleRefreshIcon.style.transitionDuration = "0.3s";
      aiTitleRefreshIcon.style.transform = "rotate(" + 360 * ++refreshNum + "deg)";
      setTimeout(() => {
        aiTitleRefreshIcon.style.opacity = "1";
      }, 300);
    }
    startAI(summaryText);
  }

  function aiRecommend() {
    indexI = 0;
    indexJ = 1;
    clearTimeouts();
    animationRunning = false;
    elapsed = 0;
    explanation.innerHTML = "生成中. . .";
    aiStr = "";
    aiStrLength = "";
    observer.disconnect();
    timeouts[2] = setTimeout(() => {
      explanation.innerHTML = recommendList();
    }, 600);
  }

  function recommendList() {
    let thumbnail = document.querySelectorAll(".relatedPosts-list a");
    if (!thumbnail.length) {
      const cardRecentPost = document.querySelector(".card-widget.card-recent-post");
      if (!cardRecentPost) return "";

      thumbnail = cardRecentPost.querySelectorAll(".aside-list-item a");

      let list = "";
      for (let i = 0; i < thumbnail.length; i++) {
        const item = thumbnail[i];
        list += `<div class="ai-recommend-item"><span class="index">${
          i + 1
        }：</span><a href="javascript:;" onclick="pjax.loadUrl('${item.href}')" title="${
          item.title
        }" data-pjax-state="">${item.title}</a></div>`;
      }

      return `很抱歉，无法找到类似的文章，你也可以看看本站最新发布的文章：<br /><div class="ai-recommend">${list}</div>`;
    }

    let list = "";
    for (let i = 0; i < thumbnail.length; i++) {
      const item = thumbnail[i];
      list += `<div class="ai-recommend-item"><span>推荐${
        i + 1
      }：</span><a href="javascript:;" onclick="pjax.loadUrl('${item.href}')" title="${
        item.title
      }" data-pjax-state="">${item.title}</a></div>`;
    }

    return `推荐文章：<br /><div class="ai-recommend">${list}</div>`;
  }

  function aiGoHome() {
    startAI("正在前往博客主页...", false);
    timeouts[2] = setTimeout(() => {
      if (window.pjax) {
        pjax.loadUrl("/");
      } else {
        location.href = location.origin;
      }
    }, 1000);
  }

  function introduce() {
    startAI(
      `我是本站的阅读助手（${gptName}）。本文的摘要与常见问答在构建时由 AI 预生成并直接写入页面，访问时不会调用任何模型接口。点击下方按钮可以重新播放摘要或推荐相关文章。`
    );
  }

  function onAiTagClick() {
    startAI("本站 AI 摘要在构建时批量预生成、随页面静态下发，你的浏览器不会向任何模型服务发起请求。");
  }
})();
