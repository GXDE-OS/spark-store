QT += core gui widgets network concurrent
TARGET = spark-update-tool
TEMPLATE = app

# Set C++ standard to C++17
CONFIG += c++17

# Enable auto features (uic, moc, rcc)
CONFIG += qt warn_on release

# Version info
VERSION = 0.1.0
DEFINES += APP_VERSION=\\\"$$VERSION\\\"

# Source files
SOURCES += \
    src/main.cpp \
    src/mainwindow.cpp \
    src/aptssupdater.cpp \
    src/appdelegate.cpp \
    src/applistmodel.cpp \
    src/downloadmanager.cpp \
    src/ignoreconfig.cpp

HEADERS += \
    src/mainwindow.h \
    src/aptssupdater.h \
    src/appdelegate.h \
    src/applistmodel.h \
    src/downloadmanager.h \
    src/ignoreconfig.h

FORMS += \
    src/mainwindow.ui

RESOURCES += \
    src/icons.qrc

# Linux-specific settings
unix:!macx {
    # 安装到 /usr/bin 目录
    target.path = /usr/bin
    INSTALLS += target
    
    # 如果需要安装其他文件（如桌面文件、图标等），可以添加
    # desktop.path = /usr/share/applications
    # desktop.files = spark-update-tool.desktop
    # INSTALLS += desktop
    
    # Additional Linux specific configurations if needed
    QMAKE_CXXFLAGS += -Wall -Wextra
}

# Remove Windows and macOS specific sections since we're focusing on Linux