#ifndef APTSSUPDATER_H
#define APTSSUPDATER_H

#include <QWidget>
#include <QStringList>
#include <QTemporaryFile>
#include <QLocale>
#include <QJsonObject>
#include <QJsonArray>
class aptssUpdater : public QWidget
{
    Q_OBJECT
public:
    explicit aptssUpdater(QWidget *parent = nullptr);

    QStringList getUpdateablePackages(); // 查询可更新包列表及更新内容
    QStringList getPackageSizes();       // 获取每个包的大小
    QStringList getDesktopAppNames();  // 获取桌面应用名称列表
    QStringList getPackageIcons();    // 获取包图标列表
    QJsonArray getUpdateInfoAsJson(); // 获取更新信息的 JSON 格式
    QString m_tempFilePath;
    
    // APM 相关方法
    QStringList getApmUpdateablePackages(); // 查询 APM 可更新包列表及更新内容
    QJsonArray getApmUpdateInfoAsJson(); // 获取 APM 更新信息的 JSON 格式
    QJsonArray mergeUpdateInfo(); // 合并 APTSS 和 APM 的更新信息

signals:
private:
    bool checkDesktopFiles(const QStringList &desktopFiles, QString &appName, const QString &lang, const QString &packageName);
    QStringList packageName;
    QStringList apmPackageName; // APM 包列表

    // 检查包安装状态的方法
    bool isPackageInstalledInAptss(const QString &packageName); // 检查包是否在 aptss 中已安装
    bool isPackageInstalledInApm(const QString &packageName);   // 检查包是否在 apm 中已安装
};

#endif // APTSSUPDATER_H