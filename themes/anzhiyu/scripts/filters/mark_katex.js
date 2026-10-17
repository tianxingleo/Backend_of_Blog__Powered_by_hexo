/**
 * AnZhiYu perf 2026-10
 * 标记含有服务端 KaTeX 渲染结果的文章/页面，供模板按需引入 KaTeX CSS。
 * hexo-filter-katex 在 before_post_render（优先级 9）把公式渲染为 HTML，
 * 此处在 after_* 阶段检测渲染痕迹（class="katex"），命中则置 page.katex = true。
 */

const markKatex = (data) => {
 if (
  data &&
  typeof data.content === "string" &&
  data.content.includes('class="katex"')
 ) {
  data.katex = true;
 }
 return data;
};

hexo.extend.filter.register("after_post_render", markKatex);
hexo.extend.filter.register("after_page_render", markKatex);
