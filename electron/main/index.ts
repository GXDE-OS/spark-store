import {
  app,
  BrowserWindow,
  ipcMain,
  Menu,
  nativeImage,
  shell,
  Tray,
  nativeTheme,
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

const logger = pino({ name: "index.ts" });

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

logger.info("User Agent: " + getUserAgent());

/** 根据启动参数 --no-apm / --no-spark 决定只展示的来源 */
function getStoreFilterFromArgv(): "spark" | "apm" | "both" {
  if (process.arch === "loong64") {
    // Currently loong64 only have spark support
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

ipcMain.handle("get-app-version", (): string => getAppVersion());

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

async function createWindow() {
  win = new BrowserWindow({
    title: "星火应用商店",
    width: 1366,
    height: 768,
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

  if (VITE_DEV_SERVER_URL) {
    // #298
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
    logger.info("Renderer process is ready.");
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });
  // win.webContents.on('will-navigate', (event, url) => { }) #344

  win.on("close", (event) => {
    if (allowAppExit) {
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
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
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
        win.show();
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
    if (win.isVisible()) {
      win.hide();
      win.setSkipTaskbar(true);
    } else {
      win.show();
      win.setSkipTaskbar(false);
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
