"use strict";

// 可选参数降级档位：个别网关不认识 response_format / thinking 时按 400 自动降级，
// 降级结果对整个构建周期生效，避免每篇文章都重复踩坑。
const PARAM_VARIANTS = [
  { jsonMode: true, thinkingOff: true },
  { jsonMode: true, thinkingOff: false },
  { jsonMode: false, thinkingOff: false },
];

const MAX_BACKOFF_MS = 15000;
const MAX_RETRY_AFTER_MS = 30000;

function createRuntime() {
  return {
    requestCount: 0,
    variantLevel: {}, // 提供方名 -> 参数档位
    authFailed: {}, // 提供方名 -> 本次构建内停用
    byProvider: {}, // 提供方名 -> { requests, ok, promptTokens, completionTokens, totalTokens }
  };
}

function recordAttempt(runtime, providerName) {
  runtime.requestCount += 1;
  const p = (runtime.byProvider[providerName] =
    runtime.byProvider[providerName] ||
    { requests: 0, ok: 0, promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  p.requests += 1;
}

function recordUsage(runtime, providerName, usage) {
  if (!usage) return;
  const p = runtime.byProvider[providerName] || (runtime.byProvider[providerName] = {});
  p.promptTokens += usage.prompt_tokens || 0;
  p.completionTokens += usage.completion_tokens || 0;
  p.totalTokens += usage.total_tokens || 0;
}

function recordOk(runtime, providerName) {
  const p = runtime.byProvider[providerName];
  if (p) p.ok += 1;
}

function backoffDelay(attempt, retryAfterMs) {
  if (retryAfterMs != null && Number.isFinite(retryAfterMs)) {
    return Math.min(retryAfterMs, MAX_RETRY_AFTER_MS);
  }
  return Math.min(1000 * Math.pow(2, attempt), MAX_BACKOFF_MS) + Math.floor(Math.random() * 500);
}

function parseRetryAfter(header) {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return secs * 1000;
  const date = Date.parse(header);
  if (Number.isFinite(date)) return date - Date.now();
  return null;
}

async function safeText(res) {
  try {
    return (await res.text()).slice(0, 200);
  } catch (_err) {
    return "";
  }
}

/**
 * 单提供方对话补全：超时 / 429 / 5xx / 网络错误按指数退避重试；
 * 400 触发参数降级；401/403 将该提供方标记为本次构建不可用。
 * budget.isExhausted() 为真时中止，返回 budget: true（不算失败）。
 */
async function callChat({ provider, messages, maxOutputTokens, timeoutMs, maxRetries, runtime, budget }) {
  let attempt = 0;
  while (true) {
    if (budget && budget.isExhausted()) {
      return { ok: false, budget: true, reason: "本次构建请求/token 预算已用尽" };
    }

    const level = Math.min(runtime.variantLevel[provider.name] || 0, PARAM_VARIANTS.length - 1);
    const variant = PARAM_VARIANTS[level];
    const body = { model: provider.model, messages, max_tokens: maxOutputTokens };
    if (variant.jsonMode) body.response_format = { type: "json_object" };
    if (variant.thinkingOff) body.thinking = { type: "disabled" };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(provider.baseUrl + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
          ...(provider.session ? { "x-opencode-session": provider.session } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      recordAttempt(runtime, provider.name);
      const reason = err && err.name === "AbortError" ? `请求超时（${timeoutMs}ms）` : `网络错误: ${err.message}`;
      if (attempt < maxRetries) {
        await sleep(backoffDelay(attempt, null));
        attempt += 1;
        continue;
      }
      return { ok: false, retryable: true, reason: `${provider.name}: ${reason}` };
    }
    clearTimeout(timer);
    recordAttempt(runtime, provider.name);

    if (res.status === 200) {
      let json = null;
      try {
        json = await res.json();
      } catch (_err) {
        /* 走内容为空分支 */
      }
      const content =
        json && json.choices && json.choices[0] && json.choices[0].message
          ? json.choices[0].message.content
          : null;
      recordUsage(runtime, provider.name, json && json.usage);
      if (typeof content !== "string" || !content.trim()) {
        if (attempt < maxRetries) {
          await sleep(backoffDelay(attempt, null));
          attempt += 1;
          continue;
        }
        return { ok: false, retryable: true, reason: `${provider.name}: 返回内容为空` };
      }
      recordOk(runtime, provider.name);
      return { ok: true, content, usage: (json && json.usage) || null, provider: provider.name };
    }

    if (res.status === 400) {
      const errText = await safeText(res);
      if (level < PARAM_VARIANTS.length - 1 && /response_format|thinking|param|parameter|invalid|unsupported|not supported/i.test(errText)) {
        runtime.variantLevel[provider.name] = level + 1;
        console.warn(`[ai] ${provider.name} 不支持当前参数组合，降级重试（档位 ${level + 1}）`);
        continue; // 参数降级不消耗重试次数
      }
      return { ok: false, retryable: false, reason: `${provider.name}: 400 ${errText}` };
    }

    if (res.status === 401 || res.status === 403) {
      runtime.authFailed[provider.name] = true;
      const errText = await safeText(res);
      return { ok: false, retryable: false, reason: `${provider.name}: ${res.status} 鉴权失败，本次构建内停用该提供方（${errText}）` };
    }

    if (res.status === 429 || res.status === 408 || res.status >= 500) {
      const retryAfterMs = parseRetryAfter(res.headers.get("retry-after"));
      if (attempt < maxRetries) {
        await sleep(backoffDelay(attempt, retryAfterMs));
        attempt += 1;
        continue;
      }
      const errText = await safeText(res);
      return { ok: false, retryable: true, reason: `${provider.name}: ${res.status} ${errText}` };
    }

    const errText = await safeText(res);
    return { ok: false, retryable: false, reason: `${provider.name}: ${res.status} ${errText}` };
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { callChat, createRuntime };
