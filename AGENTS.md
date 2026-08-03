# 星火应用商店 - AI 编码指南

**仓库:** spark-store-project/spark-store
**项目类型:** Electron + Vue 3 + Vite + Qt 桌面应用
**用途:** 星火应用商店的桌面应用商店客户端
**许可证:** GPL-3.0

---

如果你是 AI 编码代理，在此仓库工作时，请遵循以下指南：

## 🏗️ 项目架构概览

### 技术栈

- **前端框架:** Vue 3 with Composition API (`<script setup>`)
- **构建工具:** Vite 6.4.1 + Qt5
- **桌面框架:** Electron 40.0.0
- **UI 框架:** Tailwind CSS 4.1.18
- **语言:** TypeScript (严格模式已启用)
- **状态管理:** Vue 响应式系统 (ref, computed)
- **HTTP 客户端:** Axios 1.13.2
- **日志:** Pino logger

### 目录结构

```
spark-store/
├── electron/                    # Electron 主进程
│   ├── main/
│   │   ├── backend/             # 后端逻辑 (如安装管理器)
│   │   │   └── install-manager.ts  # 核心安装/包管理
│   │   ├── deeplink.ts          # Deep Link 协议处理
│   │   ├── handle-url-scheme.ts # URL Scheme 处理器
│   │   └── index.ts             # 主进程入口点
│   ├── preload/
│   │   └── index.ts             # 预加载脚本 (IPC 桥梁)
│   └── global.ts                # 进程间共享状态
├── src/                         # Vue 渲染进程
│   ├── components/              # Vue 组件 (模态框、卡片、网格)
│   ├── global/                  # 全局配置和状态
│   │   ├── downloadStatus.ts    # 下载队列管理
│   │   ├── storeConfig.ts       # API 配置和共享状态
│   │   └── typedefinition.ts    # TypeScript 类型定义
│   ├── modules/                 # 业务逻辑模块
│   │   └── processInstall.ts    # 安装/卸载逻辑
│   ├── assets/                  # CSS/图片
│   ├── App.vue                  # 根组件
│   └── main.ts                  # 渲染进程入口
├── spark-update-tool/           # Qt 软件更新工具
│   ├── src/                     # C++ 源代码
│   │   ├── mainwindow.cpp/h/ui  # 主窗口
│   │   ├── applistmodel.cpp/h   # 应用列表模型
│   │   ├── appdelegate.cpp/h    # 应用列表委托
│   │   ├── downloadmanager.cpp/h # 下载管理器
│   │   ├── aptssupdater.cpp/h   # APTSS 更新器
│   │   └── ignoreconfig.cpp/h   # 忽略配置管理
│   ├── resources/               # 图标和资源文件
│   ├── debian/                  # Debian 打包文件
│   └── CMakeLists.txt           # CMake 构建配置
├── extras/                      # Shell 脚本和策略文件
├── icons/                       # 应用图标
├── scripts/                     # 维护脚本
├── public/                      # 公共资源
├── electron-builder.yml         # 构建配置
├── vite.config.ts               # Vite 配置
├── tsconfig.json                # TypeScript 配置
├── eslint.config.ts             # ESLint 配置
└── package.json                 # 依赖和脚本
```

---

## 🔧 配套工具

### Spark Update Tool (spark-update-tool/)

**技术栈:** Qt6 + C++

**用途:** 独立的软件更新工具，用于检查和安装系统软件更新。

**主要组件:**

| 文件 | 用途 |
|------|------|
| `mainwindow.cpp/h/ui` | 主窗口界面，包含应用列表视图、搜索框、更新按钮 |
| `applistmodel.cpp/h` | 应用列表数据模型，管理可更新应用的数据 |
| `appdelegate.cpp/h` | 应用列表视图委托，负责绘制每个应用项的UI（图标、进度条、复选框等） |
| `downloadmanager.cpp/h` | 下载管理器，基于 aria2c 实现多线程下载 |
| `aptssupdater.cpp/h` | APTSS 更新器，调用 `aptss` 命令获取更新列表 |
| `ignoreconfig.cpp/h` | 忽略配置管理，管理用户选择忽略更新的应用 |

**核心功能:**

1. **获取更新列表:** 调用 `aptss list --upgradable` 获取可更新应用
2. **应用名识别:** 基于 `ss-do-upgrade.sh` 部分代码实现
3. **包大小识别:** 通过 dpkg 获取包大小信息
4. **多线程下载:** 基于 aptss 方案，使用 aria2c 进行多线程下载
5. **忽略更新:** 用户可以忽略特定应用的更新
6. **批量更新:** 支持选择多个应用进行批量更新

**构建方式:**

```bash
cd spark-update-tool
mkdir build && cd build
cmake ..
make
```

**支持的发行版:**
- GXDE OS
- Ubuntu
- deepin
- Debian 10+
- UOS
- 银河麒麟
- Arch Linux
- Fedora
---

## 🎯 核心概念

### 1. APM 包管理器集成

本应用作为 APM CLI 工具 (`/opt/spark-store/extras/shell-caller.sh`) 的 GUI 前端。

**关键操作:**

- `apm install -y <pkgname>` - 安装包
- `apm remove -y <pkgname>` - 卸载包
- `apm list --installed` - 列出已安装的包
- `apm list --upgradable` - 列出可升级的包

**重要:** 在 Linux 上，所有 APM 操作都需要通过 `pkexec` 进行权限提升。

### 2. IPC 通信模式

**主进程 (Node.js) ⟷ 渲染进程 (浏览器)**

```typescript
// 在渲染进程中 (Vue):
window.ipcRenderer.send('queue-install', JSON.stringify(download));
window.ipcRenderer.invoke('list-installed');
window.ipcRenderer.on('install-complete', (event, result) => { /* ... */ });

// 在主进程中 (Electron):
ipcMain.on('queue-install', async (event, download_json) => { /* ... */ });
ipcMain.handle('list-installed', async () => { /* ... */ });
event.sender.send('install-complete', { id, success, ... });
```

**在 Preload 中暴露的 API:**

- `window.ipcRenderer.on/off/send/invoke` - IPC 通信
- `window.apm_store.arch` - 系统架构检测 (amd64-store, arm64-store)

### 3. 安装队列系统

**位置:** `electron/main/backend/install-manager.ts`

**关键特性:**

- 单任务顺序处理（一次只能安装一个应用）
- 通过 `Map<number, InstallTask>` 管理任务队列
- 通过 IPC 事件实时流式传输进度
- 自动检测权限提升

**任务生命周期:**

1. 渲染进程发送 `queue-install`，包含任务 ID 和包名
2. 主进程检查是否有重复任务
3. 任务加入队列，状态为 `queued`
4. `processNextInQueue()` 生成子进程
5. stdout/stderr 通过 `install-log` 流式传输到渲染进程
6. 通过 `install-complete` 发送完成信号和退出码

**关键模式:**

```typescript
// 在处理前始终检查是否空闲
if (idle) processNextInQueue(0);

// 任务完成后，检查是否有更多任务
tasks.delete(task.id);
idle = true;
if (tasks.size > 0) processNextInQueue(0);
```

---

## 📝 类型系统指南

**重要:** 不要在代码中使用 any！

### 核心类型 (src/global/typedefinition.ts)

#### 应用数据结构

```typescript
// 从 API 返回的原始 JSON (PascalCase)
interface AppJson {
  Name: string;
  Pkgname: string;
  Version: string;
  Filename: string;
  // ... (遵循上游 API 格式)
}

// 标准化的应用数据 (camelCase)
interface App {
  name: string;
  pkgname: string; // 主要标识符
  version: string;
  category: string; // 由前端添加
  currentStatus: "not-installed" | "installed";
  flags?: string; // 例如: "automatic" 表示依赖
  arch?: string; // 例如: "amd64", "arm64"
  // ... (完整定义见 typedefinition.ts)
}
```

#### 下载/安装任务

```typescript
interface DownloadItem {
  id: number; // 唯一任务 ID
  pkgname: string; // 包标识符
  status: DownloadItemStatus; // "queued" | "installing" | "completed" | "failed" | "paused"
  progress: number; // 0-100
  logs: Array<{ time: number; message: string }>;
  retry: boolean; // 重试标志
  upgradeOnly?: boolean; // 用于升级操作
  // ... (完整定义)
}
```

#### IPC 负载

```typescript
interface InstallLog {
  id: number;
  time: number;
  message: string;
}

interface DownloadResult extends InstallLog {
  success: boolean;
  exitCode: number | null;
}
```

---

## 🎨 Vue 组件模式

### Composition API 最佳实践

```typescript
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Ref } from 'vue';

// 响应式状态
const apps: Ref<App[]> = ref([]);
const loading = ref(true);

// 计算属性
const filteredApps = computed(() => {
  return apps.value.filter(/* ... */);
});

// 生命周期钩子
onMounted(async () => {
  await loadCategories();
  await loadApps();
});

// 方法 (使用箭头函数或函数声明)
const handleInstall = () => {
  // 实现
};
</script>
```

### Props 和 Events 模式

```typescript
// Props 定义
const props = defineProps<{
  app: App | null;
  show: boolean;
}>();

// Emits 定义
const emit = defineEmits<{
  close: [];
  install: [];
  remove: [];
}>();

// 使用
emit("install");
```

### Vue 中的 IPC 事件监听

**始终在 `onMounted` 中使用以便正确清理:**

```typescript
onMounted(() => {
  window.ipcRenderer.on(
    "install-complete",
    (_event: IpcRendererEvent, result: DownloadResult) => {
      // 处理事件
    },
  );

  window.ipcRenderer.on(
    "install-log",
    (_event: IpcRendererEvent, log: InstallLog) => {
      // 处理日志
    },
  );
});
```

---

## 🔧 主进程模式

### 生成 APM 命令

```typescript
import { spawn } from "node:child_process";

// 检查权限提升
const superUserCmd = await checkSuperUserCommand();
const execCommand = superUserCmd.length > 0 ? superUserCmd : SHELL_CALLER_PATH;
const execParams =
  superUserCmd.length > 0
    ? [SHELL_CALLER_PATH, "apm", "install", "-y", pkgname]
    : ["apm", "install", "-y", pkgname];

// 生成进程
const child = spawn(execCommand, execParams, {
  shell: false,
  env: process.env,
});

// 流式输出
child.stdout.on("data", (data) => {
  webContents.send("install-log", {
    id,
    time: Date.now(),
    message: data.toString(),
  });
});

// 处理完成
child.on("close", (code) => {
  const success = code === 0;
  webContents.send("install-complete", {
    id,
    success,
    exitCode: code /* ... */,
  });
});
```

### 解析 APM 输出

**APM 输出是基于文本的特定格式:**

```typescript
// 已安装包格式: "pkgname/repo,version arch [flags]"
// 示例: "code/stable,1.108.2 amd64 [installed]"
const parseInstalledList = (output: string) => {
  const apps: InstalledAppInfo[] = [];
  const lines = output.split("\n");
  for (const line of lines) {
    const match = line
      .trim()
      .match(/^(\S+)\/\S+,\S+\s+(\S+)\s+(\S+)\s+\[(.+)\]$/);
    if (match) {
      apps.push({
        pkgname: match[1],
        version: match[2],
        arch: match[3],
        flags: match[4],
        raw: line.trim(),
      });
    }
  }
  return apps;
};
```

---

## 🌐 API 集成

### 基础配置

````typescript
// src/global/storeConfig.ts
export const APM_STORE_BASE_URL = 'https://erotica.spark-app.store';

// URL 结构:
// /{arch}/{category}/applist.json        - 应用列表
// /{arch}/{category}/{pkgname}/icon.png  - 应用图标
// /{arch}/{category}/{pkgname}/screen_N.png - 截图 (1-5)
// /{arch}/categories.json                - 分类映射

### 首页 (主页) 数据

商店可能会在 `{arch}` 下提供一个特殊的 `home` 目录用于本地化首页。预期有两个 JSON 文件:

- `homelinks.json` — 用于构建首页的轮播或链接块。每个条目示例:

```json
{
  "name": "交流反馈",
  "more": "前往论坛交流讨论",
  "imgUrl": "/home/links/bbs.png",
  "type": "_blank",
  "url": "https://bbs.spark-app.store/"
}
````

- `homelist.json` — 描述若干推荐应用列表，每项引用一个 JSON 列表（`jsonUrl`）:

```json
[
  {
    "name": "装机必备",
    "type": "appList",
    "jsonUrl": "/home/lists/NecessaryforInstallation.json"
  }
]
```

应用使用的解析规则:

- 通过前缀解析 `imgUrl`: `${APM_STORE_BASE_URL}/{arch}${imgUrl}`。
- `type: _blank` → 使用系统浏览器打开链接；`type: _self` → 在当前页面打开。
- 对于 `homelist.json` 中 `type: "appList"` 的条目，获取引用的 `jsonUrl` 并将每个项映射到 UI 使用的应用形状:
  - `Name` → `name`
  - `Pkgname` → `pkgname`
  - `Category` → `category`
  - `More` → `more`

实现位置:

- 渲染进程: `src/App.vue` 在选择 `home` 分类时加载并规范化 `homelinks.json` 和 `homelist.json`，并将数据暴露给新的 `HomeView` 组件。
- 组件: `src/components/HomeView.vue` 渲染链接卡片和推荐应用部分（复用 `AppCard.vue`）。

注意事项:

- `home` 目录路径是: 配置的 `APM_STORE_BASE_URL` 下的 `/{arch}/home/`。
- 缺失或部分无效的文件会被优雅地处理 — 个别失败不会阻止显示其他首页部分。

````

### Axios 使用

```typescript
const axiosInstance = axios.create({
  baseURL: APM_STORE_BASE_URL,
  timeout: 1000,  // 注意: 非常短的超时时间！
});

// 按分类加载应用
const response = await axiosInstance.get<AppJson[]>(
  `/${window.apm_store.arch}/${category}/applist.json`
);
````

**开发代理 (vite.config.ts):**

```typescript
server: {
  proxy: {
    '/local_amd64-store': {
      target: 'https://erotica.spark-app.store',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/local_amd64-store/, ''),
    }
  }
}
```

---

## 🎯 Deep Link 协议 (SPK URI Scheme)

**URL Scheme:** `spk://`

### 支持的 SPK URI 格式

格式: `spk://search/{pkgname}`

**示例:**

- `spk://search/code` - 搜索并打开 "code" 应用
- `spk://search/steam` - 搜索并打开 "steam" 应用
- `spk://search/store.spark-app.hmcl` - 搜索并打开 "HMCL" 游戏

### 实现模式

```typescript
// electron/main/deeplink.ts - 解析命令行并路由
export function handleCommandLine(commandLine: string[]) {
  const deeplinkUrl = commandLine.find((arg) => arg.startsWith("spk://"));
  if (!deeplinkUrl) return;

  try {
    const url = new URL(deeplinkUrl);
    const action = url.hostname; // 'search'

    if (action === "search") {
      // 格式: spk://search/pkgname
      // url.pathname 将是 '/pkgname'
      const pkgname = url.pathname.split("/").filter(Boolean)[0];
      if (pkgname) {
        listeners.emit("search", { pkgname });
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Error parsing SPK URI");
  }
}

// src/App.vue - 在渲染进程中处理
window.ipcRenderer.on(
  "deep-link-search",
  (_event: IpcRendererEvent, data: { pkgname: string }) => {
    // 使用 pkgname 触发搜索
    searchQuery.value = data.pkgname;
  },
);
```

---

## 🛡️ 安全考虑

### 权限提升

**始终检查 `pkexec` 的可用性:**

```typescript
const checkSuperUserCommand = async (): Promise<string> => {
  if (process.getuid && process.getuid() !== 0) {
    const { stdout } = await execAsync("which /usr/bin/pkexec");
    return stdout.trim().length > 0 ? "/usr/bin/pkexec" : "";
  }
  return "";
};
```

### 上下文隔离

**当前状态:** 上下文隔离已 **启用** (Electron 默认行为)。

**通过 Preload 安全地暴露 IPC:**

```typescript
// electron/preload/index.ts
contextBridge.exposeInMainWorld("ipcRenderer", {
  on: (...args) => ipcRenderer.on(...args),
  send: (...args) => ipcRenderer.send(...args),
  invoke: (...args) => ipcRenderer.invoke(...args),
});
```

**⚠️ 不要启用 nodeIntegration 或禁用 contextIsolation！**

---

## 🎨 UI/UX 模式

### Tailwind CSS 使用

**暗色模式支持:**

```vue
<div class="bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
  <!-- 内容 -->
</div>
```

**主题切换:**

```typescript
const isDarkTheme = ref(false);

watch(isDarkTheme, (newVal) => {
  localStorage.setItem("theme", newVal ? "dark" : "light");
  document.documentElement.classList.toggle("dark", newVal);
});
```

### 模态框模式

```vue
<template>
  <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center">
    <div class="absolute inset-0 bg-black/50" @click="closeModal"></div>
    <div class="modal-panel relative z-10 bg-white dark:bg-slate-900">
      <!-- 模态框内容 -->
    </div>
  </div>
</template>
```

### 加载状态

```typescript
const loading = ref(true);

// 在模板中
<div v-if="loading">Loading...</div>
<div v-else>{{ apps.length }} apps</div>
```

---

## 🧪 测试与质量

### ESLint 配置

```typescript
// eslint.config.ts
export default defineConfig([
  globalIgnores([
    "**/3rdparty/**",
    "**/node_modules/**",
    "**/dist/**",
    "**/dist-electron/**",
  ]),
  tseslint.configs.recommended,
  pluginVue.configs["flat/essential"],
  eslintConfigPrettier,
  eslintPluginPrettierRecommended,
]);
```

### TypeScript 配置

```json
{
  "compilerOptions": {
    "strict": true, // 严格模式已启用
    "noEmit": true, // 不输出 (Vite 处理构建)
    "module": "ESNext",
    "target": "ESNext",
    "jsx": "preserve", // Vue JSX
    "resolveJsonModule": true // 导入 JSON 文件
  }
}
```

### 代码质量命令

```bash
npm run lint         # 运行 ESLint
npm run lint:fix     # 自动修复问题
npm run format       # 使用 Prettier 格式化
```

---

## 🚀 构建与开发

### 开发模式

```bash
npm run dev          # 启动开发服务器 (Vite + Electron)
```

**开发服务器:** `http://127.0.0.1:3344/` (来自 package.json)

### 生产构建

```bash
npm run build        # 构建所有 (deb + rpm)
npm run build:deb    # 仅构建 Debian 包
npm run build:rpm    # 仅构建 RPM 包
```

**构建输出:**

- `dist-electron/` - 编译的 Electron 代码
- `dist/` - 编译的渲染器资源
- 打包的应用在项目根目录

### 测试打包脚本（开发过程统一使用）

开发 / 自测阶段的打包**一律使用测试脚本 `scripts/test-build.sh`**，不要直接手敲 `dpkg-buildpackage`：

```bash
./scripts/test-build.sh
```

脚本行为：

- 自动读取 `debian/changelog` 顶部的 deb 版本号（如 `5.2.1.0`），将**最后一段数字 +1** 并追加 `-test` 修订号（如 `5.2.1.1-test`）。
- 每次运行版本递增（`5.2.1.1-test` → `5.2.1.2-test` → …），产物形如 `spark-store_5.2.1.X-test_amd64.deb`，与正式发版版本区分。
- 自动设置 `ELECTRON_MIRROR` 镜像（`https://registry.npmmirror.com/-/binary/electron/`）后执行 `dpkg-buildpackage -us -uc -b`。
- 仅修改 `debian/changelog`，不改 `package.json`（electron-builder 的 dir 产物版本由 `package.json` 决定，不影响 deb 文件名）。

> 注意：每次运行会改写 `debian/changelog`（未跟踪的工作区改动），测试完成后按需自行还原为正式版本。

### 构建配置

**electron-builder.yml:**

- App ID: `cn.eu.org.simplelinux.apmstore`
- Linux 目标: deb, rpm
- 包含 extras/ 目录在资源中
- 自动更新禁用 (Linux 包管理器处理更新)

---

## 📦 重要文件说明

### 1. electron/main/backend/install-manager.ts

**用途:** 核心包管理逻辑
**主要职责:**

- 任务队列管理
- APM 命令生成
- 进度报告
- 已安装/可升级列表解析

**关键函数:**

- `processNextInQueue()` - 任务处理器
- `parseInstalledList()` - 解析 APM 输出
- `checkSuperUserCommand()` - 权限提升

### 2. src/App.vue

**用途:** 根组件
**主要职责:**

- 应用状态管理
- 分类/应用加载
- 模态框协调
- Deep Link 处理

### 3. src/global/downloadStatus.ts

**用途:** 下载队列状态
**关键特性:**

- 响应式下载列表
- 下载项 CRUD 操作
- UI 更新的变化监听器

### 4. electron/preload/index.ts

**用途:** 渲染进程-主进程桥梁
**关键特性:**

- IPC API 暴露
- 架构检测
- 加载动画

### 5. vite.config.ts

**用途:** 构建配置
**关键特性:**

- Electron 插件设置
- 开发服务器代理
- Tailwind 集成

---

## 🐛 常见陷阱与解决方案

### 1. 重复任务处理

**问题:** 用户多次点击安装
**解决方案:**

```typescript
if (tasks.has(id) && !download.retry) {
  logger.warn("Task already exists, ignoring duplicate");
  return;
}
```

### 2. 窗口关闭行为

**问题:** 任务运行时关闭窗口
**解决方案:**

```typescript
win.on("close", (event) => {
  event.preventDefault();
  if (tasks.size > 0) {
    win.hide(); // 隐藏而不是关闭
    win.setSkipTaskbar(true);
  } else {
    win.destroy(); // 没有任务时允许关闭
  }
});
```

### 3. 应用数据规范化

**问题:** API 返回 PascalCase，应用使用 camelCase
**解决方案:**

```typescript
const normalizedApp: App = {
  name: appJson.Name,
  pkgname: appJson.Pkgname,
  version: appJson.Version,
  // ... 映射所有字段
};
```

### 4. 截图加载

**问题:** 并非所有应用都有 5 张截图
**解决方案:**

```typescript
for (let i = 1; i <= 5; i++) {
  const img = new Image();
  img.src = screenshotUrl;
  img.onload = () => screenshots.value.push(screenshotUrl);
  // 没有 onerror 处理器 - 静默跳过缺失的图片
}
```

---

## 📚 日志最佳实践

### Pino Logger 使用

```typescript
import pino from "pino";
const logger = pino({ name: "module-name" });

// 级别: trace, debug, info, warn, error, fatal
logger.info("Application started");
logger.error({ err }, "Failed to load apps");
logger.warn(`Package ${pkgname} not found`);
```

### 日志位置

**开发:** 控制台使用 `pino-pretty`
**生产:** 结构化 JSON 到 stdout

---

## 🔄 状态管理

### 全局状态 (src/global/storeConfig.ts)

```typescript
export const currentApp = ref<App | null>(null);
export const currentAppIsInstalled = ref(false);
```

**使用模式:**

```typescript
import { currentApp, currentAppIsInstalled } from "@/global/storeConfig";

// 设置当前应用
currentApp.value = selectedApp;

// 检查安装状态
window.ipcRenderer
  .invoke("check-installed", app.pkgname)
  .then((isInstalled: boolean) => {
    currentAppIsInstalled.value = isInstalled;
  });
```

### 下载队列 (src/global/downloadStatus.ts)

```typescript
export const downloads = ref<DownloadItem[]>([]);

// 添加下载
downloads.value.push(newDownload);

// 移除下载
export const removeDownloadItem = (pkgname: string) => {
  const index = downloads.value.findIndex((d) => d.pkgname === pkgname);
  if (index !== -1) downloads.value.splice(index, 1);
};

// 监听变化
export const watchDownloadsChange = (callback: () => void) => {
  watch(downloads, callback, { deep: true });
};
```

---

## 🎯 贡献指南

### 添加新功能时

1. **首先添加 TypeScript 类型** (src/global/typedefinition.ts)
2. **更新 IPC 处理器** (如果需要主进程-渲染进程通信)
3. **遵循现有组件模式** (props, emits, setup)
4. **使用实际的 APM 命令测试** (不要在开发中使用 mock)
5. **完成任务时更新 README TODO 列表**

### 代码风格

- **使用 TypeScript 严格模式** - 没有 `any` 类型，除非使用 `eslint-disable`
- **避免直接使用 eslint-disable** - 如果你真的不知道类型，使用 `undefined` 代替
- **优先使用 Composition API** - `<script setup lang="ts">`
- **在 setup 中使用箭头函数** 作为方法
- **解构导入** - `import { ref } from 'vue'`
- **遵循命名约定:**
  - 组件: PascalCase (AppCard.vue)
  - 函数: camelCase (handleInstall)
  - 常量: UPPER_SNAKE_CASE (SHELL_CALLER_PATH)

### 提交信息格式

```
type(scope): subject

示例:
feat(install): add retry mechanism for failed installations
fix(ui): correct dark mode toggle persistence
refactor(ipc): simplify install manager event handling
docs(readme): update build instructions
```

建议添加签名到提交。

---

## 🔗 相关资源

- **APM 项目:** https://gitee.com/spark-store-project/AmberPM
- **Electron 文档:** https://www.electronjs.org/docs
- **Vue 3 文档:** https://vuejs.org/
- **Vite 文档:** https://vitejs.dev/
- **Tailwind CSS:** https://tailwindcss.com/

---

## ⚠️ 已知问题和 TODO

详见 README.md。

## 🎓 新贡献者学习路径

### 阶段 1: 理解技术栈

1. 阅读 Vue 3 Composition API 文档
2. 查看 Electron IPC 通信模式
3. 理解 APM 包管理器基础

### 阶段 2: 探索代码

1. 从 `src/App.vue` 开始 - 查看应用状态如何流动
2. 学习 `electron/main/backend/install-manager.ts` - 理解任务队列
3. 查看 `src/global/typedefinition.ts` - 学习数据结构

### 阶段 3: 做第一次修改

1. 从 TODO 列表中选择一项 (优先 UI 改进)
2. 创建功能分支
3. 遵循代码风格指南
4. 使用实际的 APM 命令测试
5. 提交清晰的 PR 描述

---

## 🤖 AI Agent 特定指令

### 生成代码时

1. **始终先检查现有模式** - 搜索类似的实现
2. **保持类型安全** - 没有隐式 any，使用显式类型
3. **遵循 IPC 命名约定:**
   - 主进程 → 渲染进程: `kebab-case` (例如: `install-complete`)
   - 处理器: 描述性名称 (例如: `queue-install`, `list-installed`)
4. **错误处理:**
   - 始终捕获 promises
   - 记录带有上下文的错误
   - 发送用户友好的消息到渲染进程
5. **状态更新:**
   - 使用 Vue 响应式 (ref, reactive)
   - 避免直接数组变异，使用展开运算符
   - 在异步操作完成前更新 UI

### 修复 Bug 时

1. **首先复现** - 理解上下文
2. **检查 IPC 通信** - 许多 Bug 是时序问题
3. **验证 APM 输出解析** - 格式可能会改变
4. **测试边界情况:**
   - 缺失的包
   - 网络失败
   - 权限提升失败
   - 快速按钮点击

### 重构时

1. **不要破坏 IPC 契约** - 保持事件名称和负载兼容
2. **保持类型安全** - 在代码之前更新类型
3. **端到端测试安装流程**
4. **更新注释和文档**

### 必须执行

1. Lint 代码
2. 格式化代码
3. 构建 vite 项目以检查错误

---

**文档版本:** 1.0
**最后更新:** 2026-03-10
**生成对象:** 在 elysia-best/apm-app-store 工作的 AI 编码代理

---

本文档应随着代码库的演变而更新。如有疑问，请参考实际源代码，并优先考虑类型安全和用户体验。
