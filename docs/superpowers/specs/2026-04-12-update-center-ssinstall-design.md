# 更新中心 Spark 更新命令设计

## 背景

当前 Electron 更新中心对 `aptss` 来源的更新项仍保留一条旧路径：当任务没有本地下载文件时，直接执行 `shell-caller.sh aptss install -y <pkg> --only-upgrade`。这条路径会在宿主系统里直接升级软件包，但不会复用 Qt 更新器已经采用的“先下载 deb，再通过 `ssinstall` 安装”的流程。

仓库里已经存在一个更贴近更新器预期的行为参考：旧 Qt 更新器在安装 `aptss` 来源更新时，会对下载好的 deb 调用 `ssinstall`，并带上“不创建桌面快捷方式”和“安装后删除下载文件”等参数。

本次需求是：仅对 Electron 更新中心生效，把 Spark 软件包更新改为走 `shell-caller` 顶层 `ssinstall` 路径，同时避免更新时创建新的桌面项。

## 目标

1. Electron 更新中心处理 `aptss` 更新时，统一改为“下载 deb -> `shell-caller.sh ssinstall` 安装”。
2. 更新时传入 `ssinstall` 的“不创建桌面项”参数，避免更新流程额外生成桌面快捷方式。
3. 变更只作用于 Electron 更新中心，不影响普通安装流、APM 更新流和 `extras/shell-caller.sh` 的白名单行为。
4. 继续沿用现有提权方式：若存在 `pkexec`，仍通过 `pkexec /opt/spark-store/extras/shell-caller.sh ...` 执行。

## 非目标

1. 不修改 `electron/main/backend/install-manager.ts` 的普通安装逻辑。
2. 不修改 `apm` 来源更新的下载与安装方式。
3. 不扩展 `extras/shell-caller.sh` 以支持新的 `aptss ssinstall` 子命令形式。
4. 不修改旧 Qt 更新器行为；它只作为现有参考实现。

## 已确认的命令约束

### shell-caller 约束

当前仓库内的 `extras/shell-caller.sh` 只支持 3 个顶层命令类型：

1. `apm`
2. `aptss`
3. `ssinstall`

其中 `aptss` 仅允许 `install` 和 `remove` 两个子命令，不支持 `aptss ssinstall ...`。因此，本次实现不会尝试新增 `shell-caller aptss ssinstall` 这种调用形式，而是直接使用已存在的顶层 `ssinstall` 入口。

### ssinstall 参数名

本机 `ssinstall --help` 显示的真实参数名是：

```bash
--no-create-desktop-entry
```

因此，需求里口头表达的 `--no-create-desktop` 会在实现中落到 `--no-create-desktop-entry`，避免引入不存在的参数名。

## 现状问题

当前更新中心后端只有 APM 更新项会在刷新阶段补齐 `downloadUrl`、`fileName`、`size` 和 `sha512` 等下载元数据。`aptss` 更新项只来自 `apt list --upgradable` 的文本解析结果，因此：

1. `aptss` 更新项通常没有可下载 deb 的元数据。
2. 没有 deb 文件时，安装逻辑会退回旧的 `aptss install --only-upgrade` 命令。
3. 这使得 Electron 更新中心无法像 Qt 更新器那样稳定走 `ssinstall` 路径。

## 方案概览

采用“刷新阶段补齐 `aptss` 下载元数据，执行阶段统一走 `ssinstall`”的方案。

整体流程如下：

1. 刷新更新列表时，继续查询 `aptss` 的可升级包。
2. 对每个 `aptss` 更新项额外查询 `apt download --print-uris` 元数据。
3. 只有拿到 `downloadUrl` 和 `fileName` 的 `aptss` 更新项才进入最终更新列表。
4. 执行更新任务时，先下载对应 deb。
5. 下载完成后调用 `shell-caller.sh ssinstall <deb> --no-create-desktop-entry --delete-after-install`。
6. 若存在提权命令，则实际执行 `pkexec /opt/spark-store/extras/shell-caller.sh ssinstall ...`。

这样可以让 Electron 更新中心的 `aptss` 更新行为与 Qt 更新器保持一致，同时严格限定在更新中心内部，不影响商店其他安装入口。

## 模块变更

### 1. `electron/main/backend/update-center/index.ts`

新增 `aptss` 下载元数据补全逻辑，方式与现有 APM 元数据补全保持一致。

建议变更：

1. 新增一个 `aptss` 的 `print-uris` 命令构造函数，复用当前 `apt-fast` 配置与源列表参数。
2. 复用现有 `parsePrintUrisOutput()` 解析函数，不新增第二套解析器。
3. 为 `aptss` 更新项新增与 APM 相同的元数据补全过程。
4. 元数据查询失败的 `aptss` 项从最终可更新列表中剔除，并写入 warning。

这样做的原因是：更新中心一旦展示某个更新项，就应该能够实际完成下载和安装，而不是在任务执行阶段才发现缺少 deb 元数据。

### 2. `electron/main/backend/update-center/install.ts`

`aptss` 更新项的安装路径改为严格依赖已下载的 `filePath`。

行为调整：

1. `item.source === "aptss"` 且有 `filePath` 时，执行 `shell-caller.sh ssinstall`。
2. 传参为：

```bash
ssinstall <deb-path> --no-create-desktop-entry --delete-after-install
```

3. 若存在 `superUserCmd`，则通过 `buildPrivilegedCommand()` 包装成：

```bash
/usr/bin/pkexec /opt/spark-store/extras/shell-caller.sh ssinstall <deb-path> --no-create-desktop-entry --delete-after-install
```

4. 删除 `aptss` 无文件时回退到 `buildLegacySparkUpgradeCommand()` 的行为。

这意味着 `aptss` 更新不再允许悄悄退回旧式 `aptss install --only-upgrade` 流程。

### 3. 其他模块

以下模块不应发生行为变化：

1. `electron/main/backend/install-manager.ts`
2. `extras/shell-caller.sh`
3. `spark-update-tool/` 中的 Qt 更新器逻辑
4. `apm` 来源更新的下载与安装分支

## 数据流

### 刷新阶段

1. 读取 `aptss` 和 `apm` 的可升级列表。
2. 读取已安装来源状态。
3. 为 `aptss` 更新项加载 deb 元数据。
4. 为 `apm` 更新项加载 deb 元数据。
5. 合并来源、迁移标记、图标和其他展示字段。
6. 返回只包含“可实际下载并安装”的更新项列表。

### 执行阶段

1. 任务进入 `downloading`。
2. 使用已有 aria2 下载器下载 deb。
3. 任务进入 `installing`。
4. `aptss` 项执行 `shell-caller.sh ssinstall`。
5. `apm` 项继续执行当前 `shell-caller.sh apm ssinstall` 流程。
6. 成功后标记完成，失败则保留日志与错误信息。

## 错误处理

### 刷新失败

如果某个 `aptss` 包的元数据查询失败：

1. 不让该项进入可更新列表。
2. 在 `warnings` 中记录具体失败信息，例如 `aptss metadata query for <pkg> failed ...`。
3. 不影响其他更新项展示。

### 安装失败

如果 `shell-caller.sh ssinstall ...` 返回非 0：

1. 保持当前任务失败处理逻辑不变。
2. 将 stdout/stderr 继续写入任务日志。
3. 由任务队列把该更新项标记为 `failed`。

### 取消任务

取消逻辑保持不变。只要下载或安装子进程被中止，任务仍按当前机制进入 `cancelled` 或 `failed` 分支，不额外引入新的取消状态。

## 测试方案

### 单元测试

先写失败测试，再改实现。至少覆盖以下场景：

1. `load-items.test.ts`
   - `aptss` 更新项会额外查询 `print-uris` 元数据。
   - 元数据成功时，结果包含 `downloadUrl` 和 `fileName`。
   - 元数据失败时，该项被过滤并写入 warning。

2. `task-runner.test.ts`
   - `aptss` 文件安装走 `shell-caller.sh ssinstall <deb> --no-create-desktop-entry --delete-after-install`。
   - 不再断言旧的 `buildLegacySparkUpgradeCommand()` 输出。
   - `apm` 文件安装仍走 `shell-caller.sh apm ssinstall <deb>`，避免回归。

3. 如有必要，为安装构造函数补充更细粒度测试，确保带 `superUserCmd` 时参数顺序正确。

### 验证命令

实现完成后至少执行：

1. `npm run test -- --run src/__tests__/unit/update-center/load-items.test.ts src/__tests__/unit/update-center/task-runner.test.ts`
2. `npm run lint`
3. `npm run build`

## 风险与约束

1. `aptss` 元数据查询会为每个更新项新增一次命令调用，刷新成本会增加，但这是换取 updater-only `ssinstall` 行为所必需的最小代价。
2. 若某些仓库源对 `apt download --print-uris` 返回格式异常，相关更新项会被过滤并显示 warning；这比静默退回旧命令更符合本次需求。
3. `shell-caller.sh ssinstall` 会自动补上 `--native`，因此更新中心无需重复传入该参数。

## 决策总结

1. Electron 更新中心的 `aptss` 更新改为“下载 deb 后通过顶层 `shell-caller.sh ssinstall` 安装”。
2. 实际使用的桌面项参数名为 `--no-create-desktop-entry`。
3. 删除 `aptss` 更新回退到 `aptss install --only-upgrade` 的旧行为。
4. 该变更只作用于 `electron/main/backend/update-center/`，不修改其他安装入口。
