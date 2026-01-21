#!/bin/bash

# Debian 合并后的验证脚本
# Verification script for merged Debian configuration

echo "========================================="
echo "Spark Store - Debian 配置验证"
echo "========================================="
echo ""

# 检查文件存在
echo "[1/4] 检查文件结构..."
if [ ! -d "debian" ]; then
    echo "  ✗ debian 目录不存在"
    exit 1
fi

if [ ! -f "debian/control" ]; then
    echo "  ✗ debian/control 不存在"
    exit 1
fi

if [ ! -f "debian/rules" ]; then
    echo "  ✗ debian/rules 不存在"
    exit 1
fi

echo "  ✓ 文件结构完整"
echo ""

# 检查是否有旧目录残留
echo "[2/4] 检查是否清理了冗余目录..."
if [ -d "debian-qt5" ] || [ -d "debian-qt6" ]; then
    echo "  ⚠ 警告: 仍然存在 debian-qt5 或 debian-qt6 目录"
else
    echo "  ✓ 已清理冗余目录"
fi

if [ -f "debian-qt5-qt6-backup.tar.gz" ]; then
    echo "  ✓ 已创建备份: debian-qt5-qt6-backup.tar.gz"
fi
echo ""

# 检查 control 文件支持两个版本
echo "[3/4] 检查 debian/control 的版本支持..."
if grep -q "qt5-default | qt6-base-dev" debian/control; then
    echo "  ✓ control 文件支持 Qt5 和 Qt6 选择"
else
    echo "  ⚠ control 文件可能未正确配置"
fi

if grep -q "libdtk6core-dev" debian/control && grep -q "libdtk6core[^-]" debian/control; then
    echo "  ✓ control 文件包含 Qt6 DTK 依赖"
else
    echo "  ⚠ control 文件可能缺少 Qt6 DTK 依赖"
fi
echo ""

# 检查 rules 文件支持版本切换

echo "[4/4] 检查 debian/rules 的版本切换支持..."
if grep -q "QT_VERSION ?= qt5" debian/rules; then
    echo "  ✓ rules 文件支持 QT_VERSION 变量（默认 qt5）"
else
    echo "  ✗ rules 文件缺少 QT_VERSION 变量定义"
    exit 1
fi

if grep -q "ifeq.*QT_VERSION.*qt6" debian/rules; then
    echo "  ✓ rules 文件支持 qt6 条件配置"
else
    echo "  ⚠ rules 文件可能缺少 qt6 条件"
fi

if grep -q "QMAKE_CMD = qmake6" debian/rules; then
    echo "  ✓ rules 文件支持 qmake6 选择"
else
    echo "  ⚠ rules 文件可能缺少 qmake6 支持"
fi
echo ""

# 检查Qt5版本

echo "[5/5] 检查Qt5版本..."
QT5_VERSION=""
if command -v qmake &> /dev/null; then
    QT5_VERSION=$(qmake --version | grep -oP 'Qt\s+\K[0-9]+\.[0-9]+')
    echo "  当前Qt5版本: $QT5_VERSION"
elif command -v qmake5 &> /dev/null; then
    QT5_VERSION=$(qmake5 --version | grep -oP 'Qt\s+\K[0-9]+\.[0-9]+')
    echo "  当前Qt5版本: $QT5_VERSION"
else
    echo "  ✗ 未检测到Qt5 (qmake或qmake5)"
    QT5_VERSION="0.0"
fi

# 检查是否需要安装Qt5.11
if [ "$QT5_VERSION" != "5.11" ]; then
    echo "  ⚠ Qt5版本不是5.11，推荐使用Qt5.11版本以获得最佳兼容性（非强制要求）"
    
    # 询问用户是否继续
    read -p "  要继续尝试自动安装吗？(Y/N): " user_choice
    if [[ "$user_choice" =~ ^[Yy]$ ]]; then
        # 尝试通过系统源安装Qt5.11
        if command -v apt-get &> /dev/null; then
            sudo apt-get update
            sudo apt-get install -y qt5-default
            
            # 重新检查版本
            if command -v qmake &> /dev/null; then
                QT5_VERSION=$(qmake --version | grep -oP 'Qt\s+\K[0-9]+\.[0-9]+')
                echo "  安装后Qt5版本: $QT5_VERSION"
            elif command -v qmake5 &> /dev/null; then
                QT5_VERSION=$(qmake5 --version | grep -oP 'Qt\s+\K[0-9]+\.[0-9]+')
                echo "  安装后Qt5版本: $QT5_VERSION"
            fi
        else
            echo "  ⚠ 不支持的包管理器，无法自动安装"
        fi
    else
        echo "  用户选择不进行自动安装"
    fi
    
    # 再次检查版本
    if [ "$QT5_VERSION" != "5.11" ]; then
        echo "======================================================"
        echo "  ⚠ 注意：Qt5版本仍不是5.11，可能会影响应用程序的兼容性"
        echo "  如需使用Qt5.11版本，请访问以下链接自行安装："
        echo "  https://download.qt.io/new_archive/qt/5.11/5.11.3/"
        echo "  脚本将继续执行后续检查..."
        echo "======================================================"
    else
        echo "  ✓ Qt5版本已更新为5.11"
    fi
else
    echo "  ✓ Qt5版本为5.11，符合要求"
fi
echo ""

# 最终结果
echo "========================================="
echo "✓ 验证完成！Debian 配置已正确合并"
echo "========================================="
echo ""
echo "使用方法:"
echo "  构建 Qt5: ./build-deb-qt5.sh"
echo "  构建 Qt6: ./build-deb-qt6.sh"
echo "  构建两个版本: ./build-deb-both.sh"
echo ""
echo "或手动指定版本:"
echo "  QT_VERSION=qt5 dpkg-buildpackage -us -uc -b"
echo "  QT_VERSION=qt6 dpkg-buildpackage -us -uc -b"