---
title: 极简条件下的房间3D重建，DA3与各3DGS Pipeline方案横评
date: 2026-02-20 16:21:03
categories:
  - 学习
tags:
  - 3DGS
  - SDF
  - Depth Anything 3
  - CG
  - CV
slug: room-3d-reconstruction-da3-3dgs
alias:
  - '/2026/02/20/极简条件下的房间3D重建，DA3与各3DGS-Pipeline方案横评/'
---

# 极少素材极低质量的极端情况下房间三维重建不同Pipeline对比

在推进个人 3D 记忆库构建的过程中，我们经常会遇到一个棘手的问题：日常随手记录的视频往往是不完美的。我们无法像实验室里那样，架设专业设备去获取无死角、高分辨率的素材。 如果只有一段极少视角的手机视频、极低画质、再加上满屋子的白墙和反光地板，三维重建还能做吗？ 传统的 SfM（如 COLMAP）在这种大面积弱纹理场景下往往直接宣告失败。为了探寻在**极少素材、极低质量**的极端情况下的最佳解决方案，我在本地（RTX 5070 12G）对目前主流的几种结合深度先验的 3DGS Pipeline 进行了横向对比测试。

## 素材

- **拍摄器材**：OPPO Find X8
- **拍摄环境**：室内傍晚暗光环境
- **素材规格**：从手机拍摄视频中抽取165张约500×700的照片，焦段15mm广角镜头（极少素材极低质量的极端情况）

## 训练环境

12600kF + RTX5070 12G + 64G RAM

## 参考资料

### 论文

- **3D Gaussian Splatting for Real-Time Radiance Field Rendering** - Bernard Kerbl等, SIGGRAPH 2023 [[Paper](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/3d_gaussian_splatting_high.pdf)] [[Project](https://repo-sam.inria.fr/fungraph/3d-gaussian-splatting/)]
- **Depth Anything: Unleashing the Power of Large-Scale Unlabeled Data** - Lihe Yang等, CVPR 2024 [[Paper](https://arxiv.org/abs/2401.10891)] [[Project](https://depth-anything.github.io/)]
- **Depth Anything V3** - Lihe Yang等, 2025 [[Paper](https://arxiv.org/abs/2501.05931)] [[Project](https://depth-anything-v3.github.io/)]
- **SuGaR: Surface-Aligned Gaussian Splatting for Efficient 3D Mesh Reconstruction and High-Fidelity Rendering** - Antoine Guédon等, CVPR 2024 [[Paper](https://arxiv.org/abs/2312.13109)] [[Project](https://anttwo.guedon.github.io/sugar/)]
- **DN-Splatter: Depth Normalizer for Robust Gaussian Splatting** - Vikram Prateek等, 2024 [[Paper](https://arxiv.org/abs/2403.17879)] [[Project](https://dn-splatter.github.io/)]
- **2D Gaussian Splatting for Geometrically Accurate Radiance Fields** - Tang, Yiqin等, SIGGRAPH 2024 [[Paper](https://arxiv.org/abs/2312.07108)] [[Project](https://github.com/limacv/GaussianView)]
- **COLMAP: Structure-from-Motion and Multi-View Stereo** - Johannes L. Schönberger等, CVPR 2016 [[Paper](https://arxiv.org/abs/1610.07950)] [[Project](https://colmap.github.io/)]

### 代码仓库

- **Depth Anything V3** - [[GitHub](https://github.com/DepthAnything/Depth-Anything-V3)]
- **3D Gaussian Splatting (Official)** - [[GitHub](https://github.com/raphaelmeudec/Splatting)]
- **SuGaR** - [[GitHub](https://github.com/Anttwo/SuGaR)]
- **DN-Splatter** - [[GitHub](https://github.com/DN-Splatter/DN-Splatter)]
- **2D Gaussian Splatting** - [[GitHub](https://github.com/limacv/GaussianView)]
- **DepthSplat** - [[GitHub](https://github.com/ADL-CHU/DepthSplat)]
- **COLMAP** - [[GitHub](https://github.com/colmap/colmap)]
- **gaussian-splatting-comparison** - 各种3DGS实现对比 [[GitHub](https://github.com/nerfstudio-project/gaussian-splatting-comparison)]

---

## Depth Anything 3

### 720P原图（多白墙，多噪点，低清晰度）：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_3d0dd1f7dc1b5b8547ae0312d097278a.webp)

### DA3 stream 单目深度图（准确性高）：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_3cc2f07120cbba149ca80859ddb1f64c.webp)

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_7e7a1b3007c2065f79ef5522de7f8fd2.webp)

## Depth Anything 3+DepthSplat（优先级1）

### 处理时间

1.5min+1s

### 正面：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_a8d633748ae490da40a73ef14fd72cd0.webp)

### 外面：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_73014c3c7c3c64d00d7cc8cf7f47c4f4.webp)

### 优缺点

优点：干净。快速。有Mesh

缺点：对于没拍到或者没拍好的地方会断裂

## Depth Anything 3+DN-Splatter 30k迭代（优先级2）

### 处理时间：

1.5min+30min~1h

### 内部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_9a89026981c4cf91e815a5155502a8d4.webp)

### 外部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_c965149975a8fef85052458fadc756d1.webp)

### 优缺点：

优点：内部细节丰富，外部相对干净，唯一一个几乎无断裂的（包括基本没有拍到的地板或者反光严重的地板）

缺点：视觉效果还是不算满意

## Depth Anything 3+原生3DGS 迭代30000步

### 优缺点：

1.5min+15min

### 内部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_96b3b30d409d434095f1c82d341ea0bb.webp)

### 外部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_abf277c3c374d9bd2bcc3473e3b5eac7.webp)

### 优缺点：

优点：没有什么空洞

缺点：有点模糊不清。模型太大约900mb

## COLMAP+SuGaR  SDF模式（非SDF模式如Mesh模式和无约束模式都是重建失败）Part3 15000步迭代

### 训练时间：

约1.5h

### 内部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_05e88c77d03d3e60f31ca8ca3f275e35.webp)

### 外部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_dfc3596887047cfa8cbe84234d3ba890.webp)

### 优缺点：

优点：传统COLMAP下唯一内成功的

缺点：太慢了，太破碎了

## COLMAP+SuGaR  SDF模式（非SDF模式如Mesh模式和无约束模式都是重建失败）Part3 30000步迭代

### 训练时间：

1.5h+

## 内部：

支离破碎没法看

### 外部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_cd527cbfd8bbfb7d2a1d51e02c2ef732.webp)

### 优缺点：

优点：整个房间基本都有高斯椭球覆盖，比15000步的多

缺点：漂浮的椭球过多，完全不能看；太慢了

## COLMAP+原生3DGS，迭代5k步，24mm主设拍摄（只有这个素材是24mm，其他都是15mm广角）

### 训练时间：

约20min

### 内部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_608cbb59a995c0ca55568305326c6ecb.webp)

### 外部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_111e2324d43e8bc0e64592ed971624bf.webp)

### 优缺点

优点：内部细节还行

缺点：整个房间只有一半重建成功，另一半断裂，房间外太凌乱

## COLMAP+原生3DGS，迭代15k步，15mm广角拍摄

### 训练时间：

约15min

### 内部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_b31087952912b9f0843e17a4cb604d37.webp)

### 外部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_fe6603b819013a49cd8f4e0821dbc958.webp)

### 优缺点：

优点：COLMAP不断裂了

缺点：内部细节不足，外部凌乱

## Depth Anything 3+2DGS 3w步

### 训练时间：

1.5min+30min~1h

### 内部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_ab25060e9be6192e4a8fa3107b4f3a6a.webp)

### 外部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_0d5094b581880fc046e1c087d08a8d89.webp)

### 优缺点：

优点：外部相对干净

特点：内部看像是在看mesh

缺点：内部细节不足

## Depth Anything 3+SuGaR

### 训练时长：

1.5min+1.5h

### 内部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_101bb0e71a1e83913583aa123ef90a7a.webp)

### 外部：

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/26_02_ee8b59be3a192215a519d3df05c90816.webp)

### 优缺点：

优点：外部相对干净，内部细节还行

缺点：内部不够整洁，耗时太多

## 总结与建议

基于以上对比测试，对于极简条件下的房间3D重建场景：

- **最佳快速方案**：Depth Anything 3 + DepthSplat（~1.5min处理时间，干净且带Mesh）
- **最佳质量方案**：Depth Anything 3 + DN-Splatter（30k迭代，内部细节丰富，几乎无断裂）
- **不推荐方案**：传统COLMAP + SuGaR（耗时过长，1.5h+，且容易断裂）

### 关键技术点

1. **深度先验的重要性**：在弱纹理场景下，DA3的单目深度估计显著提升了重建质量
2. **Pipeline选择**：结合深度先验的Pipeline相比传统SfM方法更鲁棒
3. **训练时间权衡**：快速方案适合预览，质量方案适合最终输出

### 实验参数说明

- **素材**：165张约500×700照片，15mm广角镜头
- **训练环境**：12600KF + RTX 5070 12G + 64G RAM
- **深度估计**：DA3 Stream 单目深度图
- **3DGS迭代步数**：15k-30k步（根据不同Pipeline调整）

