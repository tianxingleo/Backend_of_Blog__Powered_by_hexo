---
title: Nuxt3+Supabase全栈应用私有化部署全记录
date: 2026-02-10 16:01:34
categories:
  - 项目
tags:
  - nuxt
  - supabase
  - vps
---

# Nuxt3 + Supabase 全栈应用私有化部署全记录

> 本文由 opencode + glm4.7 整理

### 文章结构

本文分为两个主要部分：

**第一部分：理想之路 —— 标准化部署 SOP**
详细介绍在理想情况下应该如何进行部署，包括环境准备、Supabase 配置、数据迁移、Nuxt 部署等完整流程。

**第二部分：实战踩坑实录 —— 每一个报错背后的血泪**
真实还原部署过程中遇到的各种问题，从 Docker 安装失败到数据库密码地狱，再到构建优化等，为读者提供避坑指南。

---

## 第一部分：理想之路 —— 标准化部署 SOP (如果不踩坑，你应该这样做)

> 💡 **核心逻辑**：基于 Ubuntu 22.04 LTS，使用 Docker Compose 编排 Supabase，配合 Docker 运行 Nuxt3，并通过 GitHub Actions 实现自动化部署，最后由 Nginx 进行反向代理和 SSL 终结。

### 一、 基础设施与环境准备 (Infrastructure)

#### 1.1 服务器选型与初始化

##### 硬件基准配置

在部署 Supabase + Nuxt 3 全栈应用时，服务器配置需要综合考虑以下因素：

**推荐配置**：
- **CPU**: 2核心起步，推荐 4 核心（并行处理数据库查询和前端构建）
- **内存**: 4GB 起步，推荐 8GB（构建 Nuxt 应用时内存消耗极大）
- **存储**: 50GB SSD 起步（数据库 + 日志 + 文件存储）
- **带宽**: 5Mbps 起步，推荐 10Mbps（考虑用户访问和文件传输）

**为什么内存对构建至关重要**：

Nuxt 3 的构建过程（尤其是 Nitro 服务器构建）是内存密集型任务：

```bash
# 构建时的内存消耗分析
Building Nuxt Nitro server...
# - TypeScript 编译：~1GB
# - Bundle 打包：~1.5GB  
# - 代码分割：~512MB
# - 总计：~3GB+ 峰值
```

如果在 2GB 内存服务器上直接构建，极易触发 OOM (Out of Memory) 错误。

##### 安全组配置 (Firewall)

**必须开放的端口**：
```bash
# 基础服务端口
22  # SSH 管理访问
80  # HTTP 访问
443 # HTTPS 访问
```

**严禁直接暴露的端口**：
```bash
# 数据库和服务端口（仅内网访问）
5432 # PostgreSQL 数据库
8000 # Kong API 网关
8001 # Supabase Studio
3000 # Nuxt 应用服务
```

##### 磁盘空间管理

**检查磁盘挂载情况**：
```bash
df -h
# 输出示例：
# Filesystem      Size  Used Avail Use% Mounted on
# /dev/vda1        40G   12G   26G  32% /
# /dev/vdb         100G   1G   99G   1% /data
```

**处理云盘扩容后的文件系统调整**：
```bash
# 1. 查看磁盘分区情况
fdisk -l

# 2. 扩展分区（假设扩容 /dev/vda1）
growpart /dev/vda 1

# 3. 扩展文件系统
resize2fs /dev/vda1

# 4. 验证扩容结果
df -h
```

##### Swap 虚拟内存配置

**为何小内存服务器必须配置 Swap**：

- **构建缓冲**: npm install 和 npm run build 时临时缓解内存压力
- **防止 OOM**: 避免 Linux 内核强制杀死进程
- **多任务支持**: 允许同时运行 Supabase 和 Nuxt 构建任务

**创建 4GB Swap 的标准命令**：
```bash
# 1. 创建 Swap 文件
fallocate -l 4G /swapfile

# 2. 设置权限
chmod 600 /swapfile

# 3. 格式化为 Swap
mkswap /swapfile

# 4. 启用 Swap
swapon /swapfile

# 5. 永久生效（添加到 /etc/fstab）
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# 6. 验证 Swap 状态
swapon --show
free -h
```

#### 1.2 核心软件安装

##### Git 安装与 SSH Key 配置

```bash
# 1. 安装 Git
sudo apt update && sudo apt install git -y

# 2. 配置 Git 用户信息
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# 3. 生成 SSH Key（用于 GitHub 访问）
ssh-keygen -t rsa -b 4096 -C "your.email@example.com"

# 4. 查看公钥并添加到 GitHub
cat ~/.ssh/id_rsa.pub
```

##### Docker & Docker Compose v2 安装

**避坑指南：不使用 apt install docker.io**

Ubuntu 默认源的 Docker 版本通常较旧且不包含 `docker-compose-plugin`：

```bash
# ❌ 错误方式（会导致版本过旧和插件缺失）
sudo apt install docker.io docker-compose-plugin -y
# 错误：E: Unable to locate package docker-compose-plugin
```

**推荐方案：官方脚本 + 国内镜像源**：

```bash
# 1. 下载官方安装脚本
curl -fsSL https://get.docker.com -o get-docker.sh

# 2. 使用阿里云镜像安装（国内服务器必需）
sudo sh get-docker.sh --mirror Aliyun

# 3. 启动 Docker 服务
sudo systemctl start docker
sudo systemctl enable docker

# 4. 添加用户到 docker 组（避免 sudo）
sudo usermod -aG docker $USER

# 5. 验证安装
docker --version
# Docker version 24.0.x, build xxx

docker compose version  
# Docker Compose version v2.20.x
```

### 二、 Supabase 后端私有化部署 (Backend)

#### 2.1 官方 Docker 仓库配置

##### 获取 Supabase Docker 配置

```bash
# 1. 进入用户主目录
cd ~

# 2. 克隆 Supabase Docker 配置（使用浅克隆减少下载量）
git clone --depth 1 https://mirror.ghproxy.com/https://github.com/supabase/supabase

# 3. 进入 Docker 配置目录
cd supabase/docker
```

#### 2.2 环境变量 (`.env`) 黄金法则

##### 安全核心：JWT_SECRET 配置

```bash
# 生成强随机字符串（至少 32 字符）
openssl rand -base64 32
# 输出示例：Jk8s9D2f7G4hP1qR6tW3zY5uV8iA0mN1xL4cB5eF7gH2jK9lP3oQ6rS8tU1vW

# 在 .env 中设置
JWT_SECRET=Jk8s9D2f7G4hP1qR6tW3zY5uV8iA0mN1xL4cB5eF7gH2jK9lP3oQ6rS8tU1vW
```

**为什么 JWT_SECRET 必须固定**：
- JWT Secret 用于生成和验证所有 API 访问令牌
- Secret 变更会导致所有现有令牌失效
- 数据库中的用户密码哈希依赖此 Secret

##### 密码陷阱：特殊符号限制

```bash
# ❌ 错误示例（会导致连接串解析失败）
POSTGRES_PASSWORD=P@ssw0rd@2022
POSTGRES_PASSWORD=admin:password

# ✅ 正确示例（使用字母数字组合）
POSTGRES_PASSWORD=SuperCore2022Admin
POSTGRES_PASSWORD=adminpassword2022
```

#### 2.3 服务启动与验证

##### 启动 Supabase 服务

```bash
# 1. 拉取所有镜像（首次执行）
docker compose pull

# 2. 启动所有服务
docker compose up -d

# 3. 查看启动日志（可选）
docker compose logs -f
```

### 三、 数据迁移策略 (Migration Strategy)

#### 3.1 数据库结构迁移 (Schema)

##### 导出 Schema-only 结构

```bash
# 1. 从 Supabase Dashboard 获取连接字符串
# 格式：postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres

# 2. 导出 public 架构的结构（不含数据）
pg_dump "postgresql://postgres:你的密码@db.你的项目ID.supabase.co:5432/postgres" \
  --schema-only \
  --schema=public \
  --quote-all-identifiers \
  --no-owner \
  --no-privileges \
  > schema_structure.sql
```

### 四、 Nuxt 3 前端容器化适配 (Frontend Adaptation)

#### 4.1 配置文件深度调优 (`nuxt.config.ts`)

##### 内存优化配置

```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  // 🔧 构建优化
  sourcemap: false,           // 关闭 SourceMap，减少 40% 构建时间
  
  // 🔧 Nitro 服务器配置
  nitro: {
    prerender: {
      concurrency: 1,         // 限制并发，防止内存溢出
      routes: ['/']           // 只预渲染首页
    },
    // 🔧 解决第三方库路径问题
    externals: {
      inline: ['tslib']       // 内联 tslib，避免路径丢失错误
    }
  }
})
```

#### 4.2 Dockerfile 编写规范

##### 完整的 Dockerfile 示例

```dockerfile
# Dockerfile
# 🔧 选择合适的基础镜像
FROM node:20-alpine AS base
WORKDIR /app

# 🔧 安装构建依赖（解决原生模块编译问题）
FROM base AS deps
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
RUN npm ci --only=production && npm cache clean --force

# 🔧 构建阶段
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# 🔧 生产运行阶段
FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/node_modules ./node_modules

ENV HOST=0.0.0.0
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

### 五、 自动化部署 (CI/CD with GitHub Actions)

#### 5.1 密钥管理

##### GitHub Secrets 配置

在 GitHub 仓库的 `Settings > Secrets and variables > Actions` 中配置以下密钥：

```bash
# 🔧 服务器连接信息
SERVER_HOST=your-server-ip
SSH_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----...

# 🔧 应用密钥
SUPABASE_URL=http://127.0.0.1:8000
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SECRET_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 六、 网关与安全 (Nginx & SSL)

#### 6.1 Nginx 反向代理配置

##### 多域名策略配置

```nginx
# 🌐 前端主站 - www.supercore.hk
server {
    listen 443 ssl http2;
    server_name www.supercore.hk supercore.hk;
    
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 🔧 API 网关 - api.supercore.hk
server {
    listen 443 ssl http2;
    server_name api.supercore.hk;
    
    location / {
        proxy_pass http://127.0.0.1:8000;
        client_max_body_size 50M;
    }
}
```

#### 6.2 SSL 证书自动化

##### 申请 SSL 证书

```bash
# 🚀 前端域名
sudo certbot --nginx -d www.supercore.hk -d supercore.hk

# 🚀 API 域名
sudo certbot --nginx -d api.supercore.hk
```

---

## 第二部分：实战踩坑实录 —— 每一个报错背后的血泪 (The Debugging Logs)

> 💡 **核心逻辑**：按时间线还原真实遇到的问题，从环境配置到数据库崩溃，再到前端构建失败和最终的连通性问题。每一个错误都代表着一个宝贵的经验教训。

### 💀 阶段一：环境与基础设施的"下马威"

#### 坑点 1：Docker 安装包"失踪"

**报错现场**：
```bash
root@supercore-hk:~# sudo apt install docker-compose-plugin -y
E: Unable to locate package docker-compose-plugin
Failed to start docker.service: Unit docker.service not found.
```

**最终解决方案：使用国内镜像**
```bash
sudo sh get-docker.sh --mirror Aliyun
```

**经验教训**：
1. **不要盲目相信系统源**：对于 Docker 这类快速发展的工具，官方源总是领先于系统源
2. **国内服务器必须考虑网络因素**：直接访问国外资源往往不稳定

#### 坑点 2：服务器磁盘空间"幽灵"

**报错现场**：
```bash
npm warn tar TAR_ENTRY_ERROR ENOSPC: no space left on device, write
```

**解决过程**：
```bash
growpart /dev/vda 1
resize2fs /dev/vda1
```

**经验教训**：
1. **云盘扩容需要两步操作**：分区扩展 + 文件系统扩展
2. **df -h 看到的不一定是真实大小**：需要用 fdisk 确认磁盘实际大小

### 💀 阶段二：Supabase 数据库的"密码地狱" (最艰难的战役)

#### 坑点 3：特殊字符引发的连接串解析失败

**报错现场**：
```bash
could not translate host name "2022bOER@2022@db" to address: Name or service not known
```

**最终解决方案**：
```bash
POSTGRES_PASSWORD=Super2022admin
# 移除所有特殊字符
```

#### 坑点 4：Docker 卷持久化导致的"密码分裂"

**问题分析**：
Docker 的卷持久化机制保存了旧的数据库配置，即使修改了 `.env` 文件，已经存在的数据库数据仍然使用旧密码。

**最终解决方案：数据库"上帝模式"重置**
```bash
# 1. 修改 pg_hba.conf 为 trust 模式
docker exec supabase-db bash -c "echo 'local all all trust' > /var/lib/postgresql/data/pg_hba.conf"

# 2. 无密码连接并重置所有系统账号
docker exec -it supabase-db psql -U postgres << EOF
ALTER USER postgres PASSWORD 'YourSecurePassword';
ALTER USER supabase_auth_admin PASSWORD 'YourSecurePassword';
ALTER USER supabase_storage_admin PASSWORD 'YourSecurePassword';
EOF
```

### 💀 阶段三：Nuxt 构建与运行时的"崩溃循环"

#### 坑点 5：构建时内存溢出 (OOM)

**报错现场**：
```bash
npm run build
# 服务器卡死，SSH 连接断开

dmesg | tail -10
# [12345.678] Out of memory: Kill process 1234 (npm) score 900
```

**解决过程**：

**步骤一：配置 Swap 虚拟内存**
```bash
fallocate -l 4G /swapfile
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
```

**步骤二：优化 Nuxt 配置**
```typescript
export default defineNuxtConfig({
  sourcemap: false,
  nitro: {
    prerender: {
      concurrency: 1
    }
  }
})
```

#### 坑点 6：SSR 环境下的 Pinia 崩溃

**报错现场**：
```bash
TypeError: Cannot read properties of undefined (reading 'state') (500 Error)
```

**最终解决方案**：
```bash
# 将通用插件改为客户端专用
mv plugins/pinia-persist.ts plugins/pinia-persist.client.ts
```

### 💀 阶段四：连通性与配置的"最后一步"

#### 坑点 7：无效的 API Key (Invalid Signature)

**报错现场**：
```bash
{"code":401,"msg":"Invalid signature"}
```

**解决过程**：
```bash
# 1. 固定 JWT_SECRET
JWT_SECRET=Jk8s9D2f7G4hP1qR6tW3zY5uV8iA0mN1xL4cB5eF7gH2jK9lP3oQ6rS8tU1vW

# 2. 使用 SQL 重新生成 API Keys
SELECT auth.jwt('{"role":"anon","iss":"supabase"}'::json) as anon_key;
```

#### 坑点 8：Certbot Python 环境冲突

**报错现场**：
```bash
ImportError: cannot import name 'appengine' from 'google.auth.transport'
```

**解决方案**：
```bash
pip3 install 'urllib3==1.26.16'
```

## 结语

### 核心经验总结

经过这次完整的私有化部署实践，我们深刻体会到：**全栈独立开发不仅仅是写代码，更是对 Linux、Docker、网络协议和构建工具链的综合考验**。

### 最关键的经验教训

#### 1. 永远掌控你的配置

**不要相信"自动生成的配置"**：

- `JWT_SECRET` 必须手动生成并固定，自动生成会导致所有 API Key 失效
- 数据库密码避免特殊字符，PostgreSQL 连接串解析很脆弱

#### 2. 资源限制下的优化策略

**小内存服务器必须做针对性优化**：

```bash
# 1. Swap 虚拟内存是必备的
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile

# 2. 构建优化配置
export NODE_OPTIONS="--max-old-space-size=1536"
npm run build -- --no-sourcemap
```

### 给后来者的建议

#### 部署前准备

1. **充分测试**：在类似环境先完整测试一遍部署流程
2. **备份策略**：确保有完整的备份和恢复方案
3. **监控准备**：提前配置好日志收集和监控告警

#### 部署过程中

1. **分步验证**：每完成一个阶段就验证功能正常
2. **日志监控**：实时监控各服务的日志，及时发现问题
3. **回滚准备**：准备好快速回滚方案，减少故障时间

### 最终的价值

虽然私有化部署过程充满挑战，但带来的价值是显著的：

1. **数据掌控**：所有数据都在自己的服务器中，满足合规要求
2. **成本可控**：避免了 SaaS 服务的指数级费用增长
3. **性能优化**：可以根据业务需求进行针对性优化
4. **技术成长**：全栈部署经验是工程师的重要技能

---

**相关资源**：

- [Supabase 官方文档](https://supabase.com/docs)
- [Nuxt 3 部署指南](https://nuxt.com/docs/getting-started/deployment)
- [Docker Compose 最佳实践](https://docs.docker.com/compose/)
- [Nginx 配置优化](https://www.nginx.com/resources/wiki/start/)

如有问题或建议，欢迎提交 Issue 或 Pull Request！

---

> 本文由 opencode + glm4.7 基于真实部署对话整理，记录了从踩坑到成功的完整私有化部署历程。