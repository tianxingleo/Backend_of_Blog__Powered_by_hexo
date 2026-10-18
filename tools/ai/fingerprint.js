"use strict";

const { sha256, canonicalJson } = require("./util");
const { PROMPT_VERSION } = require("./prompt");

const POLICY_VERSION = "incremental-v1";

// Markdown 正规化：只处理换行符、行尾空白和多余空行，
// 保留代码块、公式、英文与列表结构，避免无关格式变化触发重新生成。
function normalizeMarkdown(text) {
  return String(text || "")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map(line => line.replace(/[ \t]+$/, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function toStringArray(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    return value
      .flat(Infinity)
      .map(v => String(v).trim())
      .filter(Boolean);
  }
  const s = String(value).trim();
  return s ? [s] : [];
}

// 内容指纹只覆盖 AI 真正消费的输入；modelId 取主通道模型，
// 更换主模型会触发全量重算，回退通道生成不会。
function computeFingerprint({ title, description, tags, categories, normalizedBody }, modelId) {
  return sha256(
    canonicalJson({
      title: String(title || "").trim(),
      description: String(description || "").trim(),
      tags: toStringArray(tags).sort(),
      categories: toStringArray(categories).sort(),
      normalizedMarkdownBody: normalizedBody,
      summaryPromptVersion: PROMPT_VERSION,
      modelId: modelId || "none",
      generationPolicyVersion: POLICY_VERSION,
    })
  );
}

module.exports = { normalizeMarkdown, computeFingerprint, toStringArray, POLICY_VERSION };
