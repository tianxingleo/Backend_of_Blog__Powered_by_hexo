#!/usr/bin/env node
"use strict";

// Build-time AI: one request for each changed article, zero model requests from visitors.
// Generated data is checked into source/_data for incremental reuse across machines/CI.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const POST_DIR = path.join(ROOT, "source", "_posts");
const OUTPUT = path.join(ROOT, "source", "_data", "ai_summaries.json");
const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-flash";
const PROMPT_VERSION = "static-ai-v1";
const FORCE = process.env.AI_FORCE_REBUILD === "1";

function listPosts(dir, relative = "") {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const name = path.posix.join(relative, entry.name);
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listPosts(full, name) : /\.md$/i.test(entry.name) ? [{ full, name }] : [];
  }).sort((a, b) => a.name.localeCompare(b.name));
}

function parsePost(raw, filename) {
  const front = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  const meta = front ? front[1] : "";
  const body = front ? raw.slice(front[0].length) : raw;
  const match = meta.match(/^title:\s*(.+)\s*$/m);
  const title = match ? match[1].trim().replace(/^['"]|['"]$/g, "") : filename.replace(/\.md$/i, "");
  const disabled = /^ai:\s*(false|no|off)\s*$/im.test(meta) || /^published:\s*false\s*$/im.test(meta);
  return { title, body, disabled };
}

function cleanMarkdown(text) {
  return text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^\s*(?:#{1,6}|>|[-*+] )\s*/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function excerpt(text) {
  const paragraphs = text.split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
  const prose = paragraphs.find((s) => s.length >= 45 && !/^[|:=-]+$/.test(s)) || paragraphs.join(" ");
  return (prose || "暂无文章导读").slice(0, 220);
}

async function generateWithDeepSeek(title, text) {
  // Include the beginning and the end instead of silently losing conclusions.
  const context = text.length > 11000 ? text.slice(0, 8500) + "\n[中间内容略]\n" + text.slice(-2500) : text;
  const instruction = [
    "你是个人技术博客的编辑。请仅依据文章内容生成严谨的中文摘要和2至3组常见问题。",
    "不要臆测论文结果、性能数据、代码效果或作者经历；不确定就不写。",
    "严格返回 JSON 对象，结构：",
    '{"summary":"100到220字、清楚概括核心思路和适用范围","qa":[{"q":"读者可能提出的问题","a":"可以从文中找到依据的简洁答案"}]}',
    "JSON 中不要使用 Markdown 代码围栏；问答内容不得超出原文事实。",
  ].join("\n");
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: false,
      thinking: { type: "disabled" },
      response_format: { type: "json_object" },
      max_tokens: 1100,
      messages: [
        { role: "system", content: instruction },
        { role: "user", content: "标题：" + title + "\n正文：\n" + context },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok) throw new Error("DeepSeek HTTP " + response.status);
  const data = await response.json();
  const message = data.choices && data.choices[0] && data.choices[0].message;
  if (!message || !message.content) throw new Error("Empty AI response");
  const parsed = JSON.parse(message.content);
  if (typeof parsed.summary !== "string" || parsed.summary.trim().length < 25) {
    throw new Error("Invalid AI summary");
  }
  return {
    summary: parsed.summary.trim().slice(0, 550),
    qa: (Array.isArray(parsed.qa) ? parsed.qa : [])
      .filter((v) => v && typeof v.q === "string" && typeof v.a === "string")
      .slice(0, 3)
      .map((v) => ({ q: v.q.trim().slice(0, 140), a: v.a.trim().slice(0, 550) })),
  };
}

async function main() {
  const existing = fs.existsSync(OUTPUT) ? JSON.parse(fs.readFileSync(OUTPUT, "utf8")) : {};
  const old = existing.entries || {};
  const next = {};
  let reused = 0, aiGenerated = 0, fallbacks = 0;
  for (const post of listPosts(POST_DIR)) {
    const raw = fs.readFileSync(post.full, "utf8");
    const { title, body, disabled } = parsePost(raw, post.name);
    if (disabled) continue;
    const text = cleanMarkdown(body);
    if (!text) continue;
    const sourceHash = crypto.createHash("sha256")
      .update(PROMPT_VERSION + "\n" + title + "\n" + text).digest("hex");
    const id = "_posts/" + post.name;
    const cached = old[id];
    if (!FORCE && cached && cached.sourceHash === sourceHash &&
        (!API_KEY || (cached.kind === "model" && cached.model === MODEL))) {
      next[id] = cached;
      reused++;
      continue;
    }

    let generated = null;
    if (API_KEY) {
      try {
        generated = await generateWithDeepSeek(title, text);
      } catch (error) {
        console.warn("[static-ai] " + post.name + ": " + error.message + " (using excerpt)");
      }
    }
    if (generated) {
      next[id] = {
        title, sourceHash, kind: "model", model: MODEL,
        summary: generated.summary, qa: generated.qa,
      };
      aiGenerated++;
    } else {
      next[id] = { title, sourceHash, kind: "excerpt", summary: excerpt(text), qa: [] };
      fallbacks++;
    }
  }
  const output = JSON.stringify({ version: 1, entries: next }, null, 2) + "\n";
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  if (!fs.existsSync(OUTPUT) || fs.readFileSync(OUTPUT, "utf8") !== output) {
    fs.writeFileSync(OUTPUT, output, "utf8");
  }
  console.info("[static-ai] reused=" + reused + ", generated=" + aiGenerated +
    ", excerpts=" + fallbacks + ", total=" + Object.keys(next).length);
  if (!API_KEY) console.info("[static-ai] Set DEEPSEEK_API_KEY in your build environment to generate AI summaries.");
}

main().catch((error) => {
  console.error("[static-ai]", error.message);
  process.exitCode = 1;
});
