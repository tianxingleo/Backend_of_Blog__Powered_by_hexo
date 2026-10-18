"use strict";

// hexo-front-matter 是 hexo 的直接依赖，随站点一起安装；不可用时退回极简解析
let parseWithHexo;
try {
  parseWithHexo = require("hexo-front-matter").parse;
} catch (_err) {
  parseWithHexo = null;
}

function naiveParse(raw) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(raw);
  if (!match) return { data: {}, content: raw };
  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (m) data[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return { data, content: match[2] };
}

function parse(raw) {
  if (parseWithHexo) {
    try {
      const parsed = parseWithHexo(raw) || {};
      return { data: parsed, content: parsed._content || "" };
    } catch (_err) {
      // 落到极简解析
    }
  }
  return naiveParse(raw);
}

module.exports = { parse };
