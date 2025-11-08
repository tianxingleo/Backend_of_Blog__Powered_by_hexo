---
title: DUT开发区cpc组第一次例会笔记（2025秋）
date: 2025-10-30 21:21:46
tags:
  - cpc
  - cpp
---

## 1.向上取整

在 C++ 中，对两个整数做除法并实现**向上取整**（Ceiling Division）的通用方法是利用一个简单的数学技巧。



### 通用公式



对于两个正整数 $a$（被除数）和 $b$（除数），向上取整的公式是：

$$\lceil \frac{a}{b} \rceil = \frac{a + b - 1}{b}$$



### C++ 实现



C++

```cpp
#include <iostream>

// 假设 a 和 b 都是正整数 (a >= 0, b > 0)
int ceiling_division(int a, int b) {
    // 使用 long long 以防止 a + b - 1 发生溢出，尽管对于 int 类型大部分情况下不会。
    // 如果 a 和 b 接近 int 的最大值，应该使用更大的类型。
    return (a + b - 1) / b;
}

int main() {
    int a1 = 10, b1 = 3;  // 10 / 3 = 3.33 -> 4
    int a2 = 9,  b2 = 3;  // 9 / 3 = 3.00 -> 3
    int a3 = 1,  b3 = 5;  // 1 / 5 = 0.20 -> 1

    std::cout << "10 / 3 向上取整: " << ceiling_division(a1, b1) << std::endl; // 输出 4
    std::cout << "9 / 3 向上取整: " << ceiling_division(a2, b2) << std::endl;  // 输出 3
    std::cout << "1 / 5 向上取整: " << ceiling_division(a3, b3) << std::endl;  // 输出 1

    return 0;
}
```



### 公式解释



这个技巧的原理是：

1. C++ 的整数除法（如 `a / b`）默认是**向下取整**（Truncation towards zero，对于正数来说就是 $\lfloor \frac{a}{b} \rfloor$）。
2. 如果 $a$ 能够被 $b$ 整除（例如 $9/3 = 3$），那么 $a + b - 1$ 的值会比下一个 $b$ 的倍数小 $1$，所以 $(a + b - 1) / b = (a / b)$。
   - 例子：$a=9, b=3$。$(9 + 3 - 1) / 3 = 11 / 3 = 3$。
3. 如果 $a$ 不能被 $b$ 整除，存在余数（例如 $10/3 = 3\text{余}1$），那么 $a + b - 1$ 的值会**刚好达到或超过**下一个 $b$ 的倍数。当它被 $b$ 整除时，结果会向上进位 $1$。
   - 例子：$a=10, b=3$。$(10 + 3 - 1) / 3 = 12 / 3 = 4$。



### 另一种方法：浮点数转换 (不推荐)



虽然可以使用浮点数转换，但这通常会引入浮点数精度问题，并且效率较低。

C++

```cpp
#include <cmath>
#include <iostream>

// 假设 a 和 b 都是正整数 (a >= 0, b > 0)
int ceiling_division_float(int a, int b) {
    // 将其中一个操作数转换为 double，进行浮点除法
    double result = (double)a / b;
    // 使用 std::ceil 函数向上取整，然后转换为 int
    return (int)std::ceil(result);
}
```

**注意：** 在竞争性编程或对性能和精度要求高的场景中，应该优先使用**整数公式** $\frac{a + b - 1}{b}$。

## 2. 1ll

在 C++ 中初始化 `long long` 类型的变量时，使用 `1LL` 这样的后缀（或在任何涉及常量的表达式中使用）是一个**非常好的习惯，甚至可以说是必需的**，原因如下：



### 1. 确保常量的类型是 `long long`



在 C++ 中，当你直接写一个整数常量时，例如 `1`、`100` 或 `2000000000`，编译器默认会将其视为：

- **`int`**
- 如果值太大，超过了 `int` 的范围，则会依次升级为 `unsigned int`、`long int`，直到能容纳它的最小类型。

当你使用后缀 `LL` 或 `ll` 时，你**明确地告诉**编译器，这个数字是一个 `long long int` 类型的常量。

- `1` 是一个 `int` 类型的常量。
- `1L` 或 `1l` 是一个 `long int` 类型的常量。
- **`1LL` 或 `1ll` 是一个 `long long int` 类型的常量。**



### 2. 避免潜在的溢出（Overflow）和类型转换问题



考虑以下两种情况：



#### 场景 A: 赋值时的溢出（最常见问题）



如果你的常量值**超过了 $32$ 位 `int` 的最大值**（约 $21$ 亿），但你没有加 `LL` 后缀，就会导致溢出或非预期的行为：

C++

```cpp
// 假设 int 是 32 位，最大值约 2.1 * 10^9
long long large_num = 3000000000; // 错误或警告！
// 3000000000 默认被视为 int。
// 在赋值给 long long 之前，它首先以 int 身份进行计算或存储，
// 这会导致 int 溢出。然后，这个错误的值才被提升（提升）给 long long。
// 结果 large_num 可能不是 30 亿，而是一个负数或一个错误的正数。

long long correct_num = 3000000000LL; // 正确
// 3000000000LL 直接被视为 long long 类型常量，不会溢出，然后赋值。
```



#### 场景 B: 表达式中的类型提升（Promotion）



即使常量本身的值很小（比如 $1$），如果在涉及大量运算的表达式中，使用 `LL` 可以确保整个计算在 `long long` 的精度下进行：

C++

```cpp
long long a = 2000000000; // 假设是 20 亿
long long b = 5;
long long c = a * b; // 期望结果是 100 亿

// 错误示范：
long long result1 = a * 1; // 尽管 1 很小，但 a 已经是 long long
long long result2 = a * 1LL; // 保证结果是 long long

// 更危险的例子：
long long result3 = 1000000000 * 5; // 危险！10亿 * 5 结果是 50亿
// 1000000000 和 5 都是 int，它们的乘积 50 亿会溢出 int，
// 然后这个溢出的结果才赋值给 long long。

long long result4 = 1000000000LL * 5; // 安全
// 因为有 LL，乘法在 long long 精度下进行。
```



### 总结



无论是初始化还是在表达式中使用，只要是 `long long` 类型的变量涉及到**整数常量**时，都应该添加 `LL` 或 `ll` 后缀。

| **表达式** | **类型**             | **含义**                        |
| ---------- | -------------------- | ------------------------------- |
| `1`        | `int`                | 普通整数常量                    |
| `1L`       | `long int`           | `long` 整数常量                 |
| **`1LL`**  | **`long long int`**  | **`long long` 整数常量 (推荐)** |
| `1U`       | `unsigned int`       | `unsigned` 整数常量             |
| `1ULL`     | `unsigned long long` | `unsigned long long` 整数常量   |

因此，**在 `long long` 初始化或使用常数时使用 `1LL` 是一个规范且必要的做法，可以完全避免因隐式类型转换和整数溢出导致的潜在 bug。**



## 3. memset()

关于数组初始化是否使用 `memset()`，答案是：**不一定，它取决于数组的类型、目标值，以及你使用的是 C 语言还是 C++ 语言。**



### 1. `memset()` 的作用和限制



`memset()` 是一个 C 标准库函数，它的作用是：

> 将指定内存块（从起始地址开始）的前 `N` 个字节都设置为同一个**字节值**。

**关键限制：**

- **只能安全地将数组初始化为 0 或 -1：**
  - 当你想将整数数组或浮点数数组初始化为 **0** 时，`memset()` 是安全且高效的。因为无论是 `int`、`float` 还是指针，全 0 的字节序列都对应于它们的 0 值。
  - 当你想将数组初始化为 **-1** 时，对于大多数有符号整数类型（如 `int`），`memset()` 也是安全的。因为全 1 的字节序列通常代表 -1 的补码表示。
  - **对于任何其他值（例如 1、100、3.14），使用 `memset()` 是错误的。** 因为 `memset()` 是按字节填充的，如果你想将一个 `int` 数组初始化为 100，`memset()` 会将每个 `int` 的所有字节都设置为 `100`，这通常不会得到数字 100 的值。



### 2. 数组初始化的常见方法和推荐





#### A. C++ 推荐方法 (更安全、更现代)



在 C++ 中，推荐使用以下方法，它们更安全，更具类型感知：

| **方法**                         | **适用场景**                   | **优点**                                 | **示例**                                                     |
| -------------------------------- | ------------------------------ | ---------------------------------------- | ------------------------------------------------------------ |
| **花括号初始化**                 | **任何数组**、C++11 之后的标准 | 简洁、安全、自动将剩余元素初始化为 0。   | `int arr[5] = {1, 2};` // 结果: {1, 2, 0, 0, 0}              |
| **仅花括号**                     | **将数组初始化为全 0**         | 最简洁、最快。                           | `int arr[5] = {};` 或 `int arr[5]{};` // 结果: {0, 0, 0, 0, 0} |
| **`std::fill` 或 `std::fill_n`** | **将数组初始化为任意值**       | 类型安全，适用于任何类型，可读性好。     | `std::fill(std::begin(arr), std::end(arr), 10);`             |
| **`std::vector`**                | **代替原生数组**               | 尺寸可变，自动管理内存，初始化方法多样。 | `std::vector<int> vec(10, 5);` // 10个元素，都初始化为 5     |



#### B. C/C++ 通用方法 (针对特定值)



| **方法**       | **适用场景**                    | **优点**                                    | **示例**                        |
| -------------- | ------------------------------- | ------------------------------------------- | ------------------------------- |
| **`memset()`** | **将 POD 数组初始化为 0 或 -1** | **性能最高**（通常是 C++ 算法无法比拟的）。 | `memset(arr, 0, sizeof(arr));`  |
| **`for` 循环** | **初始化为任意值**              | 最灵活，可以执行复杂逻辑。                  | `for (int& x : arr) { x = 7; }` |



### 结论和建议



1. **如果你使用 C++ 并且需要将数组初始化为除了 0 或 -1 以外的任意值：**
   - **使用 `std::fill` 或 `std::for_each`**。它们是类型安全的，并且能正确处理对象的构造。
2. **如果你需要将 C 风格数组（`int[]`, `char[]` 等）快速初始化为全 0：**
   - **在 C++ 中，使用 `int arr[N] = {};`** (最简洁和 C++ 推荐)。
   - **在 C 或需要最高性能时，使用 `memset(arr, 0, sizeof(arr))`**。
3. **如果你处理的数组元素是复杂的对象（非 POD 类型，如 `std::string`、自定义类）：**
   - **绝对不要使用 `memset()`。** 这会导致对象内部状态被破坏，必须使用 C++ 的初始化列表或 `std::fill` 等方法。



## 4. strlen()

`.size()` 和 `strlen()` 函数都是用来获取字符串长度的，但它们在使用对象、计算方式和适用语言方面有明显的区别：

| **特点**            | **.size()**                                                  | **strlen()**                                                 |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| **适用对象**        | 主要用于 C++ 标准库中的容器，例如 `std::string`, `std::vector`, `std::list` 等。 | 主要用于 C 风格字符串（以空字符 `\0` 结尾的字符数组 `char[]` 或 `char*`）。 |
| **计算方式**        | 返回容器中**实际存储的元素个数**。对于 `std::string`，它返回的是字符串中的字符数量，**不包括**末尾的空字符 `\0`。 | 从字符串的起始地址开始，逐个字符计数，直到遇到**第一个空字符 `\0` 为止**。返回的长度**不包括**空字符 `\0`。 |
| **效率/时间复杂度** | 通常是 $O(1)$，因为它直接访问对象内部存储的长度成员变量。    | $O(n)$，因为它必须遍历整个字符串直到找到空字符。             |
| **返回类型**        | 通常是 `size_t` 类型（一个无符号整数类型）。                 | `size_t` 类型。                                              |
| **是否安全**        | 相对安全，因为它操作的是标准库对象，不会发生越界访问。       | 存在安全风险，如果传入的字符数组没有正确的空字符 `\0` 结尾，函数会一直读下去直到访问到非法内存，导致未定义行为（通常是程序崩溃）。 |
| **头文件 (C++)**    | 通常不需要额外的头文件（对于 `std::string`），或者对应容器的头文件（例如 `<vector>`）。 | `<cstring>` 或 `<string.h>`。                                |

**总结：**

1. **C++ 编程中，处理 `std::string` 对象时，应优先使用 `.size()` 或 `.length()` 方法**（这两个对于 `std::string` 来说是等价的）。它更快、更安全、更符合 C++ 面向对象的习惯。
2. **处理 C 风格字符串 (`char\*` 或 `char[]`) 时，必须使用 `strlen()`**。

**示例（C++）：**

C++

```cpp
#include <iostream>
#include <string>
#include <cstring> // for strlen

int main() {
    // C++ std::string
    std::string cpp_str = "Hello";
    
    // 使用 .size() 或 .length() (推荐)
    std::cout << "std::string .size(): " << cpp_str.size() << std::endl; 
    // 输出: 5 

    // C 风格字符串
    const char* c_str = "World"; 
    
    // 使用 strlen() (必须)
    std::cout << "C-style strlen(): " << std::strlen(c_str) << std::endl; 
    // 输出: 5
    
    // 尽管不推荐，但你也可以对 std::string 的 C 风格表示使用 strlen
    std::cout << "std::string c_str() + strlen(): " << std::strlen(cpp_str.c_str()) << std::endl;
    // 输出: 5
    
    return 0;
}
```

## 5. 四舍五入

在 C++ 中实现四舍五入，最简单、最标准的方法是使用 C++11 引入的数学函数 **`std::round()`**。

如果你使用的是 C++11 之前的标准，或者需要自定义精度，则需要使用不同的技巧。

以下是 C++ 中实现四舍五入的几种主要方法：

------



### 1. 使用 `std::round()` (C++11 及更高版本，**推荐**⭐)



`std::round()` 是 C++ 标准库 `<cmath>` 中的函数，它实现了标准的四舍五入规则：到最近的整数，如果刚好在两个整数中间，则**舍入到远离零的方向**（即 $|x + 0.5|$）。

**特点：**

- **最标准、最简洁。**
- 定义在 `<cmath>` 头文件中。

**代码示例：**

C++

```cpp
#include <iostream>
#include <cmath>

int main() {
    double num1 = 3.4;
    double num2 = 3.5;
    double num3 = 3.6;
    double num4 = -3.4;
    double num5 = -3.5;
    double num6 = -3.6;

    std::cout << "std::round(3.4) = " << std::round(num1) << std::endl; // 输出 3
    std::cout << "std::round(3.5) = " << std::round(num2) << std::endl; // 输出 4 (远离零)
    std::cout << "std::round(3.6) = " << std::round(num3) << std::endl; // 输出 4

    std::cout << "std::round(-3.4) = " << std::round(num4) << std::endl; // 输出 -3
    std::cout << "std::round(-3.5) = " << std::round(num5) << std::endl; // 输出 -4 (远离零)
    std::cout << "std::round(-3.6) = " << std::round(num6) << std::endl; // 输出 -4

    return 0;
}
```

------



### 2. 使用 `floor(x + 0.5)` 技巧 (兼容 C/C++，但有局限)



这是 C 语言中常用的四舍五入方法，利用了向下取整函数 `std::floor()`。

原理：

对于正数 $x$，$x + 0.5$ 之后，小数部分 $< 0.5$ 的会变成 $< 1.0$，而小数部分 $\ge 0.5$ 的会变成 $\ge 1.0$，再进行向下取整即可实现四舍五入。

**局限性：**

- **不适用于负数**。对于负数，它会得到错误的结果（例如：`floor(-3.5 + 0.5)` 等于 `floor(-3.0)`，结果是 $-3$，应该四舍五入到 $-4$）。

**代码示例：**

C++

```cpp
#include <iostream>
#include <cmath>

int main() {
    double num1 = 3.6;
    double num2 = -3.6;

    // 仅适用于正数的四舍五入
    double rounded_positive = std::floor(num1 + 0.5); // 4.1 -> floor(4.1) -> 4
    std::cout << "Floor(3.6 + 0.5) = " << rounded_positive << std::endl; // 输出 4

    // 对负数结果错误
    double rounded_negative = std::floor(num2 + 0.5); // -3.6 + 0.5 = -3.1 -> floor(-3.1) -> -4 (正确应该是-4)

    // 但对于 -3.4
    double num3 = -3.4;
    double rounded_negative_wrong = std::floor(num3 + 0.5); // -3.4 + 0.5 = -2.9 -> floor(-2.9) -> -3 (应该-3，结果正确，但机制不通用)
    
    return 0;
}
```

------



### 3. 实现自定义四舍五入函数 (手动处理正负数)



为了在没有 `std::round()` 的旧环境中实现完全正确的四舍五入，需要结合 `floor()` 和 `ceil()`，或者使用 `floor(abs(x) + 0.5)` 并保留符号。

**代码示例：**

C++

```cpp
#include <iostream>
#include <cmath>

double custom_round(double x) {
    if (x >= 0.0) {
        // 正数：加 0.5 后向下取整
        return std::floor(x + 0.5);
    } else {
        // 负数：减 0.5 后向上取整 (或者使用 abs 技巧)
        return std::ceil(x - 0.5);
        // 或者使用：return -std::floor(std::abs(x) + 0.5);
    }
}

int main() {
    std::cout << "custom_round(3.5) = " << custom_round(3.5) << std::endl;    // 输出 4
    std::cout << "custom_round(-3.5) = " << custom_round(-3.5) << std::endl;  // 输出 -4

    return 0;
}
```

------



### 4. 四舍五入到小数点后 N 位



如果你需要保留特定位数的小数（例如四舍五入到小数点后两位），则需要进行乘法、四舍五入，然后再除法。

**原理：**

1. 将数字乘以 $10^N$。
2. 对结果进行四舍五入（使用 `std::round()`）。
3. 将结果除以 $10^N$。

**代码示例：**

C++

```cpp
#include <iostream>
#include <cmath>

// 四舍五入到小数点后 N 位
double round_to_n_digits(double value, int n) {
    // 计算 10 的 N 次方
    double factor = std::pow(10.0, n); 
    
    // 步骤1 & 2: 乘以因子，四舍五入
    double temp_value = std::round(value * factor);
    
    // 步骤3: 除以因子
    return temp_value / factor;
}

int main() {
    double pi = 3.14159265;
    
    // 四舍五入到小数点后 2 位
    double result_2 = round_to_n_digits(pi, 2); 
    std::cout << "Round to 2 digits: " << result_2 << std::endl; // 输出 3.14
    
    // 四舍五入到小数点后 3 位
    double result_3 = round_to_n_digits(pi, 3); 
    std::cout << "Round to 3 digits: " << result_3 << std::endl; // 输出 3.142

    return 0;
}
```

## 6. 三目运算符

三目运算符（Ternary Operator），也常被称为“条件运算符”，是许多编程语言中（如 C, C++, Java, JavaScript, Python 等）唯一一个需要三个操作数的运算符。

它主要用于**简化简单的 `if...else` 语句**，让代码更加简洁。

------



### 📚 基本语法



三目运算符的基本结构如下：

```
条件 (condition) ? 表达式1 (expression_if_true) : 表达式2 (expression_if_false)
```

**工作原理：**

1. 首先，计算`条件`（通常是一个布尔表达式，即结果为“真”或“假”）。
2. 如果`条件`为**真 (true)**，则执行`表达式1`，并且整个三目运算的结果就是`表达式1`的值。
3. 如果`条件`为**假 (false)**，则执行`表达式2`，并且整个三目运算的结果就是`表达式2`的值。

------



### 💡 示例对比



让我们来看一个使用 `if...else` 和使用三目运算符的对比。

**场景：** 假设我们要判断一个人的年龄 `age` 是否大于等于 18 岁，如果是，则设置状态为 "成年" (adult)，否则为 "未成年" (minor)。



#### 1. 使用 `if...else` 语句



JavaScript

```
let age = 20;
let status;

if (age >= 18) {
  status = "成年";
} else {
  status = "未成年";
}

console.log(status); // 输出: "成年"
```



#### 2. 使用三目运算符



使用三目运算符，可以将上面的逻辑压缩到一行代码中：

JavaScript

```
let age = 20;
let status = (age >= 18) ? "成年" : "未成年";

console.log(status); // 输出: "成年"
```

在这个例子中：

- `条件` 是 `age >= 18`
- `表达式1` (条件为真时执行) 是 `"成年"`
- `表达式2` (条件为假时执行) 是 `"未成年"`

------



### 🔧 常见用例



1. 变量赋值（如上例）：

   这是最常见的用法，根据条件给变量赋不同的值。

2. 函数返回值：

   可以直接在 return 语句中使用。

   JavaScript

   ```
   function getFee(isMember) {
     return isMember ? "$2.00" : "$10.00";
   }
   console.log(getFee(true)); // 输出: "$2.00"
   ```

3. 处理 null 或 undefined（空值检查）：

   在给变量赋值前，检查它是否为空。

   JavaScript

   ```
   let username = loggedInUser ? loggedInUser.name : "Guest";
   // 如果 loggedInUser 存在，则使用其 name 属性，否则显示 "Guest"
   ```

------



### 👍 优点与 👎 缺点





#### 优点



- **简洁：** 相比 `if...else` 块，代码行数更少，更紧凑。
- **方便：** 非常适合在行内进行简单的逻辑判断，尤其是在赋值或函数返回时。



#### 缺点



- **可读性下降（过度使用时）：** 如果 `条件` 或 `表达式` 过于复杂，或者进行 "嵌套"（在三目运算符中再嵌套一个三目运算符），代码的可读性会迅速下降。

> ⚠️ 使用建议：
>
> 当逻辑简单且清晰时（例如 "二选一" 赋值），使用三目运算符是很好的选择。
>
> 如果逻辑复杂（例如 if...else if...else），或者表达式非常长，强烈建议使用 if...else 语句，以保证代码的可读性和可维护性。

------

## 7. 格式化输出

### 1.

"%02d" 是**格式化字符串**中的一种格式说明符，常见于像 C 语言的 `printf` 函数中，用于输出整数。

它的具体含义是：

- **`%`**: 表示这是一个格式说明符的开始。
- **`d`**: 表示要输出的是一个**十进制带符号整数**（decimal integer）。
- **`0`**: 是一个**标志/修饰符**，表示如果输出的数字位数不足指定的宽度，将会在前面用**数字 0 填充**。
- **`2`**: 是**最小字段宽度**，表示输出的数字至少会占据 2 个字符的位置。

**总结来说，"%02d" 的意思是：**

以十进制整数形式输出，**最小宽度为 2 位**，如果数字不足 2 位，则在前面**用 0 补齐**。

**例子：**

| **输入数字** | **输出结果** | **解释**                    |
| ------------ | ------------ | --------------------------- |
| `5`          | `"05"`       | 不足 2 位，前面补一个 0。   |
| `12`         | `"12"`       | 刚好 2 位，按原样输出。     |
| `123`        | `"123"`      | 超过 2 位，按实际位数输出。 |

### 2.

当你希望输出的字符（通常是字符串或数字）**一定占据指定的宽度**，并且要求内容在指定的宽度内**左对齐**时，你需要使用格式化字符串中的以下结构：



### 结构



```
% - [宽度] [类型]
```



### 组成部分详解



1. **`%`**: 格式说明符的开始。
2. **`-` (负号/减号)**:
   - 这个是**对齐标志**。
   - 它的作用就是强制输出内容在指定的字段宽度内**左对齐**。如果没有它，默认是右对齐。
3. **`[宽度]`**:
   - 这是一个**数字**，表示输出字段的最小宽度。
   - 如果输出内容的实际长度小于这个宽度，则会在右侧填充空格。
4. **`[类型]`**:
   - 表示要输出的数据类型，例如：
     - `s`：字符串 (String)
     - `d`：十进制整数 (Decimal integer)
     - `f`：浮点数 (Float)



### 示例



假设你希望输出一个字符串，它至少占据 **10 个字符的宽度**，并要求**左对齐**。



#### 使用 `% - 10 s`



| **代码**  | **结果** | **解释**                |
| --------- | -------- | ----------------------- |
| `printf(" | %-10s    | ", "Hello");`           |
| `printf(" | %-10s    | ", "WorldWide");`       |
| `printf(" | %-10s    | ", "SuperLongString");` |



#### 数字的左对齐示例



对于数字，虽然不常用，但也可以左对齐。

| **代码**  | **结果** | **解释**  |
| --------- | -------- | --------- |
| `printf(" | %-5d     | ", 123);` |

请注意，这种格式化语法主要应用于 C/C++ 的 `printf` 函数以及许多受其影响的语言（如 Perl、PHP 等）。在 Python、Java 等现代语言中，也有类似的格式化方法，但具体语法可能会略有不同。

### 3.

`%lf` 和 `%Lf` 是 C/C++ 语言中用于处理**浮点数**的格式化说明符，它们主要区别在于所针对的数据类型大小和使用场景。



### 总结区别



| **特性**     | **%lf**                                  | **%Lf**                                       |
| ------------ | ---------------------------------------- | --------------------------------------------- |
| **数据类型** | **`double`** (双精度浮点数)              | **`long double`** (长双精度浮点数)            |
| **含义**     | **`long float`** 的缩写，表示 `double`。 | **`Long float`** 的缩写，表示 `long double`。 |
| **占用内存** | 通常 8 字节                              | 通常 10 或 16 字节（取决于系统和编译器）      |
| **精度**     | 较高（标准双精度）                       | 最高（比 `double` 更高）                      |
| **`printf`** | 用于输出 `double` 类型的值。             | 用于输出 `long double` 类型的值。             |
| **`scanf`**  | **必须**用于读取 `double` 类型的值。     | **必须**用于读取 `long double` 类型的值。     |

------



### 详细解释





#### 1. `%lf` (用于 `double`)



- **数据类型：** `double`（双精度浮点数）。

- **用途：**

  - 在 **`printf`** 中：用于输出 `double` 类型的值。
  - 在 **`scanf`** 中：用于读取输入并存储到 `double` 类型的变量中。这是与旧的 C 标准中 `float` 使用 `%f` 的一个重要区别。

- **示例 (C 语言)：**

  C

  ```
  double num_d = 1.23456789;
  printf("Double (printf): %lf\n", num_d); // 输出 double
  
  // 读取 double 时必须使用 %lf
  // double input_d;
  // scanf("%lf", &input_d); 
  ```



#### 2. `%Lf` (用于 `long double`)



- **数据类型：** `long double`（长双精度浮点数）。

- **用途：**

  - 在 **`printf`** 中：用于输出 `long double` 类型的值。
  - 在 **`scanf`** 中：用于读取输入并存储到 `long double` 类型的变量中。

- **特点：** `long double` 提供了比 `double` 更高的精度和更大的数值范围，但在不同平台和编译器上的实现可能不同（通常是 10 字节或 16 字节）。

- **示例 (C 语言)：**

  C

  ```cpp
  long double num_ld = 9.876543210987654321L; // L 或 l 表示 long double
  printf("Long Double (printf): %Lf\n", num_ld); // 输出 long double
  
  // 读取 long double 时必须使用 %Lf
  // long double input_ld;
  // scanf("%Lf", &input_ld); 
  ```



### ❗ 重点注意事项



**关于 `printf` 函数：**

在 C 语言中，当向 `printf` 函数传递 `float` 或 `double` 类型的参数时，遵循**默认参数升级 (Default Argument Promotions)** 规则。

- `float` 类型的值会自动提升为 `double` 类型。

这意味着，对于**输出**：

- 输出 `float` 或 `double` 类型的值，使用 `%f` 或 `%lf` **都可以**，它们通常被视为等效。

**关于 `scanf` 函数：**

`scanf` 不涉及默认参数升级，它需要知道变量的确切大小和类型才能正确地将输入数据写入内存地址。

- 读取 **`float`** 变量时，必须使用 `%f`。
- 读取 **`double`** 变量时，**必须**使用 `%lf`。
- 读取 **`long double`** 变量时，**必须**使用 `%Lf`。

总结来说，在现代 C/C++ 编程中，**当你处理 `long double` 时，你需要使用 `%Lf`；而处理 `double` 时，使用 `%lf` 是最标准和推荐的做法（尤其是在 `scanf` 中）**。

## 8. sort()

`std::sort()` 是 C++ 标准库 `<algorithm>` 中一个非常强大且常用的函数，用于对容器或 C 风格数组中的元素进行排序。它基于一种高效的混合排序算法（通常是**内省排序** Introsort，结合了快速排序、堆排序和插入排序的优点）。

无论是对于 `std::vector` 还是 C 风格数组，`std::sort()` 的使用方式都是一致的，因为它操作的本质是**迭代器（Iterator）**。

------



### 一、 `std::sort()` 的基本用法



`std::sort()` 函数的签名（简化版）如下：

C++

```
template< class RandomAccessIterator >
void sort( RandomAccessIterator first, RandomAccessIterator last );

template< class RandomAccessIterator, class Compare >
void sort( RandomAccessIterator first, RandomAccessIterator last, Compare comp );
```

它需要两个（或三个）参数：

1. `first`：指向要排序序列的**起始元素**的迭代器（或指针）。
2. `last`：指向要排序序列的**结束元素的下一个位置**的迭代器（或指针）。这是一个**半开区间** `[first, last)`。
3. `comp` (可选)：一个**比较函数**（或 Lambda 表达式），用于定义排序的顺序。

------



### 二、 针对 C 风格数组的使用



对于 C 风格数组，可以直接使用**数组名作为指针**，或者使用 `std::begin()` 和 `std::end()` 辅助函数来获取迭代器。



#### 1. 默认升序排序 (从小到大)



默认情况下，`std::sort()` 使用元素的 `<` 运算符进行比较，实现升序排列。

C++

```
#include <iostream>
#include <algorithm> // 必须包含
#include <iterator>  // 用于 std::begin / std::end (C++11+)

int main() {
    int arr[] = { 50, 20, 40, 10, 30 };
    int n = sizeof(arr) / sizeof(arr[0]);

    // 方法一：使用指针和数组长度（最传统 C++ 方式）
    // std::sort(arr, arr + n); 

    // 方法二：使用 std::begin 和 std::end (C++11 推荐方式)
    std::sort(std::begin(arr), std::end(arr));

    // 输出结果: 10 20 30 40 50
    for (int x : arr) {
        std::cout << x << " ";
    }
    std::cout << std::endl;
    return 0;
}
```



#### 2. 自定义降序排序 (从大到小)



要实现降序，需要提供第三个参数——一个比较器。

C++

```
#include <iostream>
#include <algorithm>

int main() {
    int arr[] = { 50, 20, 40, 10, 30 };

    // 方法一：使用 std::greater<T>()
    // std::greater<int>() 是一个函数对象，定义了降序比较
    std::sort(std::begin(arr), std::end(arr), std::greater<int>());

    // 方法二：使用 Lambda 表达式 (最灵活)
    // auto descending_comp = [](int a, int b) {
    //     return a > b; // 如果 a 应该排在 b 的前面，则返回 true
    // };
    // std::sort(std::begin(arr), std::end(arr), descending_comp);

    // 输出结果: 50 40 30 20 10
    // ...
    return 0;
}
```

------



### 三、 针对 `std::vector` 的使用



`std::vector` 提供了自己的成员函数 `begin()` 和 `end()` 来获取迭代器，这是最常用的方式。



#### 1. 默认升序排序



C++

```
#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> vec = { 50, 20, 40, 10, 30 };

    // 使用 vector 的成员函数 begin() 和 end()
    std::sort(vec.begin(), vec.end());

    // 输出结果: 10 20 30 40 50
    for (int x : vec) {
        std::cout << x << " ";
    }
    std::cout << std::endl;
    return 0;
}
```



#### 2. 自定义降序排序



同样，通过提供第三个比较器参数实现降序。

C++

```
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> vec = { 50, 20, 40, 10, 30 };

    // 使用 Lambda 表达式进行降序排序
    std::sort(vec.begin(), vec.end(), [](int a, int b) {
        return a > b; // 定义降序
    });

    // 输出结果: 50 40 30 20 10
    // ...
    return 0;
}
```



### 总结



| **特性**       | **C 风格数组**                     | **std::vector**                    |
| -------------- | ---------------------------------- | ---------------------------------- |
| **包含头文件** | `<algorithm>`                      | `<algorithm>`, `<vector>`          |
| **起始迭代器** | `arr` 或 `std::begin(arr)`         | `vec.begin()`                      |
| **结束迭代器** | `arr + n` 或 `std::end(arr)`       | `vec.end()`                        |
| **核心函数**   | **`std::sort(first, last, comp)`** | **`std::sort(first, last, comp)`** |

`std::sort()` 的强大之处在于它抽象了底层容器的差异，通过**迭代器**接口实现了统一的排序操作。只要容器提供了随机访问迭代器（Random Access Iterator），就可以使用 `std::sort`。



## 9.时间复杂度

![](https://pub-f8d3afa0c3274f1e943ee2f8c45dff96.r2.dev/25_10_63a0cd5212019d108a20d78b6edb56de.webp)
