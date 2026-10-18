"use strict";

const fs = require("fs");
const path = require("path");

const CACHE_VERSION = 1;

function empty() {
  return { version: CACHE_VERSION, generatedAt: null, entries: {} };
}

function load(cacheFile) {
  if (!fs.existsSync(cacheFile)) return empty();
  try {
    const data = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    if (!data || typeof data !== "object" || typeof data.entries !== "object") {
      throw new Error("entries 字段缺失");
    }
    return { version: CACHE_VERSION, generatedAt: data.generatedAt || null, entries: data.entries };
  } catch (err) {
    const backup = cacheFile + ".corrupt-" + Date.now();
    fs.copyFileSync(cacheFile, backup);
    console.warn(`[ai] 缓存文件解析失败（${err.message}），已备份为 ${path.basename(backup)}，从空缓存开始`);
    return empty();
  }
}

// 临时文件 + 原子替换：中途中断不会损坏上一版结果
function saveAtomic(cacheFile, state) {
  const dir = path.dirname(cacheFile);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, "." + path.basename(cacheFile) + ".tmp");
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, cacheFile);
}

module.exports = { load, saveAtomic, empty, CACHE_VERSION };
