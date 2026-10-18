"use strict";

const { loadConfig } = require("./config");
const cacheStore = require("./cache");
const { scanPosts } = require("./scan");

const USAGE = `
用法：
  node tools/ai/cli.js plan    [--upgrade-all] [--limit N]   干跑：列出会生成哪些文章，不请求 API
  node tools/ai/cli.js generate [--upgrade-all] [--force] [--limit N]   有限并发生成，仅处理变化文章

参数：
  --upgrade-all  忽略指纹一致性，全量重新生成（提示词/模型升级后使用，会计费）
  --force        忽略失败冷却期，立即重试失败文章
  --limit N      本次最多处理 N 篇
`;

function parseArgs(argv) {
  const options = { upgradeAll: false, force: false, limit: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--upgrade-all") options.upgradeAll = true;
    else if (a === "--force") options.force = true;
    else if (a === "--limit") options.limit = Number(argv[++i]) || 0;
    else if (a.startsWith("--limit=")) options.limit = Number(a.slice(8)) || 0;
    else {
      console.error(`未知参数: ${a}\n${USAGE}`);
      process.exit(2);
    }
  }
  return options;
}

function plan(options) {
  const cfg = loadConfig();
  for (const w of cfg.warnings) console.warn(`[ai] ${w}`);

  const cacheState = cacheStore.load(cfg.cacheFile);
  const primaryModelId = cfg.fingerprintModelId;
  const posts = scanPosts({
    postsDir: cfg.postsDir,
    sourceDir: cfg.sourceDir,
    cacheState,
    primaryModelId,
    upgradeAll: options.upgradeAll,
    force: options.force,
  });

  const postByKey = new Map(posts.map(p => [p.key, p]));
  const prunable = Object.keys(cacheState.entries).filter(k => {
    const p = postByKey.get(k);
    return !p || p.status === "disabled";
  });

  const changed = posts.filter(p => p.status === "changed");
  const limited = options.limit > 0 ? changed.slice(0, options.limit) : changed;
  const count = status => posts.filter(p => p.status === status).length;

  console.log("===== AI 摘要生成计划（dry-run，不请求 API） =====");
  console.log(
    `提供方: ${cfg.providers.map(p => `${p.name}(${p.model})`).join(" → ") || "无（缺少密钥，将只复用缓存）"}`
  );
  console.log(
    `并发 ${cfg.concurrency} · 请求预算 ${cfg.maxRequestsPerBuild}/构建 · token 预算 ${cfg.maxTokensPerBuild}/构建` +
      (options.upgradeAll ? " · 模式：全量重算（--upgrade-all）" : "")
  );
  console.log("");
  console.log(
    `待生成 ${changed.length} · 复用 ${count("unchanged")} · 冷却中 ${count("cooldown")} · 禁用 ${count("disabled")}` +
      ` · 内容过短 ${count("skipped-short")} · 将清理缓存 ${prunable.length}`
  );

  if (limited.length) {
    console.log("");
    console.log("将生成：");
    for (const p of limited) {
      const reason = !p.entry
        ? "新文章"
        : p.entry.status !== "ok"
          ? `上次状态 ${p.entry.status}`
          : "内容/版本变化";
      console.log(`  ${p.key}（${reason}）`);
    }
  }

  const est = cfg.providers.length ? Math.min(limited.length, cfg.maxRequestsPerBuild) : 0;
  console.log("");
  if (!cfg.providers.length) {
    console.log("预计 API 请求: 0（没有可用密钥，仅复用已有缓存）");
  } else {
    console.log(
      `预计 API 请求: ${est}` + (changed.length > est ? `（共需 ${changed.length}，超出部分下次构建继续）` : "")
    );
  }

  const cooling = posts.filter(p => p.status === "cooldown");
  if (cooling.length) {
    console.log("");
    console.log("冷却中（--force 可强制重试）:");
    for (const p of cooling) console.log(`  ${p.key}（重试时间 ${p.entry.retryAfter}）`);
  }
  if (prunable.length) {
    console.log("");
    console.log("将清理缓存:");
    for (const k of prunable) console.log(`  ${k}`);
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === "help" || command === "--help") {
    console.log(USAGE);
    return 0;
  }
  if (command === "plan") {
    plan(parseArgs(rest));
    return 0;
  }
  if (command === "generate") {
    const { run } = require("./generate");
    const result = await run(parseArgs(rest));
    return result.code;
  }
  console.error(`未知命令: ${command}\n${USAGE}`);
  return 2;
}

main().then(code => process.exit(code)).catch(err => {
  console.error("[ai] 未捕获错误:", err);
  process.exit(1);
});
