---
title: 针对 RackNerd VPS 与中国移动出口带宽限制的排查与优化指南
date: 2026-01-15 23:06:03
tags:
  - vps
  - RackNerd
  - Hysteria 2
---

# 针对 RackNerd VPS 与中国移动出口带宽限制的排查与利用Hysteria 2优化指南

## 1. 问题背景与现象

在使用 RackNerd 等美西廉价 VPS 时，中国移动宽带用户常遇到以下典型现象：
*   **初期正常**：VPS 刚部署完成时（通常在非高峰时段），连接速度快，延迟可接受。
*   **后期衰减**：在晚高峰（19:00 - 23:00）或部署一段时间后，SSH 连接卡顿，文件传输速度跌至极低水平（如 0.5Mbps - 2Mbps），且伴随高丢包率。
*   **协议失效**：使用基于 TCP 的协议（如 VLESS-Reality、VMess-TCP）时，即使更换端口或伪装域名，速度依然无法恢复。

## 2. 排查思路与根因分析

当出现上述问题时，需按照以下逻辑进行排查，确认是否为线路拥堵导致的物理瓶颈。

### 2.1 排除本地与服务端配置问题
在进行链路分析前，需确认并非单点故障：
*   **本地网络**：访问国内网站或其他非跨境服务速度正常，排除本地光猫或路由器问题。
*   **VPS 负载**：通过 `top` 或 `htop` 命令检查 VPS 的 CPU 和内存占用。如果 CPU Steal Time (st) 较低，排除“邻居”占用资源导致的性能下降。

### 2.2 链路路由追踪 (TraceRoute)
这是定位问题的核心步骤。通过 `tracert` (Windows) 或 `mtr` (Linux/macOS) 工具追踪数据包路径。

**典型故障样本分析（基于中国移动）：**
1.  **省内骨干网（第 1-7 跳）**：延迟较低（<30ms），无丢包。说明本地到省级出口网络通畅。
2.  **国际出口节点（第 8-9 跳）**：
    *   IP 段通常为 `223.120.*.*` 或 `221.183.*.*`。
    *   **现象**：延迟出现突增（例如从 30ms 飙升至 200ms+），且伴随请求超时（Request Timed Out）。
    *   **结论**：这是中国移动的国际出口网关。此处的高延迟和丢包意味着出口带宽拥堵。
3.  **境外承载网（第 10+ 跳）**：
    *   进入 `cogentco.com` 或类似廉价骨干网运营商。
    *   **现象**：持续的丢包（星号 `*`）和高延迟。
    *   **结论**：RackNerd 等廉价 VPS 商家通常接入 Cogent 等成本较低的线路，这些线路与中国运营商的互联互通质量在高峰期极差。

### 2.3 为什么 TCP 协议（Reality/VMess）会失效？
Reality 等协议底层基于 TCP。TCP 协议拥有拥塞控制机制（Congestion Control）：
1.  当链路发生丢包时，TCP 协议将其判定为网络拥堵。
2.  发送端会主动降低发送窗口大小（减速）以缓解拥堵。
3.  在移动出口拥堵导致的高丢包环境下（丢包率可能高达 20%-75%），TCP 会不断触发减速机制，导致实际吞吐量极低（如卡在 Kbps 级别），甚至断连。

## 3. 解决方案：部署 Hysteria 2

在无法改变物理线路（不更换 CN2 GIA 等高端线路）的前提下，更换传输层协议是唯一有效的技术手段。

### 3.1 为什么选择 Hysteria 2
Hysteria 2 基于 **UDP** 协议。与 TCP 不同，UDP 本身不保证可靠传输，也不具备强制的退避机制。Hysteria 2 通过自定义的拥塞控制算法，在检测到丢包时，不会像 TCP 那样大幅降低发送速率，而是利用冗余发包或快速重传抢占带宽。
*   **适用场景**：高丢包、高延迟、线路拥堵的“垃圾”线路。
*   **效果**：在 TCP 仅能跑 2Mbps 的环境下，Hysteria 2 可能跑出 50Mbps-100Mbps 的速度。

### 3.2 部署前准备
*   **域名**：建议拥有一个域名解析到 VPS IP（用于申请 SSL 证书，提高协议隐蔽性）。
*   **防火墙**：Hysteria 2 依赖 UDP 端口，需在 VPS 后台及系统内部放行 TCP 和 UDP 端口。

**放行端口命令 (以 CentOS/AlmaLinux 的 firewalld 为例)：**
```bash
# 放行 80 端口 (用于 ACME 申请证书)
firewall-cmd --zone=public --permanent --add-port=80/tcp
# 放行 443 端口 (作为 Hysteria 2 的监听端口，需同时放行 TCP 和 UDP)
firewall-cmd --zone=public --permanent --add-port=443/tcp
firewall-cmd --zone=public --permanent --add-port=443/udp
# 重载生效
firewall-cmd --reload
```

### 3.3 官方脚本部署步骤

使用 Hysteria 官方提供的一键脚本进行安装。

**1. 执行安装命令**
```bash
bash <(curl -fsSL https://get.hy2.sh/)
```
*   如果脚本询问是否安装，选择 `Yes`。
*   安装完成后，脚本会自动创建系统服务 `hysteria-server.service`。

**2. 配置文件编写**
官方脚本安装后，需手动配置 `/etc/hysteria/config.yaml`。为避免格式错误，建议使用 `cat` 命令直接写入。

> **注意**：如果不使用 Cloudflare CDN，请确保域名在 DNS 解析时**关闭**代理（即 Cloudflare 的“小黄云”需为灰色），仅做 DNS 解析。

**配置模板（ACME 自动证书版）：**
将以下内容中的 `域名`、`邮箱` 和 `密码` 替换为实际值。

```bash
cat <<EOF > /etc/hysteria/config.yaml
listen: :443

acme:
  domains:
    - vps.yourdomain.com  # 替换为你的域名
  email: admin@yourdomain.com

auth:
  type: password
  password: your_strong_password # 替换为你的密码

masquerade:
  type: proxy
  proxy:
    url: https://bing.com/
    rewriteHost: true

# 带宽限制建议：
# 填写小于 VPS 物理上限的值，避免长时间占满带宽被商家判定为滥用
bandwidth:
  up: 500 mbps
  down: 1000 mbps
ignoreClientBandwidth: false
EOF
```

**3. 处理端口占用**
RackNerd 的系统模板可能预装了 httpd 或 nginx 占用 80 端口，导致 ACME 证书申请失败。需清理端口：
```bash
systemctl stop httpd nginx
systemctl disable httpd nginx
```

**4. 启动服务与验证**
```bash
systemctl enable --now hysteria-server.service
systemctl status hysteria-server.service --no-pager
```
*   **状态检查**：若状态为 `Active: active (running)`，且日志显示 ACME 证书获取成功，即部署完成。
*   **错误排查**：若启动失败，使用 `journalctl -u hysteria-server.service -n 20` 查看日志。常见原因为 YAML 缩进错误或 80/443 端口仍被占用。

## 4. 客户端配置要点

服务端部署成功后，客户端（如 v2rayN、NekoBox）的配置至关重要。

1.  **基础信息**：
    *   地址：你的域名
    *   端口：443
    *   协议：Hysteria 2
    *   SNI：你的域名
    *   密码：配置文件中设置的密码
2.  **不安全连接 (Allow Insecure)**：
    *   若使用 ACME 申请的正式证书，此项**关闭**（设置为 False）。
    *   若使用自签证书，此项**开启**（设置为 True）。
3.  **带宽设置 (关键)**：
    *   在客户端配置中，**必须**填写下行带宽/下载速度（如 `100 Mbps` 或 `500 Mbps`）。
    *   如果不填写该参数，Hysteria 2 客户端可能不会启动暴力发包模式，导致提速效果不明显。

## 5. 总结

对于 RackNerd 配合中国移动宽带这种“高丢包、高拥堵”的网络环境，排查问题的核心在于识别物理线路的出口瓶颈。在物理线路无法改变的情况下，放弃基于 TCP 的协议，转而使用基于 UDP 的 Hysteria 2 协议，通过其激进的拥塞控制机制对抗丢包，是解决速度慢、断连问题的最直接、最有效的技术方案。
