"use strict";

const path = require("path");
const fs = require("fs");

let dotenvLoaded = false;
function ensureDotenv() {
  if (dotenvLoaded) return;
  dotenvLoaded = true;
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  try {
    require("dotenv").config({ path: envPath });
  } catch (_err) {
    // dotenv 未安装时退回进程环境变量
  }
}

function toInt(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.round(n), min), max);
}

function toFloat(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const ROOT = process.cwd();

function loadConfig() {
  ensureDotenv();
  const warnings = [];

  const order = (process.env.AI_PROVIDER_ORDER || "opencode,deepseek")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const providers = [];
  let fingerprintModelId = "none";
  for (const name of order) {
    const prefix = name.toUpperCase();
    const apiKey = process.env[`${prefix}_API_KEY`];
    const baseUrl = (process.env[`${prefix}_BASE_URL`] || "").replace(/\/+$/, "");
    const model = process.env[`${prefix}_MODEL`];
    const session = process.env[`${prefix}_SESSION`] || "";
    // 指纹模型取配置顺序中首个定义完整的提供方，与密钥是否可用无关，
    // 保证无密钥机器（如 CI 缓存复用、新克隆）与有密钥机器算出同一指纹
    if (fingerprintModelId === "none" && baseUrl && model) {
      fingerprintModelId = `${name}:${model}`;
    }
    if (!apiKey) {
      warnings.push(`提供方 ${name} 未配置 API key，已跳过`);
      continue;
    }
    if (!baseUrl || !model) {
      warnings.push(`提供方 ${name} 缺少 BASE_URL 或 MODEL，已跳过`);
      continue;
    }
    providers.push({ name, baseUrl, apiKey, model, session });
  }

  return {
    root: ROOT,
    enabled: (process.env.AI_ENABLED || "true") !== "false",
    concurrency: toInt(process.env.AI_CONCURRENCY, 3, { min: 1, max: 16 }),
    maxRetries: toInt(process.env.AI_MAX_RETRIES, 2, { min: 0, max: 5 }),
    requestTimeoutMs: toInt(process.env.AI_REQUEST_TIMEOUT_MS, 60000, { min: 5000, max: 600000 }),
    maxInputChars: toInt(process.env.AI_MAX_INPUT_CHARS, 15000, { min: 1000, max: 200000 }),
    maxOutputTokens: toInt(process.env.AI_MAX_OUTPUT_TOKENS, 1000, { min: 100, max: 8000 }),
    maxRequestsPerBuild: toInt(process.env.AI_MAX_REQUESTS_PER_BUILD, 30, { min: 1 }),
    maxTokensPerBuild: toInt(process.env.AI_MAX_TOKENS_PER_BUILD, 100000, { min: 1000 }),
    pricePerMtokInput: toFloat(process.env.AI_PRICE_PER_MTOK_INPUT, 0),
    pricePerMtokOutput: toFloat(process.env.AI_PRICE_PER_MTOK_OUTPUT, 0),
    providers,
    fingerprintModelId,
    warnings,
    postsDir: path.join(ROOT, "source", "_posts"),
    sourceDir: path.join(ROOT, "source"),
    cacheFile: path.join(ROOT, "source", "_data", "ai_summaries.json"),
    lockFile: path.join(ROOT, "tools", "ai", ".generate.lock"),
  };
}

module.exports = { loadConfig };
