---
title: 用 GLOMAP 替换 COLMAP 加速 3DGS 重建管线
date: 2025-12-10 23:02:02
tags:
  - glomap
  - colmap
  - 3dgs
  - wsl
  - linux
---

# 用 GLOMAP 替换 COLMAP 加速 3DGS 重建管线

在 3D Gaussian Splatting (3DGS) 的数据预处理阶段，稀疏重建（Sparse Reconstruction）往往是耗时瓶颈。传统的 **COLMAP** 采用增量式（Incremental）重建策略，虽然精度高但随着图片数量增加速度呈指数级下降。

**GLOMAP** 作为一种全新的全局式（Global）SfM 系统，能够在保持重建质量的同时，将重建速度提升 1-2 个数量级，且对弱纹理和难样本具有更强的鲁棒性。本文将介绍如何在现代 Linux 开发环境中，以最简洁的方式编译 GLOMAP 并将其无缝集成到 Python 自动化管线中。

## 1. 核心思路

GLOMAP 的设计理念是兼容 COLMAP 的数据格式。因此，我们不需要替换整个管线，只需替换后端的核心重建模块：

1. **前端（保持不变）**：继续使用 COLMAP 进行特征提取（Feature Extractor）和匹配（Matcher）。
2. **后端（替换）**：将 `colmap mapper` 替换为 `glomap mapper`。
3. **输入/输出**：GLOMAP 直接读取 COLMAP 的 `database.db`，并输出标准的 COLMAP 稀疏模型格式（`.bin`）。

## 2. 环境依赖与编译 (The "Golden" Configuration)

在混合了 Conda 环境（新版 ABI）和系统环境（旧版 ABI/GCC 14）的复杂场景下，编译 GLOMAP 极易遇到 ABI 冲突或依赖地狱。

经过验证，**“系统级依赖 + Conda 环境”** 的混合编译策略是最稳健的方案。

### 2.1 安装系统级依赖

不要试图在 Conda 内部解决图形学依赖，直接使用 `apt` 安装核心库，确保 OpenGL 和 ABI 兼容性：



```bash
sudo apt-get update
# 安装 OpenGL, CGAL 和 Boost 的系统开发库
sudo apt-get install libgl1-mesa-dev libglu1-mesa-dev libcgal-dev libboost-all-dev
```

### 2.2 编译 GLOMAP

在 Conda 环境激活的状态下，使用以下 CMake 配置。这个配置强制 GLOMAP 链接系统的 Boost 和 OpenGL 库，同时兼容 GCC 14 的新特性，避免了 `undefined reference` 和头文件冲突。



```bash
git clone https://github.com/colmap/glomap.git
cd glomap
mkdir build && cd build

# 核心配置命令
cmake .. -GNinja -DCMAKE_BUILD_TYPE=Release \
    -DOPENGL_gl_LIBRARY=/usr/lib/x86_64-linux-gnu/libGL.so \
    -DOPENGL_glu_LIBRARY=/usr/lib/x86_64-linux-gnu/libGLU.so \
    -DCGAL_DIR=/usr/lib/x86_64-linux-gnu/cmake/CGAL \
    -DCMAKE_CXX_FLAGS="-DBOOST_MATH_DISABLE_FLOAT128" \
    -DBOOST_ROOT=/usr \
    -DBoost_LIBRARY_DIR=/usr/lib/x86_64-linux-gnu \
    -DBoost_NO_SYSTEM_PATHS=OFF

# 编译并安装
ninja
sudo ninja install
```

- **注**：安装完成后，验证 `glomap --help` 是否能正常输出。

## 3. Python 管线集成

在自动化脚本（如 `run_glomap.py`）中，我们需要做两件事：注入运行时环境变量以解决库冲突，并修改调用逻辑。

### 3.1 运行时环境注入 (解决 DLL Hell)

GLOMAP 和 COLMAP 可能依赖不同版本的 `libsqlite3` 或 `libstdc++`。为了防止运行时崩溃（如 `SQL logic error`），必须强制优先加载 Conda 环境的动态库。

在 Python 脚本的入口处添加：



```Python
import os

# 获取 Conda 环境路径
conda_prefix = os.environ.get("CONDA_PREFIX")
env = os.environ.copy()

if conda_prefix:
    conda_lib = os.path.join(conda_prefix, "lib")
    current_ld = env.get("LD_LIBRARY_PATH", "")
    # 🔥 核心修正：将 Conda lib 路径置顶，解决 SQLite 版本冲突
    env["LD_LIBRARY_PATH"] = f"{conda_lib}:{current_ld}"
    
# 🔥 核心修正：解决 Setuptools/Distutils 在 PyTorch 扩展编译时的冲突
env["SETUPTOOLS_USE_DISTUTILS"] = "stdlib"
```

### 3.2 替换 Mapper 调用逻辑

找到原本调用 `colmap mapper` 的代码段，将其替换为 `glomap mapper`。

**注意路径差异**：COLMAP 需要指定到 `sparse/0`，而 GLOMAP 只需指定到 `sparse`（它会自动创建 `0` 子目录）。



```python
import shutil
import subprocess

# ... 前置步骤：特征提取和匹配 (保持使用 colmap) ...

# === Step 3: Global SfM via GLOMAP ===
glomap_output_dir = colmap_output_dir / "sparse"
glomap_output_dir.mkdir(parents=True, exist_ok=True)

# 自动查找系统中的 glomap
system_glomap_exe = shutil.which("glomap")
if not system_glomap_exe:
    system_glomap_exe = "/usr/local/bin/glomap"

print(f"🚀 [SfM Backend] Switching to GLOMAP: {system_glomap_exe}")

# 执行命令
subprocess.run([
    system_glomap_exe, "mapper",
    "--database_path", str(database_path),
    "--image_path", str(extracted_images_dir),
    "--output_path", str(glomap_output_dir)
], check=True, env=env) # 务必传入修改后的 env

print("✅ Global reconstruction finished.")
```

## 4. 总结

通过上述改造，我们实现了一个高性能的 3DGS 预处理管线：

1. **编译层面**：通过混合链接策略（System Boost + Conda Dependencies），解决了 GCC 14 和 CUDA 环境下的 ABI 兼容性问题。
2. **运行层面**：通过 `LD_LIBRARY_PATH` 注入，解决了 SQLite 等底层库的版本冲突。
3. **逻辑层面**：利用 GLOMAP 的全局优化算法替代了传统的增量式重建。

这种方案不仅大幅缩短了大规模场景的重建时间，还显著提升了自动化流程的稳定性。





# 踩坑实录：在 GCC 14 与 Conda 混合环境中编译 GLOMAP 的至暗时刻

> **背景**： 目标是将传统的 COLMAP 增量式重建替换为 GLOMAP 全局重建以加速 3DGS 管线。 **环境**：
>
> - OS: Ubuntu 24.04 (WSL2)
> - Compiler: GCC 14.3.0 (Conda 自带，极新)
> - CUDA: 12.8
> - Base Environment: Conda (`vggt`)

------

## 🛑 第一关：构建系统的版本代沟

### 1.1 CMake 版本的“背刺”

起初，为了追求最新特性，我运行了 `pip install cmake --upgrade`，安装了 **CMake 4.2.0**（预览版）。

**报错现象**：

CMake

```
CMake Error at build/_deps/colmap-src/cmake/FindDependencies.cmake:22 (find_package):
  By not providing "FindBoost.cmake" ...
  Could not find a package configuration file provided by "Boost" ...
```

**深度分析**： GLOMAP 在编译时会自动下载 COLMAP 源码作为依赖。COLMAP 的 CMake 脚本还在使用旧版的 `FindBoost` 模块查找 Boost 库。然而，CMake 4.x 版本激进地移除了这些废弃模块，导致向后兼容性断裂。

**🔧 修正**： 降级回稳健的 3.x 版本系列。

Bash

```
pip install "cmake==3.28.3"
```

------

## 🛑 第二关：依赖库的“隐身”与冲突 (OpenGL & CGAL)

### 2.1 Conda 编译器的“傲慢” (OpenGL 缺失)

虽然系统通过 `apt install libgl1-mesa-dev` 安装了 OpenGL，但 CMake 依然报错： `Could NOT find OpenGL (missing: OPENGL_opengl_LIBRARY OPENGL_glx_LIBRARY)`

**深度分析**： Conda 环境内的 CMake 默认搜索路径被隔离在 Conda 环境内（`$CONDA_PREFIX`）。它“看不见”宿主机 `/usr/lib` 下的系统库。

**❌ 错误尝试**： 试图添加 `-DCMAKE_PREFIX_PATH="/usr"`。 **后果**：CMake 确实找到了 OpenGL，但它同时也顺着 `/usr` 找到了系统自带的旧版 CUDA (12.0)，导致与 Conda 内的新版 CUDA (12.8) 冲突，报错 `Found unsuitable version "12.0.140", but required is at least "12.6.85"`。

**🔧 修正**： **精准投喂**。不开放整个 `/usr`，而是显式指定库文件路径：

Bash

```
-DOPENGL_gl_LIBRARY=/usr/lib/x86_64-linux-gnu/libGL.so \
-DOPENGL_glu_LIBRARY=/usr/lib/x86_64-linux-gnu/libGLU.so
```

### 2.2 CGAL 的死循环

COLMAP 强依赖 CGAL。尝试在 Conda 内安装 `conda install cgal`，却因 Python 版本和依赖锁死导致 `LibMambaUnsatisfiableError`。于是转而使用系统级 CGAL (`apt install libcgal-dev`)。

**报错现象**： 编译时报错 `fatal error: CGAL/Delaunay_triangulation_3.h: No such file or directory`。

**深度分析**： CMake 虽然在配置阶段找到了库（Linker 层面），但 Conda 自带的编译器（Compiler 层面）为了防止环境污染，屏蔽了 `/usr/include` 标准头文件路径。

**🔧 修正 (软链接大法)**： 欺骗编译器，将系统头文件映射到 Conda 环境中：

Bash

```
ln -sf /usr/include/CGAL $CONDA_PREFIX/include/CGAL
ln -sf /usr/include/GL/gl.h $CONDA_PREFIX/include/GL/gl.h
```

------

## 🛑 第三关：编译器的“超前” (GCC 14 vs Boost)

这是最隐蔽的一个坑。

**报错现象**：

C++

```
/home/ltx/.../boost/math/cstdfloat/cstdfloat_limits.hpp:46:13: error: redefinition of 'class std::numeric_limits<__float128>'
```

**深度分析**：

- **GCC 14**：原生支持并定义了 128 位浮点数 (`__float128`) 的 `numeric_limits` 特化。
- **Boost 1.82**：不知道 GCC 14 已经干了这事，于是它自己又定义了一遍。
- **结果**：C++ 也就是所谓的 One Definition Rule (ODR) 违规，编译直接炸裂。

**❌ 错误尝试**： 使用编译参数 `-DBOOST_MATH_DISABLE_FLOAT128`。无效，因为某些 Boost 头文件的内部包含逻辑可能绕过了这个宏检查。

**🔧 修正 (源码 Patch)**： 编写 Python 脚本，直接修改 Conda 环境里的 Boost 头文件。

- **坑中坑**：最初的脚本使用简单的字符串匹配插入 `#if` 和 `#endif`，结果因为未能正确处理嵌套的大括号或 `template<>` 前缀，导致 `#endif` 插入位置错误，截断了类定义，引发 `expected unqualified-id before '}'` 语法错误。

- **最终解**：利用文件末尾的锚点 (`namespace std`) 倒序定位，精准包裹冲突代码块：

  C++

  ```
  #if !defined(__GNUC__) || __GNUC__ < 14 
  // ... 冲突的类定义 ...
  #endif
  ```

------

## 🛑 第四关：链接器的“精神分裂” (ABI Conflict)

这是编译通过后，在 Link 阶段的大 Boss。

**报错现象**：

Plaintext

```
undefined reference to `boost::program_options::...::set_additional_parser(... std::__cxx11::basic_string ...)`
```

**深度分析**：

1. **GLOMAP (你的代码)**：使用 GCC 14 编译，默认开启 **C++11 ABI** (新版字符串内存布局)。符号中带有 `cxx11` 标签。
2. **Boost (Conda 里的库)**：为了兼容性，Conda-forge 里的 Boost 很多时候还在使用 **旧版 ABI**。
3. **结果**：链接器拿着“新版钥匙”去开“旧版锁”，找不到对应的符号。

**❌ 错误尝试**： 强制 GLOMAP 使用旧版 ABI：`-D_GLIBCXX_USE_CXX11_ABI=0`。 **后果**：Boost 的报错解决了，但 **Glog 和 Ceres**（也在 Conda 里）却报出了几百个 `undefined reference`。原来 Conda 环境是分裂的：Boost 是旧 ABI，而 Glog/Ceres 是新 ABI。**这被称为 "ABI Split"**。

**🔧 修正 (心脏移植)**： 既然 Conda 的 Boost 是旧 ABI，不可用，我们决定**弃用 Conda 的 Boost，强行链接 Ubuntu 系统的 Boost**（系统库通常是新 ABI，与 GCC 14 兼容）。

1. 安装系统 Boost: `apt install libboost-all-dev`

2. **偷梁换柱**：将 Conda 的 Boost 头文件目录重命名隐藏，建立软链接指向 `/usr/include/boost`。

3. CMake 强制指定：

   CMake

   ```
   -DBOOST_ROOT=/usr \
   -DBoost_LIBRARY_DIR=/usr/lib/x86_64-linux-gnu \
   -DBoost_NO_SYSTEM_PATHS=OFF
   ```

这样，GLOMAP 编译时用的是系统的 Boost（新 ABI），链接时也用的系统的 Boost，完美解决了 ABI 冲突。

------

## 🛑 第五关：运行时的“DLL Hell” (SQLite & Python)

编译终于成功了，但运行 `run_glomap.py` 时直接崩溃。

### 5.1 SQLite 版本冲突

**报错现象**：

Plaintext

```
[database_sqlite.cc:1631] SQLite error: SQL logic error
terminate called after throwing ... No registered database factory succeeded.
```

**深度分析**：

- **Database 来源**：由 `colmap feature_extractor` 生成。如果是调用系统旧版 COLMAP，生成的 DB 可能版本较老。
- **GLOMAP 读取**：GLOMAP 链接了 Conda 的新版 SQLite 库。
- **关键点**：由于我们在编译时为了解决 OpenGL 问题，在 RPATH 中引入了 `/usr/lib`，导致 GLOMAP 运行时**优先加载了系统的旧版 `libsqlite3.so`**，而不是 Conda 的新版。新代码 + 旧库 = 崩溃。

**🔧 修正**： 在 Python 脚本中注入环境变量，强制将 Conda 的 lib 目录优先级提至最高：

Python

```
env["LD_LIBRARY_PATH"] = f"{conda_lib}:{env.get('LD_LIBRARY_PATH', '')}"
```

### 5.2 Python 库的自相残杀

**报错现象**： `ImportError: cannot import name 'dispatch_model' ... circular import` `AssertionError: .../distutils/core.py`

**深度分析**：

1. **Setuptools vs Distutils**：PyTorch 在即时编译 CUDA 算子（gsplat）时，触发了 Setuptools 对 Distutils 的劫持检查。环境中的 Setuptools 版本过高，导致断言失败。
2. **Accelerate 循环引用**：Nerfstudio 依赖的 `accelerate` 库与 `transformers` 库版本不匹配，导致模块导入死循环。

**🔧 修正**：

1. 注入环境变量：`env["SETUPTOOLS_USE_DISTUTILS"] = "stdlib"`
2. 升级库：`pip install --upgrade accelerate transformers`

------

## 🏁 总结

要让 GLOMAP 在一个“由于使用了 Conda 而变得复杂”的现代 Linux 环境中跑起来，我们实际上完成了一次**外科手术级别的环境改造**：

1. **Patch 源码**：修改 Boost 头文件以适配 GCC 14。
2. **Patch 文件系统**：通过软链接让 Conda 编译器看到系统图形库。
3. **Patch 依赖树**：混合使用系统级 Boost 和 Conda 级 Ceres/Glog 以对齐 ABI。
4. **Patch 运行时**：劫持 `LD_LIBRARY_PATH` 解决动态库加载顺序。
