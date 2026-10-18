# Tianxingleo 的 Hexo 博客

个人网站：<https://tianxingleo.top/>，基于 Hexo 与 AnZhiYu 主题。本仓库保留原有主题动画、文章展示、搜索和交互。

## 构建阶段预生成 AI 摘要

```text
修改 Markdown 文章
  → 对每篇文章计算 SHA-256 内容指纹
  → 未变化：复用 source/_data/ai_summaries.json
  → 有变化：构建机调用 DeepSeek Flash（仅有密钥时）
  → 没有密钥或调用失败：使用文章片段作为静态导读
  → Hexo 将摘要和文章问答写入 HTML
  → 访客浏览时不需要调用模型 API
```

默认模型：`deepseek-flash`；接口：`https://api.deepseek.com/chat/completions`。

在 Windows PowerShell 中配置**当前终端进程的环境变量**（密钥不要写进源码、主题配置或前端脚本）：

```powershell
$env:DEEPSEEK_API_KEY = "填入自己的密钥"
npm install
npm run build
npm run deploy
```

生成器源码位于 `tools/generate-ai-summaries.js`，不会被 Hexo 当作主题插件重复执行。

或者直接执行本仓库原有的 `npm run d` 流程，它现在也会先生成增量缓存。未设置密钥时，同样能够生成静态导读；需要以后补齐真正的 AI 摘要，只需配置密钥再构建即可。

也可以运行 `npm run ai:generate` 单独更新缓存。想重做全部文章可设置 `AI_FORCE_REBUILD=1`，但会增加请求成本。可通过 `DEEPSEEK_MODEL` 指定兼容模型。

首次构建后，建议将 `source/_data/ai_summaries.json` 提交进仓库：后续构建可以跨电脑和持续集成复用已有结果。网页摘要以及问答均是构建时生成的静态内容，不是实时聊天，不会对任意新问题调用模型。

**注意：** 摘要可能出错；技术结论以原文为准。`ai: false` 可让指定文章退出自动生成。原有 AI 摘要区和打字动画仍然保留。任何服务端管理密钥应使用环境变量或 CI Secrets；特别要检查原站点 Algolia 配置中已提交的管理密钥，若有效应及时轮换。
