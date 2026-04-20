---
title: 【首发】在 RTX 5070 (Blackwell) + WSL2 上跑通最新模型 Meta SAM 3D 的终极方案
date: 2025-12-08 14:29:13
categories:
  - 项目
tags:
  - 5070
  - blackwell
  - wsl
  - pytorch
  - cuda
  - SAM3D
  - linux
  - 3dgs
---

**关键词**：RTX 5070, WSL2, PyTorch Stable (CUDA 12.8), SAM 3D, Runtime Mocking, 显存流水线优化

## 1. 背景与技术挑战

Meta 最新发布的 **SAM 3D Objects** 是单图生成 3D 的 SOTA 模型。然而，在 2025 年发布的 RTX 50 系列显卡上部署该模型面临巨大挑战：

1. **架构代差**：RTX 5070 采用 Blackwell 架构 (sm_120)，旧版 PyTorch 无法识别。
2. **依赖地狱**：SAM 3D 依赖的 Kaolin 和 PyTorch3D 等库尚未适配 CUDA 12.8+，导致源码编译失败。
3. **显存瓶颈**：模型加载需要占用大量显存，直接运行极易导致 12GB 显存溢出 (OOM)。

本文提出一种**“降维打击”**的解决方案：利用 PyTorch 稳定版驱动硬件，通过**源码编译**解决核心渲染器 (gsplat) 兼容性，利用**Runtime Mocking (运行时伪造)** 技术绕过非核心库的编译难题，并通过**显存分级流水线**实现大模型在消费级显卡上的流畅运行。



## 2. 基础环境构建 (Infrastructure)

### 2.1 WSL2 环境准备

确保 Windows 显卡驱动已更新至支持 CUDA 12.8 的版本。在 WSL2 (Ubuntu 22.04/24.04) 中执行：

```
# 创建干净的 Python 3.10 环境 (兼容性最佳)
conda create -n sam3d_rtx50 python=3.10 -y
conda activate sam3d_rtx50

# 升级基础构建工具
pip install --upgrade pip setuptools wheel ninja
```

### 2.2 安装 PyTorch (稳定版 CUDA 12.8)

针对 RTX 50 系显卡，直接使用官方支持 CUDA 12.8 的稳定版 PyTorch。这是驱动 sm_120 架构的核心。

codeBash

```
# 安装 PyTorch Stable (2025.12 此时官方已支持 CUDA 12.8)
pip3 install torch torchvision
```

*验证：运行 python -c "import torch; print(torch.cuda.get_device_capability())" 应输出 (12, 0)。*

### 2.3 编译核心光栅化引擎：Gsplat

SAM 3D 的核心生成能力依赖 gsplat。由于二进制包不兼容 Blackwell 架构，必须**强制源码编译**。



```
# 1. 建立工作目录
mkdir -p ~/workspace/ai && cd ~/workspace/ai

# 2. 强制源码编译 gsplat
# --no-binary: 强制不使用预编译包
# --no-build-isolation: 使用当前环境的 PyTorch 进行编译
pip install gsplat --no-binary=gsplat --no-cache-dir --no-build-isolation
```



## 3. SAM 3D 模型部署 (Model Setup)

### 3.1 安装 SAM 3D 主体

采用 **“无依赖安装模式”**，防止 pip 自动降级我们已配置好的 PyTorch 和 Gsplat。



```
cd ~/workspace/ai
git clone https://github.com/facebookresearch/sam-3d-objects.git
cd sam-3d-objects

# 仅安装代码逻辑，不安装依赖
pip install -e . --no-deps

# 手动补齐纯 Python 依赖 (避开 Kaolin/PyTorch3D)
pip install hydra-core omegaconf tqdm scikit-image opencv-python matplotlib nvidia-pyindex
pip install git+https://github.com/microsoft/MoGe.git@a8c37341bc0325ca99b9d57981cc3bb2bd3e255b
```

### 3.2 下载模型权重 (Hugging Face)

配置 Hugging Face 并下载完整权重。



```
# 1. 登录 Hugging Face (需要 Access Token)
pip install "huggingface_hub[cli]"
huggingface-cli login 

# 2. 下载模型权重
TAG=hf
hf download --repo-type model --local-dir checkpoints/${TAG}-download --max-workers 1 facebook/sam-3d-objects
mv checkpoints/${TAG}-download/checkpoints checkpoints/${TAG}
rm -rf checkpoints/${TAG}-download

# 3. 关键修复：补全缺失的配置文件 (官方权重包常缺失此文件)
mkdir -p ./checkpoints/hf
wget -O ./checkpoints/hf/ss_generator.yaml https://raw.githubusercontent.com/facebookresearch/sam-3d-objects/main/configs/ss_generator.yaml
```



## 4. 技术创新：全栈优化脚本 (sam3d.py)

这是本方案的核心技术创新点。我们编写一个单一的 Python 脚本 sam3d.py，集成了以下技术：

1. **Runtime Dependency Injection (Mocking)**: 在内存中动态创建虚假的 kaolin 和 pytorch3d 模块，骗过 Python 的 import 检查，从而无需编译这些在 RTX 50 上难以构建的库。
2. **CPU-Offload Initialization**: 拦截 torch.load，强制将所有模型权重加载到系统内存 (RAM)，防止初始化阶段 GPU OOM。
3. **Pipeline Hooking**: 劫持推理管线函数，透传中间结果，强制关闭 Mesh 生成步骤（因其依赖 Kaolin），仅保留 Gaussian Splat 生成。

**请将以下代码保存为 sam3d.py，放在 Windows 的工程目录下：**



```python
import os
import sys
import shutil
import time
import datetime
from pathlib import Path
import logging
import torch
from types import ModuleType
import numpy as np
from PIL import Image

# ================= 🔧 技术创新 1: 运行时依赖注入 (Mocking) =================
# 原理：SAM 3D 仅在数据加载和 Mesh 导出阶段依赖 Kaolin/PyTorch3D。
# 核心推理 (3DGS 生成) 仅依赖 gsplat。通过 Mock 骗过解释器，可免去复杂的编译过程。
def inject_mocks():
    print("⚠️ [系统检测] 正在注入虚拟 Kaolin 和 PyTorch3D 运行时...")
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    
    # 通用 Mock 类：吞噬所有调用，返回零张量或自身
    class MockClass:
        def __init__(self, *args, **kwargs): self.device = device
        def __call__(self, *args, **kwargs): return torch.zeros(1, 3, device=device, requires_grad=True)
        def compose(self, *args, **kwargs): return self
        def inverse(self): return self
        def to(self, *args, **kwargs): return self
        def cpu(self): return self
        def cuda(self): return self
        def clone(self): return self
        def detach(self): return self
        def get_matrix(self): return torch.eye(4, device=device).unsqueeze(0)
        def transform_points(self, x): return x 
        def transform_normals(self, x): return x
        def __getattr__(self, name):
            def method_mock(*args, **kwargs): return self
            return method_mock
    
    def mock_func(*args, **kwargs): return torch.tensor(0.0, device=device)

    # 1. 伪造 Kaolin 模块树
    if "kaolin" not in sys.modules:
        mock_kaolin = ModuleType("kaolin")
        submodules = ["ops", "ops.mesh", "ops.spc", "metrics", "metrics.pointcloud", 
                      "render", "render.camera", "render.mesh", "visualize", "io", 
                      "io.obj", "io.usd", "utils", "utils.testing"]
        for name in submodules:
            parts = name.split(".")
            parent = mock_kaolin
            for i, part in enumerate(parts):
                if not hasattr(parent, part):
                    new_mod = ModuleType(f"kaolin.{'.'.join(parts[:i+1])}")
                    setattr(parent, part, new_mod)
                    sys.modules[f"kaolin.{'.'.join(parts[:i+1])}"] = new_mod
                parent = getattr(parent, part)
        
        # 填充关键接口
        mock_kaolin.ops.mesh.TriangleHash = MockClass
        mock_kaolin.ops.mesh.check_sign = mock_func
        mock_kaolin.ops.mesh.sample_points = mock_func
        mock_kaolin.metrics.pointcloud.chamfer_distance = mock_func
        mock_kaolin.visualize.IpyTurntableVisualizer = MockClass
        mock_kaolin.render.camera.Camera = MockClass
        mock_kaolin.render.camera.CameraExtrinsics = MockClass
        mock_kaolin.render.camera.PinholeIntrinsics = MockClass
        mock_kaolin.render.mesh.dibr_rasterization = mock_func
        mock_kaolin.io.obj.import_mesh = lambda *args, **kwargs: (None, None)
        mock_kaolin.utils.testing.check_tensor = mock_func
        mock_kaolin.__path__ = []
        sys.modules["kaolin"] = mock_kaolin

    # 2. 伪造 PyTorch3D 模块树
    if "pytorch3d" not in sys.modules:
        mock_p3d = ModuleType("pytorch3d")
        mock_p3d.__path__ = []
        for mod in ["transforms", "structures", "renderer", "renderer.cameras", "renderer.camera_utils", "renderer.mesh", "vis", "vis.plotly_vis"]:
            parts = mod.split(".")
            parent = mock_p3d
            for i, part in enumerate(parts):
                if i == 0: continue
                if not hasattr(parent, part):
                    setattr(parent, part, ModuleType(f"pytorch3d.{'.'.join(parts[:i+1])}"))
                parent = getattr(parent, part)
        
        sys.modules["pytorch3d"] = mock_p3d
        sys.modules["pytorch3d.transforms"] = mock_p3d.transforms
        sys.modules["pytorch3d.structures"] = mock_p3d.structures
        sys.modules["pytorch3d.renderer"] = mock_p3d.renderer

        # 填充数学变换与渲染类
        mock_p3d.transforms.Transform3d = MockClass
        mock_p3d.transforms.Rotate = MockClass
        mock_p3d.transforms.Translate = MockClass
        mock_p3d.transforms.Scale = MockClass
        mock_p3d.transforms.quaternion_multiply = lambda q1, q2: q1 
        mock_p3d.transforms.quaternion_invert = lambda q: q
        mock_p3d.transforms.matrix_to_quaternion = lambda m: torch.tensor([1., 0., 0., 0.], device=m.device).repeat(m.shape[0], 1)
        mock_p3d.transforms.quaternion_to_matrix = lambda q: torch.eye(3, device=q.device).unsqueeze(0).repeat(q.shape[0], 1, 1)
        mock_p3d.transforms.axis_angle_to_quaternion = lambda a: torch.tensor([1., 0., 0., 0.], device=a.device).repeat(a.shape[0], 1)
        
        mock_p3d.renderer.look_at_view_transform = lambda **kwargs: (torch.eye(3, device=device).unsqueeze(0), torch.zeros(1, 3, device=device))
        mock_p3d.renderer.look_at_rotation = lambda **kwargs: torch.eye(3, device=device).unsqueeze(0)
        
        renderer_classes = [
            "FoVPerspectiveCameras", "PerspectiveCameras", "CamerasBase",
            "PointsRenderer", "PointsRasterizationSettings", "PointsRasterizer", 
            "AlphaCompositor", "RasterizationSettings", "MeshRenderer", "MeshRasterizer", 
            "MeshRendererWithFragments", "SoftPhongShader", "HardPhongShader", "SoftSilhouetteShader", 
            "TexturesVertex", "PointLights", "DirectionalLights", "AmbientLights", "Materials", "BlendParams"
        ]
        for cls in renderer_classes:
            setattr(mock_p3d.renderer, cls, MockClass)

        mock_p3d.structures.Meshes = MockClass
        mock_p3d.structures.Pointclouds = MockClass
        mock_p3d.structures.join_meshes_as_batch = mock_func

    print("✅ [虚拟化] 运行时依赖注入完成")

# 注入 Mocks
inject_mocks()

# ================= 🔧 配置区域 =================
INPUT_IMAGE_NAME = "input.jpg" 
LINUX_WORK_ROOT = Path.home() / "sam3d_workspace"
SAM3D_REPO_PATH = Path.home() / "workspace/ai/sam-3d-objects" # 请根据实际路径修改
CONFIG_PATH = SAM3D_REPO_PATH / "checkpoints/hf/pipeline.yaml"
# CPU 配置 Hack 路径
CPU_CONFIG_PATH = CONFIG_PATH.parent / "cpu_pipeline.yaml"

def format_duration(seconds):
    return str(datetime.timedelta(seconds=int(seconds)))

def setup_environment():
    if not SAM3D_REPO_PATH.exists():
        print(f"❌ 错误: 找不到 SAM 3D 仓库路径: {SAM3D_REPO_PATH}")
        sys.exit(1)
    
    sys.path.append(str(SAM3D_REPO_PATH))
    sys.path.append(str(SAM3D_REPO_PATH / "notebook"))
    os.chdir(SAM3D_REPO_PATH)

def prepare_cpu_config():
    """创建一个强制使用 CPU 的临时配置文件，防止 Inference 初始化时 GPU OOM"""
    if not CONFIG_PATH.exists(): return False
    try:
        with open(CONFIG_PATH, 'r', encoding='utf-8') as f: content = f.read()
        new_content = content.replace("device: cuda", "device: cpu").replace('device: "cuda"', 'device: "cpu"')
        with open(CPU_CONFIG_PATH, 'w', encoding='utf-8') as f: f.write(new_content)
        return True
    except: return False

def auto_generate_mask(image_np):
    """简单的亮度阈值自动去背景"""
    intensity = image_np.mean(axis=2)
    is_white_bg = intensity > 240
    is_black_bg = intensity < 15
    if np.sum(is_white_bg) > image_np.size/3 * 0.1:
        return np.where(is_white_bg, 0, 255).astype(np.uint8)
    elif np.sum(is_black_bg) > image_np.size/3 * 0.1:
        return np.where(is_black_bg, 0, 255).astype(np.uint8)
    return np.ones(image_np.shape[:2], dtype=np.uint8) * 255

def run_pipeline():
    global_start_time = time.time()
    windows_dir = Path(__file__).resolve().parent
    
    # 优先检测 PNG (Alpha 通道)
    source_img_path = windows_dir / "input.png"
    if not source_img_path.exists(): source_img_path = windows_dir / INPUT_IMAGE_NAME
    
    project_name = source_img_path.stem 
    work_dir = LINUX_WORK_ROOT / project_name
    
    print(f"\n🚀 [RTX 5070 Pipeline] 启动任务: {source_img_path.name}")

    if work_dir.exists(): shutil.rmtree(work_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    target_img_path = work_dir / source_img_path.name
    shutil.copy2(str(source_img_path), str(target_img_path))

    print(f"\n🧠 [2/3] 加载模型 (CPU初始化模式)...")
    setup_environment()
    prepare_cpu_config()
    
    try:
        from inference import Inference, load_image
        import numpy as np
        
        # 1. 技术创新 2: 拦截权重加载
        # 强制所有模型权重加载到系统内存 (RAM)，避免初始化时打爆显存
        original_torch_load = torch.load
        def cpu_load_hook(*args, **kwargs):
            if 'map_location' not in kwargs: kwargs['map_location'] = 'cpu'
            return original_torch_load(*args, **kwargs)
        
        torch.load = cpu_load_hook
        inference = Inference(str(CPU_CONFIG_PATH))
        inference._pipeline.device = torch.device('cuda') # 欺骗 Pipeline 对象
        torch.load = original_torch_load # 恢复钩子
        print("    ✅ 模型加载完成 (RAM驻留)")

        # 2. 图像预处理
        pil_image = Image.open(str(target_img_path)).convert("RGBA")
        # 降采样保护显存
        target_size = 256 
        if max(pil_image.size) > target_size:
            scale = target_size / max(pil_image.size)
            pil_image = pil_image.resize((int(pil_image.size[0]*scale), int(pil_image.size[1]*scale)), Image.LANCZOS)
        
        image_rgba = np.array(pil_image)
        image = image_rgba[:, :, :3]
        
        # Mask 处理：优先 Alpha，否则自动计算
        if image_rgba.shape[2] == 4: mask = image_rgba[:, :, 3]
        else: mask = auto_generate_mask(image)

        pipeline = inference._pipeline

        # 3. 技术创新 3: 显存分级流水线 (Manual Memory Pipeline)
        # 12GB 显存无法同时容纳 Stage1 + Stage2 + DINO，必须手动调度
        
        # --- Stage 1: Sparse Structure ---
        print("\n🚚 [Stage 1] 搬运模型至 GPU...")
        pipeline.models["ss_generator"].to('cuda')
        pipeline.models["ss_decoder"].to('cuda')
        if "ss_encoder" in pipeline.models and pipeline.models["ss_encoder"]: pipeline.models["ss_encoder"].to('cuda')
        if "ss_condition_embedder" in pipeline.condition_embedders: pipeline.condition_embedders["ss_condition_embedder"].to('cuda')
        
        print("🚀 [Stage 1] 生成稀疏结构...")
        stage1_output = pipeline.run(image=image, mask=mask, stage1_only=True, seed=42)
        
        # --- Stage Switch ---
        print("\n🔄 [显存切换] 卸载 Stage 1 -> 加载 Stage 2...")
        pipeline.models["ss_generator"].cpu()
        pipeline.models["ss_decoder"].cpu()
        if "ss_encoder" in pipeline.models and pipeline.models["ss_encoder"]: pipeline.models["ss_encoder"].cpu()
        if "ss_condition_embedder" in pipeline.condition_embedders: pipeline.condition_embedders["ss_condition_embedder"].cpu()
        torch.cuda.empty_cache()

        pipeline.models["slat_generator"].to('cuda')
        pipeline.models["slat_decoder_gs"].to('cuda')
        if "slat_condition_embedder" in pipeline.condition_embedders: pipeline.condition_embedders["slat_condition_embedder"].to('cuda')
        
        # 4. 技术创新 4: 禁用 Mesh Decoder (绕过 Kaolin 依赖)
        pipeline.decode_formats = ["gaussian"]
        
        # --- Stage 2: Gaussian Generation ---
        print("🚀 [Stage 2] 生成 Gaussian Splats...")
        # Hook: 劫持 sample_sparse_structure，直接注入 Stage 1 结果，避免重复计算
        original_sample_ss = pipeline.sample_sparse_structure
        pipeline.sample_sparse_structure = lambda *args, **kwargs: stage1_output
        
        try:
            output = pipeline.run(image=image, mask=mask, stage1_only=False, seed=42, 
                                  with_mesh_postprocess=False, with_texture_baking=False)
        finally:
            pipeline.sample_sparse_structure = original_sample_ss

        # 5. 结果保存
        if "gs" in output:
            ply_output_path = work_dir / f"{project_name}_3d.ply"
            output["gs"].save_ply(str(ply_output_path))
            final_windows_path = windows_dir / f"{project_name}_3dgs.ply"
            shutil.copy2(str(ply_output_path), str(final_windows_path))
            print(f"\n🎉 成功！模型已保存: {final_windows_path}")
        else:
            print("❌ 失败: 未生成数据")

    except Exception as e:
        print(f"❌ 运行出错: {e}")
        import traceback
        traceback.print_exc()
        torch.cuda.empty_cache()

    print(f"\n📊 总耗时: {format_duration(time.time() - global_start_time)}")

if __name__ == "__main__":
    run_pipeline()
```



## 5. 运行与结果验证

### 5.1 启动推理

在 WSL 终端中，导航到 Windows 下脚本所在目录并运行：

```
cd /mnt/c/Users/<YourName>/.../SAM3d
# CUDA_LAUNCH_BLOCKING=1 有助于防止 Windows TDR 超时
CUDA_LAUNCH_BLOCKING=1 python sam3d.py
```

### 5.2 预期输出

1. **Mock 注入成功**：看到 ✅ [虚拟化] 运行时依赖注入完成。
2. **显存优化**：初始化时显存占用极低，Stage 切换时显存会有明显释放和重新占用。
3. **结果生成**：在当前目录下生成 input_3dgs.ply 文件。





# 在 RTX 5070 + WSL 环境下强行跑通 SAM 3D：一场跨越软硬件代沟的踩坑实录

**背景**：Meta 开源的 SAM 3D Objects 是一个极其惊艳的“单图转3D”模型。然而，当它遇到 2025 年发布的 NVIDIA RTX 5070 (Blackwell 架构) 时，发生了一场灾难性的化学反应。显卡太新，库太老，依赖冲突，CUDA 兼容性... 这是一个关于如何在一个不支持的环境中，通过“欺骗”、“魔改”和“移花接木”最终跑通代码的故事。

**环境配置**：

- **OS**: Windows 11 + WSL2 (Ubuntu)
- **GPU**: NVIDIA GeForce RTX 5070 (Compute Capability sm_120)
- **Goal**: 运行 facebookresearch/sam-3d-objects 推理 Pipeline
- **核心矛盾**: 项目依赖 PyTorch 2.5.1 (CUDA 12.1)，但 RTX 5070 必须使用 PyTorch Nightly 2.9.1+ (CUDA 12.8+) 才能识别。



## 第一阶段：依赖缺失与“伪造”战术 (The Mocking Game)

项目初始依赖安装中，kaolin 和 pytorch3d 是两个最大的拦路虎。由于环境复杂，直接编译失败。为了快速验证逻辑，我选择了 **Mock（伪造）** 策略。

### 坑 1：PyTorch3D 模块缺失与 Visualization 报错

**现象**：运行脚本直接报错 ImportError，提示找不到 pytorch3d 或 kaolin 的子模块。 **分析**：SAM 3D 的推理代码 (inference.py) 引用了大量的辅助工具类（如相机变换、可视化器），但这些库在 Windows/WSL 混合环境下极难编译。 **措施**： 不编译库，直接在 sam3d.py 脚本头部注入 Mock 对象。

- 伪造了 kaolin.visualize.IpyTurntableVisualizer。
- 伪造了 pytorch3d.vis.plotly_vis 及其辅助函数 _scale_camera_to_bounds, _update_axes_bounds。
- **核心逻辑**：只要推理核心不调用这些可视化函数，空壳类就能骗过 Python 的 Import 检查。

### 坑 2：Transform3d 的链式调用陷阱

**现象**：Mock 了 Transform3d 类，但报错 'Tensor' object has no attribute 'rotate'。 **分析**：PyTorch3D 的变换类支持链式调用（如 t.rotate().translate()）。简单的 Mock 函数返回了 Tensor，导致链条断裂。 **措施**： 重写 Mock 类，使其在调用方法（如 compose, inverse）时返回 self，仅在 **call** 时返回 Tensor。



## 第二阶段：数据流与类型的严苛校验

解决了 Import 问题后，数据喂进去了，但格式全是错。

### 坑 3：Mask 的数值溢出

**现象**：RuntimeError: max(): Expected reduction dim ... input.numel() == 0。 **分析**：

- 我手动创建了 Mask：mask = np.ones(...) * 255。
- inference.py 内部逻辑有一行 mask = mask.astype(np.uint8) * 255。
- **灾难**：255 (uint8) * 255 发生了整数溢出，变成了 1。也就是几乎全透明，导致点云被过滤光了。 **措施**：修改 Mask 初始化逻辑，直接传入 255 并确保 pipeline 内部不再重复缩放，或者传入 1 让其缩放（最终方案是直接对接底层 run()，故需传入 255）。

### 坑 4：维度与类型断言 (AssertionError)

**现象**：

1. ValueError: 拼接图像时维度不匹配 (3D vs 4D)。
2. AssertionError: assert image.dtype == np.uint8。 **分析**：

- SAM 3D 的 Pipeline 对输入非常挑剔。它会自动给 Mask 增加 Batch 维度。如果我们预处理时手动加了维度，就会导致维度过多。
- 习惯性地将图像归一化到 [0, 1] (Float)，但模型强行要求 [0, 255] (Uint8)。 **措施**：
- **去归一化**：保持输入为 uint8。
- **维度回退**：保持 Mask 为 2D (H, W)，让 Pipeline 自己去处理升维。



## 第三阶段：显存危机 (OOM) 与 5070 的架构墙

这是最绝望的阶段。代码通了，但硬件撑不住，或者硬件不兼容。

### 坑 5：12GB 显存的极限与贪婪加载

**现象**：CUDA error: out of memory。 **分析**：RTX 5070 只有 12GB 显存。InferencePipeline 初始化时极其“贪婪”，试图一次性把 Stage 1 (Sparse Structure) 和 Stage 2 (Latent -> Gaussian) 的所有模型（包括巨大的 DINOv2）全部加载进显存。初始化阶段就爆了。 **措施：分阶段加载 (Stage-wise Loading)**。 重写 run_pipeline 逻辑：

1. **CPU 初始化**：通过 Hack 配置文件，强制模型初始化在 CPU 内存中。
2. **Stage 1**：只把 Stage 1 相关的模型搬运到 GPU，跑完后立即卸载回 CPU。
3. **Stage 2**：搬运 Stage 2 模型到 GPU，执行后续。 这让 12GB 显存也能跑动大模型。

### 坑 6：Blackwell 架构 (sm_120) 的排斥反应

**现象**：RuntimeError: CUDA error: no kernel image is available for execution on the device。 **分析**：

- 项目默认依赖 PyTorch 2.5.1 (CUDA 12.1)，最高支持 sm_90 (Hopper)。
- RTX 5070 是 sm_120。旧版 PyTorch 根本没有包含能在这张卡上运行的二进制代码。 **尝试**：试图设置 TORCH_CUDA_ARCH_LIST="9.0" 进行 JIT 编译，失败。 **结论**：**必须使用 PyTorch Nightly (2.9.1+)**。



## 第四阶段：编译地狱 (Nightly Build vs Legacy Code)

为了迁就显卡换了 PyTorch Nightly，结果引发了依赖库的全面崩盘。

### 坑 7：Kaolin 与 PyTorch3D 的 C++ ABI 冲突

**现象**：换了 PyTorch 2.9.1 后，kaolin 报错 undefined symbol 或 ImportError: Kaolin requires PyTorch <= 2.5.1。 **分析**：

- **预编译包失效**：官方 Wheel 包是针对旧 PyTorch 编译的，ABI 不兼容。
- **源码编译失败**：Kaolin 源码中包含过时的 CUDA API (cudaMemcpyToArray 等)，被 CUDA 12.8 的编译器拒绝。 **尝试**：
- 修改 setup.py 解除版本限制 -> 失败（C++ 编译错误）。
- 降级 GCC -> 失败。
- 寻找 Nvidia Nightly Index -> 下载了针对 PyTorch 2.5 的包，依然 ABI 冲突。

### 坑 8：Gsplat 的死循环

**现象**：pip install 自动触发 gsplat 编译，但因为 build isolation 找不到 torch 而失败。 **措施**：

1. 手动克隆 gsplat 源码。
2. 使用 pip install . --no-build-isolation 强制使用当前环境的 Nightly PyTorch 进行编译。 **结果**：这是唯一成功的编译！Gsplat 成功适配了 RTX 5070。



## 第五阶段：终局之战 (The Hybrid Solution)

既然 Kaolin 和 PyTorch3D 无论如何都无法在 RTX 5070 + PyTorch Nightly 上编译成功，而核心推理库 Gsplat 却编译成功了，我们采用了一个大胆的 **“半真半假”** 策略。

### 最终解决方案：真 Gsplat + 假辅助库

**思路**：SAM 3D 的核心生成逻辑依赖 Gsplat，而 Kaolin 和 PyTorch3D 更多用于数据加载、网格生成（Mesh）和可视化。既然我们要的是 Gaussian Splat (.ply)，我们可以**放弃 Mesh 生成**，从而**不需要**这两个库的 C++ 核心功能。

**操作步骤**：

1. **环境基石**：使用成功编译了 Gsplat 的 gs_linux 环境 (Torch 2.9.1 Nightly)。
2. **全面伪造 (Mock V13)**：
   - 在 sam3d.py 头部注入大量 Mock 代码，伪造 kaolin 的 TriangleHash、check_tensor 以及 pytorch3d 的 RasterizationSettings、BlendParams 等。
   - 甚至伪造了数学函数 quaternion_multiply（反正推理阶段可能用不到，或者用不到高精度）。
3. **Hook (移花接木)**：
   - 为了防止 Pipeline 内部调用真实的 Mesh 生成逻辑，我们在 Stage 2 之前设置 pipeline.decode_formats = ["gaussian"]。
   - 通过 Hook sample_sparse_structure 函数，将 Stage 1 的结果直接透传给 Stage 2，避免重复计算和显存爆炸。
4. **去背景**：
   - 输入图片如果是 JPG，全白 Mask 会导致生成一个实心长方体（把背景也算进去了）。
   - **最终解**：使用 remove.bg 生成透明 PNG，利用 Alpha 通道作为 Mask。

### 结果

- **Kaolin**: Mocked (未安装)
- **PyTorch3D**: Mocked (未安装)
- **Gsplat**: Real (本地编译, CUDA 12.8)
- **PyTorch**: Nightly 2.9.1
- **Output**: 成功生成 .ply 文件，在 Super Splat 中完美查看。



### 总结 (Takeaway)

在 RTX 50 系这种超前硬件上运行旧代码，核心心法只有两条：

1. **核心算子必须真**：涉及到 GPU 核心计算的（如 gsplat 的光栅化），必须基于 Nightly PyTorch 重新编译，绝无捷径。
2. **辅助组件可以假**：对于只负责 I/O、格式转换或非核心渲染的重型库（如 Kaolin），如果编译不过，**Mock 往往比 Debug C++ 源码更高效**。
