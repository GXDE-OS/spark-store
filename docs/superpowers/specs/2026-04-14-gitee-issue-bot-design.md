# Gitee Issue 巡检与 Opencode 启动设计

## 背景

当前仓库没有一个稳定的自动化流程，能够按固定周期检查 `https://gitee.com/spark-store-project/spark-store/issues`，筛出当前“最新且最重要”的 issue，并在人工确认后自动拉起新的 opencode 进程开始分析与修复。

你的目标不是让机器人直接静默修复，而是建立一个半自动流程：

1. 每 6 小时自动检查一次 Gitee issues。
2. 自动筛出 1 个当前最值得处理的候选 issue。
3. 默认只汇报，不自动开始修改。
4. 你确认后，自动打开新的 opencode 窗口开始处理。
5. 后续实际开始修改代码时，仍然以 `~/Desktop/spark-store` 作为基仓库，但必须通过 git worktree 从 `Erotica` 分支开出新分支，在隔离工作区中执行修改。

## 目标

1. 使用 `systemd --user` 定时器实现每 6 小时自动巡检。
2. 每轮最多选择 1 个 issue 作为候选项。
3. 候选项必须有可解释的评分结果，便于人工确认。
4. 默认不自动修复，只记录候选状态并等待批准。
5. 批准后自动启动新的 opencode 窗口，并把 issue 上下文传入。
6. 为后续修复流程固定 worktree 约束：从 `Erotica` 分支开新分支，并保持 `~/Desktop/spark-store` 作为主仓库入口。
7. 整个方案尽量独立于 Electron 主进程现有运行逻辑，避免把定时调度耦合进应用本体。

## 非目标

1. 不在本次实现中加入“自动修复后自动提交 PR”之类更长的链路。
2. 不在本次实现中加入应用内 GUI 审批界面。
3. 不在本次实现中实现复杂的 AI 优先级判断；优先使用透明、可维护的规则评分。
4. 不在本次实现中把 issue 处理结果自动回写到 Gitee。
5. 不在本次实现中实际创建 worktree 并改代码；这里只固定后续执行约束和启动提示。

## 方案选择

本次考虑三种方案：

1. 用户级 `systemd` 定时器 + 独立 Node/TypeScript 巡检脚本 + 本地批准入口。
2. 用户级 `systemd` 定时器 + Gitee 评论驱动批准。
3. 完全接入 Electron，使用应用内常驻进程和弹窗审批。

最终选择方案 1。

原因：

1. 它最小化对现有桌面应用逻辑的侵入，不要求应用常驻。
2. `systemd --user` 已符合你的运行环境偏好，也与仓库里已有的用户级后台命令模式一致。
3. 本地批准入口最容易落地，不依赖额外的 Gitee 写权限和 webhook/comment 解析。
4. 后续如果要升级成评论审批或 GUI 审批，也可以在该方案基础上扩展。

## 设计概览

新增一个独立的 issue 巡检子系统，由五部分组成：

1. `check-issues` 巡检入口：抓取 issue、打分、落本地状态。
2. `state` 状态层：保存当前候选项、历史批准记录和最近一次运行结果。
3. `approve-issue` 批准入口：由你手动触发，读取当前候选项并进入启动流程。
4. `opencode launcher`：负责拼接 issue prompt 并打开新的 opencode 窗口。
5. `systemd --user` 单元：负责每 6 小时调度巡检入口。

整体数据流分为两个阶段：

1. 自动巡检阶段：仅发现和记录，不启动修复。
2. 人工批准阶段：由你确认后，才启动新的 opencode 会话。

## 文件与模块边界

### 脚本入口

- 新增：`scripts/issue-bot/check-issues.ts`
  - 负责单次巡检执行。
  - 拉取 Gitee issues。
  - 调用评分逻辑选出候选项。
  - 写入状态文件和运行日志。

- 新增：`scripts/issue-bot/approve-issue.ts`
  - 负责读取当前候选项。
  - 检查是否已有未完成批准任务。
  - 标记当前 issue 为已批准。
  - 调用 opencode 启动器。

### 共享库

- 新增：`scripts/issue-bot/lib/gitee.ts`
  - 封装 issue 列表获取与基础字段归一化。
  - 输出统一结构，例如：`id`、`title`、`url`、`state`、`createdAt`、`updatedAt`、`labels`、`bodyPreview`。

- 新增：`scripts/issue-bot/lib/ranking.ts`
  - 根据“最新且最重要”的规则计算分数。
  - 输出总分和评分明细，便于人工解释。

- 新增：`scripts/issue-bot/lib/state.ts`
  - 负责本地状态读写。
  - 处理状态文件缺失、损坏、备份与迁移。

- 新增：`scripts/issue-bot/lib/opencode.ts`
  - 负责生成发给 opencode 的 prompt。
  - 负责调用本地 opencode 启动命令。
  - 固定写入 worktree 执行约束。

### 配置与调度

- 新增：`extras/systemd/spark-store-issue-bot.service`
  - 用户级一次性服务，执行单轮巡检。

- 新增：`extras/systemd/spark-store-issue-bot.timer`
  - 每 6 小时触发一次 service。

- 修改：`package.json`
  - 增加 `issue-bot:check`。
  - 增加 `issue-bot:approve`。

## 本地状态模型

建议把状态文件写到用户目录下的缓存位置，而不是仓库内，避免污染工作区。

建议路径：`~/.cache/spark-store/issue-bot/state.json`

状态至少包含：

```ts
interface IssueBotState {
  currentCandidate: RankedIssue | null;
  approvedIssue: ApprovedIssue | null;
  seenIssueIds: number[];
  lastRunAt: string | null;
  lastRunStatus: "idle" | "success" | "network-error" | "parse-error";
  lastRunMessage: string | null;
}
```

其中：

1. `currentCandidate` 表示当前等待你批准的候选 issue。
2. `approvedIssue` 表示已经批准并已启动 opencode 的 issue，用于避免重复批准。
3. `seenIssueIds` 用于辅助去重，避免每轮都反复选择同一批低质量 issue。
4. `lastRun*` 用于排查巡检失败原因。

## Gitee 拉取策略

优先顺序如下：

1. 若存在可稳定使用的 Gitee API，则优先使用 API。
2. 若 API 受限或字段不足，则退回页面抓取。

无论采用哪种来源，`gitee.ts` 对外只暴露统一的 issue 数据结构，不把 HTML 解析细节传播到评分层和状态层。

抓取范围只包含：

1. 打开的 issue。
2. 当前仓库 `spark-store-project/spark-store`。
3. 必需字段能提取成功的 issue。

如果本轮无法获取完整 issue 列表：

1. 记录错误。
2. 不覆盖现有 `currentCandidate`。
3. 结束本轮执行，等待下次 timer。

## 排序与筛选规则

评分逻辑使用可解释的静态规则，不做黑盒决策。

### 基础过滤

先过滤掉以下 issue：

1. 已关闭 issue。
2. 已批准且尚未被显式清理的 issue。
3. 缺少标题或链接等关键字段的异常项。

### 加分项

以下情况加分：

1. 标题或内容包含高影响关键词：`崩溃`、`打不开`、`无法安装`、`升级失败`、`卡死`、`白屏`、`闪退`。
2. 与主流程强相关：安装、卸载、更新、启动、搜索、列表加载。
3. 最近创建或最近更新。
4. 含有复现步骤、日志、截图、错误信息。
5. 带有明显 bug 类型标签。

### 减分项

以下情况减分：

1. 纯咨询类或需求讨论类 issue。
2. 信息过少，例如只有一句“不能用”。
3. 明显重复、无明确可执行内容。

### 产出格式

`ranking.ts` 输出不只包含总分，还包含明细，例如：

```ts
interface RankingBreakdown {
  total: number;
  reasons: string[];
}
```

状态文件和批准前摘要都需要携带这些明细，确保“为什么选它”是透明的。

## 巡检流程

`check-issues.ts` 的单轮行为固定为：

1. 读取本地状态。
2. 拉取 Gitee issue 列表。
3. 标准化数据。
4. 按过滤规则剔除不可处理项。
5. 计算每个 issue 的分数。
6. 选出得分最高的 1 个 issue。
7. 将其写入 `currentCandidate`。
8. 更新 `lastRunAt`、`lastRunStatus` 和摘要信息。

如果没有候选项：

1. 将 `currentCandidate` 设为 `null`。
2. 写入“本轮无可处理 issue”的状态。
3. 不触发任何后续动作。

## 批准流程

`approve-issue.ts` 的行为固定为：

1. 读取本地状态。
2. 检查 `currentCandidate` 是否存在。
3. 检查是否已有 `approvedIssue` 正在等待处理结果。
4. 若可批准，则将候选项复制到 `approvedIssue`。
5. 调用 opencode 启动器。
6. 启动成功后保留 `approvedIssue`，并可选择清空 `currentCandidate`。

本次实现采用保守策略：

1. 启动成功后，清空 `currentCandidate`。
2. 保留 `approvedIssue`，避免同一 issue 被重复批准。

后续如果需要“已完成”或“已放弃”清理动作，可以再补一个独立命令。

## Opencode 启动器设计

`opencode.ts` 负责两件事：

1. 生成 prompt。
2. 调用本地 opencode 启动命令。

### Prompt 内容

prompt 需要至少包含：

1. issue 标题。
2. issue URL。
3. issue 摘要。
4. 评分原因。
5. 任务目标：分析根因并开始修复。
6. 明确约束：开始修改时，基仓库使用 `~/Desktop/spark-store`，但实际编码必须通过 git worktree，从 `Erotica` 分支开出新分支后进行。

### Worktree 约束

批准后启动的新 opencode 会话中，必须显式看到以下执行约束：

1. 基仓库固定为 `~/Desktop/spark-store`。
2. 真正开始修改代码前，使用 git worktree 创建隔离工作区。
3. 新 worktree 必须从 `Erotica` 分支开出新的工作分支。
4. 修复工作在该 worktree 中进行，而不是直接在主仓库工作目录中进行。

这里的职责是“把约束传给后续修复会话”，而不是在当前巡检脚本里代替用户创建 worktree。

### 启动命令配置

不要把 opencode 启动命令硬编码成不可修改的固定路径。

推荐顺序：

1. 读取环境变量，例如 `SPARK_STORE_OPENCODE_CMD`。
2. 若未配置，则退回默认命令模板。
3. 若命令不存在，返回明确错误并保留 `currentCandidate`/`approvedIssue` 状态供重试。

## systemd 调度设计

使用用户级 systemd 单元：

### `spark-store-issue-bot.service`

职责：

1. 调用一次 `issue-bot:check`。
2. 以 oneshot 形式运行。
3. 将日志交给 systemd journal。

### `spark-store-issue-bot.timer`

职责：

1. 每 6 小时触发一次 service。
2. 启用持久化调度，使设备休眠后恢复时仍可补跑。

不把批准动作放进 timer，因为批准必须由人工触发。

## 错误处理

### 网络或解析失败

1. 记录 `lastRunStatus` 为失败类型。
2. 保留旧候选项，不清空有效状态。
3. 输出清晰日志，供 `journalctl --user` 排查。

### 状态文件损坏

1. 读取失败时先备份原文件。
2. 生成新的空状态。
3. 在日志中注明发生了状态恢复。

### 启动 opencode 失败

1. 不丢失候选 issue 信息。
2. 记录失败信息到状态文件。
3. 允许你修正环境后再次执行批准或重试命令。

## 测试与验证

### 脚本层验证

需要至少覆盖以下行为：

1. 有多个 issue 时，能按规则稳定选出得分最高的候选项。
2. 无 issue 或全被过滤时，`currentCandidate` 正确为空。
3. 状态文件缺失时能初始化默认状态。
4. 状态文件损坏时能备份并恢复。
5. 批准入口能读取候选项并更新状态。
6. opencode 启动命令缺失时，能返回明确错误而不丢状态。

### 手动验证

需要人工验证：

1. `npm run issue-bot:check` 能成功写出候选项。
2. 连续运行两次巡检，状态更新符合预期，没有异常重复。
3. `npm run issue-bot:approve` 能基于当前候选项启动新的 opencode 窗口。
4. 启动后的 prompt 中包含 worktree 约束和 `Erotica` 分支要求。
5. `systemctl --user start spark-store-issue-bot.service` 可执行。
6. `systemctl --user enable --now spark-store-issue-bot.timer` 后能看到 timer 生效。

### 仓库质量验证

完成实现后，至少执行：

1. `npm run lint`
2. `npm run build:vite`

如果脚本新增了独立测试，还要运行相应测试命令。

## 风险与约束

1. Gitee 页面结构可能变化，因此 `gitee.ts` 需要把抓取逻辑局部化，避免影响其他模块。
2. “最重要”本质上是启发式规则，不保证绝对正确，因此必须保留人工批准环节。
3. 如果 opencode 的命令行接口或窗口启动方式在本机环境中变化，需要通过配置而不是源码硬编码来适配。
4. worktree 约束属于后续修复会话的执行要求，当前设计只负责传达和固化，不负责提前改变用户当前工作区。

## 决策总结

1. 用 `systemd --user` 定时器每 6 小时巡检一次 Gitee issues。
2. 每轮只选 1 个“最新且最重要”的候选 issue。
3. 默认只汇报，不自动修复。
4. 你批准后，再自动拉起新的 opencode 窗口。
5. 启动 prompt 中必须固定写明：后续开始修改时，以 `~/Desktop/spark-store` 为基仓库，并通过 git worktree 从 `Erotica` 分支开新分支后执行修复。
