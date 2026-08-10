import { computed, ref, type ComputedRef, type Ref } from "vue";

import type {
  UpdateCenterItem,
  UpdateCenterSnapshot,
  DownloadItem,
  UpdateCenterStartTask,
  StoreFilter,
} from "@/global/typedefinition";
import { downloads, getNextUpdateDownloadId } from "@/global/downloadStatus";
import { APM_STORE_BASE_URL } from "@/global/storeConfig";

const EMPTY_SNAPSHOT: UpdateCenterSnapshot = {
  items: [],
  tasks: [],
  warnings: [],
  hasRunningTasks: false,
};

export interface UpdateCenterStore {
  isOpen: Ref<boolean>;
  loading: Ref<boolean>;
  showCloseConfirm: Ref<boolean>;
  showMigrationConfirm: Ref<boolean>;
  searchQuery: Ref<string>;
  selectedTaskKeys: Ref<Set<string>>;
  snapshot: Ref<UpdateCenterSnapshot>;
  filteredItems: ComputedRef<UpdateCenterItem[]>;
  allSelected: ComputedRef<boolean>;
  someSelected: ComputedRef<boolean>;
  bind: () => void;
  unbind: () => void;
  open: (storeFilter?: StoreFilter) => Promise<void>;
  refresh: (storeFilter?: StoreFilter) => Promise<void>;
  ignoreItem: (packageName: string, newVersion: string) => Promise<void>;
  unignoreItem: (packageName: string, newVersion: string) => Promise<void>;
  toggleSelection: (taskKey: string) => void;
  toggleSelectAll: () => void;
  getSelectedItems: () => UpdateCenterItem[];
  closeNow: () => void;
  startSelected: () => Promise<void>;
  requestClose: () => void;
}

const matchesSearch = (item: UpdateCenterItem, query: string): boolean => {
  if (query.length === 0) {
    return true;
  }

  const normalizedQuery = query.toLowerCase();
  return [item.displayName, item.packageName, item.taskKey].some((value) =>
    value.toLowerCase().includes(normalizedQuery),
  );
};

export const createUpdateCenterStore = (): UpdateCenterStore => {
  const isOpen = ref(false);
  const loading = ref(false);
  const showCloseConfirm = ref(false);
  const showMigrationConfirm = ref(false);
  const searchQuery = ref("");
  const selectedTaskKeys = ref(new Set<string>());
  const snapshot = ref<UpdateCenterSnapshot>(EMPTY_SNAPSHOT);
  let lastStoreFilter: StoreFilter = "both";

  const resetSessionState = (): void => {
    showCloseConfirm.value = false;
    showMigrationConfirm.value = false;
    searchQuery.value = "";
    selectedTaskKeys.value = new Set();
  };

  const applySnapshot = (nextSnapshot: UpdateCenterSnapshot): void => {
    const selectableTaskKeys = new Set(
      nextSnapshot.items
        .filter((item) => item.ignored !== true)
        .map((item) => item.taskKey),
    );
    selectedTaskKeys.value = new Set(
      [...selectedTaskKeys.value].filter((taskKey) =>
        selectableTaskKeys.has(taskKey),
      ),
    );
    snapshot.value = nextSnapshot;
  };

  const selectableItems = computed(() =>
    snapshot.value.items.filter((item) => item.ignored !== true),
  );

  const filteredItems = computed(() => {
    const query = searchQuery.value.trim();
    return snapshot.value.items.filter((item) => matchesSearch(item, query));
  });

  const allSelected = computed(() => {
    const selectable = selectableItems.value;
    return (
      selectable.length > 0 &&
      selectable.every((item) => selectedTaskKeys.value.has(item.taskKey))
    );
  });

  const someSelected = computed(() => {
    const selectable = selectableItems.value;
    return (
      selectable.length > 0 &&
      selectable.some((item) => selectedTaskKeys.value.has(item.taskKey))
    );
  });

  const handleState = (nextSnapshot: UpdateCenterSnapshot): void => {
    applySnapshot(nextSnapshot);
  };

  let isBound = false;

  const bind = (): void => {
    if (isBound) {
      return;
    }

    window.updateCenter.onState(handleState);
    isBound = true;
  };

  const unbind = (): void => {
    if (!isBound) {
      return;
    }

    window.updateCenter.offState(handleState);
    isBound = false;
  };

  // 先刷新软件源，再加载更新列表；刷新失败仅告警，不阻断扫描
  const runSystemUpdateThenLoad = async (
    storeFilter: StoreFilter,
    load: (filter: StoreFilter) => Promise<UpdateCenterSnapshot>,
  ): Promise<void> => {
    try {
      await window.ipcRenderer.invoke(
        "update-center-run-system-update",
        storeFilter,
      );
    } catch (error) {
      console.error("[UpdateCenter] system update failed", error);
    }
    const nextSnapshot = await load(storeFilter);
    applySnapshot(nextSnapshot);
  };

  const open = async (storeFilter: StoreFilter = "both"): Promise<void> => {
    lastStoreFilter = storeFilter;
    resetSessionState();
    isOpen.value = true;
    loading.value = true;
    try {
      await runSystemUpdateThenLoad(storeFilter, window.updateCenter.open);
    } finally {
      loading.value = false;
    }
  };

  const refresh = async (
    storeFilter: StoreFilter = lastStoreFilter,
  ): Promise<void> => {
    lastStoreFilter = storeFilter;
    loading.value = true;
    try {
      await runSystemUpdateThenLoad(storeFilter, window.updateCenter.refresh);
    } finally {
      loading.value = false;
    }
  };

  const ignoreItem = async (
    packageName: string,
    newVersion: string,
  ): Promise<void> => {
    await window.updateCenter.ignore({ packageName, newVersion });
  };

  const unignoreItem = async (
    packageName: string,
    newVersion: string,
  ): Promise<void> => {
    await window.updateCenter.unignore({ packageName, newVersion });
  };

  const toggleSelection = (taskKey: string): void => {
    const item = snapshot.value.items.find(
      (entry) => entry.taskKey === taskKey,
    );
    if (!item || item.ignored === true) {
      return;
    }

    const nextSelection = new Set(selectedTaskKeys.value);
    if (nextSelection.has(taskKey)) {
      nextSelection.delete(taskKey);
    } else {
      nextSelection.add(taskKey);
    }

    selectedTaskKeys.value = nextSelection;
  };

  const toggleSelectAll = (): void => {
    const selectable = selectableItems.value;
    if (allSelected.value) {
      selectedTaskKeys.value = new Set();
    } else {
      selectedTaskKeys.value = new Set(selectable.map((item) => item.taskKey));
    }
  };

  const getSelectedItems = (): UpdateCenterItem[] => {
    return snapshot.value.items.filter(
      (item) =>
        selectedTaskKeys.value.has(item.taskKey) && item.ignored !== true,
    );
  };

  const closeNow = (): void => {
    resetSessionState();
    loading.value = false;
    isOpen.value = false;
  };

  const startSelected = async (): Promise<void> => {
    const selectedItems = getSelectedItems();
    if (selectedItems.length === 0) {
      return;
    }

    // 在前端创建下载项，这样用户能在下载列表中看到更新任务
    const arch = window.apm_store.arch || "amd64";
    const startTasks: UpdateCenterStartTask[] = [];

    selectedItems.forEach((item) => {
      // 检查任务是否已存在
      if (
        !downloads.value.find(
          (d) =>
            d.pkgname === item.packageName &&
            d.origin === (item.source === "apm" ? "apm" : "spark"),
        )
      ) {
        const finalArch =
          item.source === "apm" ? `${arch}-apm` : `${arch}-store`;
        const icon =
          item.remoteIcon ||
          `${APM_STORE_BASE_URL}/${finalArch}/unknown/${item.packageName}/icon.png`;
        const downloadId = getNextUpdateDownloadId();
        const download: DownloadItem = {
          id: downloadId,
          name: item.displayName,
          pkgname: item.packageName,
          version: item.newVersion,
          icon,
          origin: item.source === "apm" ? "apm" : "spark",
          status: "queued",
          progress: 0,
          downloadedSize: 0,
          totalSize: item.size || 0,
          speed: 0,
          timeRemaining: 0,
          startTime: Date.now(),
          logs: [{ time: Date.now(), message: "开始更新..." }],
          source: "Update Center",
          retry: false,
          upgradeOnly: true,
          filename: item.fileName,
          metalinkUrl: item.downloadUrl
            ? `${item.downloadUrl}.metalink`
            : undefined,
        };
        downloads.value.push(download);
        startTasks.push({
          taskKey: item.taskKey,
          id: downloadId,
        });
      }
    });

    if (startTasks.length === 0) {
      return;
    }

    await window.updateCenter.start(startTasks);
  };

  const requestClose = (): void => {
    // 直接关闭，不需要确认，因为任务在主下载队列中执行
    closeNow();
  };

  return {
    isOpen,
    loading,
    showCloseConfirm,
    showMigrationConfirm,
    searchQuery,
    selectedTaskKeys,
    snapshot,
    filteredItems,
    allSelected,
    someSelected,
    bind,
    unbind,
    open,
    refresh,
    ignoreItem,
    unignoreItem,
    toggleSelection,
    toggleSelectAll,
    getSelectedItems,
    closeNow,
    startSelected,
    requestClose,
  };
};
