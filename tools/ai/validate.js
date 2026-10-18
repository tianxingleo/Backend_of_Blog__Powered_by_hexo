"use strict";

function str(v) {
  return typeof v === "string" ? v.trim() : "";
}

// 容错解析：模型可能带 ```json 围栏或前后杂文字
function parseModelJson(content) {
  const text = String(content || "").trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fence ? fence[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return { ok: false, errors: ["输出中没有 JSON 对象"] };
  }
  try {
    return { ok: true, value: JSON.parse(candidate.slice(start, end + 1)) };
  } catch (err) {
    return { ok: false, errors: ["JSON 解析失败: " + err.message] };
  }
}

// 结构校验 + 轻度清洗：过滤超长、空串与多余条目，宁可少一条也不要脏数据
function validateAndClean(raw) {
  const errors = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, errors: ["根节点不是 JSON 对象"] };
  }

  const summary = str(raw.summary);
  if (summary.length < 30) errors.push(`summary 过短（${summary.length} 字）`);
  if (summary.length > 600) errors.push(`summary 超过 600 字（${summary.length} 字）`);

  let highlights = [];
  if (raw.highlights !== undefined && raw.highlights !== null) {
    if (!Array.isArray(raw.highlights)) errors.push("highlights 不是数组");
    else highlights = raw.highlights.map(str).filter(s => s && s.length <= 60).slice(0, 6);
  }

  let qa = [];
  if (!Array.isArray(raw.qa)) {
    errors.push("qa 不是数组");
  } else {
    qa = raw.qa
      .map(item => {
        if (!item || typeof item !== "object") return null;
        const q = str(item.q);
        const a = str(item.a);
        if (!q || !a || q.length > 120 || a.length > 600) return null;
        return { q, a };
      })
      .filter(Boolean);
    if (qa.length < 1) errors.push("qa 没有合法条目");
    else qa = qa.slice(0, 4);
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: { summary, highlights, qa } };
}

module.exports = { parseModelJson, validateAndClean };
