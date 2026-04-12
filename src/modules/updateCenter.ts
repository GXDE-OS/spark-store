import { computed, ref, type ComputedRef, type Ref } from "vue";

import type {
  UpdateCenterItem,
  UpdateCenterSnapshot,
  DownloadItem,
} from "@/global/typedefinition";
import { downloads } from "@/global/downloadStatus";
import { APM_STORE_BASE_URL } from "@/global/storeConfig";

const EMPTY_SNAPSHOT: UpdateCenterSnapshot = {
  items: [],
  tasks: [],
  warnings: [],
  hasRunningTasks: false,
};

export interface UpdateCenterStore {
  isOpen: Ref<boolean>;
  showCloseConfirm: Ref<boolean>;
  showMigrationConfirm: Ref<boolean>;
  searchQuery: Ref<string>;
  selectedTaskKeys: Ref<Set<string>>;
  snapshot: Ref<UpdateCenterSnapshot>;
  filteredItems: ComputedRef<UpdateCenterItem[]>;
  bind: () => void;
  unbind: () => void;
  open: () => Promise<void>;
  refresh: () => Promise<void>;
  toggleSelection: (taskKey: string) => void;
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
  const showCloseConfirm = ref(false);
  const showMigrationConfirm = ref(false);
  const searchQuery = ref("");
  const selectedTaskKeys = ref(new Set<string>());
  const snapshot = ref<UpdateCenterSnapshot>(EMPTY_SNAPSHOT);

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

  const filteredItems = computed(() => {
    const query = searchQuery.value.trim();
    return snapshot.value.items.filter((item) => matchesSearch(item, query));
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

  const open = async (): Promise<void> => {
    resetSessionState();
    const nextSnapshot = await window.updateCenter.open();
    applySnapshot(nextSnapshot);
    isOpen.value = true;
  };

  const refresh = async (): Promise<void> => {
    const nextSnapshot = await window.updateCenter.refresh();
    applySnapshot(nextSnapshot);
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

  const getSelectedItems = (): UpdateCenterItem[] => {
    return snapshot.value.items.filter(
      (item) =>
        selectedTaskKeys.value.has(item.taskKey) && item.ignored !== true,
    );
  };

  const closeNow = (): void => {
    resetSessionState();
    isOpen.value = false;
  };

  const startSelected = async (): Promise<void> => {
    const selectedItems = getSelectedItems();
    const taskKeys = selectedItems.map((item) => item.taskKey);

    if (taskKeys.length === 0) {
      return;
    }

    // 在前端创建下载项，这样用户能在下载列表中看到更新任务
    const arch = window.apm_store.arch || "amd64";
    let downloadIdCounter =
      downloads.value.length > 0
        ? Math.max(...downloads.value.map((d) => d.id)) + 1
        : 1;

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
        const download: DownloadItem = {
          id: downloadIdCounter++,
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
      }
    });

    await window.updateCenter.start(taskKeys);
  };

  const requestClose = (): void => {
    // 直接关闭，不需要确认，因为任务在主下载队列中执行
    closeNow();
  };

  return {
    isOpen,
    showCloseConfirm,
    showMigrationConfirm,
    searchQuery,
    selectedTaskKeys,
    snapshot,
    filteredItems,
    bind,
    unbind,
    open,
    refresh,
    toggleSelection,
    getSelectedItems,
    closeNow,
    startSelected,
    requestClose,
  };
};
