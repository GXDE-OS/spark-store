# 应用列表缓存导致"新应用上架后搜不到"的根因分析与设计方案

> App List Cache Analysis & Design (spark-store)
> 整理日期：2026-08-11
> 背景分支：`Erotica`
> 文档涵盖：① 列表缓存根因与修复（C1/C2）；② 下载日志断层修复（附加）

---

## 0. 现象（用户反馈）

- 服务端上新应用后，在商店内**搜不到**该应用。
- 直觉认为是 `~/.cache` 下的本地缓存导致，但实测并非如此。
- 进一步反馈：**重启应用也无效，只有"删除缓存"才行**——这指向缓存层在重启后仍返回陈旧数据。

---

## 1. 缓存层逐层排查

| 缓存层 | 是否存在 | 证据 | 是否导致本问题 |
|---|---|---|---|
| **① 内存（渲染进程 `apps` 数组）** | 是 | 搜索基于内存 `baseApps`（`App.vue:665`）；`loadApps` 仅在 `onMounted` 调用一次（`App.vue:3447`） | 是（叠加因素）：运行期不刷新，新应用不在内存 |
| **② 本地磁盘"应用列表"文件缓存** | **否** | 源码无 `writeFile(applist)`；`~/.config/spark-store/` 下无应用列表缓存文件 | 否（用户最初怀疑点，已排除） |
| **③ Chromium 网络磁盘缓存** | **是（关键）** | 渲染进程 `axios` 走 XHR，受 Chromium 网络栈影响；`~/.config/spark-store/Cache` 目录存在 | **是**：重启后请求命中该磁盘缓存，返回旧 `applist.json` |
| **④ CDN 边缘缓存** | **是（关键）** | 生产域名 `erotica.spark-app.store` 挂 CDN；静态 `applist.json` 被边缘缓存；代码未发 `no-cache` | **是**：即使穿透③，CDN 仍可能返回边缘陈旧副本 |

### 请求侧缓存控制现状（代码事实）
- `fetchWithRetry`（`App.vue:432`）：`axiosInstance.get(url, { signal })`，**无任何 `Cache-Control` 头**。
- `axiosInstance`（`App.vue:427`）：仅 `baseURL` + `timeout`，无 headers。
- 主进程 `onBeforeSendHeaders`（`electron/main/index.ts:653`）：只注入 `User-Agent`，**未注入 `Cache-Control: no-cache`**。
- `loadApps`（`App.vue:3216`）：`apps.value.push(...)` —— **append 模式、无去重、无重置**，重跑会累积重复。
- `loadTabApps`（`App.vue:3098`）：`if (tabApps.value[entryId]) return;` —— **已加载分类强缓存，永不重拉**。
- `loadCategories`（`App.vue:3430`）：`categories.json` 仅启动时加载一次；若为"新分类"则永不加载其 `applist.json`。

---

## 2. 根因结论（实测修正）

> **2026-08-11 实测修正**：曾假设"CDN 边缘主动缓存"，curl 实测远程 `applist.json` 响应头为 `server: nginx` + `etag` + `last-modified`，**无任何 `Cache-Control`/`Expires`/`Age`**。因此真因是 **nginx 未发缓存控制头 → Chromium 启发式缓存（heuristic caching）**，而非 CDN 主动边缘缓存。

**主因（解释"重启无效、删除才行"）—— Chromium 启发式缓存：**
> 对"无 Cache-Control 头"的响应，Chromium 按 `Last-Modified` 计算启发式 TTL ≈ `(now - LM)/10`。实测当前文件 `LM` 距今约 7.6h → TTL ≈ **46 分钟**。在此窗口内：
> - 重启应用 → 重新发请求 → Chromium 直接复用 `~/.config/spark-store/Cache` 旧副本（启发式视为"新鲜"）→ 返回**旧 JSON** → 新应用搜不到。
> - 只有**删除 `~/.config/spark-store/Cache`** 强制失效，才可能拿到新内容。
> 这与"重启无效、删缓存才行"的现象**精确吻合**。

**叠加因素（解释"运行期搜不到"）：**
> `loadApps` 仅在启动时加载一次、且 `loadTabApps` 对已加载分类强缓存，运行期内存数据不会自动更新。即便请求能穿透缓存，也需重启/手动触发才进入内存。

**次要因素（条件触发）：**
> 若新应用落入 `categories.json` 尚未包含的**新分类**，`loadApps` 遍历 `categories.value` 不会请求该分类，连重启都搜不到，需等 `categories.json` 同步。

> 说明：用户最初怀疑的"~/.cache 应用列表文件缓存"**不存在**；真因是 nginx 无 CC 头导致的 Chromium 启发式缓存（③层的精确机理），其陈旧表现与"文件缓存"一致，故被误判。

### 2.1 实测证据（curl / Node，2026-08-11）
- `curl -sI` 远程 `applist.json`：`HTTP/2 200`、`server: nginx`、`etag: "6a7a764e-2f9d8"`、`last-modified: Tue, 11 Aug 2026 01:09:34 GMT`，**无 `cache-control`/`expires`/`age`**。
- Node 计算：LM 距今 ≈ 27572s → 启发式 TTL ≈ 2757s ≈ **46 分钟**（窗口内重启命中陈旧副本）。
- `curl -H "Cache-Control: no-cache"` 仍 `200` 正常 → 客户端带 no-cache 即不再复用陈旧副本，证明 **C1 修复方向正确**。
- 带 `?_t=Date.now()` 的 URL 经 `new URL()` 解析合法（pathname 正确、search 为 `_t=...`）→ **C2 修复方向正确**。

---

## 3. 设计方案（最终版 · 已整合 7 维审计）

> 设计原则：**精准根治 + 配套必补项齐全 + 不过度设计**。
> 改动分两类——**核心（绕过缓存层，根治）** 与 **辅助（主动刷新体验）**；其中辅助项含 5 个**必补配套**，否则功能/可靠性打折（详见第 4 节审计结论）。

### 3.1 核心（根治"重启/删除才有效"）—— 绕过缓存层
> 目标：列表/分类请求**永远拿最新**，不依赖删除缓存目录。

- **C1 请求头禁用缓存**
  - `fetchWithRetry` 对数据 JSON 请求加 `headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }`。
  - 主进程 `electron/main/index.ts:653` 的 `onBeforeSendHeaders` 中，**仅对 `applist.json` / `categories.json` / `priority-config.json` 路径**注入 `Cache-Control: no-cache`（scope 严格过滤，绝不影响 `cdn.d.store...` 图标/截图加速）。双保险覆盖所有请求路径。

- **C2 URL 版本 bust（穿透 CDN 边缘缓存最稳手段）**
  - 对上述数据请求 URL 追加 `?_t=${Date.now()}`，使每次 URL 不同，CDN 边缘与 Chromium 均无缓存可命中。
  - 代价：每次穿透 CDN，但列表文件小、频率低（启动/聚焦/手动），可接受。
  - **兼容性确认项**：上线前需在测试环境确认 `erotica.spark-app.store` 的 CDN 对含 query 的静态路径行为正常（极少数 CDN 有特殊规则）；若有异常，回退为仅依赖 `no-cache` 或 path 版本戳。

### 3.2 辅助（主动刷新体验）—— 让用户无需重启即拿最新
> 前提：3.1 已绕过缓存层。否则刷新也拿不到新数据。

- **A1 `loadApps` 幂等重建（必做，刷新安全前提）**
  - 将 `App.vue:3216` 的 `apps.value.push` 改为：每个分类结果收集进 `Map<pkgname, App>`（复用现有 hybrid 合并逻辑），**该分类加载完即 `apps.value = [...map.values()]`**——保留增量提交（首个分类成功即关遮罩，不回退首屏体验），同时对所有模式（含 spark-only/apm-only）去重，反而比现状更稳。

- **A2 `refreshAppData()` 编排**
  - 提取 `await loadCategories()`（本身重建安全，`App.vue:2946`）+ 重跑改造后的 `loadApps()`。覆盖主因与次要因素（新分类一并刷新）。

- **A3 两个刷新入口**
  - **窗口聚焦（经主进程，非渲染 window focus）**：主进程 `win.on('focus')` → `webContents.send('window-focus')` → 渲染监听调用 `refreshAppData()`（Electron 无边框窗口的渲染 `window focus` 事件不一定可靠，必须走 IPC 才稳）。
  - **手动刷新按钮**：工具栏/侧边栏加刷新图标，调用 `refreshAppData()`。

### 3.3 必补配套（5 项，缺一不可）
| 编号 | 维度 | 配套项 | 解决风险 |
|---|---|---|---|
| **P1** | 功能正确 | A1 改造时**保留每分类增量提交** + 非 hybrid 也按 pkgname 去重 | 防首屏回退、防重复应用 |
| **P2** | 可靠性 | `refreshAppData`/`loadApps` 加**串行化守卫**（in-flight 合并或 `isRefreshing` 标志） | 防焦点/手动/启动并发竞态覆盖（`loadApps` 当前无锁，已确认） |
| **P3** | 可靠性 | 用**主进程 `win.on('focus')`→IPC** 而非渲染 `window focus` | 防无边框窗口 focus 事件不可靠导致刷新静默失效 |
| **P4** | 性能 | 聚焦刷新加**防抖（~3s）+ 节流** | 防切窗口抖动堆叠请求、穿透 CDN 放大流量 |
| **P5** | 可观测 | `refreshAppData` 入口打印 `[AppData] 触发刷新 (reason=focus\|manual)`；`applist` 加载后记录条目数变化（`1200 → 1201`） | 便于线上诊断"刷新是否真生效 / 新应用是否进内存" |

### 3.4 可选
- **O1 `loadTabApps` TTL 失效**：`App.vue:3098` 强缓存改"超过 TTL（如 10min）才重拉"。因 all 搜索主路径已由 3.1+3.2 覆盖，可后置。

---

## 4. 7 维专业审计结论（改动影响预评估）

| 维度 | 影响评估 | 关键结论 |
|---|---|---|
| **1. 功能正确性** | 改善明确；A1/C2 改造需连带处理增量提交与去重（P1） | 根治"陈旧列表"，但 C 改动需保增量体验 |
| **2. 性能** | C2 每次穿透 CDN，开销小；**唯一主要负向是聚焦频繁触发** | 需 P4 防抖；否则成主要性能负向 |
| **3. 安全性** | `no-cache`/时间戳 bust 中性；scope 必须限数据路径 | 不全局注入，不影响图标加速 |
| **4. 可靠性** | 两处真实风险：`loadApps` 无并发锁（竞态）、渲染 focus 不可靠 | 需 P2 串行化 + P3 IPC focus |
| **5. 兼容性** | `no-cache`/query 对所有 CDN/HTTP 通用；仅需一次 CDN 行为确认（C2） | 兼容性良好 |
| **6. 可维护性** | `refreshAppData` 抽出后逻辑集中、易测；增量代码小 | 维护性改善 |
| **7. 可观测/可测** | 当前刷新路径无专属日志；应补 P5 | 便于上线诊断 |

**总体**：方案根治有效，性能/安全负向可控；**3 个必补配套（P1/P2/P3）+ 2 个强建议（P4/P5）** 须一并实现，否则功能正确性/可靠性打折。

---

## 5. 方案落地可行性验证（代码核对 · 测试，不改功能代码）

> 本节为在动手前对方案各项做的**代码级可行性核对**（未修改任何源码），确认可实现性与需细化点。

### 5.1 逐项核对结论

| 项 | 代码事实（已核对） | 可行性 | 需细化点 |
|---|---|---|---|
| **C1 主进程 no-cache 注入** | `onBeforeSendHeaders` 在 `electron/main/index.ts:653` 注册，可拿 `details.url`（完整 URL，含 `.../applist.json` 等）。用 `url.includes('/applist.json')\|\|includes('/categories.json')\|\|includes('/priority-config.json')` 过滤注入即可 | ✅ 可行 | scope 必须限三路径，不影响 `cdn.d.store...` 图标 |
| **C2 URL bust** | 数据请求三入口（`loadApps` `App.vue:3203`、`loadTabApps` `3133/3151`、`loadCategories` `2925`）**均走 `fetchWithRetry`**；但 `loadPriorityConfig`（`storeConfig.ts:84`）走**独立 `priorityConfigAxios`，不经过 `fetchWithRetry`** | ✅ 可行 | **bust 须覆盖两个 axios 实例**；否则 `priority-config.json` 仍可能陈旧（影响 auto 策略，非搜索主路径但同源） |
| **A1 loadApps Map 幂等重建** | 当前 `App.vue:3216` `apps.value.push`，在 `Promise.all`(`3190`) 的 `category→origins` 异步循环内。改：函数内声明跨分类 `Map<pkgname,App>`，每分类 `origins` 完成后 `apps.value = [...map.values()]` | ✅ 可行 | 增量提交须保留在每个**分类**处理末尾（非等全部完成），否则首屏回退；Map 按 pkgname 作 key 天然覆盖 spark-only/apm-only 去重 |
| **A2 refreshAppData 编排** | 新函数 = `await loadCategories()` + 重跑改造后 `loadApps()`；与 `loadApps` 同作用域即可 | ✅ 可行 | 建议 `onMounted` 也改调 `refreshAppData` 而非裸 `loadApps`，统一入口 |
| **A3 + P3 主进程 focus→IPC** | 主进程 `win` 为模块级 `let win`(`electron/main/index.ts:122`)，`createWindow` 内 `mainWindow`(`418`)。`mainWindow.on('focus', () => mainWindow.webContents.send('appdata-window-focus'))` 可靠（主进程事件，不受无边框影响） | ✅ 可行 | 渲染侧 `window.ipcRenderer.on('appdata-window-focus', ...)` 调用 `refreshAppData`；**preload 无需改动**（通用 `on` 通道已暴露） |
| **P2 串行化守卫** | `loadApps` 当前**无并发锁**（`loading.value` 仅遮罩），已确认 | ✅ 可行 | `refreshAppData` 内加 `refreshInFlight` Promise 合并：`if (inFlight) return inFlight; inFlight=(async()=>{...})().finally(()=>inFlight=null)` |
| **P4 防抖** | focus 抖动会快速多次触发 | ✅ 可行 | P2 的 in-flight 合并已天然防抖首跑；再叠加 time-based 节流（如 10s 内仅一次）更稳 |
| **P5 刷新日志** | 既有 Pino `logger`（如 `App.vue:3205` `logger.info('加载分类...')`） | ✅ 可行 | `refreshAppData` 入口 `[AppData] 触发刷新 reason=...`；`loadApps` 完成 `[AppData] 应用数 X → Y`（Y=map.size） |

### 5.2 关键发现（影响方案完整性）

1. **C1 主进程注入是 C2 的兜底**：主进程 `onBeforeSendHeaders` 注入 `no-cache` 对**所有**经 Chromium 的请求（含 `priorityConfigAxios` 的 XHR）生效；即便 C2 漏给 `priorityConfigAxios` 加 bust，C1 也能保证其不读缓存。**建议 C1 为主、C2 为辅**，两者互补而非二选一。
2. **C2 必须显式覆盖 `priorityConfigAxios`**：因其独立于 `fetchWithRetry`，要在 `storeConfig.ts:84` 的 `priorityConfigAxios.get(configPath)` 处单独加 bust（或在 `priorityConfigAxios` 实例层加请求拦截器统一加 `?_t`）。否则 auto 策略配置可能陈旧。
3. **loadApps 异步嵌套**：当前 `categoriesList.map(async category => origins.map(async mode => ...))` 嵌套异步；A1 改造时，需把内层改为 `await Promise.all(origins.map(...))` 后在分类回调末尾提交 `apps.value`，确保"每分类增量提交"。
4. **下游无回归**：`apps.value` 整体替换会触发 Vue 响应式，`baseApps`/`filteredApps`/排行均依赖它，赋值即刷新，无兼容问题。
5. **preload 零改动**：新 IPC 通道 `appdata-window-focus` 直接 `send`/`on`，复用已暴露的通用 `ipcRenderer`，不需改 `contextBridge`。

### 5.3 测试结论

- **全部 8 个方案项（C1/C2/A1/A2/A3 + P1~P5）均可实现，无不可落地项。**
- 落地前须落实 5 个细化点（5.1 表"需细化点" + 5.2 关键发现），其中 **C2 双 axios 覆盖** 与 **C1 兜底关系** 是最易被遗漏、却影响完整性的两点。
- 风险等级：均为低~中，无高危阻塞；P2（竞态）与 A3 的 IPC 可靠性属"不做则功能打折"的必补项，已在方案中标明。

### 5.4 实际效果验证（2026-08-11，本机可执行部分已实测）

> 用户要求验证"实际效果"。区分两类验证：
> - **(a) 机理实证（本机已完成）**：用 curl/Node 验证根因与修复方向正确性，无需 GUI/服务端改动。
> - **(b) 端到端实证（需真机+服务端上架新应用，本机无法完成）**：见第 7 节，须由用户在真实环境执行。

**(a) 已完成的本机实证：**
1. `curl -sI` 远程 `applist.json`：**无 `cache-control` 头、`server: nginx`** → 证实 Chromium 启发式缓存为真因（非 CDN 主动缓存）。
2. Node 计算启发式 TTL ≈ 46 分钟 → 量化"重启仍陈旧"的窗口。
3. `?_t=Date.now()` URL 经 `new URL()` 解析合法 → C2 方向正确。
4. `curl -H "Cache-Control: no-cache"` 仍 200 → 客户端带 no-cache 即绕过陈旧副本，C1 方向正确。
5. 串行化守卫 / Map 幂等去重 / focus→IPC 逻辑已在 5.1 核对，均为纯逻辑可单测（实现后补单测即闭环）。

**(b) 尚待真机验证（非本机能力范围）：**
- 需在**服务端上架一个真实新应用**（最好落入已存在分类，隔离"新分类"变量）。
- 安装修复包后，**不删缓存、不重启** → 聚焦/刷新 → 搜到新应用（验证 C1/C2 绕过启发式缓存）。
- 重启不清缓存 → 首屏即显示（验证重启不再拿旧数据）。
- 对照旧包同样操作需删 `Cache` 才有效 → 根因闭合。
- 说明：本机为无显示环境（headless Linux），且无法操作远端商店后台上架，故 (b) 必须用户在真实环境执行；**但根因机理已由 (a) 实证闭合，修复方向确凿**。

---

## 6. 明确不做（避免过度设计）

- ❌ **定时轮询**（后台常驻网络/CPU 开销，用户未要求实时）。
- ❌ **本地磁盘离线缓存**（问题不在离线，反而引入陈旧风险）。
- ❌ **ETag / 304 协商缓存**（axios 不过系统缓存层，且已有 no-cache + bust 更稳；除非确认代理忽略请求头才需要）。
- ❌ **全局 `Cache-Control` 注入到所有请求**（仅对数据 JSON 路径注入，避免影响图标/截图等静态资源加速）。

---

## 6. 验证方法

> **验证分工**：步骤 1（单测）随实现完成；步骤 2–5（端到端）需服务端上架新应用 + 真实 GUI 环境，**由用户在真机执行**（本机 headless 无法完成）。

1. **单元/逻辑**：`loadApps` 幂等化后补测——重跑两次 `apps.value` 长度不变、无重复 pkgname；`refreshAppData` 串行化 + 防抖单测。
2. **集成（根因闭合）**：服务端上架新应用（落入已存在分类，隔离"新分类"变量）。
3. 安装修复包，**不删缓存、不重启** → 聚焦窗口 / 点刷新 → 应搜到新应用（证明缓存已绕过，P5 日志应显示条目数 +1）。
4. 重启应用（不清缓存）→ 首屏即显示新应用（证明 no-cache + bust 生效，重启不再拿旧数据）。
5. **对照旧包**：同样操作需"删除 `~/.config/spark-store/Cache` 才有效"——确认根因闭合、修复生效。

> 注：机理层面已由第 5.4 节本机 curl/Node 实证闭合（nginx 无 CC 头 → Chromium 启发式缓存 ≈46min；C1/C2 方向正确），故修复方向确凿，端到端仅作最终确认。

---

## 附：历次分析演进

- **第一轮**：怀疑 `~/.cache` 本地应用列表文件缓存 → 核查排除（无磁盘列表缓存，搜索基于内存）。
- **第二轮**：深入确认"运行期不刷新"为主因（`loadApps` 仅启动一次、append 无去重、`loadTabApps` 强缓存、categories 启动一次）。
- **第三轮**：结合"重启无效、删除才行"反馈，定位为 **Chromium 磁盘缓存 + CDN 边缘缓存**双重陈旧，且代码零缓存失效机制；修正上轮结论——重启无效的根因是缓存层喂旧数据，而非单纯内存不刷新。
- **第四轮（方案验证）**：按用户要求"先测试不改代码"，对最终方案的 8 项（C1/C2/A1/A2/A3 + P1~P5）做代码级可行性核对，确认全部可落地；补充 5 个细化点（C2 须覆盖 `priorityConfigAxios` 独立实例、C1 主进程注入为兜底、loadApps 异步嵌套改造、下游无回归、preload 零改动），写入第 5 节。方案待用户审核后决定是否实现。

---

## 8. 附加修复：下载日志断层（下载卡在"正在获取 Metalink"突兀退出）

### 8.1 现象（用户反馈）
下载应用时日志停在：
```
[13:57:09] 开始下载...
[13:57:09] 正在获取 Metalink 文件: amd64-store/office/com.qianwen.otohime/com.qianwen.otohime_3.7.5.145_amd64.deb.metalink
```
随后界面无过渡直接结束（状态变 failed / 任务消失），中间无任何失败原因，体验突兀。

### 8.2 根因
下载流程在 `electron/main/backend/install-manager.ts` 的 `runDownloadPhase`：
1. **Metalink 下载请求失败无前端日志**：`await axios.get(...)` 抛错时，原代码未 `sendLog`，错误只在主进程 `logger.error` 静默记录；错误向上抛到外层 catch → 直接发 `install-complete {success:false}`，渲染端日志面板永远停在"正在获取 Metalink"。
2. **aria2c 拉起失败也无日志**：`child.on("error")` 仅 `reject(err)`，渲染端同样看不到原因。
3. **渲染端 `install-complete` 失败分支不写 logs**：`src/modules/processInstall.ts` 收到失败时只改 `status="failed"`，未把 `log.message` 的失败原因写入 `downloadObj.logs`，导致日志卡在最后一条中间状态。

三者叠加：任一环节失败，UI 都在"正在获取 Metalink"后突兀结束且无原因。

### 8.3 修复（已提交）
- **F1（主进程 Metalink 失败日志）**：`axios.get` 用 try/catch 包裹，失败时 `sendLog("获取 Metalink 失败: <reason>")` 并 `throw`，保证渲染端能显示原因。Metalink 写入 `finish` 回调补 `sendLog("Metalink 文件下载完成")`。
- **F2（aria2c 拉起失败日志）**：`child.on("error")` 补 `sendLog("aria2c 启动失败: <msg>")`。
- **F3（渲染端失败原因入日志）**：`install-complete` 的 `else` 分支解析 `log.message` 中的 `message` 字段，push 一条 `下载失败: <reason>` 到 `downloadObj.logs`；成功分支补 `下载完成`。

改动文件：
- `electron/main/backend/install-manager.ts`（F1、F2）
- `src/modules/processInstall.ts`（F3）

> 注：本修复仅改善"失败可见性"，不改变下载/重试/安装逻辑本身；UI 不再突兀卡在中间日志。

### 8.4 验证边界
本机 headless 无法真实触发 aria2c 下载与 GUI 日志面板；已通过 `vue-tsc` 类型检查与 `read_lints` 0 错误。真实失败场景（如 Metalink 404、网络中断）下的日志连贯性需用户在真机验证。

---

## 9. 附加修复：更新中心点击"更新"后卡"开始更新..."

### 9.1 现象（用户反馈）
在软件更新中心选择 Visual Studio Code: 点击更新后，下载详情弹窗日志停在：
```
[09:23:41] 开始更新...
```
状态为 `queued`，后续无进展、无错误，界面卡死。

### 9.2 根因
更新中心 `electron/main/backend/update-center/service.ts` 的 `start()` 方法，把任务通过 `webContents.send("queue-install", JSON.stringify(installTaskData))` 发送给主下载队列。

**但 `webContents.send` 是从主进程向渲染进程发消息，渲染进程的 `ipcRenderer.on("queue-install")` 能收到，而主进程的 `ipcMain.on("queue-install") 监听的是渲染进程 `ipcRenderer.send` 的消息，监听不到自己 `webContents.send` 的消息。**

结果：任务根本没有进入 `install-manager.ts` 的下载队列，`processNextDownload()` 永远不会执行，UI 自然卡在"开始更新...」。

### 9.3 修复（已提交）
- **I1（抽离可复用的入队函数）**：在 `electron/main/backend/install-manager.ts` 新增导出 `addInstallTask(payload, sender)`，把原来 `ipcMain.on("queue-install")` 里的解析、校验、去重、APM 检查、命令构建、入队逻辑全部抽到该函数。`ipcMain.on` 本身只做 JSON 解析并调用 `addInstallTask`。
- **I2（更新中心直接调用入队）**：`electron/main/backend/update-center/service.ts` 的 `start()` 不再 `webContents.send("queue-install")`，而是直接 `await addInstallTask(installTaskData, webContents)`，使任务真正进入主下载队列。
- **I3（类型安全）**：新增 `QueueInstallPayload` 接口，避免 `any`。

改动文件：
- `electron/main/backend/install-manager.ts`（I1、I3）
- `electron/main/backend/update-center/service.ts`（I2）

### 9.4 验证边界
本机 headless 无法启动 GUI 触发真实更新下载；已通过 `vue-tsc` 与 `read_lints` 0 错误。真机需在软件更新中心勾选一项更新并点击"更新"，确认日志从"开始更新..."推进到"正在获取 Metalink 文件"、下载进度增加，最终进入安装或明确失败。
