#include "ignoreconfig.h"
#include <QStandardPaths>
#include <QDir>
#include <QFile>
#include <QTextStream>
#include <QDebug>

IgnoreConfig::IgnoreConfig(QObject *parent)
    : QObject(parent)
{
    QString configDir;
    QByteArray sudoUserHomeEnv = qgetenv("SUDO_USER_HOME");

    if (!sudoUserHomeEnv.isEmpty()) {
        configDir = QString::fromLocal8Bit(sudoUserHomeEnv) + "/.config";
    } else {
        configDir = QStandardPaths::writableLocation(QStandardPaths::ConfigLocation);
    }

    QDir dir(configDir);
    if (!dir.exists()) {
        dir.mkpath(".");
    }
    m_configFilePath = dir.filePath("spark-store/ignored_apps.conf");
    
    // 确保目录存在
    QFileInfo fileInfo(m_configFilePath);
    QDir configDirPath = fileInfo.dir();
    if (!configDirPath.exists()) {
        configDirPath.mkpath(".");
    }
    
    // 加载现有配置
    loadConfig();
    
    // 输出忽略列表到 qDebug
    printIgnoredApps();
}

void IgnoreConfig::addIgnoredApp(const QString &packageName, const QString &version)
{
    m_ignoredApps.insert(qMakePair(packageName, version));
    saveConfig();
}

void IgnoreConfig::removeIgnoredApp(const QString &packageName, const QString &version)
{
    m_ignoredApps.remove(qMakePair(packageName, version));
    saveConfig();
}

bool IgnoreConfig::isAppIgnored(const QString &packageName, const QString &version) const
{
    return m_ignoredApps.contains(qMakePair(packageName, version));
}

QSet<QPair<QString, QString>> IgnoreConfig::getIgnoredApps() const
{
    return m_ignoredApps;
}

void IgnoreConfig::printIgnoredApps() const
{
    qDebug() << "=== 忽略的应用列表 ===";
    qDebug() << "配置文件路径:" << m_configFilePath;
    
    if (m_ignoredApps.isEmpty()) {
        qDebug() << "没有忽略的应用";
    } else {
        for (const auto &app : m_ignoredApps) {
            qDebug() << "忽略的应用:" << app.first << "版本:" << app.second;
        }
    }
    qDebug() << "====================";
}

bool IgnoreConfig::saveConfig()
{
    QFile file(m_configFilePath);
    if (!file.open(QIODevice::WriteOnly | QIODevice::Text)) {
        qDebug() << "无法打开配置文件进行写入:" << m_configFilePath;
        return false;
    }

    QTextStream out(&file);
    for (const auto &app : m_ignoredApps) {
        out << app.first << "|" << app.second << "\n";
    }
    file.close();
    return true;
}

bool IgnoreConfig::loadConfig()
{
    QFile file(m_configFilePath);
    if (!file.exists()) {
        // 配置文件不存在，这是正常的，返回true表示没有错误
        return true;
    }
    
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        qDebug() << "无法打开配置文件进行读取:" << m_configFilePath;
        return false;
    }

    m_ignoredApps.clear();
    QTextStream in(&file);
    while (!in.atEnd()) {
        QString line = in.readLine().trimmed();
        if (!line.isEmpty()) {
            QStringList parts = line.split('|');
            if (parts.size() == 2) {
                m_ignoredApps.insert(qMakePair(parts[0], parts[1]));
            }
        }
    }
    file.close();
    return true;
}
