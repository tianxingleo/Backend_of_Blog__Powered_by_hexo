---
title: CPU服务器跑LLM实录
date: 2026-01-30 22:35:08
categories:
  - 项目
tags:
  - AI
  - LLM
  - 服务器
---

## 1. 硬件配置概况

这台服务器的配置比较特殊，是典型的企业级后端服务器：
*   **CPU**: 双路 Intel Xeon Gold 6231，共64个逻辑核心。支持 AVX-512 指令集。
*   **内存**: 376GiB（约384GB）。这是这台机器最大的优势。
*   **硬盘**: 238GB NVMe 固态硬盘（系统盘）+ 5块 14.6TB 机械硬盘（数据盘）。
*   **显卡**: 无独立显卡。

**核心思路**：利用 384GB 的超大内存作为“显存”，运行大参数量的量化模型。

## 2. 环境搭建与网络难题

要在 Linux 上跑模型，首选 **Ollama**。但在国内服务器上安装 Ollama 经常卡在下载环节。

### 代理配置
Ollama 的安装脚本和模型库都在 GitHub/Amazon S3 上。我先部署了 **Hysteria2** 客户端，将其转为本地 8080 端口的 HTTP 代理。

在执行安装脚本时，必须手动指定代理：
```bash
export https_proxy=http://127.0.0.1:8080
export http_proxy=http://127.0.0.1:8080
curl -fsSL https://ollama.com/install.sh | sh
```
安装完后，如果下载模型也要快，还需要修改 `ollama.service` 的环境变量，加入 `HTTPS_PROXY`。

## 3. 磁盘空间带来的“教训”

**这是整个过程中最容易踩的坑。**

### 系统盘爆满
我的系统盘只有 238GB。当我尝试下载 `llama3.1:405b`（约240GB）时，下载到 88% 提示 `no space left on device`。系统直接卡死，Ollama 服务崩溃。

### 方案建议：迁移存储路径
如果系统盘不够大，一定要在下载前把存储路径改到机械硬盘阵列上。
1.  格式化大硬盘：`sudo mkfs.ext4 /dev/sda`
2.  挂载：`sudo mount /dev/sda /mnt/data`
3.  配置 Ollama 环境变量：
    使用 `sudo systemctl edit ollama.service` 添加：
    ```ini
    [Service]
    Environment="OLLAMA_MODELS=/mnt/data/ollama_models"
    ```
4.  **注意权限**：修改路径后，必须执行 `sudo chown -R ollama:ollama /mnt/data/ollama_models`，否则 Ollama 无法读写模型。

### 挽救半成品文件
如果下载了一大半发现空间不足，不要急着删。可以把 `/usr/share/ollama/.ollama/models/blobs` 里的 `-partial` 后缀文件手动 `mv` 到新路径下，改好配置重启服务，Ollama 可以实现断点续传，省去几百GB的流量。

## 4. 模型选择与性能实测

在 384GB 内存的支持下，我测试了几个重量级模型：

### 推荐模型清单
1.  **Qwen3-Next:80b (50GB)**: 目前的主力。在 64 核 CPU 上，生成速度约为 **2.42 tokens/s**。虽然比 GPU 慢，但回答质量很高，体感像是一个人在对面匀速打字。
2.  **DeepSeek-R1-70B**: 推理能力极强，内存占用约 45GB，运行非常稳定。
3.  **Llama 3.1 405B (量化版)**: 这是一个尝试，需要约 240GB 内存。这台机器能跑起来，这本身就是奇迹。虽然速度不到 1 token/s，但在处理极高难度的逻辑证明时很有用。

### 如何查看速度
在 Ollama 交互界面输入 `/set verbose`，每次对话完它会给出统计。
*   `eval rate`: 实际生成速度（单位 tokens/s）。
*   `load duration`: 加载时间。因为我内存够大，模型加载完后会常驻内存，第二次提问几乎是秒回。

## 总结与建议

**CPU玩LLM，玩玩就好（）**
