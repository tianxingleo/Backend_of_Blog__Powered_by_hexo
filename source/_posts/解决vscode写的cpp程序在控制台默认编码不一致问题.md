---
title: 解决vscode写的cpp程序在控制台默认编码不一致问题
date: 2025-10-27 09:49:07
categories:
  - 学习
tags:
  - cpp
  - vscode
slug: vscode-cpp-encoding-fix
alias:
  - '/2025/10/27/解决vscode写的cpp程序在控制台默认编码不一致问题/'
---



### 在 C++ 程序中临时更改终端编码



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


