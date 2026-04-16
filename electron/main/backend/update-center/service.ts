import { BrowserWindow } from "electron";
import {
  IGNORE_CONFIG_PATH,
  applyIgnoredEntries,
  createIgnoreKey,
  loadIgnoredEntries,
  saveIgnoredEntries,
  sortIgnoredItems,
} from "./ignore-config";
import {
  createUpdateCenterQueue,
  type UpdateCenterQueueSnapshot,
} from "./queue";
import type { UpdateCenterItem, UpdateSource } from "./types";

export type StoreFilter = "spark" | "apm" | "both";

export interface UpdateCenterLoadedItems {
  items: UpdateCenterItem[];
  warnings: string[];
}

export interface UpdateCenterServiceItem {
  taskKey: string;
  packageName: string;
  displayName: string;
  currentVersion: string;
  newVersion: string;
  source: UpdateSource;
  localIcon?: string;
  remoteIcon?: string;
  ignored?: boolean;
  downloadUrl?: string;
  fileName?: string;
  size?: number;
  sha512?: string;
  isMigration?: boolean;
  migrationSource?: UpdateSource;
  migrationTarget?: UpdateSource;
  aptssVersion?: string;
}

export interface UpdateCenterServiceTask {
  taskKey: string;
  packageName: string;
  source: UpdateSource;
  localIcon?: string;
  remoteIcon?: string;
  status: UpdateCenterQueueSnapshot["tasks"][number]["status"];
  progress: number;
  logs: UpdateCenterQueueSnapshot["tasks"][number]["logs"];
  errorMessage: string;
}

export interface UpdateCenterServiceState {
  items: UpdateCenterServiceItem[];
  tasks: UpdateCenterServiceTask[];
  warnings: string[];
  hasRunningTasks: boolean;
}

export interface UpdateCenterIgnorePayload {
  packageName: string;
  newVersion: string;
}

export interface UpdateCenterStartTask {
  taskKey: string;
  id: number;
}

export interface UpdateCenterService {
  open: (storeFilter?: StoreFilter) => Promise<UpdateCenterServiceState>;
  refresh: (storeFilter?: StoreFilter) => Promise<UpdateCenterServiceState>;
  ignore: (payload: UpdateCenterIgnorePayload) => Promise<void>;
  unignore: (payload: UpdateCenterIgnorePayload) => Promise<void>;
  start: (tasks: UpdateCenterStartTask[]) => Promise<void>;
  cancel: (taskKey: string) => Promise<void>;
  getState: () => UpdateCenterServiceState;
  subscribe: (
    listener: (snapshot: UpdateCenterServiceState) => void,
  ) => () => void;
}

export interface CreateUpdateCenterServiceOptions {
  loadItems: (
    storeFilter: StoreFilter,
  ) => Promise<UpdateCenterItem[] | UpdateCenterLoadedItems>;
  loadIgnoredEntries?: () => Promise<Set<string>>;
  saveIgnoredEntries?: (entries: ReadonlySet<string>) => Promise<void>;
}

const getTaskKey = (
  item: Pick<UpdateCenterItem, "pkgname" | "source">,
): string => `${item.source}:${item.pkgname}`;

const toState = (
  snapshot: UpdateCenterQueueSnapshot,
): UpdateCenterServiceState => ({
  items: snapshot.items.map((item) => ({
    taskKey: getTaskKey(item),
    packageName: item.pkgname,
    displayName: item.name || item.pkgname,
    currentVersion: item.currentVersion,
    newVersion: item.nextVersion,
    source: item.source,
    localIcon: item.localIcon,
    remoteIcon: item.remoteIcon,
    ignored: item.ignored,
    downloadUrl: item.downloadUrl,
    fileName: item.fileName,
    size: item.size,
    sha512: item.sha512,
    isMigration: item.isMigration,
    migrationSource: item.migrationSource,
    migrationTarget: item.migrationTarget,
    aptssVersion: item.aptssVersion,
  })),
  tasks: [], // 不再展示任务日志
  warnings: [...snapshot.warnings],
  hasRunningTasks: false, // 任务不在更新中心执行
});

const normalizeLoadedItems = (
  loaded: UpdateCenterItem[] | UpdateCenterLoadedItems,
): UpdateCenterLoadedItems => {
  if (Array.isArray(loaded)) {
    return { items: loaded, warnings: [] };
  }

  return {
    items: loaded.items,
    warnings: loaded.warnings,
  };
};

export const createUpdateCenterService = (
  options: CreateUpdateCenterServiceOptions,
): UpdateCenterService => {
  const queue = createUpdateCenterQueue();
  const listeners = new Set<(snapshot: UpdateCenterServiceState) => void>();
  let currentStoreFilter: StoreFilter = "both";
  const loadIgnored =
    options.loadIgnoredEntries ??
    (() => loadIgnoredEntries(IGNORE_CONFIG_PATH));
  const saveIgnored =
    options.saveIgnoredEntries ??
    ((entries: ReadonlySet<string>) =>
      saveIgnoredEntries(IGNORE_CONFIG_PATH, entries));

  const applyWarning = (message: string): void => {
    queue.finishRefresh([message]);
  };

  const getState = (): UpdateCenterServiceState => toState(queue.getSnapshot());

  const emit = (): UpdateCenterServiceState => {
    const snapshot = getState();
    listeners.forEach((listener) => {
      listener(snapshot);
    });
    return snapshot;
  };

  const refresh = async (
    storeFilter: StoreFilter = currentStoreFilter,
  ): Promise<UpdateCenterServiceState> => {
    currentStoreFilter = storeFilter;
    queue.startRefresh();
    emit();

    try {
      const ignoredEntries = await loadIgnored();
      const loadedItems = normalizeLoadedItems(
        await options.loadItems(currentStoreFilter),
      );
      const items = sortIgnoredItems(
        applyIgnoredEntries(loadedItems.items, ignoredEntries),
      );
      queue.setItems(items);
      queue.finishRefresh(loadedItems.warnings);
      return emit();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      queue.setItems([]);
      applyWarning(message);
      return emit();
    }
  };

  return {
    open: refresh,
    refresh,
    async ignore(payload) {
      const entries = await loadIgnored();
      entries.add(createIgnoreKey(payload.packageName, payload.newVersion));
      await saveIgnored(entries);
      await refresh();
    },
    async unignore(payload) {
      const entries = await loadIgnored();
      entries.delete(createIgnoreKey(payload.packageName, payload.newVersion));
      await saveIgnored(entries);
      await refresh();
    },
    async start(tasks) {
      const snapshot = queue.getSnapshot();
      const taskIdByKey = new Map(tasks.map((task) => [task.taskKey, task.id]));
      const selectedItems = snapshot.items.filter(
        (item) => taskIdByKey.has(getTaskKey(item)) && !item.ignored,
      );

      if (selectedItems.length === 0) {
        return;
      }

      // 获取主窗口的 webContents
      const mainWindow = BrowserWindow.getAllWindows()[0];
      const webContents = mainWindow?.webContents;

      if (!webContents) {
        console.error("No main window found");
        return;
      }

      // 获取当前 items
      let currentItems = snapshot.items;

      for (const item of selectedItems) {
        const updateTaskId = taskIdByKey.get(getTaskKey(item));
        if (!updateTaskId) {
          continue;
        }

        // 构建 metalink URL
        const metalinkUrl = item.downloadUrl
          ? `${item.downloadUrl}.metalink`
          : undefined;

        // 发送到主下载队列
        const installTaskData = {
          id: updateTaskId,
          pkgname: item.pkgname,
          metalinkUrl,
          filename: item.fileName,
          upgradeOnly: true,
          origin: item.source === "apm" ? "apm" : "spark",
          retry: false,
        };

        // 通过 IPC 发送到主下载队列
        webContents.send("queue-install", JSON.stringify(installTaskData));

        // 从更新中心的 items 中移除该应用（不再显示在更新列表中）
        currentItems = currentItems.filter(
          (i) => getTaskKey(i) !== getTaskKey(item),
        );
      }

      // 更新队列中的 items
      queue.setItems(currentItems);

      emit();
    },
    async cancel(taskKey) {
      // 取消功能不再需要通过更新中心，直接忽略
      console.log("Cancel not needed for task:", taskKey);
    },
    getState,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
