# 已安装应用管理与更新中心加载态设计

## 背景

当前仓库里有三个直接影响体验的问题：

1. 更新中心调用 `updateCenterStore.open()` 时，会先等待主进程返回快照，再决定是否展示模态框。用户在数据返回前看不到任何反馈，主观感受就是“打开很慢”。
2. 软件管理里 `spark` 来源当前直接读取 `dpkg-query -W` 的全量安装包，结果混入了大量没有桌面入口的系统包，与“软件管理”应管理可见应用的预期不符。
3. 软件管理弹窗目前只有“卸载”操作，没有“打开”操作；同时 `src/App.vue` 对 `spark` 来源还有一条“若不在远端商店目录中则直接跳过”的过滤，会导致本机已有桌面应用即使后端已发现，也不会展示出来。

本次设计的目标是用最小改动修复这三个问题，不重做更新中心和软件管理的整体结构。

## 目标

1. 更新中心在用户触发打开时立即显示模态框，并展示明确的加载反馈。
2. `spark` 软件管理改为基于 `/usr/share/applications` 的桌面应用扫描，而不是全量系统包扫描。
3. `spark` 桌面应用通过 `realpath` 后的 desktop 文件路径，结合 `dpkg -S <desktop-path>` 反查所属包名。
4. `apm` 软件管理保持现有 `apm list --installed` 语义，继续展示依赖项。
5. 软件管理弹窗中的已安装项支持直接打开软件，复用当前已有的应用启动 IPC，而不是新增一套启动协议。

## 非目标

1. 不重构更新中心的主进程数据加载流程。
2. 不把软件管理改成“每个 desktop 入口一条记录”；本次仍按“每个包一条记录”展示。
3. 不改变 `apm` 来源中依赖项继续显示的现有产品决定。
4. 不新增应用启动器脚本，也不修改 `launch-app` IPC 的入参与调用协议。
5. 不把软件管理改造成新的独立模块或完整应用索引子系统。

## 方案概览

本次改动拆成三条最小链路：

1. 更新中心在渲染层增加独立加载态，让模态框先出现，再等待主进程快照。
2. `list-installed("spark")` 改为扫描 `/usr/share/applications` 并反查包名，再补齐版本、架构与图标信息。
3. 已安装应用弹窗增加“打开”按钮，并移除 `spark` 来源依赖远端商店目录的前端过滤，让本机已发现的桌面应用能够真正显示与启动。

## 更新中心加载态

### 当前问题

`src/App.vue` 中的 `openUpdateModal()` 直接 `await updateCenterStore.open()`，而 `src/modules/updateCenter.ts` 的 `open()` 会在拿到完整快照后才把 `isOpen` 设为 `true`。因此用户点击后会先经历一段无反馈等待。

### 目标行为

1. 用户触发打开更新中心时，模态框立即出现。
2. 数据尚未返回时，模态框主体显示“正在检查更新”的加载态，而不是空白区域。
3. 首次打开完成后，正常展示更新列表或错误提示。
4. 用户在已打开的更新中心里点击“刷新”时，继续使用同一加载状态字段，并禁用刷新按钮，避免重复触发。

### 设计

在 `src/modules/updateCenter.ts` 中为 `UpdateCenterStore` 新增渲染层加载状态，例如 `loading: Ref<boolean>`。

行为规则：

1. `open()` 调用开始时：
   - 先重置本次会话状态；
   - 立即设置 `isOpen.value = true`；
   - 设置 `loading.value = true`；
   - 然后再等待 `window.updateCenter.open()`。
2. `open()` 成功或失败结束时：
   - 统一将 `loading.value = false`。
3. `refresh()` 开始时：
   - 设置 `loading.value = true`；
   - 调用 `window.updateCenter.refresh()`；
   - 完成后再恢复 `loading.value = false`。
4. `closeNow()` 时：
   - 关闭模态框；
   - 清理搜索、选中项与迁移确认状态；
   - 同时清理渲染层加载态，避免下次打开继承旧状态。

### UI 呈现

`src/components/UpdateCenterModal.vue` 负责根据 `store.loading.value` 切换内容：

1. 当 `loading === true` 且还没有可展示项时，列表区域显示居中的加载卡片或 spinner，文案为“正在检查更新…”。
2. 当 `loading === true` 且已有旧列表时，保留当前列表内容，同时在顶部或列表区域显示轻量的“正在刷新…”提示，避免刷新时内容闪烁清空。
3. `src/components/update-center/UpdateCenterToolbar.vue` 中的刷新按钮在 `loading === true` 时禁用，并可复用现有刷新图标做旋转或弱化处理。

这个方案只在渲染层加状态，不改主进程 `update-center-open` / `update-center-refresh` 的 IPC 协议，因此不会影响现有更新中心服务与测试边界。

## `spark` 软件管理的桌面应用扫描规则

### 当前问题

`electron/main/backend/install-manager.ts` 中 `list-installed("spark")` 目前直接跑：

```bash
dpkg-query -W -f=${Package} ${Version} ${Architecture}\n
```

它得到的是全量系统包，而不是用户可管理的桌面软件。

### 目标行为

`spark` 来源的软件管理只显示 `/usr/share/applications` 下可映射到系统包的桌面应用，每个包只展示一个条目。

### 扫描算法

主进程对 `spark` 来源执行以下流程：

1. 枚举 `/usr/share/applications` 目录中的 `.desktop` 文件。
2. 对每个候选文件执行 `realpath`，得到实际 desktop 路径，兼容软链接场景。
3. 读取 desktop 内容，解析：
   - `Name`
   - `Icon`
   - `NoDisplay`
4. 过滤规则：
   - 不是 `.desktop` 的文件直接跳过；
   - `NoDisplay=true` 的 desktop 跳过；
   - 无法读取、无法解析或 `realpath` 失败的条目跳过；
   - `dpkg -S <realpath后的desktop路径>` 无法定位所属包名的条目跳过。
5. 对通过过滤的条目调用 `dpkg -S <desktop-path>` 反查所属包。
6. 将 desktop 条目按包名去重：
   - 同一包命中多个有效 desktop 时，仅保留第一个有效条目；
   - “第一个”的定义以稳定排序后的 desktop 文件名遍历顺序为准，保证结果可预测。
7. 收集到包名后，再补齐版本和架构信息，形成最终 `InstalledAppInfo[]`。

### 包信息补齐

为了保留当前软件管理卡片里的版本与架构展示，`spark` 来源仍需要版本与架构信息，但不再以它作为筛选源。

推荐做法：

1. 先通过 desktop 扫描得到有效包名集合。
2. 再执行一次 `dpkg-query -W -f=${Package}\t${Version}\t${Architecture}\n` 构建元数据映射。
3. 仅为扫描结果中出现的包补齐 `version` 和 `arch`。

这样保留了现有 UI 所需字段，同时避免再次回到“全量包即软件管理内容”的旧行为。

### 图标与名称

对于 `spark` 来源：

1. `name` 优先使用 desktop 的 `Name=`。
2. `icon` 优先使用 desktop 的 `Icon=`；若图标字段是绝对路径，则延续现有 `file://` 使用方式；若是图标名，则允许继续走当前前端回退策略或显示默认占位。
3. `pkgname` 以 `dpkg -S` 反查出的包名为准，而不是 desktop 文件名。

### 错误处理

桌面应用扫描必须按“单项失败不拖垮整体列表”处理：

1. 某个 desktop 读取失败，只跳过该项。
2. 某个 desktop 无法反查包名，只跳过该项。
3. 只有当整个目录无法读取、或关键命令整体失败时，才返回 `success: false` 给渲染层。

## `apm` 软件管理保持现状

`apm` 来源继续使用当前 `apm list --installed` 结果，行为保持不变：

1. 仍保留依赖项展示。
2. 仍使用现有的 APM `entries/applications` 解析名称、图标与是否为依赖项。
3. 不把 `apm` 来源改成纯 desktop 视角。

这样可以满足“apm 包含依赖”的明确要求，同时把本次修改范围限制在 `spark` 侧软件识别逻辑。

## 渲染层已安装应用列表修正

### 当前问题

`src/App.vue` 中 `refreshInstalledApps()` 当前有一条 `spark` 特有过滤：

1. 先在远端商店应用列表 `apps.value` 中寻找同名应用；
2. 如果 `origin === "spark" && !appInfo`，则直接 `continue`。

这会让许多本机桌面应用即使被主进程发现，也不会显示在软件管理中。

### 新规则

1. `refreshInstalledApps()` 对 `spark` 与 `apm` 统一采用“远端有完整信息则复用，远端没有则构造最小 App 对象”的策略。
2. 删除 `spark` 来源的“找不到远端目录就跳过”逻辑。
3. 这样主进程发现的本机桌面应用，无论是否存在于远端商店分类 JSON 中，都能在软件管理中展示出来。

### 最小 App 对象

当远端列表中找不到对应应用时，继续构造最小 `App` 对象，并补齐以下关键字段：

1. `name`
2. `pkgname`
3. `version`
4. `origin`
5. `currentStatus: "installed"`
6. `arch`
7. `flags`
8. `isDependency`
9. `icons`（如主进程提供）

其他目录型字段继续使用当前最小占位值即可，不额外扩展模型。

## 软件管理“打开软件”交互

### 目标行为

已安装应用弹窗中的每一项都支持直接打开软件，且不影响现有“卸载”入口。

### 交互设计

`src/components/InstalledAppsModal.vue` 中每个应用项新增一个 `打开` 按钮：

1. 点击“打开”时向父组件发出 `open-app` 事件，并透传：
   - `pkgname`
   - `origin`
2. “卸载”按钮保留。
3. 对于没有可启动信息的项，不新增额外灰态逻辑，因为本次两侧都沿用包名启动；只要条目被纳入软件管理，就认为可以尝试启动。

### 启动链路

继续复用当前已有 IPC：`launch-app`

1. `spark` 来源继续执行：
   - `/opt/spark-store/extras/app-launcher start <pkgname>`
2. `apm` 来源继续执行：
   - `apm launch <pkgname>`

这个 IPC 已被下载详情与应用详情页复用，因此本次不改协议，只把软件管理接入同一入口。

## 模块影响范围

### 主进程

1. `electron/main/backend/install-manager.ts`
   - 调整 `list-installed("spark")` 的发现逻辑。
   - 可按需要抽出一个小型 helper 处理 spark desktop 扫描，避免继续堆大单文件。

### 渲染层状态与页面

1. `src/modules/updateCenter.ts`
   - 新增加载态，并调整 `open()` / `refresh()` / `closeNow()` 的时序。
2. `src/components/UpdateCenterModal.vue`
   - 根据加载态展示“正在检查更新”或“正在刷新”提示。
3. `src/components/update-center/UpdateCenterToolbar.vue`
   - 刷新按钮支持禁用与加载视觉状态。
4. `src/components/InstalledAppsModal.vue`
   - 新增“打开”按钮与 `open-app` 事件。
5. `src/App.vue`
   - 打开更新中心时不再等待模态框延迟出现。
   - 修正 `spark` 来源软件列表的远端目录过滤。
   - 将软件管理中的 `open-app` 事件接到现有 `openDownloadedApp()`。

## 测试策略

### 更新中心

扩展以下测试：

1. `src/__tests__/unit/update-center/store.test.ts`
   - 覆盖 `open()` 在等待快照期间就已将 `isOpen` 置为 `true`。
   - 覆盖 `loading` 在 `open()` 与 `refresh()` 生命周期中的变化。
2. `src/__tests__/unit/update-center/UpdateCenterModal.test.ts`
   - 覆盖加载态文案展示。
   - 覆盖刷新按钮在加载时被禁用。

### 软件管理

1. 为 `spark` desktop 扫描逻辑新增单元测试，覆盖：
   - 从 `/usr/share/applications` 发现有效 desktop；
   - 通过 `realpath + dpkg -S` 反查包名；
   - 跳过 `NoDisplay=true`；
   - 同包多个 desktop 仅保留一个；
   - 单个 desktop 失败不会让整批结果失败。
2. 扩展 `src/__tests__/unit/InstalledAppsModal.test.ts`
   - 覆盖“打开”按钮可见；
   - 覆盖点击后会发出 `open-app` 事件。

### 回归验证

1. `spark` 来源软件管理仍可卸载。
2. `apm` 来源软件管理仍保留依赖项显示。
3. 下载详情与应用详情页已有的 `launch-app` 调用不受影响。

## 风险与约束

1. `dpkg -S` 输出格式可能包含架构后缀或多条匹配结果，解析时需要明确采用“第一条所有权记录”的稳定策略，并只提取包名部分。
2. 某些 desktop 图标可能是主题图标名而非绝对路径；本次不重做图标解析，只保证名称与路径被正确透传。
3. 如果某些本机桌面应用没有远端商店元数据，软件管理中会显示最小信息卡片；这是预期结果，因为需求本身就是“以本机 `/usr/share/applications` 为准”。
4. 更新中心加载态只解决“无反馈等待”的问题，不保证主进程真实查询耗时本身缩短。
