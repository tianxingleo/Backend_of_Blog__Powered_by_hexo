"use strict";

const crypto = require("crypto");

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

// 稳定序列化：对象键排序，数组保持顺序，保证同一输入永远得到同一字符串
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

function nowIso() {
  return new Date().toISOString();
}

function truncate(text, n) {
  const s = String(text || "");
  return s.length > n ? s.slice(0, n) + "…" : s;
}

module.exports = { sha256, canonicalJson, nowIso, truncate };
