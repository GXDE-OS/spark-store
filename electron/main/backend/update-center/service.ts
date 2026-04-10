import {
  LEGACY_IGNORE_CONFIG_PATH,
  applyIgnoredEntries,
  createIgnoreKey,
  loadIgnoredEntries,
  saveIgnoredEntries,
} from "./ignore-config";
import { createTaskRunner, type UpdateCenterTaskRunner } from "./install";
import {
  createUpdateCenterQueue,
  type UpdateCenterQueue,
  type UpdateCenterQueueSnapshot,
} from "./queue";
import type { UpdateCenterItem, UpdateSource } from "./types";

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

export interface UpdateCenterService {
  open: () => Promise<UpdateCenterServiceState>;
  refresh: () => Promise<UpdateCenterServiceState>;
  ignore: (payload: UpdateCenterIgnorePayload) => Promise<void>;
  unignore: (payload: UpdateCenterIgnorePayload) => Promise<void>;
  start: (taskKeys: string[]) => Promise<void>;
  cancel: (taskKey: string) => Promise<void>;
  getState: () => UpdateCenterServiceState;
  subscribe: (
    listener: (snapshot: UpdateCenterServiceState) => void,
  ) => () => void;
}

export interface CreateUpdateCenterServiceOptions {
  loadItems: () => Promise<UpdateCenterItem[] | UpdateCenterLoadedItems>;
  loadIgnoredEntries?: () => Promise<Set<string>>;
  saveIgnoredEntries?: (entries: ReadonlySet<string>) => Promise<void>;
  createTaskRunner?: (
    queue: UpdateCenterQueue,
    superUserCmd?: string,
  ) => UpdateCenterTaskRunner;
  superUserCmdProvider?: () => Promise<string>;
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
    displayName: item.pkgname,
    currentVersion: item.currentVersion,
    newVersion: item.nextVersion,
    source: item.source,
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
  tasks: snapshot.tasks.map((task) => ({
    taskKey: getTaskKey(task.item),
    packageName: task.pkgname,
    source: task.item.source,
    status: task.status,
    progress: task.progress,
    logs: task.logs.map((log) => ({ ...log })),
    errorMessage: task.error ?? "",
  })),
  warnings: [...snapshot.warnings],
  hasRunningTasks: snapshot.hasRunningTasks,
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
  const loadIgnored =
    options.loadIgnoredEntries ??
    (() => loadIgnoredEntries(LEGACY_IGNORE_CONFIG_PATH));
  const saveIgnored =
    options.saveIgnoredEntries ??
    ((entries: ReadonlySet<string>) =>
      saveIgnoredEntries(LEGACY_IGNORE_CONFIG_PATH, entries));
  const createRunner =
    options.createTaskRunner ??
    ((currentQueue: UpdateCenterQueue, superUserCmd?: string) =>
      createTaskRunner(currentQueue, { superUserCmd }));
  let processingPromise: Promise<void> | null = null;
  let activeRunner: UpdateCenterTaskRunner | null = null;

  const applyWarning = (message: string): void => {
    queue.finishRefresh([message]);
  };

  const getState = (): UpdateCenterServiceState => toState(queue.getSnapshot());

  const emit = (): UpdateCenterServiceState => {
    const snapshot = getState();
    for (const listener of listeners) {
      listener(snapshot);
    }
    return snapshot;
  };

  const refresh = async (): Promise<UpdateCenterServiceState> => {
    queue.startRefresh();
    emit();

    try {
      const ignoredEntries = await loadIgnored();
      const loadedItems = normalizeLoadedItems(await options.loadItems());
      const items = applyIgnoredEntries(loadedItems.items, ignoredEntries);
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

  const failQueuedTasks = (message: string): void => {
    for (const task of queue.getSnapshot().tasks) {
      if (task.status === "queued") {
        queue.appendTaskLog(task.id, message);
        queue.finishTask(task.id, "failed", message);
      }
    }
  };

  const ensureProcessing = async (): Promise<void> => {
    if (processingPromise) {
      return processingPromise;
    }

    processingPromise = (async () => {
      let superUserCmd = "";

      try {
        superUserCmd = (await options.superUserCmdProvider?.()) ?? "";
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failQueuedTasks(message);
        applyWarning(message);
        emit();
        return;
      }

      activeRunner = createRunner(queue, superUserCmd);

      while (queue.getNextQueuedTask()) {
        await activeRunner.runNextTask();
        emit();
      }
    })().finally(() => {
      processingPromise = null;
      activeRunner = null;
    });

    return processingPromise;
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
    async start(taskKeys) {
      const snapshot = queue.getSnapshot();
      const existingTaskKeys = new Set(
        snapshot.tasks
          .filter(
            (task) =>
              !["completed", "failed", "cancelled"].includes(task.status),
          )
          .map((task) => getTaskKey(task.item)),
      );
      const selectedItems = snapshot.items.filter(
        (item) =>
          taskKeys.includes(getTaskKey(item)) &&
          !item.ignored &&
          !existingTaskKeys.has(getTaskKey(item)),
      );

      if (selectedItems.length === 0) {
        return;
      }

      for (const item of selectedItems) {
        queue.enqueueItem(item);
      }
      emit();

      await ensureProcessing();
    },
    async cancel(taskKey) {
      const task = queue
        .getSnapshot()
        .tasks.find((entry) => getTaskKey(entry.item) === taskKey);

      if (!task) {
        return;
      }

      queue.finishTask(task.id, "cancelled", "Cancelled");
      if (["downloading", "installing"].includes(task.status)) {
        activeRunner?.cancelActiveTask();
      }
      emit();
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
