import {
  app,
  BrowserWindow,
  dialog,
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
import https from "node:https";
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
let submitterWin: BrowserWindow | null = null;
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

async function createWindow() {
  win = new BrowserWindow({
    title: "星火应用商店",
    width: 1366,
    height: 768,
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
ipcMain.handle("launch-submitter", async () => {
  try {
    if (submitterWin && !submitterWin.isDestroyed()) {
      submitterWin.show();
      submitterWin.focus();
      return { success: true };
    }

    submitterWin = new BrowserWindow({
      title: "星火应用商店 - 投稿应用",
      width: 800,
      height: 900,
      frame: false,
      autoHideMenuBar: true,
      icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
      webPreferences: {
        preload,
      },
    });

    if (VITE_DEV_SERVER_URL) {
      submitterWin.loadURL(`${VITE_DEV_SERVER_URL}#submitter`);
    } else {
      submitterWin.loadFile(indexHtml, { hash: "submitter" });
    }

    submitterWin.on("closed", () => {
      submitterWin = null;
    });

    submitterWin.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith("https:")) shell.openExternal(url);
      return { action: "deny" };
    });

    logger.info("Submitter window opened");
    return { success: true };
  } catch (err) {
    logger.error({ err }, "Failed to open submitter window");
    return { success: false, message: (err as Error)?.message || String(err) };
  }
});

ipcMain.on("close-submitter-window", () => {
  submitterWin?.close();
});

interface DebInfo {
  pkgname: string;
  version: string;
  author: string;
  maintainer: string;
  homepage: string;
  description: string;
  architecture: string;
}

interface HistoryAppInfo {
  id: number;
  name: string;
  pkgname: string;
  version: string;
  store: string;
  author: string;
  contributor: string;
  website: string;
  category: string;
  tags: string;
  more: string;
  icon: string;
  imgs: string[];
}

ipcMain.handle("select-deb-file", async (_event) => {
  try {
    const result = await dialog.showOpenDialog({
      title: "选择 deb 安装包",
      filters: [{ name: "Debian 包", extensions: ["deb"] }],
      properties: ["openFile"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return { success: true, filePath: result.filePaths[0] };
    }

    return { success: false, message: "用户取消选择" };
  } catch (err) {
    logger.error({ err }, "Failed to select deb file");
    return { success: false, message: (err as Error)?.message || "选择文件失败" };
  }
});

ipcMain.handle("parse-deb-file", async (_event, debPath: string) => {
  try {
    logger.info({ debPath }, "[Submitter] Starting parse-deb-file handler");

    const { exec } = await import("node:child_process");
    const util = await import("util");
    const execAsync = util.promisify(exec);

    const absoluteDebPath = path.resolve(debPath);
    logger.info({ debPath, absoluteDebPath }, "[Submitter] Resolved absolute deb path");

    if (!fs.existsSync(absoluteDebPath)) {
      logger.error({ debPath, absoluteDebPath }, "[Submitter] Deb file not found");
      return { success: false, message: `文件不存在: ${absoluteDebPath}` };
    }

    logger.info({ absoluteDebPath }, "[Submitter] Deb file exists, executing dpkg-deb command");

    const { stdout, stderr } = await execAsync(
      `dpkg-deb -f "${absoluteDebPath}" Package Version Maintainer Homepage Description Architecture`,
    );

    logger.info({ stdout, stderr }, "[Submitter] dpkg-deb command executed");

    if (stderr) {
      logger.error({ stderr }, "[Submitter] dpkg-deb returned error");
      return { success: false, message: stderr };
    }

    const lines = stdout.trim().split("\n");
    logger.info({ lineCount: lines.length, rawOutput: stdout }, "[Submitter] Parsing dpkg-deb output");

    const debInfo: DebInfo = {
      pkgname: "",
      version: "",
      author: "",
      maintainer: "",
      homepage: "",
      description: "",
      architecture: "",
    };

    for (const line of lines) {
      const [key, ...valueParts] = line.split(":");
      const value = valueParts.join(":").trim();
      logger.debug({ line, key, value }, "[Submitter] Processing dpkg-deb line");

      switch (key.trim()) {
        case "Package":
          debInfo.pkgname = value.toLowerCase();
          logger.info({ pkgname: debInfo.pkgname }, "[Submitter] Found Package name");
          break;
        case "Version":
          debInfo.version = value;
          logger.info({ version: debInfo.version }, "[Submitter] Found Version");
          break;
        case "Maintainer":
          debInfo.maintainer = value;
          debInfo.author = value;
          logger.info({ maintainer: debInfo.maintainer }, "[Submitter] Found Maintainer");
          break;
        case "Homepage":
          debInfo.homepage = value;
          logger.info({ homepage: debInfo.homepage }, "[Submitter] Found Homepage");
          break;
        case "Description":
          debInfo.description = value;
          logger.info({ description: debInfo.description.substring(0, 100) + "..." }, "[Submitter] Found Description");
          break;
        case "Architecture":
          debInfo.architecture = value;
          logger.info({ architecture: debInfo.architecture }, "[Submitter] Found Architecture");
          break;
      }
    }

    logger.info({ debInfo }, "[Submitter] Deb file parsing completed successfully");

    return { success: true, data: debInfo };
  } catch (err) {
    logger.error({ err, debPath }, "[Submitter] Failed to parse deb file with exception");
    return {
      success: false,
      message: (err as Error)?.message || "解析deb文件失败",
    };
  }
});

ipcMain.handle("search-history-app", async (_event, pkgname: string, useMirror = false) => {
  try {
    const baseUrl = useMirror
      ? "https://mirrors.sdu.edu.cn/spark-store"
      : "https://spk-json.spark-app.store";
    const storeArchs = ["store", "aarch64-store", "loong64-store"];
    const categories = [
      "chat",
      "development",
      "games",
      "image_graphics",
      "music",
      "network",
      "office",
      "others",
      "reading",
      "themes",
      "tools",
      "video",
    ];
    const results: HistoryAppInfo[] = [];

    logger.info("[Submitter] ============== SEARCH HISTORY APP START ==============");
    logger.info({ pkgname, useMirror, baseUrl, storeArchs, categories }, "[Submitter] Search parameters");

    const allPromises: Promise<void>[] = [];

    for (const arch of storeArchs) {
      for (const category of categories) {
        const url = `${baseUrl}/${arch}/${category}/${pkgname}/app.json`;
        logger.info({ arch, category, url }, "[Submitter] Starting search request");

        const promise = fetch(url, {
          headers: { "User-Agent": getUserAgent() },
        })
          .then(async (response) => {
            logger.info({ arch, category, status: response.status }, "[Submitter] Fetch completed");

            if (response.ok) {
              const json = await response.json();
              logger.info({ arch, category, rawJson: JSON.stringify(json, null, 2) }, "[Submitter] Response parsed");

              const appPkgname = json?.pkgname || json?.Pkgname || json?.packageName || "";
              logger.info({ arch, category, appPkgname, searchPkgname: pkgname }, "[Submitter] Comparing pkgname");

              if (appPkgname.toLowerCase() === pkgname.toLowerCase()) {
                logger.info({ arch, category, item: json }, "[Submitter] Found matching item");

                let iconUrl = json.icons || json.icon || "";
                let imgs = json.imgUrls || json.imgs || json.img_urls || [];
                
                if (typeof imgs === "string") {
                  try {
                    imgs = JSON.parse(imgs);
                    logger.info({ arch, category, parsedImgsCount: Array.isArray(imgs) ? imgs.length : 0 }, "[Submitter] Parsed img_urls from string");
                  } catch {
                    imgs = [];
                    logger.warn({ arch, category, imgsString: imgs }, "[Submitter] Failed to parse img_urls string");
                  }
                }

                if (iconUrl && typeof iconUrl === "string") {
                  if (useMirror) {
                    iconUrl = iconUrl.replace("spk-json.spark-app.store", "mirrors.sdu.edu.cn/spark-store");
                  }
                }

                if (Array.isArray(imgs)) {
                  imgs = imgs.map((img: string) => {
                    if (useMirror && typeof img === "string") {
                      return img.replace("spk-json.spark-app.store", "mirrors.sdu.edu.cn/spark-store");
                    }
                    return img;
                  });
                }

                results.push({
                  id: json.id || json.Id || 0,
                  name: json.name || json.Name || "",
                  pkgname: json.pkgname || json.Pkgname || "",
                  version: json.version || json.Version || "",
                  store: arch,
                  author: json.author || json.Author || "",
                  contributor: json.contributor || json.Contributor || "",
                  website: json.website || json.Website || "",
                  category: category,
                  tags: json.tags || json.Tags || "",
                  more: json.more || json.More || "",
                  icon: iconUrl,
                  imgs: imgs,
                });

                logger.info({ arch, count: results.length }, "[Submitter] Added to results");
              }
            }
          })
          .catch((error) => {
            logger.warn({ arch, category, error }, "[Submitter] Request failed or exception caught");
          });

        allPromises.push(promise);
      }
    }

    await Promise.all(allPromises);

    logger.info("[Submitter] ============== SEARCH COMPLETED ==============");
    logger.info({ totalResults: results.length, results }, "[Submitter] Search results");

    return { success: true, data: results };
  } catch (err) {
    logger.error("[Submitter] ============== SEARCH FAILED ==============");
    logger.error({ errorType: (err as Error)?.name, errorMessage: (err as Error)?.message, errorStack: (err as Error)?.stack }, "[Submitter] Exception caught");
    return {
      success: false,
      message: (err as Error)?.message || "搜索历史信息失败",
    };
  }
});

ipcMain.handle("get-category-list", async () => {
  try {
    const apiUrl = "https://upload.deepinos.org.cn/api/index/getTypeList";
    logger.info("[Submitter] ============== GET CATEGORY LIST START ==============");
    logger.info({ apiUrl, userAgent: getUserAgent() }, "[Submitter] Request parameters");

    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      headers: { "User-Agent": getUserAgent() },
    });
    const endTime = Date.now();

    logger.info({ status: response.status, statusText: response.statusText, duration: endTime - startTime }, "[Submitter] Fetch completed");

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, errorBody: errorText }, "[Submitter] Request failed");
      return { success: false, message: `获取分类列表失败 (${response.status})` };
    }

    const json = await response.json();
    logger.info({ code: json?.code, msg: json?.msg, dataType: typeof json?.data, dataLength: json?.data?.length || "N/A", response: json }, "[Submitter] Response parsed");

    return { success: true, data: json };
  } catch (err) {
    logger.error({ errorType: (err as Error)?.name, errorMessage: (err as Error)?.message, errorStack: (err as Error)?.stack }, "[Submitter] Exception caught");
    return {
      success: false,
      message: (err as Error)?.message || "获取分类列表失败",
    };
  }
});

ipcMain.handle("get-tags-list", async () => {
  try {
    const apiUrl = "https://upload.deepinos.org.cn/api/index/getTagsList";
    logger.info("[Submitter] ============== GET TAGS LIST START ==============");
    logger.info({ apiUrl, userAgent: getUserAgent() }, "[Submitter] Request parameters");

    const startTime = Date.now();
    const response = await fetch(apiUrl, {
      headers: { "User-Agent": getUserAgent() },
    });
    const endTime = Date.now();

    logger.info({ status: response.status, statusText: response.statusText, duration: endTime - startTime }, "[Submitter] Fetch completed");

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, errorBody: errorText }, "[Submitter] Request failed");
      return { success: false, message: `获取标签列表失败 (${response.status})` };
    }

    const json = await response.json();
    logger.info({ code: json?.code, msg: json?.msg, dataType: typeof json?.data, dataLength: json?.data?.length || "N/A", response: json }, "[Submitter] Response parsed");

    return { success: true, data: json };
  } catch (err) {
    logger.error({ errorType: (err as Error)?.name, errorMessage: (err as Error)?.message, errorStack: (err as Error)?.stack }, "[Submitter] Exception caught");
    return {
      success: false,
      message: (err as Error)?.message || "获取标签列表失败",
    };
  }
});

interface OssUploadMetadata {
  code: number;
  msg: string;
  data: {
    dir: string;
    host: string;
    ossAccessKeyId: string;
    policy: string;
    signature: string;
  };
}

const categoryNameToIdMap: Record<string, number> = {
  "影音播放": 1,
  "图形图像": 2,
  "系统工具": 3,
  "办公学习": 4,
  "网络通讯": 5,
  "游戏娱乐": 6,
  "开发工具": 7,
  "科学计算": 8,
  "编程开发": 9,
  "系统软件": 10,
  "桌面环境": 11,
  "主题美化": 12,
  "网络工具": 13,
  "办公软件": 14,
  "教育学习": 15,
  "影音图像": 16,
  "实用工具": 17,
  "游戏": 18,
  "其他": 19,
};

function getCategoryIdByName(categoryName: string): number {
  return categoryNameToIdMap[categoryName] || 1;
}

function generateUUID(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}-${Math.random().toString(36).substr(2, 9)}`;
}

function getUUIDFileNameSuggestIcoPic(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const uuid = generateUUID();
  return `${uuid}${ext}`;
}

function getUUIDFileNameSuggestDeb(filePath: string): string {
  const fileName = path.basename(filePath).replace(/\s+/g, "_plus_");
  const ext = path.extname(fileName).toLowerCase();
  const nameWithoutExt = path.basename(fileName, ext);
  const uuid = generateUUID().substring(0, 8);
  return `${nameWithoutExt}_${uuid}${ext}`;
}

async function getOssUploadMetadata(type: "icons" | "pic" | "deb"): Promise<OssUploadMetadata> {
  const startTime = Date.now();
  const pathMap: Record<string, string> = {
    icons: "upload_icons",
    pic: "upload_pic",
    deb: "upload_deb",
  };
  const url = `https://upload.deepinos.org.cn/api/index/${pathMap[type]}`;
  logger.info(`[Submitter] ============== GET OSS METADATA START (${type}) ==============`);
  logger.info({ url, timestamp: new Date().toISOString() }, `[Submitter] Getting OSS metadata for ${type}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": getUserAgent(),
    },
  });

  const duration = Date.now() - startTime;
  logger.info({ status: response.status, statusText: response.statusText, duration }, `[Submitter] OSS metadata response for ${type}`);

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ errorText }, `[Submitter] Failed to get OSS metadata for ${type}`);
    throw new Error(`获取 ${type} 上传签名失败: ${response.status} - ${errorText.substring(0, 200)}`);
  }

  const responseText = await response.text();
  logger.info({ responseTextLength: responseText.length, responseText: responseText.substring(0, 1000) }, `[Submitter] Raw OSS metadata response for ${type}`);

  let result: unknown;
  try {
    result = JSON.parse(responseText);
    logger.info({ resultType: typeof result, resultKeys: typeof result === "object" && result !== null ? Object.keys(result as object) : [] }, `[Submitter] Parsed OSS metadata result type for ${type}`);
  } catch (parseError) {
    logger.error({ parseError: (parseError as Error)?.message }, `[Submitter] Failed to parse OSS metadata response for ${type}`);
    throw new Error(`解析 ${type} 上传签名响应失败: ${(parseError as Error)?.message}`);
  }

  if (typeof result !== "object" || result === null) {
    logger.error({ result }, `[Submitter] OSS metadata response is not an object for ${type}`);
    throw new Error(`${type} 上传签名响应格式错误`);
  }

  const resultObj = result as Record<string, unknown>;
  if (resultObj.data === undefined || resultObj.data === null) {
    logger.error({ result }, `[Submitter] OSS metadata response data field is undefined for ${type}`);
    throw new Error(`${type} 上传签名响应缺少 data 字段`);
  }

  const dataObj = resultObj.data as Record<string, unknown>;
  if (!dataObj.host || !dataObj.dir) {
    logger.error({ data: resultObj.data }, `[Submitter] OSS metadata response data missing host or dir for ${type}`);
    throw new Error(`${type} 上传签名响应 data 字段缺少 host 或 dir`);
  }

  const ossMetadata: OssUploadMetadata = {
    code: Number(resultObj.code) || 0,
    msg: String(resultObj.msg || ""),
    data: {
      dir: String(dataObj.dir),
      host: String(dataObj.host),
      ossAccessKeyId: String(dataObj.OSSAccessKeyId || dataObj.ossAccessKeyId || dataObj.oss_access_key_id || ""),
      policy: String(dataObj.policy || ""),
      signature: String(dataObj.signature || ""),
    },
  };

  logger.info(`[Submitter] ============== OSS METADATA RECEIVED (${type}) ==============`);
  logger.info({ code: ossMetadata.code, msg: ossMetadata.msg }, `[Submitter] OSS metadata result for ${type}`);
  logger.info({ host: ossMetadata.data.host, dir: ossMetadata.data.dir }, `[Submitter] OSS upload host and dir for ${type}`);
  logger.info({ ossAccessKeyIdLength: ossMetadata.data.ossAccessKeyId.length, policyLength: ossMetadata.data.policy.length, signatureLength: ossMetadata.data.signature.length }, `[Submitter] OSS credential lengths for ${type}`);

  return ossMetadata;
}

type UploadProgressCallback = (progress: number, fileType: string) => void;

async function uploadFileToOss(
  metadata: OssUploadMetadata,
  filePath: string,
  fileName: string,
  mimeType: string,
  fileType: string,
  progressCallback?: UploadProgressCallback
): Promise<string> {
  const startTime = Date.now();
  const { host, dir, ossAccessKeyId, policy, signature } = metadata.data;
  const uploadUrl = host;
  const objectKey = `${dir}${fileName}`;

  logger.info(`[Submitter] ============== UPLOAD FILE START (${fileType}) ==============`);
  logger.info({ uploadUrl, objectKey, filePath, fileName, mimeType, timestamp: new Date().toISOString() }, `[Submitter] Starting upload for ${fileType}`);

  const fileStat = fs.statSync(filePath);
  const fileSize = fileStat.size;
  logger.info({ fileSize, fileSizeHuman: `${(fileSize / 1024 / 1024).toFixed(2)} MB` }, `[Submitter] File size for ${fileType}`);

  const fileBuffer = fs.readFileSync(filePath);
  logger.info({ bufferSize: fileBuffer.length }, `[Submitter] File buffer ready for ${fileType}`);

  const boundary = `----SparkStoreUploadBoundary${Date.now().toString(36)}`;
  const CRLF = Buffer.from("\r\n", "ascii");
  
  const encodeField = (str: string) => Buffer.from(str, "utf8");
  
  const headerBuffers: Buffer[] = [];
  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(encodeField(`Content-Disposition: form-data; name="key"\r\n\r\n`));
  headerBuffers.push(encodeField(objectKey));
  headerBuffers.push(CRLF);
  
  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(encodeField(`Content-Disposition: form-data; name="ossAccessKeyId"\r\n\r\n`));
  headerBuffers.push(encodeField(ossAccessKeyId));
  headerBuffers.push(CRLF);
  
  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(encodeField(`Content-Disposition: form-data; name="policy"\r\n\r\n`));
  headerBuffers.push(encodeField(policy));
  headerBuffers.push(CRLF);
  
  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(encodeField(`Content-Disposition: form-data; name="signature"\r\n\r\n`));
  headerBuffers.push(encodeField(signature));
  headerBuffers.push(CRLF);
  
  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(encodeField(`Content-Disposition: form-data; name="success_action_status"\r\n\r\n`));
  headerBuffers.push(encodeField("200"));
  headerBuffers.push(CRLF);
  
  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(encodeField(`Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`));
  headerBuffers.push(encodeField(`Content-Type: ${mimeType}\r\n\r\n`));
  
  const formHeaderBuffer = Buffer.concat(headerBuffers);
  const formFooterBuffer = Buffer.concat([CRLF, encodeField(`--${boundary}--\r\n`)]);
  const totalLength = formHeaderBuffer.length + fileBuffer.length + formFooterBuffer.length;
  
  logger.info({ formHeaderLength: formHeaderBuffer.length, formFooterLength: formFooterBuffer.length, totalLength, fileSize }, `[Submitter] Form lengths for ${fileType}`);

  return new Promise((resolve, reject) => {
    const url = new URL(uploadUrl);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port ? parseInt(url.port) : 443,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "User-Agent": getUserAgent(),
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": totalLength,
      },
    };

    logger.info(`[Submitter] ============== SENDING UPLOAD REQUEST (${fileType}) ==============`);
    
    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", () => {
        const duration = Date.now() - startTime;
        logger.info(`[Submitter] ============== UPLOAD RESPONSE RECEIVED (${fileType}) ==============`);
        logger.info({ status: res.statusCode, duration }, `[Submitter] Upload response for ${fileType}`);
        logger.info({ responseHeaders: res.headers }, `[Submitter] Response headers for ${fileType}`);
        logger.info({ responseBody: responseData.substring(0, 1000) }, `[Submitter] Response body for ${fileType}`);

        if (res.statusCode !== 200) {
          logger.error({ errorText: responseData.substring(0, 500) }, `[Submitter] Upload failed for ${fileType}`);
          reject(new Error(`${fileType} 上传失败: ${res.statusCode} - ${responseData.substring(0, 500)}`));
          return;
        }

        const finalUrl = `${host}${objectKey}`;
        logger.info({ finalUrl }, `[Submitter] ${fileType} upload successful, URL: ${finalUrl}`);
        resolve(finalUrl);
      });
    });

    req.on("error", (err) => {
      logger.error({ err }, `[Submitter] Upload request error for ${fileType}`);
      reject(new Error(`${fileType} 上传失败: ${err.message}`));
    });

    req.write(formHeaderBuffer);
    
    let uploadedBytes = formHeaderBuffer.length;
    
    const chunkSize = 1024 * 1024;
    for (let offset = 0; offset < fileBuffer.length; offset += chunkSize) {
      const chunk = fileBuffer.slice(offset, Math.min(offset + chunkSize, fileBuffer.length));
      req.write(chunk);
      uploadedBytes += chunk.length;
      
      if (progressCallback) {
        const progress = Math.min((uploadedBytes / totalLength) * 100, 100);
        progressCallback(progress, fileType);
      }
    }
    
    req.write(formFooterBuffer);
    req.end();
  });
}

ipcMain.handle("submit-app", async (event, formData: unknown) => {
  try {
    const startTime = Date.now();
    logger.info("[Submitter] ============== SUBMIT APP START ==============");
    logger.info({ timestamp: new Date().toISOString() }, "[Submitter] Submission started at");

    if (typeof formData !== "object" || formData === null) {
      logger.error("[Submitter] Form data is not an object");
      return { success: false, message: "表单数据格式错误" };
    }

    const dataObj = formData as Record<string, unknown>;
    logger.info("[Submitter] ============== FORM DATA RECEIVED ==============");
    logger.info({ name: dataObj.name }, "[Submitter] App name");
    logger.info({ pkgname: dataObj.pkgname }, "[Submitter] Package name");
    logger.info({ version: dataObj.version }, "[Submitter] Version");
    logger.info({ author: dataObj.author }, "[Submitter] Author");
    logger.info({ contributor: dataObj.contributor }, "[Submitter] Contributor");
    logger.info({ website: dataObj.website }, "[Submitter] Website");
    logger.info({ debFilePath: dataObj.debFilePath }, "[Submitter] Deb file path");
    logger.info({ iconPath: dataObj.iconPath }, "[Submitter] Icon path");
    logger.info({ category: dataObj.category }, "[Submitter] Category");
    logger.info({ tags: dataObj.tags }, "[Submitter] Tags");
    logger.info({ descriptionLength: typeof dataObj.description === "string" ? dataObj.description.length : 0 }, "[Submitter] Description length");
    logger.info({ screenshotsCount: Array.isArray(dataObj.screenshots) ? dataObj.screenshots.length : 0 }, "[Submitter] Screenshots count");

    const debFilePath = String(dataObj.debFilePath || "");
    const iconPath = String(dataObj.iconPath || "");
    const screenshots = Array.isArray(dataObj.screenshots) ? dataObj.screenshots : [];

    if (!debFilePath) {
      logger.error("[Submitter] Deb file path is empty");
      return { success: false, message: "请选择 deb 文件" };
    }

    if (!fs.existsSync(debFilePath)) {
      logger.error({ debFilePath }, "[Submitter] Deb file does not exist");
      return { success: false, message: `deb 文件不存在: ${debFilePath}` };
    }

    const sendUploadProgress = (step: string, progress: number, message: string) => {
      event.sender.send("submit-upload-progress", { step, progress, message });
    };

    let iconUrl = "";
    if (iconPath) {
      if (iconPath.startsWith("http://") || iconPath.startsWith("https://")) {
        logger.info({ iconPath }, "[Submitter] Icon is a remote URL, skipping upload");
        iconUrl = iconPath;
      } else if (fs.existsSync(iconPath)) {
        logger.info("[Submitter] ============== STEP 1: UPLOAD ICON ==============");
        const iconMetadata = await getOssUploadMetadata("icons");
        const iconFileName = getUUIDFileNameSuggestIcoPic(iconPath);
        sendUploadProgress("icon", 0, "正在上传图标...");
        iconUrl = await uploadFileToOss(iconMetadata, iconPath, iconFileName, "image/png", "icon", (progress) => {
          sendUploadProgress("icon", progress, `正在上传图标... ${Math.floor(progress)}%`);
        });
        sendUploadProgress("icon", 100, "图标上传完成");
        logger.info({ iconUrl }, "[Submitter] Icon upload completed");
      } else {
        logger.error({ iconPath }, "[Submitter] Icon file does not exist");
        return { success: false, message: `图标文件不存在: ${iconPath}` };
      }
    }

    const screenshotUrls: string[] = [];
    for (let i = 0; i < screenshots.length; i++) {
      const screenshot = screenshots[i];
      logger.info({ index: i, screenshot }, "[Submitter] Processing screenshot");

      if (typeof screenshot === "string") {
        if (screenshot.startsWith("http://") || screenshot.startsWith("https://")) {
          logger.info({ screenshot }, "[Submitter] Screenshot is a remote URL, skipping upload");
          screenshotUrls.push(screenshot);
        } else if (fs.existsSync(screenshot)) {
          logger.info(`[Submitter] ============== STEP 2: UPLOAD SCREENSHOT ${i + 1} ==============`);
          const picMetadata = await getOssUploadMetadata("pic");
          const picFileName = getUUIDFileNameSuggestIcoPic(screenshot);
          sendUploadProgress(`screenshot-${i}`, 0, `正在上传截图 ${i + 1}...`);
          const picUrl = await uploadFileToOss(picMetadata, screenshot, picFileName, "image/png", `screenshot ${i + 1}`, (progress) => {
            sendUploadProgress(`screenshot-${i}`, progress, `正在上传截图 ${i + 1}... ${Math.floor(progress)}%`);
          });
          sendUploadProgress(`screenshot-${i}`, 100, `截图 ${i + 1} 上传完成`);
          screenshotUrls.push(picUrl);
          logger.info({ picUrl }, `[Submitter] Screenshot ${i + 1} upload completed`);
        } else {
          logger.warn({ screenshot }, "[Submitter] Screenshot file does not exist, skipping");
        }
      }
    }

    logger.info("[Submitter] ============== STEP 3: UPLOAD DEB ==============");
    logger.info({ debFilePath, debFileName: getUUIDFileNameSuggestDeb(debFilePath) }, "[Submitter] Starting deb upload");
    const debMetadata = await getOssUploadMetadata("deb");
    const debFileName = getUUIDFileNameSuggestDeb(debFilePath);
    sendUploadProgress("deb", 0, "正在上传安装包...");
    const debUrl = await uploadFileToOss(debMetadata, debFilePath, debFileName, "application/vnd.debian.binary-package", "deb", (progress) => {
      sendUploadProgress("deb", progress, `正在上传安装包... ${Math.floor(progress)}%`);
    });
    sendUploadProgress("deb", 100, "安装包上传完成");
    logger.info("[Submitter] ============== DEB UPLOAD SUCCESSFUL ==============");
    logger.info({ debUrl, debFileName }, "[Submitter] Deb upload completed successfully");

    logger.info("[Submitter] ============== STEP 4: SUBMIT APPLICATION ==============");

    const debFileStat = fs.statSync(debFilePath);

    const categoryName = String(dataObj.category || "");
    const categoryId = getCategoryIdByName(categoryName);
    logger.info({ categoryName, categoryId }, "[Submitter] Category name and ID");

    const tagsString = String(dataObj.tags || "");
    const tagsArray = tagsString ? tagsString.split(";").map((t: string) => t.trim()).filter((t: string) => t) : [];
    logger.info({ tagsString, tagsArray }, "[Submitter] Tags conversion");

    const submitData = {
      application_name: String(dataObj.name || ""),
      application_name_zh: String(dataObj.name || ""),
      contributor: String(dataObj.contributor || ""),
      icons: iconUrl,
      size: debFileStat.size,
      file_name: path.basename(debFilePath).replace(/\s+/g, "_plus_"),
      website: String(dataObj.website || ""),
      version: String(dataObj.version || ""),
      more: String(dataObj.description || ""),
      type_id: categoryId,
      author: String(dataObj.author || ""),
      remark: (dataObj.remark as string || "") + " - (来自于投稿器_v" + getAppVersion() + ")",
      img_urls: screenshotUrls,
      deb_url: debUrl,
      mail: String(dataObj.mail || dataObj.contributor || ""),
      tags: tagsArray,
    };

    logger.info("[Submitter] ============== VALIDATING SUBMISSION DATA ==============");
    const requiredFields = ["application_name", "application_name_zh", "contributor", "icons", "size", "file_name", "version", "type_id", "author", "deb_url"];
    const missingFields = requiredFields.filter((field) => !submitData[field as keyof typeof submitData]);
    if (missingFields.length > 0) {
      logger.error({ missingFields }, "[Submitter] Missing required fields");
    }

    logger.info("[Submitter] ============== PREPARING SUBMISSION REQUEST ==============");
    logger.info({ submitData }, "[Submitter] Final submission data");

    const submitterApiUrl = "https://upload.deepinos.org.cn/api/index/upload_application";
    logger.info({ submitterApiUrl }, "[Submitter] Submission API URL");

    logger.info("[Submitter] ============== SENDING SUBMISSION REQUEST ==============");
    logger.info({ submitterApiUrl, timestamp: new Date().toISOString() }, "[Submitter] Submission request sent to API");

    const response = await fetch(submitterApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": getUserAgent(),
      },
      body: JSON.stringify(submitData),
    });

    const requestDuration = Date.now() - startTime;
    logger.info("[Submitter] ============== SUBMISSION RESPONSE RECEIVED ==============");
    logger.info({ status: response.status, statusText: response.statusText }, "[Submitter] Submission response status");
    logger.info({ duration: requestDuration }, "[Submitter] Total submission duration (ms)");

    const responseText = await response.text();
    logger.info({ responseTextLength: responseText.length }, "[Submitter] Submission response text length");

    if (!response.ok) {
      logger.error("[Submitter] ============== SUBMISSION FAILED ==============");
      logger.error({ status: response.status, statusText: response.statusText }, "[Submitter] Submission failed with status");
      logger.error({ responseText: responseText.substring(0, 2000) }, "[Submitter] Submission API error response (full)");

      let message = "提交失败";
      let apiResponse: unknown = null;

      try {
        apiResponse = JSON.parse(responseText);
        logger.error({ apiResponse }, "[Submitter] Parsed API error response");
      } catch (parseError) {
        logger.warn({ parseError: (parseError as Error)?.message }, "[Submitter] Failed to parse error response as JSON");
      }

      if (response.status === 521) {
        message = "服务器暂时不可用，请稍后重试";
      } else if (response.status === 400) {
        if (typeof apiResponse === "object" && apiResponse !== null) {
          const errorObj = apiResponse as Record<string, unknown>;
          message = String(errorObj.msg || errorObj.message || "请求参数错误");
        } else {
          message = responseText.substring(0, 200) || "请求参数错误";
        }
      } else if (response.status === 401) {
        message = "未授权，请登录后再试";
      } else if (response.status === 403) {
        message = "权限不足";
      } else if (response.status === 429) {
        message = "请求过于频繁，请稍后重试";
      } else {
        message = `提交失败 [${response.status}]: ${responseText.substring(0, 200)}`;
      }

      logger.error({ finalMessage: message }, "[Submitter] Final error message to user");
      return { success: false, message, apiResponse };
    }

    let result: unknown;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      logger.warn({ parseError: (parseError as Error)?.message }, "[Submitter] Failed to parse success response as JSON");
      result = responseText;
    }

    logger.info("[Submitter] ============== SUBMISSION SUCCESSFUL ==============");
    logger.info({ result }, "[Submitter] Submission API response content");
    logger.info({ duration: requestDuration }, "[Submitter] Total duration (ms)");

    return { success: true, data: result };
  } catch (err) {
    logger.error("[Submitter] ============== EXCEPTION CAUGHT ==============");
    logger.error({ errorType: (err as Error)?.name }, "[Submitter] Error type");
    logger.error({ errorMessage: (err as Error)?.message }, "[Submitter] Error message");
    logger.error({ errorStack: (err as Error)?.stack }, "[Submitter] Error stack");

    return { success: false, message: (err as Error)?.message || "提交失败" };
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
