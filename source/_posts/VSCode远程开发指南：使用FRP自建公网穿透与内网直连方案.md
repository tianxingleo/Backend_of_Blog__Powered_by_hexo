---
title: VSCode远程开发指南：使用FRP自建公网穿透与内网直连方案
date: 2026-01-15 23:31:46
tags:
  - ssh
  - vscode
  - vps
  - frp
---

## 背景
VS Code 自带的 Tunnel 功能基于 Azure 中继服务器，在跨国或网络环境复杂的情况下（如国内连接海外），存在高延迟、连接不稳定及保存卡顿的问题。

本教程介绍如何利用一台具有公网 IP 的 VPS，配合开源工具 **FRP** 搭建私有穿透隧道，实现低延迟的远程开发。同时介绍了在局域网环境下如何配置直连，避免流量绕行。

## 架构说明
*   **服务端 (VPS)**：CentOS 9，公网 IP（示例：`104.168.105.185`）。
*   **目标机 (Target)**：Windows 运行的 WSL (Ubuntu)，处于内网，无公网 IP。
*   **客户端 (Client)**：本地笔记本，安装 VS Code。

---

## 第一部分：VPS 服务端配置

需要在 VPS 上运行 FRP 的服务端 (`frps`)，用于中转流量。

### 1. 下载与安装
登录 VPS，下载 FRP（需根据系统架构选择，此处以 Linux AMD64 为例）：

```bash
cd ~
wget https://github.com/fatedier/frp/releases/download/v0.52.3/frp_0.52.3_linux_amd64.tar.gz
tar -zxvf frp_0.52.3_linux_amd64.tar.gz
mv frp_0.52.3_linux_amd64 frp
cd frp
```

### 2. 修改配置文件
编辑 `frps.toml`：
```bash
vi frps.toml
```
写入以下最简配置：
```toml
bindPort = 7000  # FRP 服务端与客户端通信端口
```

### 3. 配置防火墙（关键）
CentOS 9 默认开启 Firewalld，必须放行相关端口。
*   `7000`：FRP 内部通信。
*   `6000`：后续暴露 SSH 的自定义端口。

```bash
# 启动防火墙并设为开机自启
systemctl enable --now firewalld

# 放行端口
firewall-cmd --zone=public --add-port=7000/tcp --permanent
firewall-cmd --zone=public --add-port=6000/tcp --permanent
firewall-cmd --reload
```

### 4. 启动服务
使用 `nohup` 挂在后台运行：
```bash
nohup ./frps -c frps.toml > frps.log 2>&1 &
```
*检查运行状态：`ps -ef | grep frps`*

---

## 第二部分：目标机 (WSL) 配置

需要在 WSL 内运行 SSH 服务和 FRP 客户端 (`frpc`)。

### 1. 配置 SSH 服务
进入 WSL 终端，确保 SSH Server 已安装并允许密码登录。

```bash
# 重装 SSH 服务防止配置残留
sudo apt remove openssh-server -y
sudo apt install openssh-server -y

# 允许密码登录（若默认关闭）
sudo sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/g' /etc/ssh/sshd_config
# 生成主机密钥
sudo ssh-keygen -A

# 启动 SSH 服务
sudo service ssh start
```
*检查状态：确保 `sudo service ssh status` 显示 `is running`。*

### 2. 配置 FRP 客户端
下载与 VPS 版本一致的 FRP，编辑 `frpc.toml`：

```bash
nano frpc.toml
```

写入配置（将 `serverAddr` 替换为 VPS 真实 IP）：
```toml
serverAddr = "104.168.105.185"
serverPort = 7000

[[proxies]]
name = "wsl-ssh"
type = "tcp"
localIP = "127.0.0.1"
localPort = 22      # WSL 本地 SSH 端口
remotePort = 6000   # 映射到 VPS 的公网端口
```

### 3. 启动连接
```bash
# 后台运行
nohup ./frpc -c frpc.toml > /dev/null 2>&1 &
```
若需确认连接成功，可先前台运行 `./frpc -c frpc.toml`，看到 `start proxy success` 即成功。

---

## 第三部分：VS Code 远程连接 (公网模式)

此时，VPS 的 `6000` 端口已直接连通 WSL 的 `22` 端口。

### 1. 修改 SSH Config
在 VS Code 中按下 `F1`，选择 `Remote-SSH: Open Configuration File`，添加如下内容：

```ssh
Host MyWSL-VPS
    HostName 104.168.105.185
    User wsl_user_name    # 注意：这里填 WSL 的用户名，不是 VPS 的 root
    Port 6000             # 这里填 frp 映射的端口
```

### 2. 连接测试
1.  点击左侧远程资源管理器，连接 `MyWSL-VPS`。
2.  输入 **WSL 用户密码**（非 VPS 密码）。
3.  连接成功后，所有的文件修改均为实时同步。

---

## 第四部分：内网直连配置 (局域网模式)

当笔记本和主机在同一局域网时，建议走内网直连，速度更快且不消耗 VPS 流量。由于 WSL IP 为虚拟 IP，需在主机 Windows 上做端口转发。

### 1. 获取 WSL IP
在主机 PowerShell (管理员) 中执行：
```powershell
wsl hostname -I
```
假设输出为 `172.25.100.5`。

### 2. 设置 Windows 端口转发
将 Windows 主机的 `2222` 端口转发到 WSL 的 `22` 端口：
```powershell
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=22 connectaddress=172.25.100.5
```

### 3. 开放 Windows 防火墙
```powershell
New-NetFirewallRule -DisplayName "WSL SSH LAN" -Direction Inbound -LocalPort 2222 -Protocol TCP -Action Allow
```

### 4. VS Code 添加内网 Host
在 `~/.ssh/config` 中追加：

```ssh
Host MyWSL-LAN
    HostName 192.168.x.x  # 主机 Windows 在局域网的 IP
    User wsl_user_name
    Port 2222
```

### 5. 解决 WSL IP 变动问题 (进阶)
WSL 重启后 IP 会变。可创建一个 PowerShell 脚本 (`wsl_bridge.ps1`)，开机运行即可自动更新转发规则：

```powershell
$wsl_ip = (wsl hostname -I).Trim()
netsh interface portproxy delete v4tov4 listenport=2222 listenaddress=0.0.0.0
netsh interface portproxy add v4tov4 listenport=2222 listenaddress=0.0.0.0 connectport=22 connectaddress=$wsl_ip
Write-Host "WSL Mapping Updated: Windows:2222 -> $wsl_ip:22"
```

---

