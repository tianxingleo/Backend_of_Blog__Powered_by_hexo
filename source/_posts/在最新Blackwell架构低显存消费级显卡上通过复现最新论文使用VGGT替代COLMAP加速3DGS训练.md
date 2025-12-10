---
title: 在最新Blackwell架构低显存消费级显卡上通过复现最新论文使用VGGT替代COLMAP加速3DGS训练
date: 2025-12-10 21:53:53
tags:
  - vggt
  - 3dgs
  - wsl
  - RTX5070
  - blackwell
  - colmap
  - linux
  - pytorch
---

# 在 RTX 5070 + WSL 上使用 VGGT 替代 COLMAP 加速 3DGS 训练

在 3D 高斯泼溅（3DGS）和 NeRF 的工作流中，COLMAP 带来的稀疏重建（SfM）往往是耗时最长的瓶颈。Meta 推出的 **VGGT (Visual Geometry Grounded Transformer)** 提供了一种基于 Transformer 的前馈推理方案，能在几秒钟内完成传统算法需要数分钟甚至数小时的位姿估计任务。

本文将详细介绍如何在 **WSL (Windows Subsystem for Linux)** 环境下，利用 **NVIDIA RTX 5070** 显卡部署 VGGT，并将其集成到 Nerfstudio/Splatfacto 的训练管线中，实现“秒级”场景初始化。

------

## 第一部分：最佳实践部署流程

### 1. 环境准备

由于 RTX 50 系列显卡架构较新，对 CUDA 版本有特定要求，同时 WSL 环境有其特殊性，建议按照以下步骤配置：

**系统要求：**

- **OS:** Windows 11 + WSL 2 (Ubuntu 22.04/24.04)
- **GPU:** NVIDIA RTX 5070 (12GB VRAM)
- **Driver:** Windows 主机端安装最新的 NVIDIA Game Ready 驱动

**环境安装：**

1. **创建 Conda 环境：**

   Bash

   ```
   conda create -n vggt python=3.10 -y
   conda activate vggt
   ```

2. **安装 PyTorch (关键步骤)：** 不要使用 `requirements.txt` 中的旧版本。针对 RTX 5070，需安装支持 CUDA 12.4+ 的版本：

   Bash

   ```
   pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
   ```

3. **安装 VGGT：**

   Bash

   ```
   git clone https://github.com/facebookresearch/vggt.git
   cd vggt
   # 解决潜在的构建工具冲突
   export SETUPTOOLS_USE_DISTUTILS=stdlib
   pip install -e .
   ```

### 2. 构建 VGGT 推理脚本

为了替代 `colmap mapper`，我们需要编写一个 Python 脚本，直接调用 VGGT 模型进行推理，并将结果保存为 COLMAP 标准格式 (`cameras.bin`, `images.bin`, `points3D.bin`)。

以下是适配 12GB 显存的优化版核心代码逻辑：



```python
import torch
import torch.nn.functional as F
import numpy as np
from pathlib import Path
from vggt.models.vggt import VGGT
from vggt.utils.load_fn import load_and_preprocess_images_square
from vggt.utils.pose_enc import pose_encoding_to_extri_intri
from vggt.utils.geometry import unproject_depth_map_to_point_map
from vggt.utils.helper import create_pixel_coordinate_grid, randomly_limit_trues
from vggt.dependency.np_to_pycolmap import batch_np_matrix_to_pycolmap_wo_track

def run_vggt_inference(image_dir, output_sparse_dir):
    device = "cuda"
    # RTX 5070 强力推荐使用 bfloat16 加速
    dtype = torch.bfloat16 
    
    # 1. 加载模型
    model = VGGT()
    # 自动加载预训练权重
    state_dict = torch.hub.load_state_dict_from_url("https://huggingface.co/facebook/VGGT-1B/resolve/main/model.pt")
    model.load_state_dict(state_dict)
    model.eval().to(device)

    # 2. 数据预处理 (混合分辨率策略)
    # load_res=1024 保持原始纹理细节用于生成点云颜色
    # 推理时会下采样到 518x518
    image_paths = sorted(list(Path(image_dir).glob("*")))
    images_tensor, original_coords = load_and_preprocess_images_square(image_paths, target_size=1024)
    images_tensor = images_tensor.to(device)

    # 3. 前向推理 (Transformer Aggregator)
    vggt_res = 518
    images_input = F.interpolate(images_tensor, size=(vggt_res, vggt_res), mode="bilinear", align_corners=False)
    
    with torch.no_grad():
        with torch.cuda.amp.autocast(dtype=dtype):
            # 获取 Transformer 特征
            aggregated_tokens_list, ps_idx = model.aggregator(images_input[None])
            
            # 预测相机参数与深度
            pose_enc = model.camera_head(aggregated_tokens_list)[-1]
            extrinsic, intrinsic = pose_encoding_to_extri_intri(pose_enc, images_input.shape[-2:])
            depth_map, depth_conf = model.depth_head(aggregated_tokens_list, images_input[None], ps_idx)

    # 🔥【内存优化关键点】立刻释放巨大的中间特征变量
    # 25+ 张图片产生的 token list 极大，必须手动释放才能进行后续点云生成
    del aggregated_tokens_list
    torch.cuda.empty_cache()

    # 4. 数据转换 (Tensor -> Numpy)
    extrinsic = extrinsic.squeeze(0).cpu().numpy()
    intrinsic = intrinsic.squeeze(0).cpu().numpy()
    depth_map = depth_map.squeeze(0).cpu().numpy()
    depth_conf = depth_conf.squeeze(0).cpu().numpy()

    # 5. 反投影生成 3D 点云
    points_3d = unproject_depth_map_to_point_map(depth_map, extrinsic, intrinsic)

    # 6. 动态阈值过滤 (防止稀疏点云为空)
    # 针对纹理较弱或图片较少的情况，动态保留 Top-K 高置信度点
    conf_flat = depth_conf.reshape(-1)
    target_points = 100000
    if conf_flat.shape[0] > target_points:
        k_idx = conf_flat.shape[0] - target_points
        conf_threshold = max(float(np.partition(conf_flat, k_idx)[k_idx]), 0.1)
    else:
        conf_threshold = 0.1
    
    conf_mask = depth_conf >= conf_threshold
    
    # 7. 导出为 COLMAP 格式
    # ... (省略具体的 PyCOLMAP 转换与相机参数 Rescale 代码) ...
    # 核心是调用 batch_np_matrix_to_pycolmap_wo_track 并保存到 output_sparse_dir
```

### 3. 接入 Nerfstudio

使用上述脚本生成 `sparse/0/` 目录后，直接运行 `ns-process-data` 并跳过 COLMAP 步骤：

Bash

```
ns-process-data images \
    --data ./data/images \
    --output-dir ./data \
    --skip-colmap \  # <--- 关键参数：直接使用 VGGT 生成的结果
    --colmap-model-path colmap/sparse/0
```

------

## 第二部分：踩坑实录与故障排除 (Troubleshooting)

在复现过程中，我们遇到了一系列极具代表性的问题，涵盖了 Python 环境、显存管理到 WSL 文件系统特性。以下是详细记录。

### 1. 致命的显存溢出与“假死”现象

- **现象：** 当输入图片数量增加到 50 张左右时，程序并未报错崩溃，而是直接卡死，运行时间从几秒延长至数十分钟，且 `Ctrl+C` 无法终止。
- **原因：** * VGGT 基于 Transformer，显存占用与 Token 数量（图片数 × 分辨率）呈平方级增长。
  - 在 Windows/WSL 环境下，NVIDIA 驱动存在**共享显存机制**。当 12GB 显存耗尽时，系统自动调用系统内存（RAM）作为显存。内存带宽远低于显存，导致计算速度断崖式下跌，表现为程序“卡死”。
  - **代码隐患：** 原始代码中，模型推理产生的巨大中间变量 `aggregated_tokens_list` 在推理结束后未被及时释放，导致显存无法回收用于后续的点云生成。
- **解决方案：**
  - **手动内存管理：** 在 `model.aggregator` 推理结束后，立即执行 `del aggregated_tokens_list; torch.cuda.empty_cache()`。
  - **参数微调：** 对于 12GB 显存，建议将输入分辨率 `vggt_res` 设为 518（图片<30张）或 448/336（图片>30张）。

### 2. Conda 环境下的 `distutils` 冲突

- **现象：** 在安装依赖或运行 `ns-train` 时，报错 `AssertionError: .../distutils/core.py`。

- **原因：** `setuptools` (v60+) 与 Conda 环境自带的 `distutils` 存在版本冲突。`gsplat` 等库在运行时动态编译 CUDA 扩展触发了此检查。

- **解决方案：** 设置环境变量强制使用 Python 标准库：

  Python

  ```
  import os
  os.environ["SETUPTOOLS_USE_DISTUTILS"] = "stdlib"
  ```

### 3. 脚本命名引发的 `ModuleNotFoundError`

- **现象：** 运行脚本时报错 `ModuleNotFoundError: No module named 'vggt.models'; 'vggt' is not a package`。
- **原因：** 运行的脚本文件被命名为 `vggt.py`。Python import 机制会优先加载当前目录下的同名文件，而不是安装在 site-packages 中的 `vggt` 库。
- **解决方案：** * 将执行脚本重命名（例如 `run_pipeline.py`）。
  - 在代码头部使用 `sys.path` 调整搜索优先级。

### 4. Numpy 对象的“画蛇添足”错误

- **现象：** 报错 `AttributeError: 'numpy.ndarray' object has no attribute 'numpy'`。
- **原因：** VGGT 的工具函数 `unproject_depth_map_to_point_map` 返回的已经是 Numpy 数组，但在调用时习惯性地多加了一个 `.numpy()` 后缀。
- **解决方案：** 删除多余的转换调用。

### 5. Nerfstudio 报错：空点云 (Shape Mismatch)

- **现象：** `ns-train` 启动时报错 `RuntimeError: mat1 and mat2 shapes cannot be multiplied`。
- **原因：** * VGGT 默认的置信度过滤阈值（`conf > 5.0`）对于某些纹理较弱或图片较少（如 12 张）的场景过于严苛。
  - 导致生成的 `points3D.bin` 中没有任何点，Nerfstudio 无法初始化高斯点云。
- **解决方案：** 弃用固定阈值，改为**动态 Top-K 策略**。无论置信度绝对值如何，强制保留每张图中置信度最高的 N 个点，确保下游任务有数据可用。

### 6. WSL 特有的文件系统问题

- **现象：** 报错 `PIL.UnidentifiedImageError: cannot identify image file '...:Zone.Identifier'`。
- **原因：** Windows 下载的文件带有 Web 标记（Mark of the Web）。在 WSL 中，这些标记变成了可见的 `Zone.Identifier` 文本文件。Python 的 `glob` 扫描时误将其当作图片读取
