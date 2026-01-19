# Spark Store 编译脚本使用指南

本项目包含 4 个编译脚本，支持 Qt5 和 Qt6 并行编译。

## 脚本文件

### 1. **Qt5 编译脚本** (`build-qt5.sh`)
**功能**: 仅编译 Qt5 版本
```bash
./build-qt5.sh
```
**输出**:
- 编译目录: `build/qt5-Debug/`
- 可执行文件: `build/qt5-Debug/src/spark-store`

### 2. **Qt5 编译和运行脚本** (`build-run-qt5.sh`)
**功能**: 编译 Qt5 版本并立即运行
```bash
./build-run-qt5.sh
```
**流程**: 编译 → 运行应用（前台）

### 3. **Qt6 编译脚本** (`build-qt6.sh`)
**功能**: 仅编译 Qt6 版本
```bash
./build-qt6.sh
```
**输出**:
- 编译目录: `build/qt6-Debug/`
- 可执行文件: `build/qt6-Debug/src/spark-store`

### 4. **Qt6 编译和运行脚本** (`build-run-qt6.sh`)
**功能**: 编译 Qt6 版本并立即运行
```bash
./build-run-qt6.sh
```
**流程**: 编译 → 运行应用（前台）

## 快速开始

### 编译 Qt6 版本
```bash
cd /home/momen/Desktop/spark-git/spark-store
./build-qt6.sh
```

### 编译并运行 Qt5 版本
```bash
cd /home/momen/Desktop/spark-git/spark-store
./build-run-qt5.sh
```

### 编译两个版本（共存）
```bash
# 先编译 Qt6
./build-qt6.sh

# 再编译 Qt5
./build-qt5.sh
```

## 脚本特性

✓ **自动检测**: 检查 Qt 工具是否安装
✓ **并行编译**: 使用 `make -j$(nproc)` 利用所有 CPU 核心
✓ **结果验证**: 编译完成后验证可执行文件
✓ **错误处理**: 编译失败时立即停止并报错
✓ **清洁构建**: 每次都从头开始（删除旧构建目录）

## 构建目录结构

```
spark-store/
├── build/
│   ├── qt5-Debug/          # Qt5 构建目录
│   │   ├── src/
│   │   │   └── spark-store (可执行文件)
│   │   └── spark-update-tool/
│   │       └── spark-update-tool (可执行文件)
│   └── qt6-Debug/          # Qt6 构建目录
│       ├── src/
│       │   └── spark-store (可执行文件)
│       └── spark-update-tool/
│           └── spark-update-tool (可执行文件)
├── build-qt5.sh
├── build-run-qt5.sh
├── build-qt6.sh
└── build-run-qt6.sh
```

## 环境要求

### Qt5
- qmake 路径: `/usr/lib/qt5/bin/qmake`
- Qt 版本: 5.15.15+

### Qt6
- qmake6 路径: `/usr/lib/qt6/bin/qmake6`
- Qt 版本: 6.8.2+

### 构建工具
- GCC/G++ 编译器
- make 工具
- pkg-config

## 故障排除

### 问题: 未找到 Qt qmake
**解决**:
```bash
# 检查 Qt 安装
which qmake                    # 检查 Qt5
/usr/lib/qt6/bin/qmake6 --version  # 检查 Qt6
```

### 问题: 编译出错
**解决**:
1. 检查所有依赖是否安装
2. 确保有充足的磁盘空间
3. 查看完整的错误信息
4. 尝试清理构建目录

## 高级用法

### 仅运行已编译的应用（不重新编译）
```bash
# Qt5
./build/qt5-Debug/src/spark-store

# Qt6
./build/qt6-Debug/src/spark-store
```

### 后台运行应用
```bash
# Qt5 后台运行
./build/qt5-Debug/src/spark-store &

# Qt6 后台运行
./build/qt6-Debug/src/spark-store &
```

### 跳过编译直接运行
```bash
# 如果已编译，可直接运行
./build/qt6-Debug/src/spark-store
```


## 脚本维护

这些脚本会在每次运行时：
1. 检查 Qt 工具可用性
2. 清理旧的构建目录
3. 生成新的 Makefile
4. 编译项目
5. 验证编译结果
