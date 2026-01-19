#!/bin/bash
# Qt5 编译和运行脚本

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="${PROJECT_ROOT}/build/qt5-Debug"

echo "================================"
echo "Qt5 编译和运行脚本"
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

echo "✓ 编译完成！"
echo ""

# 运行应用
SPARK_STORE="${BUILD_DIR}/src/spark-store"

if [ -f "${SPARK_STORE}" ]; then
    echo "================================"
    echo "启动 spark-store（Qt5）"
    echo "================================"
    echo ""
    "${SPARK_STORE}"
else
    echo "错误: spark-store 未找到"
    exit 1
fi
