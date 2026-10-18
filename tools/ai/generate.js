"use strict";

const fs = require("fs");
const path = require("path");
const { loadConfig } = require("./config");
const cacheStore = require("./cache");
const { scanPosts } = require("./scan");
const { buildMessages, buildRepairMessages, PROMPT_VERSION } = require("./prompt");
const { parseModelJson, validateAndClean } = require("./validate");
const { callChat, createRuntime } = require("./provider");
const { nowIso } = require("./util");

const LOCK_STALE_MS = 30 * 60 * 1000;

function acquireLock(lockFile) {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  if (fs.existsSync(lockFile)) {
    const st = fs.statSync(lockFile);
    if (Date.now() - st.mtimeMs > LOCK_STALE_MS) {
      console.warn("[ai] 发现超过 30 分钟的陈旧锁文件，自动清除");
      fs.unlinkSync(lockFile);
    } else {
      return {
        ok: false,
        message: `已有生成任务在运行（锁文件 ${path.basename(lockFile)}）。如确认没有其他任务，可删除该文件后重试。`,
      };
    }
  }
  try {
    fs.writeFileSync(lockFile, JSON.stringify({ pid: process.pid, startedAt: nowIso() }), { flag: "wx" });
    return { ok: true };
  } catch (err) {
    return { ok: false, message: "获取锁失败：" + err.message };
  }
}

function releaseLock(lockFile) {
  try {
    fs.unlinkSync(lockFile);
  } catch (_err) {
    /* 已不存在 */
  }
}

// 跨构建失败冷却：30 分钟起步指数增长，封顶 24 小时
function cooldownMs(attempts) {
  return Math.min(30 * 60 * 1000 * Math.pow(2, Math.max(0, attempts - 1)), 24 * 60 * 60 * 1000);
}

function countBy(items) {
  const out = {};
  for (const item of items) out[item] = (out[item] || 0) + 1;
  return out;
}

function printReport(cfg, runtime, totals) {
  console.log("");
  console.log("===== 本次构建统计 =====");
  console.log(`生成成功 ${totals.generated} · 失败 ${totals.failed} · 预算顺延 ${totals.budgetSkipped}`);
  console.log(
    `HTTP 请求 ${runtime.requestCount} · token: 输入 ${totals.promptTokens} / 输出 ${totals.completionTokens} / 合计 ${totals.totalTokens}`
  );
  for (const [name, p] of Object.entries(runtime.byProvider)) {
    console.log(`  - ${name}: 请求 ${p.requests}（成功 ${p.ok}）`);
  }
  if ((cfg.pricePerMtokInput || cfg.pricePerMtokOutput) && totals.totalTokens) {
    const cost =
      (totals.promptTokens / 1e6) * cfg.pricePerMtokInput +
      (totals.completionTokens / 1e6) * cfg.pricePerMtokOutput;
    console.log(`估算费用: $${cost.toFixed(4)}`);
  } else {
    console.log("（未配置单价，跳过费用估算；可在 .env 设置 AI_PRICE_PER_MTOK_INPUT/OUTPUT）");
  }
}

async function run(options = {}) {
  const { upgradeAll = false, force = false, limit = 0 } = options;
  const cfg = loadConfig();
  for (const w of cfg.warnings) console.warn(`[ai] ${w}`);

  if (!cfg.enabled) {
    console.log("[ai] AI_ENABLED=false，跳过生成");
    return { code: 0 };
  }

  const cacheState = cacheStore.load(cfg.cacheFile);
  const primaryModelId = cfg.fingerprintModelId;
  const posts = scanPosts({
    postsDir: cfg.postsDir,
    sourceDir: cfg.sourceDir,
    cacheState,
    primaryModelId,
    upgradeAll,
    force,
  });

  // 清理已删除或 ai:false 文章的缓存
  const postByKey = new Map(posts.map(p => [p.key, p]));
  const pruned = [];
  for (const key of Object.keys(cacheState.entries)) {
    const p = postByKey.get(key);
    if (!p || p.status === "disabled") {
      delete cacheState.entries[key];
      pruned.push(key);
    }
  }

  const stats = countBy(posts.map(p => p.status));
  console.log(
    `[ai] 扫描完成：待生成 ${stats.changed || 0} · 复用 ${stats.unchanged || 0} · 冷却中 ${stats.cooldown || 0}` +
      ` · 禁用 ${stats.disabled || 0} · 内容过短 ${stats["skipped-short"] || 0} · 清理缓存 ${pruned.length}`
  );

  if (!cfg.providers.length) {
    console.warn("[ai] 没有可用的模型提供方（缺少密钥），本次不发起任何请求；已有缓存摘要继续可用。");
    if (pruned.length) cacheStore.saveAtomic(cfg.cacheFile, cacheState);
    return { code: 0 };
  }

  let queue = posts.filter(p => p.status === "changed");
  if (limit > 0 && queue.length > limit) queue = queue.slice(0, limit);
  if (!queue.length) {
    console.log("[ai] 没有需要生成的文章。");
    if (pruned.length) cacheStore.saveAtomic(cfg.cacheFile, cacheState);
    return { code: 0 };
  }

  const lock = acquireLock(cfg.lockFile);
  if (!lock.ok) {
    console.error(`[ai] ${lock.message}`);
    return { code: 1 };
  }

  const runtime = createRuntime();
  const totals = { generated: 0, failed: 0, budgetSkipped: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const budget = {
    isExhausted: () =>
      runtime.requestCount >= cfg.maxRequestsPerBuild || totals.totalTokens >= cfg.maxTokensPerBuild,
  };
  let budgetStop = false;
  let dirty = false;
  const flush = () => {
    if (dirty) cacheStore.saveAtomic(cfg.cacheFile, cacheState);
  };

  console.log(
    `[ai] 开始生成：${queue.length} 篇 · 并发 ${cfg.concurrency} · 预算 ${cfg.maxRequestsPerBuild} 请求 / ${cfg.maxTokensPerBuild} token`
  );

  const generateOne = async post => {
    const baseMessages = buildMessages(post, cfg.maxInputChars);
    let strategyMessages = baseMessages;
    let lastReason = "未知错误";

    for (let round = 0; round < 2; round++) {
      for (const provider of cfg.providers) {
        if (runtime.authFailed[provider.name]) continue;
        const r = await callChat({
          provider,
          messages: strategyMessages,
          maxOutputTokens: cfg.maxOutputTokens,
          timeoutMs: cfg.requestTimeoutMs,
          maxRetries: cfg.maxRetries,
          runtime,
          budget,
        });
        if (r.budget) return { status: "budget" };
        if (!r.ok) {
          lastReason = r.reason;
          continue;
        }
        if (r.usage) {
          totals.promptTokens += r.usage.prompt_tokens || 0;
          totals.completionTokens += r.usage.completion_tokens || 0;
          totals.totalTokens += r.usage.total_tokens || 0;
        }
        const parsed = parseModelJson(r.content);
        if (!parsed.ok) {
          lastReason = `${provider.name}: ${parsed.errors.join("; ")}`;
          continue;
        }
        const v = validateAndClean(parsed.value);
        if (!v.ok) {
          lastReason = `${provider.name}: 校验失败（${v.errors.join("; ")}）`;
          continue;
        }
        cacheState.entries[post.key] = {
          sourceHash: post.fingerprint,
          promptVersion: PROMPT_VERSION,
          model: `${provider.name}:${provider.model}`,
          status: "ok",
          summary: v.value.summary,
          highlights: v.value.highlights,
          qa: v.value.qa,
          generatedAt: nowIso(),
          attemptedHash: post.fingerprint,
          attempts: 0,
          retryAfter: null,
          usage: r.usage
            ? {
                prompt_tokens: r.usage.prompt_tokens || 0,
                completion_tokens: r.usage.completion_tokens || 0,
                total_tokens: r.usage.total_tokens || 0,
              }
            : null,
        };
        cacheState.generatedAt = nowIso();
        dirty = true;
        flush();
        return { status: "ok", provider: provider.name };
      }
      // 两家提供方都失败且像格式问题：追加修复提示再试一轮
      if (round === 0) strategyMessages = buildRepairMessages(baseMessages, lastReason);
    }
    return { status: "failed", reason: lastReason };
  };

  const worker = async () => {
    while (!budgetStop) {
      const post = queue.shift();
      if (!post) return;
      const result = await generateOne(post);
      if (result.status === "ok") {
        totals.generated += 1;
        console.log(`[ai] ✓ ${post.key}（${result.provider}）`);
      } else if (result.status === "budget") {
        if (!budgetStop) {
          budgetStop = true;
          totals.budgetSkipped += queue.length;
          queue.length = 0;
          console.warn("[ai] 预算触顶，停止派发新任务；剩余文章下次构建继续");
        }
        totals.budgetSkipped += 1;
        return;
      } else {
        totals.failed += 1;
        const prev = post.entry || null;
        const attempts = ((prev && prev.attempts) || 0) + 1;
        const retryAfter = new Date(Date.now() + cooldownMs(attempts)).toISOString();
        if (prev && prev.summary) {
          cacheState.entries[post.key] = {
            ...prev,
            status: "stale",
            attemptedHash: post.fingerprint,
            attempts,
            retryAfter,
          };
          console.warn(`[ai] ✗ ${post.key} 生成失败，保留上一版摘要（stale）: ${result.reason}`);
        } else {
          cacheState.entries[post.key] = {
            sourceHash: null,
            promptVersion: PROMPT_VERSION,
            model: null,
            status: "failed",
            summary: null,
            highlights: null,
            qa: null,
            generatedAt: null,
            attemptedHash: post.fingerprint,
            attempts,
            retryAfter,
            usage: null,
          };
          console.warn(`[ai] ✗ ${post.key} 生成失败（无历史摘要，前端将回退普通导读）: ${result.reason}`);
        }
        dirty = true;
        flush();
      }
    }
  };

  try {
    const n = Math.min(cfg.concurrency, queue.length);
    await Promise.all(Array.from({ length: n }, () => worker()));
  } finally {
    flush();
    releaseLock(cfg.lockFile);
  }

  printReport(cfg, runtime, totals);
  if (totals.failed > 0) {
    console.warn("[ai] 有文章生成失败：已保留旧结果或回退普通导读，部署不受阻断；冷却期结束后下次构建自动重试。");
  }
  return { code: 0 };
}

module.exports = { run };
