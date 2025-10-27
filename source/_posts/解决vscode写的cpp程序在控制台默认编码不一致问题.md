---
title: 解决vscode写的cpp程序在控制台默认编码不一致问题
date: 2025-10-27 09:49:07
tags:
---



本人首选方法二

### 方法一：修改编译参数（推荐）



通过在编译时指定源文件和执行字符集，强制编译器统一编码。这通常是在您的 `tasks.json` 或 `c_cpp_properties.json` 中修改编译命令（如果您使用 C/C++ 扩展）：

**在 `tasks.json` 文件中添加编译参数：**

打开您的 `tasks.json` 文件（通常通过在 VS Code 中运行 "终端" -> "配置默认生成任务" 或 "运行生成任务" 来生成），找到您的 C++ 编译任务，并在 `args` 数组中添加以下参数：

- **指定源文件编码为 UTF-8：**

  JSON

  ```
  "-finput-charset=UTF-8",
  ```

- **指定可执行文件中的字符集为 GBK（以匹配 Windows 终端）：**

  JSON

  ```
  "-fexec-charset=GBK",
  ```

**完整的示例（G++ 编译器）：**

JSON

```json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "C/C++: g++.exe build active file",
            "type": "shell",
            "command": "g++",
            "args": [
                "-g",
                "${file}",
                "-o",
                "${fileDirname}\\${fileBasenameNoExtension}.exe",
                // 添加以下两行
                "-finput-charset=UTF-8",
                "-fexec-charset=GBK" 
            ],
            "group": {
                "kind": "build",
                "isDefault": true
            },
            "detail": "编译器: g++.exe"
        }
    ]
}
```



### **方法二：在 C++ 程序中临时更改终端编码（更方便）**



在您的 C++ 代码中使用 `system("chcp 65001")` 命令来临时将控制台的编码更改为 **UTF-8**（Windows 编码 65001 就是 UTF-8），从而与您的源文件编码匹配。

C++

```cpp
#include <iostream>
#include <windows.h> // 需要包含此头文件

int main() {
    // 临时将控制台的活动代码页设置为 UTF-8 (65001)
    // 确保这行代码在任何中文输出之前执行
    system("chcp 65001"); 

    std::cout << "你好，世界！" << std::endl;
    
    // 或者使用 std::wcout 和 L"" 宽字符字符串，但更复杂
    // std::wcout << L"你好，世界！" << std::endl; 

    return 0;
}
```

**注意：** 这种方法简单直接，但需要在每个需要中文输出的程序中添加这行代码。



### 方法三：修改 VS Code 的文件默认编码（不推荐）



您可以将 VS Code 的默认文件编码从 UTF-8 更改为 **GBK/GB2312**，使其与 Windows 终端默认编码匹配。

1. 打开 VS Code 设置（**文件** -> **首选项** -> **设置** 或按 `Ctrl + ,`）。
2. 搜索 `files.encoding`。
3. 将 **Files: Encoding** 设置更改为 `gbk` 或 `gb2312`。

**警告：** **不推荐**此方法，因为 UTF-8 是更现代、更通用的国际编码标准。将其更改为 GBK 可能会导致与跨平台或涉及其他非中文语言的项目产生新的乱码问题。
