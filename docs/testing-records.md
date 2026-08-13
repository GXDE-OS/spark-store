# 测试记录文档（Testing Records）

> 用途：每次**修改代码后打包测试**都要在此追加一条记录，避免再次出现「改了 URL/逻辑后更新功能异常」这类回归问题。
> 维护约定（用户 2026-08-13 明确要求）：
> 1. **每次修改代码都必须打包测试**（开发/自测统一用 `./scripts/test-build.sh`，产物带 `-test` 标签）。
> 2. 打包前先在此文档新增一条记录：填写修改功能、建议测试方式、预期结果。
> 3. 打包完成（真机或构建通过后）**回填测试结果**（通过 / 失败 + 现象 + 修复动作）。
> 4. 涉及更新中心 / 下载 / 安装 / metalink / 网络 URL 等改动时，必须包含「更新中心实际勾选升级一个应用，观察日志是否推进到下载与安装」这一回归项。

---

## 记录格式（复制此模板填写）

```
### [版本号] 日期 — 一句话主题
- 修改功能：
- 涉及文件：
- 建议测试方式：
- 预期结果：
- 构建验证：vue-tsc / 打包（PASS / FAIL）
- 测试结果：（待回填）
  - 真机现象：
  - 结论：通过 / 失败
  - 失败修复：
```

---

## 历史记录

### [5.2.1.31-test] 2026-08-13 — 更新中心 hold 锁定标签 + 强制安装 + 修复安装失败误报"下载完成"
- 修改功能：
  1. 更新中心识别 `apt-mark hold` 锁定的包：默认不可选中，显示「已锁定」标签；提供「强制安装」开关，开启后 spark 源 ssinstall 追加 `--allow-change-held-packages`。
  2. 修复安装失败误报：ssinstall 放弃安装时仍以退出码 0 结束，原逻辑误判成功导致 UI 显示「下载完成」；现检测 `放弃安装`/`dry-run测试仍然失败` 等标志判失败，并按任务来源显示「更新完成/更新失败」或「安装完成/安装失败」。
- 涉及文件：
  - 后端：`update-center/types.ts`、`update-center/index.ts`、`update-center/service.ts`、`install-manager.ts`
  - 前端：`typedefinition.ts`、`modules/updateCenter.ts`、`modules/processInstall.ts`、`components/update-center/UpdateCenterItem.vue`、`components/update-center/UpdateCenterList.vue`、`components/UpdateCenterModal.vue`
- 建议测试方式：
  1. 更新中心打开，确认被 hold 的包（如 `code`）显示「已锁定」、复选框禁用、顶部提示条出现。
  2. 勾选其它普通更新项 → 开始更新 → 观察日志推进到「正在获取 Metalink」→ 下载进度 → 安装完成（不是「下载完成」）。
  3. 打开 `code` 的「强制安装」开关 → 复选框可用、标签变「将强制」→ 勾选并升级 → 观察是否正常升级（需本机 `code` 被 hold 才能验证）。
  4. 回归：用「更新中心实际升级一个普通应用」验证 metalink/下载/安装全链路未被本次改动破坏（此前 28-test 因 metalinkUrl 域名误杀出过同类问题）。
- 预期结果：hold 项默认不可选；强制开关可单独升级 hold 包；安装失败时明确显示「安装失败」而非「下载完成」；普通更新链路正常。
- 构建验证：vue-tsc 通过（exit 0）；`scripts/test-build.sh` 打包成功，产物 `spark-store_5.2.1.31-test_amd64.deb`。
- 测试结果：真机验证发现"失效"现象（见下方 32-test 修复说明）。
  - 真机现象：用户装 31-test 后从更新中心点更新，日志仅 `[14:28:23] 开始更新...` 一行后无进展。
  - 结论：非代码 bug，是 31 新增的 hold 拦截**正确行为**——用户测试的包（code）被 `apt-mark hold` 锁定，31 默认拦截它；但用户未开启该行的「强制安装」开关就点开始更新，后端 `start()` 把它过滤掉后**静默 return**，前端无任何提示，造成"只有一行日志"的观感。
  - 失败修复：32-test 修复后端 `start()` 静默拦截问题——对被 hold 且未强制的选中项，明确向前端发送 `install-complete` 失败通知（提示"已在更新中心默认跳过，请开启强制安装后重试"），不再静默卡住。

### [5.2.1.32-test] 2026-08-13 — 修复被 hold 包未强制时更新中心"静默卡开始更新"
- 修改功能：后端 `update-center/service.ts` 的 `start()` 不再对"被锁定(hold)且未开启强制安装"的选中项静默跳过。改为：先分离可启动项与被锁拦截项；对被锁拦截项向前端发送明确的 `install-complete` 失败通知（携带提示文案）；仅对真正可启动的项调用 `addInstallTask`。前端 `processInstall.ts` 的 install-complete handler 会将失败解析为「更新失败：...」，用户能看到原因而非停在「开始更新...」。
- 涉及文件：`update-center/service.ts`（仅后端；前端复用已有的 install-complete 失败显示逻辑，无需改）。
- 建议测试方式：
  1. 更新中心勾选一个**普通（未 hold）**的更新项 → 开始更新 → 日志应推进到「正在获取 Metalink」→ 下载进度 → 更新完成（确认 31 的 hold 改动未破坏普通更新链路）。
  2. 勾选一个**被 hold** 的包（如 `code`）且**不开**其「强制安装」开关 → 开始更新 → 日志应显示「更新失败：...被系统锁定(hold)...请开启强制安装后重试」，而非只有「开始更新...」。
  3. 开启该 hold 包的「强制安装」开关 → 勾选并升级 → 应正常进入下载/安装（验证强制路径）。
- 预期结果：普通更新正常；hold 未强制时给出明确失败提示而非静默卡住；hold 强制后可正常升级。
- 构建验证：vue-tsc 通过（exit 0）；`scripts/test-build.sh` 打包成功，产物 `spark-store_5.2.1.32-test_amd64.deb`。
- 测试结果：失败。
  - 真机现象：用户装 32-test 后，对 `code` 开启「强制安装」开关再点「更新选中」，日志仍只有 `[14:59:28] 开始更新...` 一行后无进展；同时「更新选中」后该包从更新中心列表消失，未保留。
  - 失败原因：
    1. `service.ts` 的 `start()` 中 `taskIdByKey` 只存储了 `task.id`（数字），后续读取 `taskIdByKey.get(taskKey)?.forceHeld` 永远为 `undefined`，导致「强制安装」开关状态丢失；被 hold 包即使开启强制仍被当作未强制拦截。
    2. held 阻断通知代码里 `webContents` 在通知循环之后才获取，导致通知实际未发出（但 32 中因原因 1 已把强制项也拦截，所以主要表现为卡住）。
    3. `start()` 启动任务后主动从 `currentItems` 过滤掉已启动项，导致用户点击「更新选中」后包立刻从更新中心消失。
  - 失败修复：见 33-test 记录。

### [5.2.1.33-test] 2026-08-13 — 修复强制安装开关失效 + 更新选中后列表消失 + 工具栏布局优化
- 修改功能：
  1. 修复 `update-center/service.ts` 中 `taskIdByKey` 仅保存 `id` 导致 `forceHeld` 丢失的 bug：改为保存完整 `UpdateCenterStartTask` 对象，确保「强制安装」开关状态能正确传递到 `addInstallTask`。
  2. 提前获取 `webContents` 到 held 阻断通知之前，确保被 hold 且未强制的项能向前端发送明确的 `install-complete` 失败通知。
  3. 移除 `start()` 中启动后从更新中心 `items` 删除已选包的逻辑，保持列表不变，等待用户刷新或任务完成后再消失。
  4. 优化 `UpdateCenterToolbar.vue`：将「全选」复选框和已选计数移到「更新选中」按钮同一行，缩短选择-执行操作路径。
- 涉及文件：
  - 后端：`electron/main/backend/update-center/service.ts`
  - 前端：`src/components/update-center/UpdateCenterToolbar.vue`
- 建议测试方式：
  1. 更新中心勾选普通未 hold 包 → 开始更新 → 日志推进到「正在获取 Metalink」→ 下载/安装完成（非「下载完成」、非卡死）。
  2. 被 hold 包（如 `code`）不开「强制安装」→ 开始更新 → 明确提示「更新失败：...被系统锁定(hold)...请开启强制安装后重试」，不只有「开始更新...」。
  3. 被 hold 包开启「强制安装」→ 勾选并升级 → 应正常进入下载/安装流程（ssinstall 命令带 `--allow-change-held-packages`）。
  4. 点击「更新选中」后，已选包仍保留在更新中心列表中，不会立即消失。
  5. 观察更新中心工具栏：「全选」复选框、已选计数、「更新选中」按钮在同一行右侧，操作便捷。
- 预期结果：强制安装真正生效；hold 未强制有明确失败提示；普通更新链路正常；更新选中后列表保留；工具栏操作更紧凑。
- 构建验证：vue-tsc 通过（exit 0）；`scripts/test-build.sh` 打包成功，产物 `spark-store_5.2.1.33-test_amd64.deb`。
- 测试结果：通过（用户确认优化与更新处理正确）。
  - 真机现象：用户装 33-test 后确认强制安装开关生效、hold 未强制有明确失败提示、普通更新链路正常。
  - 结论：通过
  - 遗留反馈：选中执行更新后，包进入下载列表却仍显示在更新中心（33-test 误删了"从列表移除已启动项"逻辑）；且全选按钮在无可选项时仍可点、无提示。两处已在 34-test 修复。

### [5.2.1.34-test] 2026-08-13 — 恢复更新后从列表移除 + 无可选项时全选禁用提示
- 修改功能：
  1. 恢复 33-test 误删的逻辑：更新中心「更新选中」启动任务后，已启动项从更新中心 `items` 移除（被 hold 未强制拦截的项不在此列，仍保留供用户开强制重试）。更新中心只展示待更新项，避免与下载队列重复显示。
  2. `modules/updateCenter.ts` 新增 `selectableCount` computed（可选项数 = 未被忽略且非"held 未强制"的项数）。
  3. `UpdateCenterToolbar.vue`：当 `selectableCount === 0`（全是 hold 未强制、全是忽略项、或完全没有可更新软件）时，全选复选框 `:disabled` 且整体置灰，右侧文案改为「无可更新项」并带提示 title。
- 涉及文件：
  - 后端：`electron/main/backend/update-center/service.ts`
  - 前端：`src/modules/updateCenter.ts`、`src/components/UpdateCenterModal.vue`、`src/components/update-center/UpdateCenterToolbar.vue`
- 建议测试方式：
  1. 勾选若干普通更新项 → 更新选中 → 这些包应从更新中心列表消失，仅出现在下载队列（之前 33-test 会残留，现恢复）。
  2. 当列表里所有项都是 hold 未强制 / 已忽略，或列表为空时：全选复选框应禁用置灰、文案显示「无可更新项」，点击无反应；「更新选中」按钮也因无选中而禁用。
- 预期结果：更新选中后不在更新中心残留；无可选项时全选禁用并提示。
- 构建验证：vue-tsc 通过（exit 0）；`scripts/test-build.sh` 打包成功，产物 `spark-store_5.2.1.34-test_amd64.deb`。
- 测试结果：待真机回填（本机无 GUI）。34-test 用户已确认更新后从列表移除、全选禁用提示均生效；但反馈开启强制后 code 仍更新失败（见 35-test 根因）。
  - 真机现象：
  - 结论：通过 / 失败
  - 失败修复：

### [5.2.1.35-test] 2026-08-13 — 修复强制安装在 ssinstall 本地文件模式误加 apt 标志
- 修改功能：`install-manager.ts` 中 spark 源的 ssinstall 命令构建逻辑。此前对**本地 .deb 文件模式**（`metalinkUrl && filename`）也追加了 `--allow-change-held-packages`，但该选项不是 ssinstall 支持的参数（ssinstall 用法 `ssinstall [选项] <deb路径>`，选项仅自身专用），会被其透传给内部 `dirname`/`basename` 导致参数解析失败、包名丢失，进而 `E: 无法定位软件包` / `Package manager quit with exit code` 失败。
  - 本地 .deb 文件模式：改走 `dpkg` 直接安装，dpkg 安装本地文件**不受 apt `hold` 限制**（hold 仅拦截 `apt install <包名>` 从仓库升级），故**不再追加**该标志。
  - 仓库模式（`ssinstall pkgname`）：从 apt 仓库拉取，hold 会拦截，保留 `forceHeld` 时追加 `--allow-change-held-packages`。
- 涉及文件：`electron/main/backend/install-manager.ts`（仅后端）。
- 建议测试方式：开启 `code`（被 hold）的「强制安装」开关 → 勾选升级 → 日志应正常进入 ssinstall 本地 .deb 安装，不再出现 `dirname/basename 未识别的选项` 与 `无法定位软件包`，最终「更新完成」。
- 预期结果：强制安装本地 .deb 不再因误加 apt 标志而失败；普通（未 hold）与仓库模式行为不变。
- 构建验证：vue-tsc 通过（exit 0）；`scripts/test-build.sh` 打包成功，产物 `spark-store_5.2.1.35-test_amd64.deb`。
- 测试结果：失败（用户 15:55 日志）。
  - 真机现象：开 code 强制 → 更新 → `E: 在更改保留软件包的同时使用了 -y 选项，但没有搭配 --allow-change-held-packages.` → `dry-run测试仍然失败，放弃安装` → 更新失败。
  - 根因：实测证实 ssinstall 本地 .deb 模式在 `dpkg -i` 失败后兜底 `aptss install <deb> -yfq`，aptss/apt 对 held 包用 `-y` 强制要求 `--allow-change-held-packages`；而 ssinstall 不识别该参数（透传给 dirname/basename 崩溃），故 35-test 去掉标志后仍被 apt 拒绝。35-test 方案（依赖 dpkg 不拦 hold）不成立。
  - 失败修复：见 36-test（改用 unhold/hold 包裹策略）。

### [5.2.1.36-test] 2026-08-13 — 强制安装改用 apt-mark unhold/hold 包裹（绕开 ssinstall 不支持该标志）
- 修改功能：`install-manager.ts` 的强制安装（forceHeld）策略从"传 `--allow-change-held-packages` 给 ssinstall"改为"安装前 `pkexec apt-mark unhold`、安装后（finally）`pkexec apt-mark hold` 恢复锁定"。
  - 新增模块函数 `runAptMark(action, pkgname)`：`checkSuperUserCommand()` 取 pkexec，直接用 `pkexec apt-mark <hold|unhold> pkgname`（**不经过 shell-caller.sh**，因其白名单仅放行 apm/aptss/ssinstall，否则报"拒绝执行"）。
  - `runInstallPhase`：`try` 开头若 `task.forceHeld && task.origin==='spark'` 先 `runAptMark("unhold")`，`finally` 中无论成败都 `runAptMark("hold")` 恢复原锁定状态。
  - 移除 spark 源 ssinstall 命令中任何 `--allow-change-held-packages`（ssinstall 不识别）。
- 涉及文件：`electron/main/backend/install-manager.ts`（仅后端；forceHeld 字段链路 service.ts→QueueInstallPayload→task 已就绪）。
- 建议测试方式：开启 `code`（被 hold）的「强制安装」开关 → 勾选升级 → 日志应出现「正在解除系统锁定（hold）...」→ ssinstall 本地安装成功 → 最终「更新完成」；另查 `apt-mark showhold` 确认安装后 code 仍被锁定（状态恢复）。
- 预期结果：强制安装 held 包成功；安装后 hold 状态自动恢复，不破坏用户原本的锁定。
- 构建验证：vue-tsc 通过（exit 0）；`scripts/test-build.sh` 打包成功，产物 `spark-store_5.2.1.36-test_amd64.deb`。
- 测试结果：未真机验证即发现更优方案（见 37-test）。36-test 的 `runAptMark` 用 `pkexec apt-mark` 会弹额外权限框，且 apt-mark 不在 policykit 免密 exec.path 内可能直接失败。
  - 失败修复：见 37-test（合并进商店已有免密 pkexec）。

### [5.2.1.37-test] 2026-08-13 — 强制安装合并进免密 pkexec（不重复请求权限）
- 修改功能：用户指出"商店已有提权配置，unhold/hold 不必再请求权限"。调查确认 policykit 规则（`extras/store.spark-app.spark-store.policy`、`pkg/.../ssinstall.policy`）仅对 `exec.path=/opt/spark-store/extras/shell-caller.sh` 与 `/usr/local/bin/ssinstall` 设 `allow_any=yes`（免密）。`pkexec apt-mark` 不在任何 policy 的 exec.path → 弹额外密码框且可能失败。
  - `extras/shell-caller.sh` 新增 `force-ssinstall` 分支：在一次已提权的 pkexec 会话内执行 `apt-mark unhold <pkg>` → `ssinstall <deb> [额外参数] --native` → `apt-mark hold <pkg>`；unhold 失败仅警告不阻断，hold 无论成败都恢复；参数用双引号防注入、空参校验。
  - `install-manager.ts`：`forceHeld && origin==='spark' && 本地 .deb` 时，构造命令走 `shell-caller force-ssinstall <pkg> <deb> --delete-after-install --no-create-desktop-entry`（即复用 ssinstall 那条免密 pkexec，仅一次权限请求）；移除 36-test 的 `runAptMark` helper 及 runInstallPhase 的 try/finally 单独 pkexec apt-mark 调用。
- 涉及文件：`extras/shell-caller.sh`、`electron/main/backend/install-manager.ts`。
- 建议测试方式：开启 `code`（被 hold）「强制安装」→ 勾选升级 → 应**仅弹一次**权限框（与平时 ssinstall 一致）→ 日志 ssinstall 本地安装成功 → 更新完成；装后 `apt-mark showhold` 确认 code 仍锁定（已自动恢复）。
- 预期结果：强制安装成功且只请求一次权限；hold 状态自动恢复。
- 构建验证：vue-tsc 通过（exit 0）；`bash -n shell-caller.sh` 语法 OK；`scripts/test-build.sh` 打包成功，产物 `spark-store_5.2.1.37-test_amd64.deb`。
- 测试结果：待真机回填（本机无 GUI）。
  - 真机现象：
  - 结论：通过 / 失败
  - 失败修复：

### [5.2.1.29-test / 5.2.1.30-test] 2026-08-13 — 修复更新中心卡"开始更新..." + metalinkUrl 域名误杀清理
- 修改功能：
  1. 29-test 修复 metalinkUrl 校验写死 `erotica.spark-app.store` 误杀真实 CDN 域 `d.spark-app.store`：放宽为 `*.spark-app.store` 全子域 + https + path.posix.normalize 折叠 `./` + 拒绝 `..` 越界。
  2. 30-test 清理调试期噪声（[debug] 日志、FILENAME_PATTERN 拆分、stream error 监听、processInstall 自监听），保留真正修复。
- 涉及文件：`install-manager.ts`、`processInstall.ts`
- 建议测试方式：更新中心勾选并升级 `trae-cn` 等普通应用，观察日志推进到「正在获取 Metalink 文件」→ 下载进度。
- 预期结果：更新中心更新功能恢复正常，不再卡「开始更新...」或「下载失败: Metalink URL 不合法」。
- 构建验证：vue-tsc 通过；打包成功（29/30-test）。
- 测试结果：用户确认 29-test 修复有效。
  - 真机现象：29-test 更新中心升级 trae-cn 正常推进到下载阶段。
  - 结论：通过

### [5.2.1.26-test ~ 5.2.1.28-test] 2026-08-13 — 更新中心"更新"卡死的多次排查
- 修改功能：
  1. 26-test：抽离 `addInstallTask(payload, sender)`，`service.ts` 的 `start()` 直接调用（修复 `webContents.send("queue-install")` 主进程自环 bug，任务从未入队）；并加 FILENAME_PATTERN、各 return 分支补 install-complete 通知、metalink 流错误监听、[debug] 日志（部分属调试噪声，后续 30-test 回退）。
  2. 28-test：暴露真正根因 metalinkUrl 域名校验误杀 `d.spark-app.store`（见 29-test 修复）。
- 涉及文件：`install-manager.ts`、`update-center/service.ts`
- 建议测试方式：更新中心实际升级应用 + 普通安装对照。
- 预期结果：更新中心任务能真正进入下载队列并推进。
- 构建验证：vue-tsc 通过；打包成功。
- 测试结果：
  - 28-test 日志首次暴露 metalinkUrl 域名误杀（见上方 29-test 修复）。
  - 结论：根因定位完成，29-test 修复通过

---

## 回归测试 checklist（每次打包必做核心项）

- [ ] `vue-tsc --noEmit` 通过，`scripts/test-build.sh` 打包成功
- [ ] **更新中心**：勾选并升级一个普通应用，日志推进 开始更新 → 正在获取 Metalink → 下载进度 → 安装完成（确认不是「下载完成」且非「开始更新...」卡死）
- [ ] **普通安装**：应用详情页安装一个应用，确认链路正常
- [ ] **忽略功能**：更新中心忽略/取消忽略一项，确认沉底与不可选
- [ ] **hold/强制**（若改动更新中心）：被 hold 包默认不可选、强制开关可单独升级
- [ ] 安装失败时 UI 明确显示「安装失败」而非「下载完成」
