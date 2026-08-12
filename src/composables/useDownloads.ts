/**
 * useDownloads —— 下载队列控制与安装触发。
 *
 * 从原 App.vue 原样搬移（pendingDownloadRecords / onDetailInstall /
 * handleInstallCompleteForDownloadRecord / onDetailRemove / onDetailFavorite /
 * pauseDownload / resumeDownload / cancelDownload / retryDownload /
 * clearCompletedDownloads / showDownloadDetailModalFunc / closeDownloadDetail /
 * openDownloadedApp / installCompleteCallback / watchDownloadsChange 注册），逻辑零改动。
 *
 * 共享状态来自 useAppState；handleInstall / handleRetry 来自 modules/processInstall；
 * openFavoriteSelector 来自 useFavorites。
 */
import type {
  App,
  DownloadItem,
  DownloadResult,
  DownloadedAppRecord,
} from "../global/typedefinition";
import type { IpcRendererEvent } from "electron";
import {
  downloads,
  currentDownload,
  showDownloadDetailModal,
  currentApp,
} from "./useAppState";
import { handleInstall, handleRetry } from "../modules/processInstall";
import { watchDownloadsChange } from "../global/downloadStatus";
import { buildFavoriteAppKey, parsePackageArch } from "../modules/appIdentity";
import { openFavoriteSelector } from "./useFavorites";
import { recordDownloadedApp } from "../modules/backendApi";
import { isLoggedIn, currentUser } from "../global/authState";

interface PendingDownloadRecord {
  userId: number;
  appKey: string;
  pkgname: string;
  name: string;
  category: string;
  selectedOrigin: "spark" | "apm";
  version: string;
  packageArch: string;
}

const pendingDownloadRecords = new Map<number, PendingDownloadRecord>();

const onDetailInstall = async (app: App) => {
  const initiatingUserId = currentUser.value?.id ?? null;
  const download = await handleInstall(app);
  if (
    !download ||
    initiatingUserId === null ||
    !isLoggedIn.value ||
    currentUser.value?.id !== initiatingUserId
  ) {
    return;
  }

  pendingDownloadRecords.set(download.id, {
    userId: initiatingUserId,
    appKey: buildFavoriteAppKey(app),
    pkgname: app.pkgname,
    name: app.name,
    category: app.category,
    selectedOrigin: app.origin,
    version: app.version,
    packageArch: app.arch || parsePackageArch(app.filename),
  });
};

const handleInstallCompleteForDownloadRecord = async (
  _event: IpcRendererEvent,
  result: DownloadResult,
) => {
  const pendingRecord = pendingDownloadRecords.get(result.id);
  if (!pendingRecord) return;

  if (result.success) {
    pendingDownloadRecords.delete(result.id);
  }

  if (
    !result.success ||
    !isLoggedIn.value ||
    currentUser.value?.id !== pendingRecord.userId
  ) {
    return;
  }

  const downloadRecord: Omit<DownloadedAppRecord, "id" | "downloadedAt"> = {
    appKey: pendingRecord.appKey,
    pkgname: pendingRecord.pkgname,
    name: pendingRecord.name,
    category: pendingRecord.category,
    selectedOrigin: pendingRecord.selectedOrigin,
    version: pendingRecord.version,
    packageArch: pendingRecord.packageArch,
  };

  try {
    await recordDownloadedApp(downloadRecord);
  } catch (error: unknown) {
    console.warn({ err: error }, "记录下载应用失败");
  }
};

const onDetailRemove = (app: App) => {
  requestUninstallRef(app);
};

const onDetailFavorite = async (app: App) => {
  await openFavoriteSelector(app);
};

// TODO: 目前 APM 商店不能暂停下载
const pauseDownload = (id: DownloadItem) => {
  const download = downloads.value.find((d) => d.id === id.id);
  if (download && download.status === "installing") {
    // 'installing' matches type definition, previously 'downloading'
    download.status = "paused";
    download.logs.push({
      time: Date.now(),
      message: "下载已暂停",
    });
  }
};

// TODO: 同理，暂未实现
const resumeDownload = (id: DownloadItem) => {
  const download = downloads.value.find((d) => d.id === id.id);
  if (download && download.status === "paused") {
    download.status = "installing"; // previously 'downloading'
    download.logs.push({
      time: Date.now(),
      message: "继续下载...",
    });
    // simulateDownload(download); // removed or undefined?
  }
};

const cancelDownload = (id: DownloadItem) => {
  const index = downloads.value.findIndex((d) => d.id === id.id);
  if (index !== -1) {
    const download = downloads.value[index];
    // 发送到主进程取消
    window.ipcRenderer.send("cancel-install", download.id);

    download.status = "failed";
    download.logs.push({
      time: Date.now(),
      message: "下载已取消",
    });
    // 保留在队列中以便用户可以重试或查看日志
  }
};

const retryDownload = (id: DownloadItem) => {
  const download = downloads.value.find((d) => d.id === id.id);
  if (download && download.status === "failed") {
    download.status = "queued";
    download.progress = 0;
    download.downloadedSize = 0;
    download.logs.push({
      time: Date.now(),
      message: "重新开始下载...",
    });
    handleRetry(download);
  }
};

const clearCompletedDownloads = () => {
  downloads.value = downloads.value.filter((d) => d.status !== "completed");
};

const showDownloadDetailModalFunc = (download: DownloadItem) => {
  currentDownload.value = download;
  showDownloadDetailModal.value = true;
};

const closeDownloadDetail = () => {
  showDownloadDetailModal.value = false;
  currentDownload.value = null;
};

const openDownloadedApp = (pkgname: string, origin?: "spark" | "apm") => {
  // const encodedPkg = encodeURIComponent(download.pkgname);
  // openApmStoreUrl(`apmstore://launch?pkg=${encodedPkg}`, {
  //   fallbackText: `打开应用: ${download.pkgname}`
  // });
  window.ipcRenderer
    .invoke("launch-app", { pkgname, origin })
    .catch((err) => console.error("启动应用失败 (launch-app):", err));
};

const installCompleteCallback = (pkgname?: string) => {
  if (currentApp.value && (!pkgname || currentApp.value.pkgname === pkgname)) {
    checkAppInstalledRef(currentApp.value);
  }
};

watchDownloadsChange(installCompleteCallback);

// checkAppInstalled 由 useAppDetail 持有，通过注入引用获取，避免循环依赖
let checkAppInstalledRef: (app: App) => void = () => undefined;
export const registerCheckAppInstalled = (fn: (app: App) => void) => {
  checkAppInstalledRef = fn;
};
// requestUninstall 由 useInstalledApps 持有，通过注入引用获取，避免循环依赖
let requestUninstallRef: (app: App) => void = () => undefined;
export const registerRequestUninstall = (fn: (app: App) => void) => {
  requestUninstallRef = fn;
};
// 登出时清空待下载记录（原 App.vue logout 中的 pendingDownloadRecords.clear()）
export const clearPendingDownloadRecords = (): void => {
  pendingDownloadRecords.clear();
};

// onDetailInstall 需要被 useFavorites / useAccountSync 调用，此处导出
export {
  pendingDownloadRecords,
  onDetailInstall,
  handleInstallCompleteForDownloadRecord,
  onDetailRemove,
  onDetailFavorite,
  pauseDownload,
  resumeDownload,
  cancelDownload,
  retryDownload,
  clearCompletedDownloads,
  showDownloadDetailModalFunc,
  closeDownloadDetail,
  openDownloadedApp,
  installCompleteCallback,
};
