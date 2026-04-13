# 更新中心迁移更新策略设计

## 背景

当前更新中心会同时拉取 `aptss` 和 `apm` 的可更新列表，并按包名合并展示。现有行为中，双源同名更新通常会显示两条记录；即使标记了“迁移”，也不会真正执行“卸载 aptss 后安装 apm”的迁移流程。

目标是把更新策略调整为以已安装来源为主，并在 `aptss -> apm` 迁移场景中提供明确、单一且可确认的更新入口。

## 目标行为

### 1. 仅安装了 aptss 版本

- 同时检查 `aptss` 和 `apm` 是否有同名更新。
- 如果只有 `aptss` 有更新：显示一条普通 `aptss` 更新记录。
- 如果 `apm` 也有同名更新，且 `apm` 的目标版本高于 `aptss`：
  - 只显示一条迁移更新记录。
  - 该记录的展示语义为“将迁移到 APM 管理”。
  - 不再显示对应的普通 `aptss` 更新记录。
- 用户确认迁移后，执行：
  1. `shell-caller.sh aptss remove <pkg>`
  2. 安装 `apm` 版本。

### 2. 仅安装了 apm 版本

- 只检查并展示 `apm` 的同名更新。
- 即使 `aptss` 存在同名更新，也不在更新中心中展示。

### 3. 同时安装了 aptss 与 apm 版本

- 同时展示两条更新记录。
- `aptss` 记录更新 `aptss` 安装位置。
- `apm` 记录更新 `apm` 安装位置。
- 两条记录互不替代，也不触发迁移逻辑。

## 数据模型调整

### UpdateCenterItem

保留现有字段，并继续使用以下迁移字段：

- `isMigration?: boolean`
- `migrationSource?: "aptss" | "apm"`
- `migrationTarget?: "aptss" | "apm"`
- `aptssVersion?: string`

迁移记录仍以 `source: "apm"` 表示最终安装来源，但其语义从“推荐迁移”改为“唯一展示的迁移更新入口”。

## 列表合并规则

更新 `mergeUpdateSources()` 的逻辑，使其按安装来源状态决定展示结果，而不是单纯把双源结果并列展示。

### 情况 A：仅 aptss 安装

条件：`installedState.aptss === true && installedState.apm === false`

- 若只有 `aptss` 更新：返回 `aptss` 记录。
- 若只有 `apm` 更新：不展示该条记录。
- 若两者都有：
  - 如果 `apm.nextVersion > aptss.nextVersion`：
    - 只返回一条迁移记录，基于 `apmItem` 构造。
    - 设置 `isMigration: true`、`migrationSource: "aptss"`、`migrationTarget: "apm"`。
    - 保存 `aptssVersion` 供 UI 展示。
  - 否则：只返回 `aptss` 记录。

### 情况 B：仅 apm 安装

条件：`installedState.aptss === false && installedState.apm === true`

- 若 `apm` 有更新：返回 `apm` 记录。
- 忽略同名 `aptss` 更新。

### 情况 C：同时安装 aptss 与 apm

条件：`installedState.aptss === true && installedState.apm === true`

- 若两者都有更新：同时返回两条记录。
- 若只有其中一方有更新：只返回对应来源的记录。

### 情况 D：未识别安装来源

- 保持保守策略：按现有回退方式展示已有更新项。
- 这个分支仅用于防止源状态解析异常时整个列表为空。

## 前端交互

### 迁移确认弹窗

当用户选择的更新项中包含 `isMigration === true` 的记录时，继续弹出迁移确认框。

文案需要明确以下信息：

- 该应用将从传统 `aptss` 管理迁移到 `APM` 管理。
- 迁移过程会先卸载现有 `aptss` 版本，再安装 `APM` 版本。
- 迁移后，该应用后续更新将由 `APM` 管理。

### 下载队列表现

- 迁移任务加入下载队列时，名称与图标沿用更新中心项。
- 队列项可继续显示为 `origin: "apm"`，因为最终安装目标是 `apm`。
- 日志首条应明确表明这是迁移更新，而不是普通更新。

## 执行链路

### 当前问题

当前更新中心点击更新后，只是把任务交给现有下载/安装队列；迁移任务并不会真正先卸载 `aptss`。

### 新执行方式

对于 `isMigration === true` 的任务：

1. 创建更新任务并进入现有下载/安装队列。
2. 在主进程的更新中心执行链路中识别该任务为迁移任务。
3. 先调用：
   - `shell-caller.sh aptss remove <pkg>`
4. 若卸载成功，再继续现有 `apm` 安装流程。
5. 若卸载失败：
   - 不进入 `apm` 安装。
   - 将任务标记为失败。
   - 将错误信息推送到下载日志与更新中心状态。

### 失败处理

- `aptss remove` 失败：
  - 整个迁移任务失败。
  - 保留用户现有安装状态，不做后续安装。
- `aptss remove` 成功但 `apm` 安装失败：
  - 任务失败。
  - 不做自动回滚。
  - 在日志中明确说明：旧版本已卸载，新版本安装失败，需要用户重试。

本次实现不加入自动回滚，避免在失败分支里引入额外高风险操作。

## 受影响模块

- `electron/main/backend/update-center/query.ts`
  - 重写合并规则。
- `electron/main/backend/update-center/service.ts`
  - 保持迁移标记透传，并为后续执行提供足够字段。
- `electron/main/backend/install-manager.ts` 或迁移任务真正进入的主进程安装执行层
  - 为迁移任务增加“先 aptss remove，再 apm install”的顺序执行。
- `src/components/update-center/UpdateCenterMigrationConfirm.vue`
  - 更新提示文案。
- `src/modules/updateCenter.ts`
  - 保持迁移项进入下载队列时的展示信息正确。

## 测试策略

需要新增或调整以下测试：

- `mergeUpdateSources()` 单元测试：
  - 仅 aptss 安装 + apm 更高版本 -> 仅返回一条迁移记录。
  - 仅 aptss 安装 + apm 不更高 -> 仅返回 aptss 记录。
  - 仅 apm 安装 + 双源同名更新 -> 仅返回 apm 记录。
  - 双方都安装 + 双源同名更新 -> 返回两条记录。
- 更新中心服务/IPC 测试：
  - 迁移任务被正确标记并透传。
- 安装执行测试：
  - 迁移任务先执行 `shell-caller.sh aptss remove <pkg>`。
  - 卸载失败时不会继续安装 `apm`。
  - 卸载成功后继续执行 `apm` 安装流程。
- 前端测试：
  - 迁移弹窗文案与触发条件正确。

## 非目标

- 不实现迁移失败后的自动回滚。
- 不修改普通 `aptss` 或普通 `apm` 更新的现有安装流程。
- 不改变“双安装”场景下两条记录并存的行为。
