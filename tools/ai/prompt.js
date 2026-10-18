"use strict";

const PROMPT_VERSION = "zh-summary-qa-v1";

function buildMessages(post, maxInputChars) {
  const meta = [
    `标题：${post.title || "（无标题）"}`,
    post.description ? `作者导读：${post.description}` : "",
    post.tags && post.tags.length ? `标签：${post.tags.join("、")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let body = post.body || "";
  let truncated = false;
  if (body.length > maxInputChars) {
    body = body.slice(0, maxInputChars);
    truncated = true;
  }

  const user =
    "请阅读下面这篇博客文章，为它生成中文导读和常见问答。\n\n" +
    meta +
    "\n\n===== 正文（Markdown）=====\n" +
    body +
    (truncated ? "\n（正文较长，此处为截断版本）" : "") +
    "\n===== 正文结束 =====\n\n" +
    "要求：\n" +
    "1. summary：100～200 字中文导读，概括文章实际内容，不夸大、不引入文章之外的信息。\n" +
    "2. highlights：2～4 条关键点，每条不超过 30 字。\n" +
    "3. qa：2～3 组读者最可能提出的问题与回答，回答必须仅依据文章内容。\n" +
    '4. 只输出一个 JSON 对象，不要输出任何其他文字，格式：{"summary": "...", "highlights": ["..."], "qa": [{"q": "...", "a": "..."}]}';

  const system =
    "你是博客文章的阅读助手，任务是为文章生成高质量的中文摘要和常见问答。" +
    "你只依据用户提供的文章内容作答，绝不编造文章中不存在的信息。输出必须是严格的 JSON。";

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

function buildRepairMessages(messages, reason) {
  return messages.concat([
    {
      role: "user",
      content: `你上一次的输出未通过校验（${reason}）。请重新输出，且只输出一个符合格式要求的 JSON 对象，不要包含任何解释文字或代码块围栏。`,
    },
  ]);
}

module.exports = { buildMessages, buildRepairMessages, PROMPT_VERSION };
