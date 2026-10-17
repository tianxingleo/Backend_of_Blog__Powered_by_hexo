/**
 * Butterfly
 * ramdom cover
 */

hexo.extend.filter.register("before_post_render", (data) => {
  const imgTestReg = /\.(png|jpe?g|gif|svg|webp)(\?.*)?$/i;
  let { cover: coverVal, top_img: topImg } = data;

  // Add path to top_img and cover if post_asset_folder is enabled
  if (hexo.config.post_asset_folder) {
    if (topImg && topImg.indexOf("/") === -1 && imgTestReg.test(topImg))
      data.top_img = `${data.path}${topImg}`;
    if (coverVal && coverVal.indexOf("/") === -1 && imgTestReg.test(coverVal))
      data.cover = `${data.path}${coverVal}`;
  }

  const randomCoverFn = () => {
    const {
      cover: { default_cover: defaultCover },
    } = hexo.theme.config;
    if (!defaultCover) return false;
    if (!Array.isArray(defaultCover)) return defaultCover;
    const num = Math.floor(Math.random() * defaultCover.length);
    return defaultCover[num];
  };

  if (coverVal === false) return data;

  // 性能优化 2026-10：默认封面使用稳定 URL，不再追加随机 _r_ 参数。
  // 随机参数会让同一图片在每篇文章/每次构建中都变成不同 URL，彻底破坏浏览器与 CDN 缓存。
  // If cover is not set, use random cover (stable URL for better caching)
  if (!coverVal) {
    const randomCover = randomCoverFn();
    data.cover = randomCover;
    coverVal = randomCover; // update coverVal
  }

  if (
    coverVal &&
    (coverVal.indexOf("//") !== -1 || imgTestReg.test(coverVal))
  ) {
    data.cover_type = "img";
  }

  return data;
});
