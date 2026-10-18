"use strict";

const fs = require("fs");
const path = require("path");
const fm = require("./frontmatter");
const { normalizeMarkdown, computeFingerprint, toStringArray } = require("./fingerprint");

const MIN_EFFECTIVE_CHARS = 120;

function walkMarkdown(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    for (const name of fs.readdirSync(cur)) {
      const abs = path.join(cur, name);
      const st = fs.statSync(abs);
      if (st.isDirectory()) stack.push(abs);
      else if (/\.md$/i.test(name)) out.push(abs);
    }
  }
  return out.sort();
}

function toKey(sourceDir, absPath) {
  return path.relative(sourceDir, absPath).split(path.sep).join("/");
}

function isExplicitlyDisabled(data) {
  return data.ai === false || data.ai === "false" || data.ai === "False";
}

// 状态说明：
//   changed        新文章或指纹变化，进入待生成队列
//   unchanged      指纹一致且结果完整，直接复用
//   cooldown       上次对该指纹生成失败，冷却期内暂不重试
//   disabled       front-matter 显式 ai: false
//   skipped-short  有效内容过短，不值得调用模型
function scanPosts({ postsDir, sourceDir, cacheState, primaryModelId, upgradeAll = false, force = false }) {
  const files = walkMarkdown(postsDir);
  const posts = [];
  const now = Date.now();

  for (const abs of files) {
    const key = toKey(sourceDir, abs);
    let raw;
    try {
      raw = fs.readFileSync(abs, "utf8");
    } catch (err) {
      console.warn(`[ai] 读取失败，跳过 ${key}: ${err.message}`);
      continue;
    }

    const { data, content } = fm.parse(raw);

    if (isExplicitlyDisabled(data)) {
      posts.push({ key, abs, status: "disabled", entry: cacheState.entries[key] || null });
      continue;
    }

    const body = normalizeMarkdown(content);
    const effectiveLen = (String(data.title || "") + String(data.description || "") + body).replace(/\s+/g, "").length;
    if (effectiveLen < MIN_EFFECTIVE_CHARS) {
      posts.push({ key, abs, status: "skipped-short", entry: cacheState.entries[key] || null });
      continue;
    }

    const fingerprint = computeFingerprint(
      {
        title: data.title,
        description: data.description,
        tags: data.tags,
        categories: data.categories,
        normalizedBody: body,
      },
      primaryModelId
    );

    const entry = cacheState.entries[key];
    const unchanged =
      !upgradeAll &&
      entry &&
      entry.status === "ok" &&
      entry.summary &&
      entry.sourceHash === fingerprint;

    if (unchanged) {
      posts.push({ key, abs, status: "unchanged", fingerprint, entry, title: data.title });
      continue;
    }

    const cooling =
      !force &&
      entry &&
      entry.attemptedHash === fingerprint &&
      entry.retryAfter &&
      Date.parse(entry.retryAfter) > now;

    posts.push({
      key,
      abs,
      status: cooling ? "cooldown" : "changed",
      fingerprint,
      entry: entry || null,
      title: data.title,
      description: data.description,
      tags: toStringArray(data.tags),
      categories: toStringArray(data.categories),
      body,
    });
  }

  return posts;
}

module.exports = { scanPosts };
