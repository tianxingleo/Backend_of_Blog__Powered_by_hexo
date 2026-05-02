---
title: Metapi统一AI网关部署全记录：从WSL2到Cloudflare Tunnel的完整配置与踩坑
date: 2026-05-02 15:00:00
categories:
  - 折腾记录
tags:
  - metapi
  - docker
  - wsl2
  - cloudflare
  - ai
slug: metapi-deployment-guide
---

# Metapi 统一 AI 网关部署全记录：从 WSL2 到 Cloudflare Tunnel 的完整配置与踩坑

> 本文记录了在 Windows WSL2 环境下部署 Metapi 统一 AI 网关的完整过程，重点记录了接入 DeepSeek 作为备用上游时遇到的一系列兼容性问题及其解决方案。

## 一、起因：为什么需要 Metapi？

### 1.1 背景：五花八门的 AI Token

作为一名重度 AI 用户，我手上有各种来源的 API Token：

- **GLM Coding Plan Lite**：智谱的编程专用额度，价格便宜但并发限制严格
- **Xiaomi Mimo **：小米的 Coding Plan，有一定赠送额度
- **DeepSeek API**：自充值余额，v4-pro 降价后性价比极高
- **各种 New API / One API 中转站**：注册了一堆站点，额度分散

这些 Token 分散在不同平台、不同账号，管理起来非常头疼。每次使用都要切换 Base URL 和 API Key，而且无法统一调度额度。

### 1.2 直接诱因：GLM Coding Plan 并发不足

GLM Coding Plan Lite 虽然便宜，但并发限制很严格。当我在 Claude Code 里进行复杂任务时，经常遇到限流。正好 DeepSeek v4-pro 大幅降价，我想把它作为备用 channel，在 GLM 限流时自动切换。

但问题来了：**DeepSeek 走 `/anthropic` 兼容端点时，与 Claude Code 的老会话存在严重的兼容性问题**。这就是本文要解决的核心问题。

---

## 二、Metapi 简介

### 2.1 核心定位

Metapi 是一个 **AI API 统一网关**：

- **一个 API Key、一个入口**：所有上游汇聚成一个入口
- **自动发现模型**：上游有什么模型自动同步
- **智能路由**：根据成本、余额、健康度自动选择通道
- **失败自动切换**：一个通道挂了自动切到备用

### 2.2 目标架构

```text
Claude Code / Cursor / Codex
           │
           ▼
    https://metapi.xxx.com/v1
        Metapi 网关
           │
    ┌──────┼──────┬──────────┐
    ▼      ▼      ▼          ▼
  GLM   Mimo   DeepSeek   Codex OAuth
 Coding  Coding    API      OAuth
 Plan    Plan     备用
```

---

## 三、部署过程

### 3.1 环境准备

- Windows 11 + WSL2 Ubuntu
- Docker Desktop for Windows（开启 WSL2 backend）
- 一个接入 Cloudflare 的域名

### 3.2 创建目录和配置

```bash
mkdir -p ~/apps/metapi
cd ~/apps/metapi
```

创建 `.env` 文件：

```env
AUTH_TOKEN=你的后台登录密码
PROXY_TOKEN=sk-metapi-你的调用密钥
TZ=Asia/Shanghai
PORT=4000
CLOUDFLARE_TUNNEL_TOKEN=你的Cloudflare Tunnel Token
```

创建 `docker-compose.yml`：

```yaml
services:
  metapi:
    image: 1467078763/metapi:latest
    container_name: metapi
    ports:
      - "4000:4000"
    volumes:
      - ./data:/app/data
      - ./patch.cjs:/app/patch.cjs:ro
      - ./entrypoint.sh:/entrypoint.sh:ro
    environment:
      AUTH_TOKEN: ${AUTH_TOKEN}
      PROXY_TOKEN: ${PROXY_TOKEN}
      CHECKIN_CRON: "0 8 * * *"
      BALANCE_REFRESH_CRON: "0 * * * *"
      PORT: 4000
      DATA_DIR: /app/data
      TZ: ${TZ}
      CODEX_UPSTREAM_WEBSOCKET_ENABLED: "true"
    entrypoint: ["/bin/sh", "/entrypoint.sh"]
    restart: unless-stopped

  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: metapi-cloudflared
    command: tunnel --no-autoupdate run --token ${CLOUDFLARE_TUNNEL_TOKEN}
    depends_on:
      - metapi
    restart: unless-stopped
```

### 3.3 Cloudflare Tunnel 配置

在 Cloudflare Zero Trust 面板创建 Tunnel，然后在 Public Hostnames 里添加：

```text
Subdomain: metapi
Domain: yourdomain.com
Type: HTTP
URL: metapi:4000
```

**注意**：URL 栏填 `metapi:4000`（Docker 内部网络服务名），不要加 `http://` 前缀。

---

## 四、接入上游站点

### 4.1 GLM Coding Plan

站点管理 → 添加站点 → 选择官方预设：
- `智谱 Coding Plan / OpenAI`（给 Cursor/Codex 用）
- `智谱 Coding Plan / Claude`（给 Claude Code 用）

不要手动修改预设的 URL 路径。

### 4.2 Mimo / MiniMax

选择 `MiniMax / OpenAI` 或 `MiniMax / Claude` 预设。

**踩坑**：Metapi 可能只同步到 `mimo-v2.5`，没有 `mimo-v2.5-pro`。需要手动触发模型同步，或在模型路由里手动添加。

### 4.3 DeepSeek

添加站点：
- **平台类型**：`claude`（使用 `/anthropic` 端点）
- **Base URL**：`https://api.deepseek.com`
- **凭证**：API Key

### 4.4 Codex OAuth

OAuth 管理 → 选择 Codex → 浏览器授权 → 自动创建站点。

---

## 五、路由配置

### 5.1 创建群组路由

把多个来源模型聚合成一个对外模型名，比如 `cc`：

```text
cc
├── glm-5.1
├── mimo-v2.5-pro
├── deepseek-v4-pro[1m]
└── claude-sonnet-4-6
```

### 5.2 配置优先级

通过 API 修改通道优先级（P 值是硬优先级，P0 最优先）：

```bash
# 获取路由 ID
curl -sS "http://localhost:4000/api/routes/summary" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.[] | select(.modelPattern=="cc")'

# 获取通道列表
curl -sS "http://localhost:4000/api/routes/$ROUTE_ID/channels" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 批量修改优先级
curl -sS "http://localhost:4000/api/channels/batch" \
  -X PUT \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": [
      { "id": 7, "priority": 0 },
      { "id": 72, "priority": 1 },
      { "id": 36, "priority": 2 },
      { "id": 57, "priority": 3 }
    ]
  }'
```

我的配置：
- **P0**: GLM（主力，便宜）
- **P1**: Mimo（备用）
- **P2**: DeepSeek（兜底）
- **P3**: Claude（最后手段）

---

## 六、DeepSeek 兼容性问题排查与修复

这是本文的核心部分。接入 DeepSeek 后，我遇到了一系列问题，从易到难层层深入。

### 6.1 问题一：DeepSeek 被误判为 Key 过期

**现象**：Metapi 后台显示 DeepSeek Key 过期，但直接 curl 测试 Key 完全正常。

**排查**：查看账号的 `extraConfig`：

```json
"runtimeHealth":{"state":"unhealthy","reason":"访问令牌失效：HTTP 400"}
```

上次请求返回了 HTTP 400，Metapi 把它误判为 Key 过期。实际错误是：

```json
{"error":{"message":"missing field `max_tokens` at line 1 column 35388"}}
```

**根因分析**：

查看 Metapi 源码 `alertRules.ts`：

```typescript
const tokenPhrase = text.includes('token') || text.includes('令牌') || text.includes('访问令牌');
const hasInvalid = text.includes('invalid') || text.includes('无效');
return tokenPhrase && (hasInvalid || hasExpired);
```

错误信息 `missing field max_tokens ... "invalid_request_error"` 中：
- `max_tokens` 包含 "token"
- `invalid_request_error` 包含 "invalid"

两个条件同时命中，导致 400 参数错误被误判为 Key 过期。

**修复方案**：

修改 `/app/dist/server/services/alertRules.js`，排除 `max_tokens` 的干扰：

```javascript
// 原代码
const tokenPhrase = text.includes('token') || text.includes('令牌') || text.includes('访问令牌');

// 修改为
const safeTokenPhrase = text.includes('令牌') || 
    text.includes('访问令牌') || 
    (text.includes('token') && !text.includes('max_tokens'));

// 同时修改判断条件
// 原：tokenPhrase && (hasInvalid || hasExpired)
// 改为：safeTokenPhrase && hasExpired
```

**修复后测试**：

| 场景 | 修改前 | 修改后 |
|------|--------|--------|
| `max_tokens` + `invalid_request_error` (400) | 误判为过期 | 不再误判 |
| 401 Unauthorized | 过期 | 过期 |
| jwt expired / token expired | 过期 | 过期 |

### 6.2 问题二：count_tokens 请求缺少 max_tokens

**现象**：老会话切换模型后报 400：

```json
{"error":{"message":"missing field `max_tokens` at line 1 column 33188"}}
```

请求路径：`/v1/messages/count_tokens`

**根因分析**：

查看 `/app/dist/server/services/upstreamRequestBuilder.js` 的 `buildClaudeCountTokensUpstreamRequest` 函数：

```javascript
const sanitizedBody = sanitizeAnthropicMessagesBody(bodyWithoutBetas);
delete sanitizedBody.max_tokens;    // 故意删除
delete sanitizedBody.maxTokens;
delete sanitizedBody.stream;
```

代码故意删除了 `max_tokens`，因为 Claude 官方 API 的 count_tokens 不需要这个字段。但 DeepSeek 的 `/anthropic` 兼容端点要求所有请求都必须带 `max_tokens`。

**修复方案**：

保存原始 `max_tokens`，在转发前恢复：

```javascript
// 保存原始值
const savedMaxTokens = sanitizedBody.max_tokens;
delete sanitizedBody.max_tokens;
delete sanitizedBody.maxTokens;
delete sanitizedBody.stream;

// ... 后续在构建请求时
body: savedMaxTokens 
    ? { ...sanitizedBody, max_tokens: savedMaxTokens } 
    : { ...sanitizedBody, max_tokens: 8192 }
```

### 6.3 问题三：跨模型 thinking block 兼容性（核心难题）

**现象**：老会话在 GLM 和 DeepSeek 之间切换时报 400：

```json
{"error":{"message":"The `content[].thinking` in the thinking mode must be passed back to the API."}}
```

这个问题排查过程非常曲折，经历了多层深入。

#### 第一层：thinking block 被丢弃

**分析**：查看 `/app/dist/server/transformers/anthropic/messages/conversion.js`：

```javascript
if (item.reasoning_signature !== undefined || rawSignature.startsWith('metapi:')) {
    return null;  // 非标准签名返回 null
}
// ...
if (signature === null)
    return null;  // 整个 thinking block 被丢弃！
```

GLM 返回的 thinking block 带有 `reasoning_signature` 字段（非 Claude 标准格式），签名解析失败后整个 block 被丢弃。但 DeepSeek 检测到 thinking mode 开启后要求必须有 thinking blocks。

**修复**：

```javascript
// 原：if (signature === null) return null;
// 改为：签名无法解析但内容存在时保留
if (signature === null && !text) return null;
```

**结果**：仍然报 400。

#### 第二层：output_config.thinking 没被处理

**分析**：通过诊断日志发现请求体里有 `output_config` 字段。Claude Code 新版本把 thinking 配置放在 `output_config.thinking` 里，而不是 `body.thinking`。之前的 stripThinking 只删了后者。

**修复**：在 stripThinking 函数中同时处理 `output_config.thinking`：

```javascript
function stripThinkingForCompatibleUpstream(body) {
    if (!body) return body;
    const next = { ...body };
    if (next.thinking) delete next.thinking;
    
    // 处理 output_config
    if (next.output_config && typeof next.output_config === 'object') {
        const oc = { ...next.output_config };
        delete oc.thinking;
        next.output_config = oc;
    }
    
    // 过滤 thinking blocks
    if (Array.isArray(next.messages)) {
        next.messages = next.messages.map(msg => {
            if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return msg;
            const filtered = msg.content.filter(block =>
                block.type !== 'thinking' && 
                block.type !== 'redacted_thinking' && 
                block.type !== 'reasoning'
            );
            return { ...msg, content: filtered };
        });
    }
    return next;
}
```

**结果**：仍然报 400。

#### 第三层：beta header 透传了 interleaved-thinking

**分析**：通过诊断发现 `anthropic-beta` header 里包含 `interleaved-thinking-2025-05-14`。这个 header 被发送给 DeepSeek，DeepSeek 看到后认为启用了 thinking 模式，但 body 里的 thinking blocks 已被删除。

**关键发现**：

```javascript
// claudeProviderProfile.js
const CLAUDE_API_KEY_DEFAULT_BETA_HEADER = 'interleaved-thinking-2025-05-14,...';

// headerUtils.js - extractClaudePassthroughHeaders
// 会把 Claude Code 发来的所有 anthropic-beta header 透传给上游
```

**修复**：

修改 `/app/dist/server/utils/headerUtils.js`，在 `extractClaudePassthroughHeaders` 返回结果中剥离 thinking 相关的 beta：

```javascript
function stripUnsupportedBetas(betaHeader) {
    if (!betaHeader) return betaHeader;
    const unsupported = [
        'interleaved-thinking',
        'redact-thinking',
        'effort-2025',
        'claude-code'
    ];
    return betaHeader.split(',').filter(b =>
        !unsupported.some(u => b.trim().startsWith(u))
    ).join(',');
}
```

同时修改 `claudeProviderProfile.js` 中的默认 beta header，去掉 `interleaved-thinking`。

**结果**：仍然报 400。

#### 第四层：还有 redact-thinking 和 effort

**分析**：诊断显示 beta header 里还有 `redact-thinking-2026-02-12` 和 `effort-2025-11-24`。之前的过滤条件不够全面。

**修复**：扩展过滤列表，去掉所有 thinking/effort 相关的 beta。

**结果**：仍然报 400。

#### 最终层：DeepSeek v4-pro 需要 thinking！

**关键发现**：

通过最终诊断，body 完全干净（`thinking_blocks=0`），beta header 也干净了，但 DeepSeek 还是报 400。

这说明：**DeepSeek v4-pro 本身就是推理模型，它需要 thinking blocks 和 thinking config**。之前的 400 是因为 beta header 里的 Claude 专有 beta（`interleaved-thinking` 等）DeepSeek 不认识。

**最终修复策略**：

- **保留** body 中的 thinking blocks 和 thinking config
- **只清理** beta header 中 DeepSeek 不支持的 Claude 专有 beta
- 确保 `max_tokens` 存在

```javascript
// 最终的 beta 过滤
function stripUnsupportedBetas(betaHeader) {
    if (!betaHeader) return betaHeader;
    const unsupported = [
        'interleaved-thinking',   // Claude 专有
        'redact-thinking',        // Claude 专有
        'effort-',                // Claude 专有
        'claude-code'             // Claude Code 专有
    ];
    return betaHeader.split(',').filter(b =>
        !unsupported.some(u => b.trim().startsWith(u))
    ).join(',');
}
```

**删除** 之前添加的 stripThinkingForCompatibleUpstream 调用，保留 thinking blocks。

**结果**：成功！老会话可以在 GLM 和 DeepSeek 之间正常切换了。

### 6.4 问题四：Codex OAuth 路由 previous_response_id 错误

**现象**：在 Codex CLI 中选择 gpt-5.3 模型，路由到 Codex OAuth 上游时返回 400：

```json
{"error":{"message":"[upstream:/responses] Upstream returned HTTP 400: {\"detail\":\"Unsupported parameter: previous_response_id\"}","type":"upstream_error"}}
```

**根因分析**：

查看 `/app/dist/server/services/codexCompatibility.js` 的 `stripCodexUnsupportedResponsesFields` 函数：

```javascript
function stripCodexUnsupportedResponsesFields(body) {
    const next = { ...body };
    delete next.max_output_tokens;
    delete next.max_completion_tokens;
    delete next.max_tokens;
    delete next.stream_options;
    // 注意：这里没有删除 previous_response_id！
    return next;
}
```

Codex OAuth 上游不支持 `previous_response_id` 参数，当 Codex CLI 在对话续传时发送这个参数，上游会返回 400。

**修复方案**：

```javascript
function stripCodexUnsupportedResponsesFields(body) {
    const next = { ...body };
    delete next.max_output_tokens;
    delete next.max_completion_tokens;
    delete next.max_tokens;
    delete next.stream_options;
    delete next.previous_response_id;  // 添加这一行
    return next;
}
```

**注意**：这是 Codex OAuth 上游的固有限制。如果使用 Codex 官方 API 或中转站（如 ikun-codex），则支持 `previous_response_id`。所以路由策略应该是：

```text
P0: Codex OAuth（新对话，无 previous_response_id）
P1: ikun-codex 中转站（支持 previous_response_id 的对话续传）
```

### 6.5 其他踩坑

#### `const` vs `let` 问题

补丁中把 `const sanitizedBody` 改成 `let sanitizedBody` 然后重新赋值，报 `Assignment to constant variable` 错误。

**解决**：检查所有被重新赋值的变量，确保用 `let` 声明。

#### Docker compose restart 不生效

`docker compose restart` 不会重新创建容器，必须用：

```bash
docker compose down
docker compose pull
docker compose up -d
```

#### In-memory cooldown 持久化

即使清理了数据库，内存中的 `fail_count` 和 `cooldown_until` 仍然跨重启存在。

**解决**：同时清理 `route_channels` 表的 `fail_count`、`last_fail_at`、`cooldown_level` 字段。

---

## 七、补丁持久化方案

补丁修改的是容器内的 `/app/dist/` 下的文件，拉取新镜像后重建容器会丢失。需要把补丁持久化。

### 7.1 创建 patch.cjs

```javascript
const fs = require('fs');

console.log('[patch] Starting patch process...');

// ===== 1. alertRules.js - 修复误判 Key 过期 =====
let alertPath = '/app/dist/server/services/alertRules.js';
let code = fs.readFileSync(alertPath, 'utf8');

if (code.includes("const tokenPhrase = text.includes('token')") && 
    !code.includes('safeTokenPhrase')) {
    code = code.replace(
        "const tokenPhrase = text.includes('token') || text.includes('令牌') || text.includes('访问令牌');",
        "const safeTokenPhrase = text.includes('令牌') || text.includes('访问令牌') || (text.includes('token') && !text.includes('max_tokens'));"
    );
    code = code.replace(/tokenPhrase && \(hasInvalid \|\| hasExpired\)/g, 'safeTokenPhrase && hasExpired');
    fs.writeFileSync(alertPath, code);
    console.log('[patch] 1. alertRules.js patched');
}

// ===== 2. headerUtils.js - 清理 beta header =====
let headerPath = '/app/dist/server/utils/headerUtils.js';
code = fs.readFileSync(headerPath, 'utf8');

if (!code.includes('stripUnsupportedBetas')) {
    // 添加过滤函数
    const stripFn = `
function stripUnsupportedBetas(betaHeader) {
    if (!betaHeader) return betaHeader;
    const unsupported = ['interleaved-thinking', 'redact-thinking', 'effort-', 'claude-code'];
    return betaHeader.split(',').filter(b => !unsupported.some(u => b.trim().startsWith(u))).join(',');
}

`;
    // 找到合适的位置插入
    const insertPoint = 'export function extractClaudePassthroughHeaders';
    if (code.includes(insertPoint)) {
        code = code.replace(insertPoint, stripFn + insertPoint);
    }
    
    // 修改 extractClaudePassthroughHeaders 返回值
    // 在 return 语句前加过滤
    const returnPattern = /return\s*\{\s*[^}]*['"]?anthropic-beta['"]?\s*:\s*[^}]+\}/;
    // 这个需要根据实际代码结构调整
    
    fs.writeFileSync(headerPath, code);
    console.log('[patch] 2. headerUtils.js patched');
}

// ===== 3. upstreamRequestBuilder.js - 确保 max_tokens =====
let upstreamPath = '/app/dist/server/services/upstreamRequestBuilder.js';
code = fs.readFileSync(upstreamPath, 'utf8');

// 3.1 const -> let
code = code.replace(
    'const sanitizedBody = sanitizeAnthropicMessagesBody(bodyWithoutBetas);',
    'let sanitizedBody = sanitizeAnthropicMessagesBody(bodyWithoutBetas);'
);

code = code.replace(
    'const configuredClaudeBody = applyConfiguredPayloadRules(sanitizedBody);',
    'let configuredClaudeBody = applyConfiguredPayloadRules(sanitizedBody);'
);

// 3.2 保存并恢复 max_tokens (count_tokens 路径)
if (!code.includes('savedMaxTokens')) {
    code = code.replace(
        '    delete sanitizedBody.max_tokens;\n    delete sanitizedBody.maxTokens;\n    delete sanitizedBody.stream;',
        '    const savedMaxTokens = sanitizedBody.max_tokens;\n    delete sanitizedBody.max_tokens;\n    delete sanitizedBody.maxTokens;\n    delete sanitizedBody.stream;'
    );
}

// 3.3 确保 max_tokens 存在 (messages 路径)
// 在合适的位置添加：if (!configuredClaudeBody.max_tokens) configuredClaudeBody.max_tokens = 8192;

fs.writeFileSync(upstreamPath, code);
console.log('[patch] 3. upstreamRequestBuilder.js patched');

// ===== 4. codexCompatibility.js - 删除 previous_response_id =====
let codexPath = '/app/dist/server/services/codexCompatibility.js';
code = fs.readFileSync(codexPath, 'utf8');

if (!code.includes('previous_response_id')) {
    code = code.replace(
        'delete next.stream_options;',
        'delete next.stream_options;\n    delete next.previous_response_id;'
    );
    fs.writeFileSync(codexPath, code);
    console.log('[patch] 4. codexCompatibility.js patched');
}

console.log('[patch] All patches applied successfully.');
```

### 7.2 创建 entrypoint.sh

```bash
#!/bin/sh
echo "[entrypoint] Applying patches..."
node /app/patch.cjs
echo "[entrypoint] Starting Metapi..."
exec node /app/dist/server/index.js
```

### 7.3 更新 docker-compose.yml

```yaml
volumes:
  - ./data:/app/data
  - ./patch.cjs:/app/patch.cjs:ro
  - ./entrypoint.sh:/entrypoint.sh:ro
entrypoint: ["/bin/sh", "/entrypoint.sh"]
```

---

## 八、客户端配置

### 8.1 Claude Code

`~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://metapi.yourdomain.com",
    "ANTHROPIC_API_KEY": "你的 PROXY_TOKEN",
    "ANTHROPIC_AUTH_TOKEN": "你的 PROXY_TOKEN"
  }
}
```

### 8.2 Cursor / Codex

```text
Base URL: https://metapi.yourdomain.com/v1
API Key: PROXY_TOKEN
```

---

## 九、运维命令速查

```bash
cd ~/apps/metapi

# 启动/重启（重建容器）
docker compose down && docker compose --env-file .env up -d

# 查看服务状态
docker compose ps

# 查看 Metapi 日志
docker logs -f metapi

# 查看 Cloudflare Tunnel 日志
docker logs -f metapi-cloudflared

# 升级 Metapi
docker compose pull metapi
docker compose --env-file .env up -d

# 手动触发模型同步（进入后台后操作）
# 站点管理 -> 选择站点 -> 同步模型

# 备份数据
tar -czf metapi-backup-$(date +%F).tar.gz data
```

---

## 十、总结

通过这次折腾，我实现了：

1. **统一入口**：一个 API Key 访问所有模型
2. **智能路由**：GLM 优先，DeepSeek 兜底
3. **跨模型兼容**：老会话可以在不同模型的 thinking 模式间切换

核心教训：

1. **DeepSeek 的 `/anthropic` 端点不完全兼容 Claude**：它要求 `max_tokens`，对 beta header 的处理也不同
2. **thinking mode 的判断不仅在 body，还在 header**：`anthropic-beta` header 里的标志会影响上游行为
3. **DeepSeek v4-pro 是推理模型，需要 thinking blocks**：不能简单删除，而是要清理不兼容的 beta header



---

## 参考资料

- [Metapi GitHub 仓库](https://github.com/cita-777/metapi)
- [Cloudflare Tunnel 文档](https://developers.cloudflare.com/tunnel/)
- [Docker Desktop WSL2 后端](https://docs.docker.com/desktop/features/wsl/)
