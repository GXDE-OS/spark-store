#!/bin/bash
# Qt5 编译脚本

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build/qt5-Debug"

echo "================================"
echo "Qt5 编译脚本"
echo "================================"
echo ""

# 检查 Qt5 qmake
if ! command -v /usr/lib/qt5/bin/qmake &> /dev/null; then
    echo "错误: 未找到 Qt5 qmake"
    echo "请确保 Qt5 已安装: /usr/lib/qt5/bin/qmake"
    exit 1
fi

echo "Qt5 版本:"
/usr/lib/qt5/bin/qmake --version
echo ""

# 创建构建目录
echo "创建构建目录: ${BUILD_DIR}"
rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}"
echo ""

# 生成 Makefile
echo "生成 Makefile..."
cd "${BUILD_DIR}"
/usr/lib/qt5/bin/qmake "${PROJECT_ROOT}/spark-store-project.pro" -r CONFIG+=debug
echo ""

# 编译
echo "开始编译..."
make -j$(nproc)
echo ""

echo "================================"
echo "Qt5 编译完成！"
echo "================================"
echo ""
echo "可执行文件位置:"
echo "  主应用: ${BUILD_DIR}/src/spark-store"
echo "  更新工具: ${BUILD_DIR}/spark-update-tool/spark-update-tool"
echo ""

# 验证编译结果
if [ -f "${BUILD_DIR}/src/spark-store" ]; then
    echo "✓ 主应用编译成功"
    ls -lh "${BUILD_DIR}/src/spark-store"
else
    echo "✗ 主应用编译失败"
    exit 1
fi

if [ -f "${BUILD_DIR}/spark-update-tool/spark-update-tool" ]; then
    echo "✓ 更新工具编译成功"
    ls -lh "${BUILD_DIR}/spark-update-tool/spark-update-tool"
fi

echo ""
