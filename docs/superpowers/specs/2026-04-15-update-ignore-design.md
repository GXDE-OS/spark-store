# 更新忽略配置迁移设计

## 背景

Electron 更新中心已经具备忽略状态的数据通路，但默认仍写入 `/etc/spark-store/ignored_apps.conf`。老 Qt 更新器也沿用同一路径。新架构下更新器不再以 root 身份启动，因此 GUI 无法稳定写入 `/etc`。与此同时，`ss-update-notifier.sh` 以 root systemd 服务运行，若直接使用 `~/` 会错误落到 `/root`。

本次改动的目标是在不重做更新链路的前提下，把“忽略更新”统一改为用户级配置，并让 Electron、老 Qt 更新器和 notifier 对同一份规则生效。

## 目标

1. 忽略配置统一迁移到用户目录 `~/.config/spark-store/ignored_apps.conf`。
2. Electron 更新中心支持显式忽略和取消忽略操作。
3. 老 Qt 更新器改为读写同一份用户级忽略配置。
4. `ss-update-notifier.sh` 在 root systemd 环境下也能读取用户级忽略配置。
5. 忽略规则同时作用于 Spark 与 APM 更新项。
6. 忽略规则按 `pkgname|version` 精确匹配，被忽略的旧版本在后续出现新版本时应重新提醒。

## 非目标

1. 不兼容旧的 `/etc/spark-store/ignored_apps.conf`。
2. 不改变更新下载、安装和迁移逻辑。
3. 不把忽略配置升级为 JSON 或数据库格式。
4. 不修改 AmberPM 侧的 `amber-pm-upgrade-notifier`。

## 方案概览

本次实现由三部分组成：

1. Electron 主进程把忽略配置路径切到用户目录，渲染层补齐“忽略 / 取消忽略”入口，并把已忽略项排在后面展示。
2. 老 Qt 更新器的 `IgnoreConfig` 改为使用 `QStandardPaths::ConfigLocation` 下的 `spark-store/ignored_apps.conf`，同时将忽略键统一为“包名 + 新版本”。
3. `ss-update-notifier.sh` 新增用户配置定位与扫描逻辑，在 root systemd 环境下优先识别活动桌面用户，失败时回退扫描 `/home/*/.config/spark-store/ignored_apps.conf` 并合并忽略集合。

## 配置文件设计

### 路径

- 统一路径：`~/.config/spark-store/ignored_apps.conf`
- Electron 通过当前进程用户的 home 解析该路径。
- Qt 通过 `QStandardPaths::writableLocation(QStandardPaths::ConfigLocation)` 解析该路径。
- notifier 不直接依赖 `~/`，而是根据目标 home 拼出 `<home>/.config/spark-store/ignored_apps.conf`。

### 格式

继续沿用现有纯文本格式，每行一条：

```text
pkgname|version
```

其中 `version` 统一表示“待更新到的新版本”，而不是当前已安装版本。

### 匹配语义

1. 仅当 `pkgname` 与 `version` 同时匹配时，视为被忽略。
2. 忽略规则不区分 `spark` / `apm` 来源。相同包名与目标版本的更新，在两侧都应被同一条规则命中。
3. 某版本被忽略后，未来出现更高版本时，不自动继承忽略状态。

## Electron 更新中心

### 主进程

`electron/main/backend/update-center/ignore-config.ts` 保持文本解析逻辑不变，只修改默认配置路径到用户目录。

`electron/main/backend/update-center/service.ts` 的默认读写也改用新路径，并在刷新结果上做一次稳定排序：

1. 正常更新项在前。
2. 已忽略项在后。
3. 同组内保持原有顺序，避免不必要的 UI 抖动。

### 渲染层交互

更新中心列表项新增两个互斥操作：

1. 未忽略项显示“忽略”按钮。
2. 已忽略项显示“取消忽略”按钮。

交互规则：

1. 点击“忽略”后调用 `window.updateCenter.ignore({ packageName, newVersion })`。
2. 点击“取消忽略”后调用 `window.updateCenter.unignore({ packageName, newVersion })`。
3. 主进程刷新完成后，渲染层使用推送或返回的新快照更新列表。
4. 已忽略项继续不可勾选，也不会加入“更新选中”任务。

## 老 Qt 更新器

### 配置路径

`IgnoreConfig` 不再尝试写 `/etc`，改为：

1. 使用 `QStandardPaths::writableLocation(QStandardPaths::ConfigLocation)`。
2. 在其下创建 `spark-store/ignored_apps.conf`。

### 忽略键统一

Qt 当前交互里，忽略按钮传的是当前版本，检查时也匹配当前版本。这会导致与 Electron 的“目标版本忽略”语义不一致。

本次统一改为：

1. 点击“忽略”时写入 `packageName + newVersion`。
2. 刷新列表时，用 `packageName + newVersion` 判断是否忽略。

取消忽略也改为按包名 + 版本删除对应条目，避免误删同包历史忽略记录。

## `ss-update-notifier.sh`

### 读取忽略配置

脚本新增两个步骤：

1. 尝试定位最可能的桌面用户 home。
2. 如果无法可靠定位，则扫描 `/home/*/.config/spark-store/ignored_apps.conf`。

扫描模式下需要把所有命中的配置文件合并成一个忽略集合，再参与过滤。

### 过滤规则

脚本当前只按包名过滤，本次改为按 `pkgname|newVersion` 精确过滤：

1. 从 `ss-do-upgrade-worker.sh upgradable-list` 读取 `PKG_NAME PKG_NEW_VER PKG_CUR_VER`。
2. 构造键 `PKG_NAME|PKG_NEW_VER`。
3. 若忽略集合中存在该键，则跳过通知计数。

### 与通知用户识别解耦

通知发送仍然尽量复用现有“找活动用户然后 `sudo -u` 发送”的策略，但“读取忽略配置”与“给谁发通知”必须解耦：

1. 即使没有可靠的当前登录用户，也应先完成忽略过滤。
2. 只有在最终需要发送通知时，再尝试解析实际桌面用户。

## 验证范围

1. Electron 单元测试覆盖新路径常量、忽略排序与忽略按钮交互。
2. Electron 手动验证更新中心忽略 / 取消忽略流程。
3. Qt 手动验证忽略后重新打开更新器仍保留状态。
4. 手动执行 `ss-update-notifier.sh`，验证 root 环境下能命中用户级忽略配置且按版本精确过滤。
