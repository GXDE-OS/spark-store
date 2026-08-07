import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
  nativeTheme,
  screen,
  session,
} from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import pino from "pino";
import { handleCommandLine } from "./deeplink.js";
import { isLoaded } from "../global.js";
import { tasks } from "./backend/install-manager.js";
import { sendTelemetryOnce } from "./backend/telemetry.js";
import { initializeUpdateCenter } from "./backend/update-center/index.js";
import {
  getMainWindowCloseAction,
  type MainWindowCloseGuardState,
} from "./window-close-guard.js";
import { registerSubmitterHandlers } from "./backend/submitter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname, "../..");

/** 与项目 package.json 一致的版本号：打包用 app.getVersion()，未打包时读 package.json */
function getAppVersion(): string {
  if (app.isPackaged) return app.getVersion();
  const pkgPath = path.join(process.env.APP_ROOT ?? __dirname, "package.json");
  try {
    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : "dev";
  } catch {
    return "dev";
  }
}

function getSystemInfo(): { distro: string } {
  try {
    const raw = fs.readFileSync("/etc/os-release", "utf8");
    const fields = Object.fromEntries(
      raw
        .split("\n")
        .map((line) => line.match(/^([A-Z_]+)=(.*)$/))
        .filter((match): match is RegExpMatchArray => match !== null)
        .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]),
    );
    const distro = fields.PRETTY_NAME || fields.NAME || "unknown";
    return { distro };
  } catch {
    return { distro: "unknown" };
  }
}

// 处理 --version 参数（在单实例检查之前）
if (process.argv.includes("--version") || process.argv.includes("-v")) {
  console.log(getAppVersion());
  process.exit(0);
}

// Assure single instance application
if (!app.requestSingleInstanceLock()) {
  app.exit(0);
}

import "./backend/install-manager.js";
import "./handle-url-scheme.js";

// 关闭 Linux 的覆盖式（overlay）滚动条，强制使用经典滚动条，
// 否则 GTK overlay 滚动条会忽略渲染进程的 ::-webkit-scrollbar 颜色，
// 导致暗色模式下滚动条始终是原生灰色。必须在 app ready 前设置。
if (process.platform === "linux") {
  app.commandLine.appendSwitch("disable-features", "OverlayScrollbar");
}

const logger = pino({ name: "index.ts" });
const FLARUM_TOKEN_URL = "https://bbs.spark-app.store/api/token";

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
let allowAppExit = false;
const preload = path.join(__dirname, "../preload/index.mjs");
const indexHtml = path.join(RENDERER_DIST, "index.html");

const getUserAgent = (): string => {
  return `Spark-Store/${getAppVersion()}`;
};

let submitterWin: BrowserWindow | null = null;
registerSubmitterHandlers(
  preload,
  indexHtml,
  VITE_DEV_SERVER_URL,
  () => submitterWin,
  (w) => {
    submitterWin = w;
  },
);

logger.info("User Agent: " + getUserAgent());

/** 根据启动参数 --no-apm / --no-spark 决定只展示的来源 */
function getStoreFilterFromArgv(): "spark" | "apm" | "both" {
  if (process.arch === "loong64") {
    // Currently loong64 only have spark support,
    // 但用户显式传入 --no-spark 时应允许回退到 apm
    if (process.argv.includes("--no-spark")) return "apm";
    return "spark";
  } else {
    const argv = process.argv;
    const noApm = argv.includes("--no-apm");
    const noSpark = argv.includes("--no-spark");
    if (noApm && noSpark) return "both";
    if (noApm) return "spark";
    if (noSpark) return "apm";
    return "both";
  }
}

ipcMain.handle("get-store-filter", (): "spark" | "apm" | "both" =>
  getStoreFilterFromArgv(),
);

// 渲染端在窗口尺寸变化时（包括无边框窗口鼠标拉边角）经此保存当前窗口尺寸
ipcMain.handle("save-window-bounds", (): boolean => {
  if (win && !win.isDestroyed()) scheduleSaveBounds(win);
  return true;
});

ipcMain.handle("get-app-version", (): string => getAppVersion());
ipcMain.handle("get-system-info", (): { distro: string } => getSystemInfo());

ipcMain.handle("request-flarum-token", async (_event, payload: unknown) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("登录信息格式不正确，请重新输入。");
  }

  const credentials = payload as Record<string, unknown>;
  if (
    typeof credentials.identification !== "string" ||
    typeof credentials.password !== "string"
  ) {
    throw new Error("登录信息格式不正确，请重新输入。");
  }

  logger.info({ endpoint: FLARUM_TOKEN_URL }, "Requesting Flarum login token");

  let response: Response;
  try {
    response = await fetch(FLARUM_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": getUserAgent(),
      },
      body: JSON.stringify({
        identification: credentials.identification,
        password: credentials.password,
      }),
    });
  } catch (err) {
    logger.error(
      { err, endpoint: FLARUM_TOKEN_URL },
      "Flarum token request failed before response",
    );
    throw new Error("无法连接星火论坛，请检查网络后重试。");
  }

  if (!response.ok) {
    logger.warn(
      { endpoint: FLARUM_TOKEN_URL, status: response.status },
      "Flarum rejected login token request",
    );
    throw new Error("论坛登录失败，请检查账号和密码。");
  }

  const data = (await response.json()) as Record<string, unknown>;
  const userId = data.userId ?? data.user_id;
  if (
    typeof data.token !== "string" ||
    userId === undefined ||
    userId === null
  ) {
    logger.warn(
      {
        endpoint: FLARUM_TOKEN_URL,
        hasToken: typeof data.token === "string" && data.token.length > 0,
        hasUserId: userId !== undefined && userId !== null,
      },
      "Flarum token response missing required fields",
    );
    throw new Error("论坛登录响应异常，请稍后重试。");
  }

  return {
    token: data.token,
    userId: String(userId),
  };
});

const getMainWindowCloseGuardState = (): MainWindowCloseGuardState => ({
  installTaskCount: tasks.size,
  hasRunningUpdateCenterTasks:
    initializeUpdateCenter().getState().hasRunningTasks,
});

const applyMainWindowCloseAction = (): void => {
  if (!win) {
    return;
  }

  const action = getMainWindowCloseAction(getMainWindowCloseGuardState());
  if (action === "hide") {
    win.hide();
    win.setSkipTaskbar(true);
    return;
  }

  win.destroy();
};

const requestApplicationExit = (): void => {
  if (!win) {
    allowAppExit = true;
    app.quit();
    return;
  }

  if (getMainWindowCloseAction(getMainWindowCloseGuardState()) === "hide") {
    win.hide();
    win.setSkipTaskbar(true);
    return;
  }

  allowAppExit = true;
  app.quit();
};

const showAndFocusMainWindow = async (): Promise<void> => {
  if (!win || win.isDestroyed()) {
    // 等待窗口创建完成，创建失败时调用方可通过异常感知
    await createWindow();
    return;
  }

  if (win.isMinimized()) {
    win.restore();
  }
  win.show();
  win.setSkipTaskbar(false);
  win.focus();
};

// 窗口尺寸持久化：保存/恢复上一次调整后的窗口大小，避免每次打开都使用默认尺寸
const DEFAULT_WINDOW_SIZE = { width: 1366, height: 768 };
const MIN_WINDOW_SIZE = { width: 800, height: 500 };
// 超过该尺寸的窗口（通常为全屏/最大化状态）在恢复时回退到默认尺寸，避免「启动即全屏、还原按钮失效」
const OVERSIZED_WINDOW_THRESHOLD = { width: 1600, height: 900 };

interface WindowState {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  maximized?: boolean;
}

function getWindowStatePath(): string {
  // 延迟到调用时再取 userData，避免在 app ready 之前调用 app.getPath 出错
  return path.join(app.getPath("userData"), "window-state.json");
}

// 校验保存的窗口位置是否至少部分落在某个显示器可见区域内，避免窗口跑到屏幕外
function isVisible(bounds: WindowState): boolean {
  // 解构为局部常量后，控制流收窄（const 不可变）可穿透到下方嵌套闭包，
  // 消除 x/y/width/height 的 “可能为未定义” 告警
  const { x, y, width, height } = bounds;
  if (x === undefined || y === undefined || width === undefined || height === undefined) {
    return false;
  }
  const displays = screen.getAllDisplays();
  return displays.some((display) => {
    const w = display.workArea;
    const horizontally = x < w.x + w.width && x + width > w.x;
    const vertically = y < w.y + w.height && y + height > w.y;
    return horizontally && vertically;
  });
}

function loadWindowState(): WindowState {
  try {
    const file = getWindowStatePath();
    if (fs.existsSync(file)) {
      const parsed = JSON.parse(
        fs.readFileSync(file, "utf-8"),
      ) as WindowState;
      if (
        parsed.width !== undefined &&
        parsed.height !== undefined &&
        parsed.width >= MIN_WINDOW_SIZE.width &&
        parsed.height >= MIN_WINDOW_SIZE.height &&
        isVisible(parsed)
      ) {
        return parsed;
      }
      logger.warn({ parsed }, "已保存的窗口状态无效，使用默认尺寸");
    }
  } catch (err) {
    logger.warn({ err }, "读取窗口状态失败，使用默认尺寸");
  }
  return {};
}

function saveWindowState(state: WindowState): void {
  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(state));
    logger.info({ state }, "已保存窗口状态");
  } catch (err) {
    logger.warn({ err }, "保存窗口状态失败");
  }
}

let saveBoundsTimer: NodeJS.Timeout | null = null;
function flushSaveBounds(): void {
  if (saveBoundsTimer) {
    clearTimeout(saveBoundsTimer);
    saveBoundsTimer = null;
  }
  if (win && !win.isDestroyed()) {
    const { width, height, x, y } = win.getBounds();
    saveWindowState({ width, height, x, y, maximized: win.isMaximized() });
  }
}
function scheduleSaveBounds(winInstance: BrowserWindow): void {
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = setTimeout(() => {
    if (winInstance.isDestroyed()) return;
    const { width, height, x, y } = winInstance.getBounds();
    saveWindowState({
      width,
      height,
      x,
      y,
      maximized: winInstance.isMaximized(),
    });
  }, 400);
}

// 应用退出前立即持久化（防抖 400ms 可能在快速关闭时丢失最后一次状态）
app.on("before-quit", () => {
  flushSaveBounds();
});

async function createWindow() {
  const saved = loadWindowState();
  // 恢复时：若上次窗口过大（>1600x900，通常为全屏/最大化），回退到默认尺寸并居中，
  // 避免「启动即全屏、还原按钮失效」；其余情况保留上次记录的实际尺寸（并居中）。
  // 放大/还原仍交由标题栏按钮控制。
  const oversized =
    (saved.width ?? 0) > OVERSIZED_WINDOW_THRESHOLD.width ||
    (saved.height ?? 0) > OVERSIZED_WINDOW_THRESHOLD.height;
  const restoredWidth = oversized
    ? DEFAULT_WINDOW_SIZE.width
    : Math.max(saved.width ?? DEFAULT_WINDOW_SIZE.width, MIN_WINDOW_SIZE.width);
  const restoredHeight = oversized
    ? DEFAULT_WINDOW_SIZE.height
    : Math.max(saved.height ?? DEFAULT_WINDOW_SIZE.height, MIN_WINDOW_SIZE.height);

  const mainWindow = new BrowserWindow({
    title: "星火应用商店",
    width: restoredWidth,
    height: restoredHeight,
    center: true,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    frame: false,
    autoHideMenuBar: true,
    icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  });
  win = mainWindow;

  // 不再自动恢复最大化状态（避免无法还原）；启动即居中显示，过大窗口已回退默认尺寸
  logger.info(
    { saved, restoredWidth, restoredHeight, oversized },
    "已恢复窗口状态（过大窗口回退默认尺寸并居中）",
  );

  // 窗口大小/位置/最大化变化后防抖保存，下次启动时恢复
  // 位置/最大化变化由主进程事件保存；尺寸变化由渲染端 DOM resize 经 IPC 兜底保存
  mainWindow.on("moved", () => scheduleSaveBounds(mainWindow));
  mainWindow.on("maximize", () => scheduleSaveBounds(mainWindow));
  mainWindow.on("unmaximize", () => scheduleSaveBounds(mainWindow));

  if (VITE_DEV_SERVER_URL) {
    // #298
    mainWindow.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.send(
      "main-process-message",
      new Date().toLocaleString(),
    );
    logger.info("Renderer process is ready.");
  });

  // Make all links open with the browser, not with the application
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
  // win.webContents.on('will-navigate', (event, url) => { }) #344

  mainWindow.on("closed", () => {
    if (win === mainWindow) {
      win = null;
    }
  });

  mainWindow.on("close", (event) => {
    if (allowAppExit) {
      // 真正退出前同步保存最终窗口尺寸（防抖可能尚未触发）
      const { width, height, x, y } = mainWindow.getBounds();
      saveWindowState({
        width,
        height,
        x,
        y,
        maximized: mainWindow.isMaximized(),
      });
      return;
    }

    // 截获 close 默认行为
    event.preventDefault();
    applyMainWindowCloseAction();
  });
}

ipcMain.on("renderer-ready", (event, args) => {
  logger.info(
    "Received renderer-ready event with args: " + JSON.stringify(args),
  );
  isLoaded.value = args.status;
  logger.info(`isLoaded set to: ${isLoaded.value}`);
});

ipcMain.on("set-theme-source", (event, theme: "system" | "light" | "dark") => {
  nativeTheme.themeSource = theme;
});

ipcMain.on("window-control-minimize", () => {
  win?.minimize();
});

ipcMain.on("window-control-toggle-maximize", () => {
  if (!win) {
    return;
  }

  if (win.isMaximized()) {
    win.unmaximize();
    return;
  }

  win.maximize();
});

ipcMain.on("window-control-close", () => {
  win?.close();
});

// 配置文件路径
const SPARK_CONFIG_DIR = path.join(
  os.homedir(),
  ".config/spark-union/spark-store",
);
const UPDATE_CHECK_CONFIG = "ssshell-config-do-not-show-upgrade-notify";
const CREATE_DESKTOP_CONFIG = "ssshell-config-do-not-create-desktop";

// 获取安装设置
ipcMain.handle("get-install-settings", async () => {
  try {
    const result: Record<string, boolean> = {};

    // 检查更新检测配置
    result[UPDATE_CHECK_CONFIG] = fs.existsSync(
      path.join(SPARK_CONFIG_DIR, UPDATE_CHECK_CONFIG),
    );

    // 检查自动创建桌面启动器配置
    result[CREATE_DESKTOP_CONFIG] = fs.existsSync(
      path.join(SPARK_CONFIG_DIR, CREATE_DESKTOP_CONFIG),
    );

    return { success: true, data: result };
  } catch (err) {
    logger.error({ err }, "Failed to get install settings");
    return { success: false, message: (err as Error)?.message || String(err) };
  }
});

// 设置安装设置
ipcMain.handle(
  "set-install-settings",
  async (
    _event,
    settings: {
      [UPDATE_CHECK_CONFIG]?: boolean;
      [CREATE_DESKTOP_CONFIG]?: boolean;
    },
  ) => {
    try {
      // 确保配置目录存在
      if (!fs.existsSync(SPARK_CONFIG_DIR)) {
        fs.mkdirSync(SPARK_CONFIG_DIR, { recursive: true });
      }

      // 更新检测配置
      const updateCheckPath = path.join(SPARK_CONFIG_DIR, UPDATE_CHECK_CONFIG);
      if (settings[UPDATE_CHECK_CONFIG]) {
        fs.writeFileSync(updateCheckPath, "");
      } else {
        if (fs.existsSync(updateCheckPath)) {
          fs.unlinkSync(updateCheckPath);
        }
      }

      // 自动创建桌面启动器配置
      const createDesktopPath = path.join(
        SPARK_CONFIG_DIR,
        CREATE_DESKTOP_CONFIG,
      );
      if (settings[CREATE_DESKTOP_CONFIG]) {
        fs.writeFileSync(createDesktopPath, "");
      } else {
        if (fs.existsSync(createDesktopPath)) {
          fs.unlinkSync(createDesktopPath);
        }
      }

      return { success: true };
    } catch (err) {
      logger.error({ err }, "Failed to set install settings");
      return {
        success: false,
        message: (err as Error)?.message || String(err),
      };
    }
  },
);

// 检查更新
ipcMain.handle("check-for-updates", async () => {
  try {
    const { spawn } = await import("node:child_process");
    const scriptPath =
      "/opt/durapps/spark-store/bin/update-upgrade/ss-do-upgrade.sh";
    const child = spawn("systemd-run", ["--user", scriptPath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    logger.info(`Launched update check script: ${scriptPath}`);
    return { success: true };
  } catch (err) {
    logger.error({ err }, "Failed to launch update check script");
    return { success: false, message: (err as Error)?.message || String(err) };
  }
});

// 启动投稿器窗口
// Register custom protocol handlers
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("spk", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
    app.setAsDefaultProtocolClient("apt", process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  app.setAsDefaultProtocolClient("spk");
  app.setAsDefaultProtocolClient("apt");
}

app.whenReady().then(() => {
  // Set User-Agent for client
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    details.requestHeaders["User-Agent"] = getUserAgent();
    callback({ cancel: false, requestHeaders: details.requestHeaders });
  });
  createWindow();
  handleCommandLine(process.argv);
  initializeUpdateCenter();
  // 启动后执行一次遥测（仅 Linux，不阻塞）
  sendTelemetryOnce(getAppVersion());
});

app.on("window-all-closed", () => {
  win = null;
  allowAppExit = false;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  void showAndFocusMainWindow();
});

app.on("activate", () => {
  void showAndFocusMainWindow();
});

app.on("will-quit", () => {
  // Clean up temp dir
  logger.info("Cleaning up temp dir");
  fs.rmSync("/tmp/spark-store/", { recursive: true, force: true });
  logger.info("Done, exiting");
});

// 设置托盘：系统中应用名称为 spark-store，图标优先 spark-store，其次 spark-store.svg，再次替代图标
const ICONS_DIR = app.isPackaged
  ? path.join(process.resourcesPath, "icons")
  : path.join(__dirname, "../..", "icons");

function resolveIconPath(filename: string): string {
  return path.join(ICONS_DIR, filename);
}

/** 按优先级返回托盘图标路径：spark-store(.png|.ico) → amber-pm-logo.png。托盘不支持 SVG，故不尝试 spark-store.svg */
function getTrayIconPath(): string | null {
  const ext = process.platform === "win32" ? ".ico" : ".png";
  const candidates = [`spark-store${ext}`];
  for (const name of candidates) {
    const iconPath = resolveIconPath(name);
    if (fs.existsSync(iconPath)) {
      logger.info("托盘图标使用: " + iconPath);
      return iconPath;
    }
  }
  logger.warn("未找到托盘图标，将使用替代图标。查找目录: " + ICONS_DIR);
  return null;
}

/** 16x16 透明 PNG，用作托盘无图标时的替代 */
const FALLBACK_TRAY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAHklEQVQ4T2NkYGD4z0ABYBwNwMAwGoChNQAAAABJRU5ErkJggg==";

function getTrayImage():
  | string
  | ReturnType<typeof nativeImage.createFromDataURL> {
  const iconPath = getTrayIconPath();
  if (iconPath) return iconPath;
  return nativeImage.createFromDataURL(FALLBACK_TRAY_PNG);
}

let tray: Tray | null = null;
app.whenReady().then(() => {
  tray = new Tray(getTrayImage());
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "显示主界面",
      click: () => {
        void showAndFocusMainWindow();
      },
    },
    {
      label: "退出程序",
      click: () => {
        requestApplicationExit();
      },
    },
  ]);
  tray.setToolTip("星火应用商店");
  tray.setContextMenu(contextMenu);
  // 双击触发
  tray.on("click", () => {
    // 双击通知区图标实现应用的显示或隐藏
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide();
      win.setSkipTaskbar(true);
    } else {
      void showAndFocusMainWindow();
    }
  });
});

// New window example arg: new windows url
// ipcMain.handle('open-win', (_, arg) => {
//   const childWindow = new BrowserWindow({
//     webPreferences: {
//       preload,
//       nodeIntegration: true,
//       contextIsolation: false,
//     },
//   })

//   if (VITE_DEV_SERVER_URL) {
//     childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
//   } else {
//     childWindow.loadFile(indexHtml, { hash: arg })
//   }
// })
