# 开发文档

## 📋 目录

- [环境搭建](#环境搭建)
- [项目结构详解](#项目结构详解)
- [开发工作流](#开发工作流)
- [调试技巧](#调试技巧)
- [本地开发最佳实践](#本地开发最佳实践)

## 环境搭建

### 系统要求

- **Node.js:** >= 22.12.0
- **npm:** >= 9.x 或 pnpm >= 8.x
- **操作系统:** Linux（推荐 Ubuntu 22.04+）
- **可选:** APM 包管理器（用于测试）

### 安装依赖

```bash
# 克隆仓库
git clone https://github.com/elysia-best/apm-app-store.git
cd apm-app-store

# 安装依赖
npm install
# 或使用 pnpm
pnpm install
```

### 开发服务器启动

```bash
# 启动开发模式
npm run dev

# 应用将在以下地址启动
# Vite 开发服务器: http://127.0.0.1:3344/
# Electron 窗口将自动打开
```

### 构建项目

```bash
# 构建生产版本（deb + rpm）
npm run build

# 仅构建前端
npm run build:vite

# 仅构建 deb 包
npm run build:deb

# 仅构建 rpm 包
npm run build:rpm
```

## 项目结构详解

### Electron 主进程

**目录:** `electron/main/`

**核心文件:**

- **`index.ts`** - 主进程入口
  - 创建应用窗口
  - 管理 IPC 通信
  - 处理生命周期事件

- **`backend/install-manager.ts`** - 安装管理器
  - 管理安装任务队列
  - 执行 APM 命令
  - 流式输出日志
  - 解析安装结果

- **`deeplink.ts`** - Deep Link 处理
  - 解析 `spk://` 协议
  - 路由到对应操作

### Vue 渲染进程

**目录:** `src/`

**核心模块:**

- **`App.vue`** - 根组件
  - 应用状态管理
  - 分类和应用加载
  - 模态框协调
  - Deep Link 监听

- **`components/`** - UI 组件
  - `AppCard.vue` - 应用卡片
  - `AppDetailModal.vue` - 应用详情
  - `DownloadQueue.vue` - 下载队列
  - 其他 11 个组件

- **`global/`** - 全局状态
  - `downloadStatus.ts` - 下载队列
  - `storeConfig.ts` - API 配置
  - `typedefinition.ts` - 类型定义

- **`modules/`** - 业务逻辑
  - `processInstall.ts` - 安装/卸载

### 共享模块

**目录:** `electron/global.ts`

- 进程间共享的常量和配置
- 系统架构检测

### 配置文件

- **`vite.config.ts`** - Vite 构建配置
- **`electron-builder.yml`** - 打包配置
- **`tsconfig.json`** - TypeScript 配置
- **`eslint.config.ts`** - ESLint 配置

## 开发工作流

### 功能开发流程

1. **需求分析**
   - 理解功能需求
   - 设计 API 和数据结构
   - 确定影响范围

2. **创建分支**

   ```bash
   git checkout -b feature/your-feature
   ```

3. **实现功能**
   - 更新类型定义 (`src/global/typedefinition.ts`)
   - 实现 Vue 组件
   - 添加 IPC 处理（如需要）
   - 编写测试

4. **测试**

   ```bash
   npm run test
   npm run test:e2e
   ```

5. **代码检查**

   ```bash
   npm run lint
   npm run format
   ```

6. **提交 PR**
   - 使用 `feat(scope): description` 格式
   - 引用相关 Issue
   - 添加详细描述

### Bug 修复流程

1. **复现 Bug**
   - 确认 Bug 存在
   - 添加复现步骤到 Issue

2. **定位问题**
   - 查看日志
   - 使用调试器
   - 检查相关代码

3. **创建分支**

   ```bash
   git checkout -b fix/your-bug-fix
   ```

4. **修复代码**
   - 最小化修改
   - 添加回归测试
   - 更新文档（如需要）

5. **验证修复**
   - 本地测试
   - 确保测试通过

6. **提交 PR**
   - 使用 `fix(scope): description` 格式
   - 说明修复方法

### 重构流程

1. **识别需要重构的代码**
   - 代码重复
   - 复杂度过高
   - 性能问题

2. **制定重构计划**
   - 不改变外部行为
   - 逐步进行
   - 保持测试通过

3. **执行重构**

   ```bash
   git checkout -b refactor/your-refactor
   ```

4. **验证**
   - 所有测试通过
   - 性能未下降
   - 代码可读性提升

## 调试技巧

### 主进程调试

**VS Code 配置:**

创建 `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Electron: Main",
      "type": "node",
      "request": "launch",
      "cwd": "${workspaceFolder}",
      "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
      "windows": {
        "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
      },
      "args": ["."],
      "outputCapture": "std"
    }
  ]
}
```

**日志调试:**

```typescript
import pino from "pino";
const logger = pino({ name: "module-name" });

logger.info("Application started");
logger.error({ err }, "Failed to load apps");
logger.debug("Debug information");
```

### 渲染进程调试

**使用 Vue DevTools:**

1. 安装 Vue DevTools 浏览器扩展
2. Electron 会自动检测
3. 检查组件树和状态

**控制台日志:**

```typescript
console.log("Debug:", data);
console.error("Error:", error);
console.table(apps);
```

### IPC 通信调试

**主进程:**

```typescript
ipcMain.on("test-channel", (event, data) => {
  console.log("Received:", data);
  event.sender.send("test-response", { result: "ok" });
});
```

**渲染进程:**

```typescript
window.ipcRenderer.send("test-channel", { test: "data" });
window.ipcRenderer.on("test-response", (_event, data) => {
  console.log("Response:", data);
});
```

### 性能分析

**Chrome DevTools:**

1. 打开 DevTools (Ctrl+Shift+I)
2. Performance 面板
3. 录制并分析

**Vite 分析:**

```bash
npm run build:vite -- --mode profile
```

## 本地开发最佳实践

### 代码组织

1. **组件拆分**
   - 单一职责原则
   - 组件不超过 300 行
   - 提取可复用逻辑

2. **状态管理**
   - 使用 Vue 响应式系统
   - 全局状态放在 `src/global/`
   - 组件状态使用 `ref` 和 `computed`

3. **类型定义**
   - 所有数据结构都有类型
   - 避免 `any` 类型
   - 使用 TypeScript 工具类型

### 组件复用

1. **Props 设计**
   - 明确的类型定义
   - 合理的默认值
   - 必填项标注

2. **Events 设计**
   - 使用 TypeScript 定义
   - 清晰的事件命名

3. **插槽使用**
   - 提供灵活的内容布局
   - 具名插槽增强可用性

### 错误处理

1. **Try-Catch**

   ```typescript
   try {
     await someAsyncOperation();
   } catch (error) {
     logger.error({ err: error }, "Operation failed");
     showErrorToUser(error.message);
   }
   ```

2. **Promise 错误**

   ```typescript
   somePromise()
     .then((result) => {
       // handle success
     })
     .catch((error) => {
       // handle error
     });
   ```

3. **Vue 错误捕获**
   ```typescript
   onMounted(() => {
     window.addEventListener("error", handleError);
   });
   ```

### 性能优化

1. **列表虚拟化**（大数据集）
2. **图片懒加载**
3. **防抖和节流**
4. **计算结果缓存**

---

**© 2026 APM 应用商店项目**
