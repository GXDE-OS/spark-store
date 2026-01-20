#!/bin/bash

# Spark Store - 构建 Qt5 和 Qt6 两个版本的 DEB 包
# Build both Qt5 and Qt6 versions of DEB packages

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

echo "========================================="
echo "Spark Store - 双版本 DEB 构建"
echo "========================================="
echo ""
echo "项目目录: $PROJECT_ROOT"
echo ""

# 检查脚本存在
if [ ! -f "$PROJECT_ROOT/build-deb-qt5.sh" ] || [ ! -f "$PROJECT_ROOT/build-deb-qt6.sh" ]; then
    echo "错误: 构建脚本不存在"
    exit 1
fi

# 检查 debian 目录存在
if [ ! -d "$PROJECT_ROOT/debian" ]; then
    echo "错误: debian 目录不存在"
    exit 1
fi

# 构建 Qt5
echo "================================"
echo "第一步：构建 Qt5 版本..."
echo "================================"
cd "$PROJECT_ROOT"
./build-deb-qt5.sh

# 检查输出
if ! ls ../*_qt5_amd64.deb 2>/dev/null | grep -q . ; then
    echo "错误: Qt5 构建失败，未找到输出文件"
    exit 1
fi

QT5_DEB=$(ls -t ../*_qt5_amd64.deb 2>/dev/null | head -1)
echo "✓ Qt5 版本已构建: $QT5_DEB"
echo ""

# 清理构建文件以进行下一次构建
echo "清理构建环境..."
cd "$PROJECT_ROOT"
rm -rf build-*/spark-update-tool build-*/src build-*/Makefile

# 构建 Qt6
echo "================================"
echo "第二步：构建 Qt6 版本..."
echo "================================"
cd "$PROJECT_ROOT"
./build-deb-qt6.sh

# 检查输出
if ! ls ../*_qt6_amd64.deb 2>/dev/null | grep -q . ; then
    echo "错误: Qt6 构建失败，未找到输出文件"
    exit 1
fi

QT6_DEB=$(ls -t ../*_qt6_amd64.deb 2>/dev/null | head -1)
echo "✓ Qt6 版本已构建: $QT6_DEB"
echo ""

# 显示最终结果
echo "========================================="
echo "✓ 构建完成！"
echo "========================================="
echo ""
echo "输出文件:"
ls -lh "$QT5_DEB" "$QT6_DEB" 2>/dev/null
echo ""

# 显示版本信息
echo "验证 Qt5 版本:"
dpkg -I "$QT5_DEB" | grep -E "Description:|Package:" | head -2
echo ""

echo "验证 Qt6 版本:"
dpkg -I "$QT6_DEB" | grep -E "Description:|Package:" | head -2
echo ""

echo "========================================="
echo "安装选项:"
echo "  Qt5: sudo apt install $QT5_DEB"
echo "  Qt6: sudo apt install $QT6_DEB"
echo "========================================="
