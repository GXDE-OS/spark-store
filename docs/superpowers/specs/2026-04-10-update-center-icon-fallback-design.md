# 更新中心图标逐级回退设计

## 背景

当前更新中心的图标解析分成两段：

1. 主进程 `electron/main/backend/update-center/icons.ts` 会优先解析本地图标，解析不到时再直接返回线上图标 URL。
2. 渲染层 `src/components/update-center/UpdateCenterItem.vue` 只接收单个 `icon` 字段，图片加载失败后直接回退到默认占位图。

这个结构已经满足“本地优先”的静态选择，但不能满足新的行为要求：

1. 当本地图标成功加载时，不再请求线上图标和默认图标。
2. 当本地图标路径虽然存在、但实际加载失败时，继续尝试线上图标。
3. 当线上图标也失败时，最后才回退到默认占位图。

问题根因不是路径优先级判断错误，而是当前前后端只传递了一个最终 `icon` 值，导致前端无法在运行时根据真实加载结果继续尝试下一层来源。

## 目标

1. 更新中心图标加载顺序固定为：`localIcon -> remoteIcon -> placeholder`。
2. 本地图标加载成功时，不再加载线上图标和默认图标。
3. 本地图标加载失败时，自动切换到线上图标。
4. 线上图标也失败时，才显示默认占位图。
5. 保持当前更新中心列表布局、图标尺寸和已有解析路径规则不变。

## 非目标

1. 不改动主商店、已安装列表或其他页面的图标逻辑。
2. 不增加新的网络探测请求，也不预检远程图标是否可访问。
3. 不重构现有本地图标解析算法，只调整数据结构和回退链路。
4. 不引入通用的图标来源数组或复杂图标对象。

## 方案选择

本次考虑过三种方案：

1. 后端透传 `localIcon` 和 `remoteIcon` 两个字段，前端顺序尝试。
2. 后端透传 `iconCandidates: string[]`，前端按数组顺序尝试。
3. 继续只传一个 `icon`，前端根据 `pkgname/category/arch` 自己重新拼线上图标地址。

最终选择方案 1。

原因：

1. 它刚好对应本次明确的三级回退需求，最小且直接。
2. 后端继续掌握图标来源规则，避免前端复制商店 URL 规则。
3. 相比数组方案，双字段更易读、更容易在 IPC 类型中维护。
4. 前端只负责“加载失败后切换到下一来源”，职责边界清晰。

## 设计概览

更新中心改为“主进程解析来源，渲染层控制加载顺序”的结构：

1. 主进程为每个更新项分别计算 `localIcon` 和 `remoteIcon`。
2. 服务层和前端类型透传这两个字段。
3. `UpdateCenterItem.vue` 按 `localIcon -> remoteIcon -> placeholder` 的顺序逐级尝试。
4. 候选图标一旦成功加载，组件不再切换到后续来源。

## 数据结构变更

### 主进程类型

修改：`electron/main/backend/update-center/types.ts`

将：

```ts
icon?: string;
```

改为：

```ts
localIcon?: string;
remoteIcon?: string;
```

### Service Snapshot

修改：`electron/main/backend/update-center/service.ts`

更新 renderer-facing item/task 类型，并在 `toState()` 中透传：

```ts
localIcon?: string;
remoteIcon?: string;
```

### 渲染层类型

修改：`src/global/typedefinition.ts`

更新 `UpdateCenterItem` 和 `UpdateCenterTaskState`：

```ts
localIcon?: string;
remoteIcon?: string;
```

## 模块边界

### `electron/main/backend/update-center/icons.ts`

保留现有职责，但返回内容从“单个最终图标”调整为“两种候选来源”：

1. `resolveDesktopIcon(pkgname)`：解析传统 deb / aptss 更新项的本地图标。
2. `resolveApmIcon(pkgname)`：解析 APM 更新项的本地图标。
3. `buildRemoteFallbackIconUrl(item)`：拼接远程商店图标地址。
4. `resolveUpdateItemIcons(item)`：组合出 `{ localIcon?, remoteIcon? }`。

这里不再提前做“本地失败就直接放弃线上”的最终决策，而是把两个候选来源都准备好交给前端。

### `electron/main/backend/update-center/index.ts`

在更新项 enrichment 阶段，将：

1. 现有的单 `icon` 注入逻辑。

调整为：

1. 读取 `resolveUpdateItemIcons(item)` 的结果。
2. 仅在字段存在时把 `localIcon` / `remoteIcon` 写回更新项。

### `src/components/update-center/UpdateCenterItem.vue`

组件不再把单个 `item.icon` 当成最终地址，而是：

1. 从 `item.localIcon` 和 `item.remoteIcon` 派生候选列表。
2. 使用当前索引决定 `img.src`。
3. 失败时切到下一候选项。
4. 候选项耗尽后切到占位图。

## 详细数据流

### 主进程加载更新项

1. 更新中心主进程加载更新项。
2. 现有逻辑继续补齐 `category`、`arch` 等字段。
3. 图标模块为每个项分别解析：
   - `localIcon`：本地图标路径。
   - `remoteIcon`：线上图标 URL。
4. enrichment 后的更新项通过 service snapshot 发送到渲染层。

### 渲染层展示更新项

1. 组件收到 `item.localIcon` / `item.remoteIcon`。
2. 组件构造一个有序候选列表：
   - 本地路径转换为 `file://` URL。
   - 远程 URL 原样使用。
3. 初始渲染第 1 个候选图标。
4. 如果 `img` 加载成功，流程结束，不再切换到下一项。
5. 如果 `img` 触发 `error`，索引递增，继续尝试下一候选图标。
6. 如果所有候选都失败，切换到占位图。

## 前端行为细节

### 候选列表生成规则

候选列表只包含存在且非空的来源：

1. `localIcon` 存在时放在第 1 位。
2. `remoteIcon` 存在时放在第 2 位。
3. 占位图不放入候选列表，而是在候选耗尽后单独回退。

这样可以避免：

1. 本地图标成功时还额外发起线上请求。
2. 图标字段为空时出现无意义的重试。

### 状态重置规则

当 `props.item` 变为新的更新项对象时：

1. 重置当前候选索引到第 1 项。
2. 清空“候选已耗尽”的状态。
3. 重新开始本地优先的尝试流程。

这样可确保列表复用或重新渲染时，新条目不会继承上一条目的失败状态。

### 占位图规则

保留当前组件内默认占位 SVG，不改样式和尺寸。

只有在以下情况下才使用占位图：

1. `localIcon` 和 `remoteIcon` 都不存在。
2. `localIcon` 加载失败且 `remoteIcon` 不存在。
3. `localIcon` 和 `remoteIcon` 都加载失败。

## 错误处理

1. 本地图标路径不存在或不可读：允许浏览器触发加载失败，再由前端切到线上图标。
2. 远程图标返回 404、超时或其他加载错误：前端切到占位图，不向用户弹额外错误。
3. 后端无法推断 `category` 或 `arch`：允许 `remoteIcon` 为空，前端只尝试本地图标和占位图。
4. 任一图标来源失败都不能影响更新列表正文、状态标签和进度条显示。

## 测试方案

### 后端测试

扩展 `src/__tests__/unit/update-center/icons.test.ts`：

1. 本地图标可解析时，`resolveUpdateItemIcons()` 返回 `localIcon`，并在条件满足时同时包含 `remoteIcon`。
2. 本地图标缺失时，仍可返回 `remoteIcon`。
3. 缺少 `category` 或 `arch` 时，不返回 `remoteIcon`。
4. 两者都不可得时，返回空对象。

### 组件测试

扩展 `src/__tests__/unit/update-center/UpdateCenterItem.test.ts`：

1. 有 `localIcon` 时先渲染本地 `file://` 地址。
2. 本地图标未失败前，不切换到 `remoteIcon`。
3. 本地图标触发 `error` 后切到 `remoteIcon`。
4. 本地和线上都触发 `error` 后切到默认占位图。
5. 切换到新的 `item` 后，回退状态会重置。

## 风险与约束

1. 如果某些包的本地图标路径在后端看来存在，但渲染进程实际不可访问，仍会触发一次失败请求；这是预期行为，因为它正是继续尝试线上图标的触发条件。
2. 远程图标 URL 继续依赖当前商店路径规则，若个别包没有线上图标，最终仍会使用占位图。
3. 本次只调整更新中心图标链路，不同步抽象其他页面，避免扩大改动范围。

## 决策总结

1. 用 `localIcon` 和 `remoteIcon` 替代单个 `icon` 字段。
2. 主进程负责解析来源，渲染层负责按顺序加载和失败回退。
3. 固定回退顺序为：本地图标 -> 线上图标 -> 默认占位图。
4. 本地图标成功时，不再加载线上图标和默认图标。
