#!/bin/bash

# Spark Store - Qt6 DEB Package Builder
# 构建 Qt6 版本的 DEB 包

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

echo "========================================="
echo "构建 Spark Store - Qt6 版本"
echo "========================================="
echo ""

# 检查 debian 目录是否存在
if [ ! -d "$PROJECT_ROOT/debian" ]; then
    echo "错误: $PROJECT_ROOT/debian 目录不存在"
    exit 1
fi

# 检查必要的文件
if [ ! -f "$PROJECT_ROOT/debian/control" ] || [ ! -f "$PROJECT_ROOT/debian/rules" ]; then
    echo "错误: debian 目录中缺少必要的文件"
    exit 1
fi

echo "使用 Qt6 构建..."
echo "Debian 配置目录: $PROJECT_ROOT/debian"
echo ""

# 构建 DEB 包，传递 Qt 版本标志
cd "$PROJECT_ROOT"
echo "开始构建..."
QT_VERSION=qt6 dpkg-buildpackage -us -uc -b

BUILD_STATUS=$?

if [ $BUILD_STATUS -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✓ Qt6 DEB 包构建成功！"
    echo "========================================="
    
    # 重命名 DEB 文件以包含 qt6 标识
    DEB_FILE=$(find "$PROJECT_ROOT/.." -maxdepth 1 -name "spark-store_*_$(dpkg-architecture -qDEB_BUILD_ARCH).deb" -type f -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2-)
    if [ -n "$DEB_FILE" ] && [ -f "$DEB_FILE" ]; then
        DEB_DIR=$(dirname "$DEB_FILE")
        DEB_BASENAME=$(basename "$DEB_FILE")
        DEB_NEW_NAME=$(echo "$DEB_BASENAME" | sed 's/_\([^_]*\)\.deb$/_qt6_\1.deb/')
        DEB_NEW_PATH="$DEB_DIR/$DEB_NEW_NAME"
        mv "$DEB_FILE" "$DEB_NEW_PATH"
        echo "DEB 文件已重命名为: $DEB_NEW_NAME"
    fi
else
    echo ""
    echo "========================================="
    echo "✗ Qt6 DEB 包构建失败"
    echo "========================================="
    exit 1
fi
