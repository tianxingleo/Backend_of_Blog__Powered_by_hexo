---
title: TIC第二节例会：1小时，0代码，做出你的个人博客静态网站
date: 2026-10-16 20:30:00
categories:
  - 学习
hidden: true
tags:
  - tic
  - hexo
  - github
  - blog
slug: tic-meeting-2-hexo-blog-guide
alias:
  - '/2026/10/16/TIC第二节例会-1小时0代码做出你的个人博客静态网站/'
---

# TIC 第二节例会：**1小时，0代码，做出你的个人博客静态网站**

> 👋欢迎来到 TIC 第二节例会！不管你之前是没听过“命令行”的纯小白，还是刚领到电脑的大一萌新，今天这节例会，我们不讲枯燥晦涩的理论，而是**手把手带你从零做出一个真正属于你自己、全世界任何人都能通过网址访问的个人博客网站！** 建议大家边听讲、边对照这篇文档一步步实操。遇到任何报错别慌，随时举手呼叫身边的学长学姐！

## 零、课前准备清单（建议例会前提前完成）

> **【TIC 第二节例会课前准备通知】**由于现场网络访问部分网站可能受到限制，为了让大家在例会上有更丝滑的实操体验，请大家在例会开始前尽量完成以下 4 个小准备（如果遇到困难也不用担心，例会现场会手把手教大家）：
>
> 1. **下载网络加速工具（用于流畅访问 GitHub）**：前往 [Watt Toolkit (原名 Steam++) 官网](https://steampp.net/)下载并安装对应系统的版本。
>
> 2. **注册 GitHub 账号**：开启加速后，前往 [GitHub 官网](https://github.com/) 注册一个账号（**请牢记你的用户名、注册邮箱和密码**，用户名未来会成为你网站网址的一部分，建议取简短好记的英文/数字）。
>
> 3. **下载三大基础开发软件安装包**（先下载好安装包即可，不会装的可以等例会一起装）：
>   * **Node.js**：[Node.js 官方下载页](https://nodejs.org/en/download)
>    
>   * **Git**：[Git 官方安装页](https://git-scm.com/install/)
>    
>   * **VS Code）**：[Visual Studio Code 官方下载页](https://code.visualstudio.com/download)
>    
>4. **带上你的电脑和充电器**，我们例会现场见！

##  一、今天这节例会我们要做什么？

| 关卡阶段 | 核心任务 | 你将解锁的新技能 |
| ----- | ----- | ----- |
| **Stage 1：简单认识** | 认识个人博客（Blog）与软件开发基本流程 | 理解什么是静态网站、为什么选 [Hexo](https://hexo.io/zh-cn/)、建立开发者思维 |
| **Stage 2：环境配置** | 配置网络加速、注册 [GitHub](https://github.com/)、安装 [Node.js](https://nodejs.org/en) / [Git](https://git-scm.com/) / [VS Code](https://code.visualstudio.com/) | 搞定程序员电脑必备的“三大件”开发环境 |
| **Stage 3：初探命令行** | 解锁终端操作，配置 [npmmirror 国内镜像源](https://npmmirror.com/) | 学会 `cd` 切换目录，用一行指令召唤 Hexo |
| **Stage 4：本地建站调试** | 初始化代码仓库，在 `localhost:4000` 预览网站 | 体验“初始化 -> 编译生成 -> 本地服务器调试”的开发闭环 |
| **Stage 5：创作第一篇博文** | 认识项目文件结构，用 VS Code 插件实时预览写 Markdown | 掌握 Markdown 排版语法与 `clean -> g -> s` hexo流程 |
| **Stage 6：正式部署上线** | 配置 SSH 密钥连接 [GitHub Pages](https://pages.github.com/)，绑定 `github.io` 域名并换皮肤 | 拥有全网可访问的专属网站，学会更换 [Butterfly](https://butterfly.js.org/en/) / [Fluid](https://fluid-dev.github.io/hexo-fluid-docs/en/start/) 等高颜值主题 |

## 二、先看效果！为什么你需要一个属于自己的 Blog？

### 1. 学长学姐的“神仙博客”长什么样？

在写第一行命令之前，先带大家看看我们 TIC 的学长学姐们自己搭建的个人博客是什么样子的！

[cxyx：](https://cccxyx.com/)

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_51572b2641f398d8d839b0950bab87ec.gif)

[Tianxingleo的Blog](https://tianxingleo.top/)：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_2b1c2bb838bf9913767d0222a592bde9.gif)

[Dinglz 's Blog](https://dinglz.cn/)：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_63607399f36293a0cd4a825755923ff1.gif)

看到这里你可能会问：**“这也太酷了吧！但我完全零基础，真的能在今天这节例会里做出来吗？”** 答案是：**完全可以！** 只要跟着下面的步骤一步步敲，1 小时后你也能拥有同款个人网站。

### 2. 灵魂拷问：Blog 是什么？现在都 2026 年了，Blog 过时了吗？

* **Blog 是什么？** **Blog（Web Log，网络日志，简称博客）** 就是你在互联网上独立拥有的一个私人网站。你可以在上面发布学习笔记、技术总结、生活随笔、摄影作品甚至个人简历。

* **已经有朋友圈、小红书、知乎、CSDN 了，为什么还要自己搭 Blog？Blog 过时了吗？** 恰恰相反！在算法推荐和商业平台横行的今天，独立博客反而是程序员圈子里最酷的“赛博自留地”：

| 对比维度 | 商业内容平台（CSDN / 知乎 / 社交平台） | 你自己搭建的独立博客（Hexo + GitHub Pages） |
| ----- | ----- | ----- |
| **页面清爽度** | 满屏弹窗广告、VIP 付费解锁、强制登录才能复制代码 | **0 广告、极速加载**，排版每一处细节都由你说了算 |
| **自由度与所有权** | 格式受限，文章可能因莫名其妙的敏感词被审核或下架 | **源码 100% 掌握在自己手里**，想怎么美化、加什么特效全凭喜好 |
| **求职与个人品牌** | 淹没在千篇一律的平台模板里，难以体现技术动手能力 | 简历上印一行 `https://你的名字.github.io`，面试官点开直接加分 |
| **社交属性** | 被算法信息流裹挟的点赞之交 | 通过**友链（友情链接）**与全校乃至全球优秀的开发者互换名片 |

### 3. 为什么我们用“搭博客”作为 TIC 零基础入门第一课？在这里能学到什么？

很多同学刚进大学学计算机或参加技术社团时，只在黑框框里写过 `Hello World` 或者算过鸡兔同笼，总觉得“写代码”离“做出一个真正的产品”很遥远。 带你用 [Hexo](https://hexo.io/zh-cn/) 搭博客，是因为它“麻雀虽小，五脏俱全”**。在这个过程中，你会不知不觉打通**现代软件开发的全流程：

1. **体验真实软件是怎么跑起来的（软件开发生命周期）**： 真正的软件开发从来不是在一个软件里单打独斗，而是：**配置底层环境（Node.js / Git） ➔ 初始化工程脚手架（Hexo） ➔ 编写源码与内容（VS Code + Markdown） ➔ 本地编译构建与调试（`localhost`） ➔ 部署发布到远程服务器（GitHub Pages）**。今天你走完这一遍，以后学前端、后端、小程序，流程全都一模一样！

2. **理解“静态网站（Static Website）”是怎么回事**： 网站通常分为两类：
   * **动态网站**（如淘宝、B站）：需要后台服务器和数据库每时每刻实时计算、推送千人千面的内容，租服务器既贵又复杂。
   
   * **静态网站**（如我们的个人博客）：文章写好后内容是固定的。我们只需要一个“加工厂”，把我们写的笔记提前转换成浏览器能看懂的网页文件（`HTML` + `CSS` + `JavaScript`），然后丢到 [GitHub Pages](https://pages.github.com/) 提供的免费服务器上，全世界就能免费、高速地访问你的网站了！
   
3. **为什么选择 [Hexo](https://hexo.io/zh-cn/) 框架？** [Hexo](https://hexo.io/zh-cn/) 是目前全球最受欢迎的开源静态博客框架之一（基于 [Node.js](https://nodejs.org/en) 开发）。它的核心优势就三个字：**快、爽、美**——几秒钟就能把上百篇 Markdown 笔记编译成完整网页，支持一条命令一键发布到 GitHub，而且社区里有成百上千套开箱即用的神仙主题（见 [Hexo 官方主题列表](https://hexo.io/themes/)），零前端基础也能改出大师级视觉效果！

## 三、第一阶段：前置准备——打通网络、账号与三大开发神器

软件开发的第一步叫“搭环境”。就像做饭前要先买好锅碗瓢盆、接通煤气一样

### Step 1：下载安装网络加速神器——Watt Toolkit（原名 Steam++）

因为我们要把博客托管在全球最大的代码托管平台 [GitHub](https://github.com/) 上，而国内直接访问 GitHub 经常会遇到网页打不开或连接超时的问题。我们可以借助开源免费的加速工具 [**Watt Toolkit**](https://steampp.net/) 来解决。

1. 打开浏览器，访问 [Watt Toolkit 官方网站](https://steampp.net/)（或在微软应用商店）。

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_a3dd7c3b790812eae5b8baaf3b3a517d.png)

1. 根据你的电脑系统（Windows / macOS）下载安装程序并打开。

2. 打开软件后，在左侧菜单栏找到 **“网络加速”**。

   ![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_3b85677607b2ef1f4dc9331cad404166.png)

3. 在右侧列表中勾选 **“GitHub”**，然后点击右下角的 **“一键加速”** 按钮（如果是第一次使用，软件提示安装证书或 Hosts 权限时，请全部点击“确定/允许”）。

   ![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_88a14a97f7ff4d5fcebf9d39e5001ba8.webp)

### Step 2：注册你的程序员身份证——GitHub 账号

可以参考：[注册Github账号详细教程【超详细篇 适合新手入门】_github注册-CSDN博客](https://blog.csdn.net/m0_75085583/article/details/145676885)

加速开启后，我们来注册全球程序员的~~同性交友~~代码开源社区——[**GitHub**](https://github.com/)。

1. 浏览器访问 [GitHub 官网](https://github.com/)，点击右上角的 **Sign up**（注册）。

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_446c77e2a11ba75570b659988b466c56.webp)

1. 按照提示依次输入你的**常用邮箱（Email）**、**密码（Password）以及用户名（Username）**。

   *  **起名特别提醒**：你的 GitHub 用户名（比如 `zhangsan`）将来会直接变成你博客的专属网址：`https://zhangsan.github.io`！所以强烈建议取一个**简短、好记、全英文/数字**的名字，并且拿小本本记好你的**用户名**和**注册邮箱**，后面配置连接时要用！

   ![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_24c160b072c7b35fed4cb4c03021ebd1.webp)

2. 去邮箱查收验证码完成验证，即可成功登录 GitHub。



### Step 3：安装三大核心软件（Node.js + Git + VS Code）

接下来我们要安装三个贯穿你整个大学编程生涯的核心工具。别被英文名字吓到，先看看它们各自扮演什么角色：

| 软件名称 | 官方下载链接 | 它在搭博客里起什么作用？ |
| ----- | ----- | ----- |
| [**Node.js**](https://nodejs.org/en/download) | [点击前往官网下载](https://nodejs.org/en/download) | Hexo 框架是用 JavaScript 写的，Node.js 让它能在你电脑上跑起来；同时自带包管理器 `npm`（相当于程序员的软件商店）。 |
| [**Git**](https://git-scm.com/install/) | [点击前往官网下载](https://git-scm.com/install/) | 帮你管理代码修改历史，并负责把你在电脑上生成的博客网页“打包快递”上传到 GitHub 服务器上。 |
| [**VS Code**](https://code.visualstudio.com/download) | [点击前往官网下载](https://code.visualstudio.com/download) | 微软出品的免费编辑器，我们用它来修改博客配置、编写 Markdown 文章并实时预览排版效果。 |

#### 🔹 1. 安装 [Node.js](https://nodejs.org/en/download)

1. 打开 [Node.js 官方下载页](https://nodejs.org/en/download)，选择带有 **LTS（Long Term Support，长期支持稳定版）** 标识的安装包下载（Windows 选 `.msi` 安装包，Mac 选 `.pkg` 安装包）。

2. 双击运行安装包，**无脑一路点击 `Next`（下一步）** 即可！

   * **注意**：安装路径可以改到 D 盘，但中间出现的 `Add to PATH`（添加到系统环境变量）默认是勾选的，**千万不要取消勾选**！

#### 🔹 2. 安装 [Git](https://git-scm.com/install/)

1. 打开 [Git 官方安装页](https://git-scm.com/install/)（Windows 同学进入 [Git for Windows 页面](https://git-scm.com/install/windows)），点击下载安装程序。

2. 双击运行安装包，里面会出现十几个专业选项页面——**零基础同学不需要改任何选项，从头到尾一路点击 `Next` 直到 `Install` 完成即可！**

3. 安装完成后，在电脑桌面空白处点击**鼠标右键**，如果看到菜单里多出了 **`Open Git Bash here`**（或者在“显示更多选项”里看到它），恭喜你，Git 安装成功！

#### 🔹 3. 安装 [VS Code (Visual Studio Code)](https://code.visualstudio.com/download)

可以参考：[VSCode安装配置使用教程（最新版超详细保姆级含插件）一文就够了_vscode使用教程-CSDN博客](https://blog.csdn.net/msdcp/article/details/127033151)

1. 打开 [VS Code 官方下载页](https://code.visualstudio.com/download)，下载对应系统的安装包。

2. 双击安装，在 **“选择其他任务（Select Additional Tasks）”** 这一步，**强烈建议把下面所有框都勾上**：

   *  将“通过 Code 打开”操作添加到 Windows 资源管理器文件上下文菜单

   *  将“通过 Code 打开”操作添加到 Windows 资源管理器目录上下文菜单

   *  添加到 PATH（重启后生效） 

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_1b960443bf1ef525c8fe4dbf6d1ec85e.webp)

##  四、第二阶段：零基础命令行入门与安装 Hexo

很多新手看到电影里黑客敲的“黑色窗口”就觉得头皮发麻。其实，**命令行（Command Line Interface，简称 CLI）** 和你平时用鼠标双击文件夹没有任何本质区别——只不过平时你是用**鼠标点击图标**跟电脑说话，而命令行是用**敲英文单词**跟电脑说话

### 1. 如何打开命令行窗口？

在 Windows 电脑上打开命令行：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_e2f62b4bcc5d6d9aa01087a7f2f3fd50.webp)

现在，请大家打开命令行窗口，依次输入下面 **3 行命令**（每输完一行按一下**回车键 `Enter`**），看看是否会输出版本号：

```
node -v
npm -v
git --version

```

* 如果每一行敲完回车后，下面都跳出了一串类似 `v20.x.x`、`10.x.x`、`git version 2.x.x` 的数字，说明你的 Node.js 和 Git 已经**成功安装**！

* 如果提示 `xxx 不是内部或外部命令`，通常是因为刚装完软件系统还没反应过来——**请把当前命令行窗口关掉重新打开一个**（或者重启一下 VS Code / 电脑）再试一次！

### 2. 零基础必学的 3 个简单命令行命令

| 命令写法 | 英文原意 | 作用 |
| ----- | ----- | ----- |
| `cd 文件夹名` | Change Directory | 比如输入 `cd myblog` 回车，就是走进当前目录下的 `myblog` 文件夹（注意 `cd` 后面有个空格！） |
| `cd ..` | Change Directory Up | 输入 `cd ..` 回车，立刻退回上一级目录 |
| `ls`（或 `dir`） | List / Directory | 列出当前文件夹下所有的文件和子文件夹（Git Bash / Mac 用 `ls`，CMD 用 `dir`） |

*(其实根本不用一路 `cd C:/xxx/xxx` 找过去。只需要像平时一样打开电脑的资源管理器，找到你想放博客的文件夹，点进去，在空白处直接**右键 -> `Open Git Bash here`**，打开的黑框框就自动在当前目录下了！)*

### 3. 给软件商店提速（配置 npm 淘宝镜像源）

刚才我们提到，`npm` 是 Node.js 自带的“应用商店”。但它的默认服务器在国外，如果直接在例会现场用默认源下载 Hexo，进度条可能会卡住一动不动。 所以，在下载任何东西之前，我们先参考 [npmmirror 镜像站官方文档](https://npmmirror.com/)，把下载源切换到国内阿里云/淘宝维护的高速镜像站！

在命令行里复制粘贴下面这行命令并回车：

```
npm config set registry https://registry.npmmirror.com
```

敲完回车没有任何报错就是成功了！你可以输入下面这行命令检查一下：

```
npm config get registry
```

如果屏幕打印出 `https://registry.npmmirror.com/`，说明你的高速下载通道已经开启！ *(此外，如果你以后在别的电脑上只想临时加速某一条安装命令，也可以在任何 `npm install ...` 命令的末尾加上 `--registry=https://registry.npmmirror.com` 后缀。)*

### 4. 正式安装 Hexo！

现在，在命令行中输入下面这行命令并回车，让 `npm` 帮我们把 [Hexo 官方脚手架](https://hexo.io/zh-cn/docs/) 安装到电脑上：

```
npm install -g hexo-cli --registry=https://registry.npmmirror.com
```

* **命令拆解**：
  * `npm install`：让应用商店帮我安装一个软件。
  
  * `-g`：`global`（全局安装）的缩写，意思是把 `hexo` 安装到整台电脑的公共区域，这样不管你在哪个文件夹打开命令行，都能直接使用 `hexo` 。
  
  * `hexo-cli`：Hexo 的命令行工具包名字。
  
* 等待十几秒进度条跑完，输入以下命令验证 Hexo 是否安装成功：

```
hexo -v
```

看到跳出一长串 `hexo-cli: x.x.x` 的版本信息，说明 Hexo 已经准备就绪

##  五、第三阶段：初始化你的博客仓库 & 本地调试预览

现在所有工具都齐了，我们要正式在电脑上搭建网站了

### Step 1：创建一个专门存放博客的空文件夹

1. 打开你电脑的磁盘（比如 `D盘` 或 `桌面`），新建一个全英文名字的空文件夹，比如叫 **`myblog`**（**文件夹名字和路径里尽量不要有中文和空格，更不要在已经装满别的文件的目录里直接初始化！**）。

2. 双击进入这个刚刚新建的空的 `myblog` 文件夹。

3. 在文件夹空白处**点击鼠标右键 -> 选择 `在终端打开`**，此时弹出的命令行窗口路径末尾应该显示着 `/myblog`。

   ![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_c3208d0d41713a7ef07c5b1490747ff3.webp)

   ![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_9ab6c25d5b1050f58e99c1715e59b346.webp)


### Step 2：初始化博客代码仓库（`hexo init`）

在这个打开的命令行窗口里，依次输入以下两行命令（第一行跑完成功后再输第二行）：

```
hexo init
```

* **发生了什么？** 当你敲下 `hexo init`（初始化）时，Hexo 会自动去把一套标准博客网站的初始模板代码下载到你的 `myblog` 文件夹里，并自动帮你安装所需的零件。

* 等待屏幕最后出现一句绿色的 **`INFO  Start blogging with Hexo!`**，再保险起见运行一下依赖包补充安装命令：

```
npm install --registry=https://registry.npmmirror.com
```

现在你再看一眼你的 `myblog` 文件夹——原本空空如也的文件夹里，瞬间多出了好几个文件夹和配置文件！这就是你博客的**本地代码仓库**。

### Step 3：本地编译与启动本地预览服务器

怎么在浏览器里看到它长什么样呢？在软件开发中，我们把这步叫做“本地编译与本地调试（Local Debugging）”。 继续在刚才的命令行窗口里，依次输入下面两行命令：

```
hexo g
hexo s
```

* **这两句暗号是什么意思？**

  1. `hexo g`（全称 `hexo generate`，生成/构建）：把你仓库里的原始笔记和配置，编译加工成浏览器能直接显示的静态网页文件。

  2. `hexo s`（全称 `hexo server`，启动本地服务器）：在你自己的电脑上临时开启一个微型网站服务器。

* 当你看到命令行里打印出下面这句话时：

  > `INFO  Hexo is running at http://localhost:4000/ . Press Ctrl+C to stop.`

* 快打开你的浏览器（Chrome / Edge 等），在地址栏输入 **`http://localhost:4000`** 并回车！

  ![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_5d42f9a08904b2a2e9943b043923efab.webp)

🎉 **恭喜你！！** 屏幕上出现了一个带着大图、写着 `Hello World` 的博客网站！这就是你亲手跑起来的第一个网站！

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_9486a55836b8309cdf7b85f019c88ac8.webp)

* **零基础科普：什么是 `localhost:4000`？**
* `localhost`（本地主机）指的是**你自己的这台电脑**，`:4000` 是房间门牌号（端口号）。
  
* 现在这个网站只运行在你自己的电脑内存里，只有你自己能看到，方便你在正式发到网上之前随便改、随便试错。
  
* 当你想继续在命令行里敲其他命令时，只需要回到命令行窗口，按下键盘上的 **`Ctrl + C`**，就能关掉这个本地预览服务器。

##  六、第四阶段：看懂项目文件结构 & 用 VS Code 写第一篇 Markdown 博客

刚才执行完 `hexo init` 后，`myblog` 文件夹里多出来的一堆文件到底是干嘛的？千万别乱删！我们现在用“宇宙第一编辑器” [**VS Code**](https://code.visualstudio.com/) 打开它，顺便教你如何优雅地写一篇博客。

### 1. 用 VS Code 打开你的博客文件夹

* 打开 **VS Code** 软件，点击左上角菜单 `File（文件）` -> `Open Folder（打开文件夹）`，选中你的 **`myblog`** 文件夹点击确定

### 2. 一张表看懂 Hexo 仓库核心文件结构

在 VS Code 左侧的资源管理器里，你会看到下面这些文件和文件夹。你只需要认识带 ⭐ 的核心成员即可：

| 文件 / 文件夹名称 | 重要程度 | 它的身份与作 |
| ----- | ----- | ----- |
| **`_config.yml`** | ⭐⭐⭐⭐⭐ | 网站的标题、副标题、你的作者名字、语言（改中文 `zh-CN`）、网站主题、以及最后上传到 GitHub 的地址，全都在这个文件里修改！ |
| **`source/`** | ⭐⭐⭐⭐     | 点开它里面的 **`_posts/`** 文件夹，你会看到一篇 `hello-world.md`。**以后你写的所有博客文章（`.md` 文件）全都放在 `source/_posts/` 里面！** |
| **`themes/`** | ⭐⭐⭐⭐ | 存放你下载的各种博客主题皮肤（默认自带一个叫 `landscape` 的基础皮肤）。 |
| **`scaffolds/`** | ⭐⭐ | 当你用命令新建文章时，Hexo 会按照这里的模板自动生成文章开头的标题和日期格式。 |
| **`public/`** | ⭐⭐ | 只有当你运行了 `hexo g` 之后它才会出现，里面装的是编译好的 HTML 网页成品（不需要手动去改它）。 |
| **`package.json`** | ⭐⭐ | 记录当前博客安装了哪些插件和版本信息。                       |
| **`node_modules/`** | 勿动 | 里面有成千上万个支撑 Hexo 运行的代码模块，**千万不要手动打开或删改里面的文件**。 |

>  **修改 `_config.yml` 的要求**： `.yml`（YAML）是一种对格式极其挑剔的配置文件。在修改 `_config.yml` 时，**每一个冒号 `:` 后面，都必须紧跟至少一个英文空格！**
>
> * 错误写法：`title:我的博客`（冒号后面没空格，运行报错）
>
> * 正确写法：`title: 我的博客`（冒号后面有一个空格）

### 3. 给 VS Code 装上“写博客神仙插件”（支持实时分屏预览！）

你看 `source/_posts/hello-world.md` 的后缀是 **`.md`**，它代表 **Markdown**——这是全世界程序员写技术文档、写博客最爱的轻量级排版语言。它不用像 Word 那样拿鼠标调字号，只用几个简单的符号（比如 `#` 代表大标题，`**` 代表加粗）就能排出极客感拉满的文章。

为了让 VS Code 写 Markdown 更爽，我们先装 2 个免费插件：

1. 点击 VS Code 最左侧边栏的 **“四个小方块”图标（Extensions / 扩展商店）**。

2. 在搜索框里依次搜索并点击 **`Install`（安装）**：

   * [**Chinese (Simplified) Language Pack**](https://marketplace.visualstudio.com/)：搜 `Chinese`，第一个就是官方中文汉化包，装完右下角点重启就是全中文界面啦！

   ![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_4749ee77ca17a825f03585511fa562a2.webp)

   * [**Markdown All in One**](https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one)：写 Markdown 必备的快捷键与自动目录补全神器。
   
   * [**Markdown Preview Enhanced**](https://marketplace.visualstudio.com/items?itemName=shd101wyy.markdown-preview-enhanced)：超强大的实时预览插件，让你左边打字，右边实时看到渲染出来的精美排版！

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_061cf34ae1db5166e656da37a8f86d03.webp)

### 4. 亲手写下你的第一篇博客文章！

让我们把刚才学到的操作串起来，发一篇属于你自己的文章：

1. **用命令新建文章**： 回到 `myblog` 的命令行窗口（如果你刚才还没关掉 `hexo s`，先按 `Ctrl + C` 停掉它，或者直接在 VS Code 里按快捷键 `` Ctrl + ` `` 唤出底部的内置终端），输入：

   ```
   hexo new "我的第一篇博客"
   ```

2. **在 VS Code 中找到并打开它**： 展开左侧的 **`source` -> `_posts`**，你会发现多出了一个 **`我的第一篇博客.md`**！点击打开它。

3. **开启右侧实时预览**： 点击编辑器右上角的 **“带放大镜的分屏小图标”**（或者在编辑区空白处右键 -> 选择 `Markdown Preview Enhanced: Open Preview to the Side`），右边立刻就会出现预览窗口！

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_e4014e46432b71588e68eea4f7dd72f4.webp)

1. **认识文章开头的“结构”并写点正文**： 你会看到文件最开头有两条 `---` 夹着的内容，千万别把 `---` 删了，这是给 Hexo 看的文章属性卡，我们在 `---` 下面用 Markdown 语法随便写几句话试试：

   ```
   ---
   title: 我的第一篇博客
   date: 2026-10-16 20:00:00
   tags:
     - TIC例会
     - 个人博客
   ---
   
   # 大家好！这是我的个人博客！
   
   今天在 **TIC 第二节例会** 上，我学会了用 [Hexo](https://hexo.io/zh-cn/) 搭建属于自己的网站！
   
   ## 我今天学会了什么？
   - 认识了软件开发的基本流程
   - 学会了使用命令行 `cd` 和 `hexo` 指令
   - 掌握了 **Markdown** 的基本排版语法
   
   > 乾坤未定，你我皆是黑马！欢迎常来我的博客逛逛~
   
   
   ```

2. **极其重要的一步：保存文件！** 写完后请按下键盘上的 **`Ctrl + S`**（Mac 为 `Command + S`）保存文件！看到小圆点消失，你的修改才算真正写进硬盘里了。

### 5. 本地更新的流程

每次你修改了 `_config.yml` 配置、或者新建/修改并保存了 `.md` 文章之后，怎么让本地网站刷新出最新内容呢：

```
hexo clean
hexo g
hexo s
```

* **为什么要按这个顺序敲？**

  1. **`hexo clean`（清理缓存）**：把之前旧的缓存文件（`db.json`）和旧的网页成品（`public` 文件夹）彻底打扫干净。很多时候你改了文章或配置却发现网页没变化，就是因为忘了跑 `hexo clean`

  2. **`hexo g`（重新构建）**：把刚才新写的《我的第一篇博客》重新编译进静态网页里。

  3. **`hexo s`（启动预览）**：再次打开 `http://localhost:4000`，刷新一下页面——你的《我的第一篇博客》已经出现在首页第一条啦！看满意后，回到命令行按 **`Ctrl + C`** 结束本地预览，准备进入最激动人心的**全网上线环节**！

## 七、第五阶段：走向世界！连接 GitHub Pages 部署你的专属 `github.io` 网站

前面我们在 `localhost:4000` 看到的网站，只有你自己的电脑能打开。现在，我们要借助 [**GitHub Pages**](https://pages.github.com/) 提供的免费静态网页托管服务，把你的博客正式发布到公网上，生成一个全世界任何人用手机、电脑都能打开的 `https://你的用户名.github.io` 网址

### Step 1：在 GitHub 上创建一个特殊名字的仓库

*(提醒：确保你的 [Watt Toolkit](https://steampp.net/) 加速依然开着！)*

1. 打开浏览器登录 [GitHub 官网](https://github.com/)。

2. 点击页面右上角头像旁边的 **`+` 号**，在下拉菜单中点击 **`New repository`**（新建代码仓库）。

3. **【生死攸关的一步：填写仓库名称 Repository name】**： 在 `Repository name` 输入框里，你填写的名字**必须严格遵守以下格式（一字不差，全小写）**：

   > **`你的GitHub用户名.github.io`**

   * **举个例子**：假设你的 GitHub 用户名叫 `xiaoming123`（可以在输入框左边 `Owner` 下面看到你自己的名字），那你在右边 `Repository name` 里就**必须填 `xiaoming123.github.io`**！

   * **为什么要这么填？** 这是 [GitHub Pages 官方文档](https://docs.github.com/pages/quickstart) 规定的特殊暗号。只有当仓库名严格等于 `用户名.github.io` 时，GitHub 才会自动把这个仓库识别为你的个人主页网站，并免费送你这个同名网址！

4. 下面的可见性保持默认的 **`Public`（公开）**，其他什么都不用勾选，直接拉到最底下点击绿色的 **`Create repository`** 按钮！
![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_53d19c51ea71d03c9a6915c93a05e867.webp)
### Step 2：配置 Git 身份与生成 SSH Key（给你的电脑办一张免密通行证）

仓库建好了，但 GitHub 怎么知道现在坐在电脑前上传代码的真的是你本人，而不是冒充你的黑客呢？ 我们需要用 Git 给电脑生成一把专属的**加密钥匙（SSH Key）**，把锁头（公钥）挂到你的 GitHub 账号上。以后你在电脑上敲命令上传博客，GitHub 核对钥匙无误就会瞬间放行！

请在桌面或 `myblog` 文件夹右键打开 **`Git Bash`**，严格按顺序执行下面 **4 步**：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_10_1ea94d80e7cc67d295134a72adeb5b53.webp)

#### 🔹 1. 告诉 Git 你的名字和邮箱（替换成你自己的）

在 Git Bash 中依次输入下面两行命令并回车（把引号里的内容换成你自己的 GitHub 用户名和注册邮箱）：

```
git config --global user.name "你的GitHub用户名"
git config --global user.email "你的GitHub注册邮箱"
```

#### 🔹 2. 生成你的专属 SSH 密钥对

继续输入下面这行命令（同样换成你的注册邮箱）：

```
ssh-keygen -t rsa -C "你的GitHub注册邮箱"


```

**敲完这行回车后，屏幕会停住问你 3 个问题（保存在哪、设不设密码）——请不要输入任何字符，直接连续按 3 下回车键（`Enter` -> `Enter` -> `Enter`）** 。直到你看到屏幕上打印出一个由字符组成的方框图案，说明钥匙已经生成完毕！

#### 🔹 3. 复制刚刚生成的公钥（`id_rsa.pub`）

不用去 C 盘翻找隐藏文件夹，直接在 Git Bash 里输入下面这行命令并回车：

```
cat ~/.ssh/id_rsa.pub
```

屏幕上会打印出一大串以 **`ssh-rsa AAAAB3NzaC1yc2...`** 开头、以你的邮箱结尾的乱码字符。 请用鼠标**从开头的 `ssh-rsa` 一直完整选中到末尾的邮箱**，右键点击 **`Copy`** 把它完整复制下来（千万别多复制或漏复制一个字母）！

#### 🔹 4. 把钥匙添加到 GitHub 网站上并测试连接

1. 回到浏览器的 [GitHub](https://github.com/) 页面，点击右上角你的**头像** -> 点击 **`Settings`（设置）**。

2. 在左侧菜单栏找到并点击 **`SSH and GPG keys`**。

3. 点击右上角绿色的 **`New SSH key`** 按钮：

   * **Title（标题）**：随便填个备忘名字，比如 `My Laptop`。

   * **Key（密钥）**：点击大输入框，按 `Ctrl + V` 把刚才复制的那一大串 `ssh-rsa ...` 粘贴进去。

   * 点击下方绿色的 **`Add SSH key`** 保存！

   * > （原文档此处为 GitHub 添加 SSH Key 的操作截图，请对照 GitHub 页面 Settings → SSH and GPG keys → New SSH key 操作）

4. **测试电脑和 GitHub 能不能握手成功**： 回到你的 Git Bash 黑框框，输入下面这行测试命令并回车：

   ```
   ssh -T git@github.com
   ```
   
   *  敲完回车后，屏幕会弹出一句询问： `Are you sure you want to continue connecting (yes/no/[fingerprint])?` **注意！这里不能直接按回车，必须用键盘敲入三个英文字母 `yes`，然后再按回车！**

   * 当你看到屏幕跳出下面这句热情的问候：

     > `Hi 你的用户名! You've successfully authenticated, but GitHub does not provide shell access.`

   * 🎉 **耶！你的电脑已经和 GitHub 成功连接！**

### Step 3：安装部署插件 & 修改 `_config.yml` 部署地址

钥匙配好了，现在我们只需要告诉 Hexo：“请把我的网站发到刚才建好的那个 GitHub 仓库里去！”

1. **安装 Hexo 的 Git 一键部署插件**： 确保你的命令行当前在 **`myblog`** 文件夹下，输入以下命令安装部署插件：

   ```
   npm install hexo-deployer-git --save --registry=https://registry.npmmirror.com
   ```
   
2. **修改博客根目录的 `_config.yml` 配置文件**： 在 VS Code 中打开 `myblog` 最外层的 **`_config.yml`** 文件，一直拉到**最底部（最后几行）**，你会看到一个 `# Deployment` 部分。 把它修改成下面这样（**请把两处 `你的GitHub用户名` 替换成你真实的 GitHub 用户名！**）：

   ```
   # Deployment
   ## Docs: https://hexo.io/docs/one-command-deployment
   deploy:
     type: git
     repo: git@github.com:你的GitHub用户名/你的GitHub用户名.github.io.git
     branch: main
   ```
   
   * 自查 3 件事**：

     1. `type:`、`repo:`、`branch:` 的**冒号后面是不是都有一个英文空格**？

     2. `type`、`repo`、`branch` 前面是不是都有 **2 个空格的缩进**并且上下对齐？

     3. 修改完之后，按 **`Ctrl + S` 保存**了吗？

### Step 4：一键部署上线！

见证奇迹的最后一步到了！
在 `myblog` 的命令行窗口中，依次输入下面 **3 行命令**（以后每次写完新文章想发到网上，也是敲这三行）：

```
hexo clean
hexo g
hexo d
```

* **这里的 `hexo d` 是什么？**
  `hexo d` 是 `hexo deploy`（部署）的缩写。它会调用我们刚装好的 `hexo-deployer-git` 插件，把 `public` 文件夹里生成好的网页成品，通过 SSH 加密通道一键推送到你的 `用户名.github.io` 仓库的 `main` 分支上！

* 当命令行最后打印出 **`INFO  Deploy done: git`** 时，代表代码已经成功发送到 GitHub 服务器！

🎉 **快去打开你的专属网站吧！**
第一次部署后，GitHub 后台构建页面大概需要 **1 \~ 2 分钟** 的反应时间。等待一分钟后，打开你的浏览器（甚至掏出手机发到寝室群里），在地址栏输入：

> **`https://你的GitHub用户名.github.io`**

看到你刚才写的《我的第一篇博客》出现在屏幕上那一刻——**恭喜你！你已经正式完成了人生中第一次完整的软件环境配置、开发调试与线上部署！**

## 八、第六阶段：进阶扩展——如何给博客换一套绝美主题与个性化美化？

成功上线后，很多同学看着默认的灰白色 Landscape 主题可能会想：**“怎么才能把我的博客变成例会开头学长学姐那种超酷的样子？”**
在 Hexo 里，网页的**文章内容（`source/`）**和**外观皮肤（`themes/`）**是完全分离的。换一套酷炫的外观，只需要**把新主题下载到 `themes` 文件夹，再去 `_config.yml` 里改一个词**就搞定了！

### 1. 热门高颜值 Hexo 主题推荐

编程世界里有一个最重要的能力叫 **“看官方文档（Read The Friendly Manual）”**。下面这几款是目前开源社区最火、中文文档最完善的神仙主题，大家课后可以挑一款自己最喜欢的去折腾：

| 主题名称 | 视觉风格特点 | 官方配置文档（保姆级中文教程） | GitHub 源码仓库 | 
| ----- | ----- | ----- | ----- | 
| [**Butterfly**](https://butterfly.js.org/en/) | 二次元/现代卡片风颜值天花板，内置打字机特效、背景粒子、夜间模式与丰富标签外挂 | [Butterfly 官方文档](https://butterfly.js.org/en/posts/butterfly-docs-en-get-started/) | [jerryc127/hexo-theme-butterfly](https://github.com/jerryc127/hexo-theme-butterfly) | 
| [**Fluid**](https://fluid-dev.github.io/hexo-fluid-docs/en/start/) | 极具呼吸感的 Material Design 设计，大图视差滚动，阅读体验清爽优雅，配置极简 | [Hexo Fluid 官方文档](https://fluid-dev.github.io/hexo-fluid-docs/en/start/) | [fluid-dev/hexo-theme-fluid](https://fluid-dev.github.io/hexo-fluid-docs/en/start/) | 
| [**NexT**](https://github.com/next-theme/hexo-theme-next) | 经典极简极客风，留白克制、层次分明，深受技术大佬喜爱 | [NexT 官方仓库与指南](https://github.com/next-theme/hexo-theme-next) | [next-theme/hexo-theme-next](https://github.com/next-theme/hexo-theme-next) | 
| [**更多官方主题**](https://hexo.io/themes/) | 涵盖极简、杂志、作品集、复古终端等上百种风格 | [Hexo Themes 官方主题商城](https://hexo.io/themes/) | [hexojs/awesome-hexo](https://github.com/hexojs/awesome-hexo) | 

### 2. 手把手实战：3 步换上 Butterfly 主题！

如何用 1 分钟把默认皮肤换成高颜值的 [**Butterfly**](https://github.com/jerryc127/hexo-theme-butterfly) 主题：

1. **Step 1：把主题源码克隆到 `themes/butterfly` 目录下**
   在你的 `myblog` 根目录下打开 Git Bash，输入下面这行命令（利用 Git 把 Butterfly 主题下载到 `themes/butterfly` 文件夹里）：

   ```
   git clone -b master https://github.com/jerryc127/hexo-theme-butterfly.git themes/butterfly
   ```
   
2. **Step 2：安装 Butterfly 主题需要的渲染插件**
   Butterfly 主题使用了 `pug` 和 `stylus` 编写页面样式，所以需要一行命令补齐这两个小插件：

   ```
   npm install hexo-renderer-pug hexo-renderer-stylus --save --registry=https://registry.npmmirror.com
   ```
   
3. **Step 3：去 `_config.yml` 总控开关里换衣服！**
   用 VS Code 打开 `myblog` 根目录下的 **`_config.yml`**，按 `Ctrl + F` 搜索 `theme:`（大概在第 99 行左右），你会看到原本写着：

   ```
   theme: landscape
   ```
   
   把它改成：

   ```
   theme: butterfly
   ```
   
   *( 再次确认：`theme:` 的冒号后面有一个空格！然后按 `Ctrl + S` 保存！)*
   
4. **本地预览新皮肤，满意后再一键推上 GitHub！**
   回到命令行，先用本地三连招看看效果：

   ```
   hexo clean
   hexo g
   hexo s
   ```
   
   打开 `http://localhost:4000` 刷新——哇！整个网站瞬间变成了精美的卡片式布局！
   确认好看之后，按 `Ctrl + C` 停掉本地预览，执行 **`hexo d`**，1 分钟后你线上的 `https://你的用户名.github.io` 也同步换上新皮肤啦！

> （原文档此处为换上 Butterfly 主题后的效果截图）

### 3. 课后可以继续怎么玩？（美化与进阶指路）

搭好框架只是开始，课后你可以对照 [Hexo 官方中文配置文档](https://hexo.io/zh-cn/docs/configuration) 和你所选主题的文档，解锁更多好玩的功能：

* **修改网站基础信息**：打开根目录 `_config.yml` 最顶部的 `# Site` 区域，把 `title`（网站标题）、`subtitle`（副标题）、`author`（你的昵称）、`language: zh-CN`（简体中文）改成你自己的信息。

* **更换头像、顶部背景图与社交链接**：打开主题文件夹下的配置文件（或新建 `_config.butterfly.yml`），按照主题文档把图片链接换成你喜欢的二次元壁纸或摄影作品。

* **开启分类（Categories）、标签云（Tags）与“关于我（About）”页面**：使用 `hexo new page tags` 等命令创建独立子页面。

* **添加炫酷插件**：比如 Live2D 桌面看板娘、网易云音乐吸底播放器、Giscus/Waline 评论区、网站访问人数统计（不蒜子）、全站文章搜索等！

