---
title: 计算几何初识：沃罗诺伊图与德劳内三角剖分（Voronoi Diagram & Delaunay Triangulation）
date: 2025-12-27 21:33:52
tags:
  - SDFoam
  - 计算机图形学
  - sdf
---

在计算机视觉与图形学的最新研究（如 CVPR/SIGGRAPH）中，**混合表征 (Hybrid Representation)** 正逐渐成为主流。SDFoam 作为其中的代表作，其核心难点往往不在于神经网络架构本身，而在于其底层采用的**计算几何 (Computational Geometry)** 结构。

本文将从数学定义与工程应用两个维度，深入剖析 SDFoam 的“几何骨架”—— **沃罗诺伊图 (Voronoi Diagram)** 与 **德劳内三角剖分 (Delaunay Triangulation)**。

> 注：文本将围绕最新论文[SDFoam: Signed-Distance Foam for explicit surface reconstruction](https://arxiv.org/abs/2512.16706)展开

## 1. 沃罗诺伊图 (Voronoi Diagram)：基于度量的空间划分

在三维重建任务中，如何高效地离散化连续空间是一个核心命题。传统的体素网格 (Voxel Grid) 采用规则划分，但其空间利用率低，难以适配多尺度的场景细节。SDFoam 选择了沃罗诺伊图，这是一种基于**距离度量**的自适应划分方案。

### 1.1 定义与数学描述
假设在欧几里得空间 $\mathbb{R}^3$ 中存在一组离散的**种子点 (Seed Points)** 或生成元，集合记为 $P = \{p_1, p_2, ..., p_n\}$。

沃罗诺伊图将空间划分为 $n$ 个区域，每个区域 $C_i$（称为 **Voronoi Cell**）包含空间中所有到 $p_i$ 的距离小于等于到其他任何种子点 $p_j$ 的距离的点。

SDFoam 论文中的形式化定义如下：
$$C_i = \{ x \in \mathbb{R}^3 \mid \|x - p_i\| \le \|x - p_j\|, \forall j \neq i \}$$

这里的 $\|\cdot\|$ 通常指 $L_2$ 范数（欧几里得距离）。这一定义不仅是一个几何描述，更是在优化过程中计算 **光线-单元交点 (Ray-Cell Intersection)** 的数学基础。

### 1.2 几何性质与拓扑特征
*   **凸多面体 (Convex Polyhedron)：** 在三维空间中，两个点的等距面是一个平面（垂直平分面）。一个 Voronoi Cell 是由多个这样的半空间取交集而成的。由于半空间是凸集，且凸集的交集仍为凸集，因此 **Voronoi Cell 必然是凸多面体**。这一性质保证了光线在穿过气泡时，进入点和射出点是成对出现的，极大地简化了光线追踪算法。
*   **空间完备性 (Partition of Unity)：** 所有 Voronoi Cell 的并集覆盖了整个空间，且内部互不重叠（除边界外）。这意味着场景中不存在“定义的真空区”，保证了渲染的连续性。

## 2. 德劳内三角剖分 (Delaunay Triangulation)：结构化连接

如果说 Voronoi 定义了“体积”，那么德劳内三角剖分则定义了“连接”与“拓扑”。它是 Voronoi 图的**对偶图 (Dual Graph)**。

### 2.1 对偶性 (Duality)
在计算几何中，Voronoi 与 Delaunay 是一一对应的：
*   **定义：** 如果两个 Voronoi 单元 $C_i$ 和 $C_j$ 共享一个公共面（Face），则连接它们的种子点 $p_i$ 和 $p_j$ 构成一条德劳内边。
*   **高维推广：** 在 3D 空间中，如果四个 Voronoi 单元共享一个公共顶点，则对应的四个种子点构成一个 **德劳内四面体 (Delaunay Tetrahedron)**。

这一对偶性在 SDFoam 中至关重要：它允许算法在**显式几何 (Explicit Geometry)** 和 **邻域关系 (Adjacency)** 之间无缝切换。

### 2.2 空球特性 (Empty Sphere Property)
为何选择 Delaunay 而非任意三角剖分？因为它具有优良的数值性质。
*   **2D 描述：** 任何 Delaunay 三角形的外接圆内部不包含其他种子点。
*   **3D 描述：** 任何 Delaunay 四面体的外接球内部不包含其他种子点。

这一特性最大化了网格中最小角的度数，避免了狭长、病态的四面体（Sliver Tetrahedra）。在物理仿真和有限元分析中，病态网格会导致严重的数值误差，而 Delaunay 网格在拓扑上是最“鲁棒”的选择。

## 3. 核心机制：隐式拓扑与数据压缩

理解了上述概念后，我们就能通过 **“数据压缩”** 的视角来理解 SDFoam 的设计哲学。

在传统的 Mesh 存储格式（如 OBJ）中，我们需要显式存储两类信息：
1.  **几何信息：** 顶点列表 $V$。
2.  **拓扑信息：** 面索引列表 $F$（定义谁和谁相连）。

然而，在 SDFoam 的架构中，利用 Voronoi/Delaunay 的数学特性，我们**仅需存储种子点的位置 $P$**。
*   **隐式拓扑推断：** 一旦点集 $P$ 确定，其对应的 Voronoi 空间划分和 Delaunay 连接关系在数学上是**唯一确定**的。
*   **可微性基础：** 这使得神经网络可以通过仅优化点的位置 $(x, y, z)$，来动态地改变整个场景的拓扑结构。这是一种极高维度的压缩，也是实现 **可微渲染 (Differentiable Rendering)** 的关键前提。

## 4. 为什么 SDFoam 选择 Voronoi？

相比于 NeRF 的 MLP 隐式场和 3DGS 的高斯椭球，SDFoam 引入 Voronoi 气泡作为基本单元（Primitive）解决了以下痛点：

### 4.1 自适应离散化 (Adaptive Discretization)
传统的体素网格（Voxel Grid）存在分辨率与内存的矛盾（$O(N^3)$ 复杂度）。而 Voronoi 结构具有天然的**空间自适应性**：
*   在几何细节丰富的区域（如物体表面），通过 **Densify（加密）** 策略增加种子点，气泡自动变小，分辨率提高。
*   在平坦或空旷区域，种子点稀疏，气泡变大，节省计算资源。

### 4.2 显式与隐式的混合 (Hybrid Representation)
这是 SDFoam 的核心创新点：
*   **显式骨架 (Explicit Backbone)：** Voronoi 提供了分段常数（Piecewise Constant）的空间划分，使得光线追踪可以通过几何求交快速完成，绕过了 NeRF 那样昂贵的沿光线密集采样。
*   **隐式细节 (Implicit Detail)：** 每个气泡内部并非简单的颜色块，而是携带了局部的 **SDF (Signed Distance Field)** 和 **球谐系数 (SH)**。

这种设计利用 Voronoi 的 **“硬切割”** 能力来捕捉宏观拓扑，同时利用 SDF 的 **“软描述”** 能力来保证跨越气泡边界时的表面光滑性和几何连续性（Geometric Coherence）。

---

### 总结

SDFoam 并非凭空创造了新的几何概念，而是巧妙地复兴了经典的计算几何工具。
*   **Voronoi** 提供了高效、凸多面体的空间划分。
*   **Delaunay** 提供了鲁棒的拓扑连接。
*   **对偶性** 实现了仅通过优化点位来驱动复杂拓扑演变的可能。
