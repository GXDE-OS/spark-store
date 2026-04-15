# Installed Apps And Update Center Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the update center open immediately with visible loading feedback, switch Spark installed-app discovery to desktop entries under `/usr/share/applications`, and let users open installed apps from the management modal.

**Architecture:** Keep the existing Electron IPC contracts in place. Add a renderer-only loading flag to the update-center store for immediate modal display, move Spark desktop discovery into a focused main-process helper that returns `InstalledAppInfo`-shaped records, and move installed-app normalization into a small renderer helper so `App.vue` can accept local desktop apps even when they are absent from the remote catalog.

**Tech Stack:** Vue 3 Composition API, TypeScript, Electron IPC, Node `fs/path/child_process`, Vitest, Testing Library Vue

---

## File Structure

- Create: `electron/main/backend/sparkInstalledApps.ts`
  Responsibility: scan `/usr/share/applications`, parse desktop files, resolve owning packages with `dpkg -S`, and return normalized Spark installed-app records.
- Create: `src/modules/installedApps.ts`
  Responsibility: convert `list-installed` results into `App` objects without filtering out Spark apps that are missing from the remote catalog.
- Create: `src/__tests__/unit/sparkInstalledApps.test.ts`
  Responsibility: regression coverage for Spark desktop discovery, deduping, and failure handling.
- Create: `src/__tests__/unit/installedApps.test.ts`
  Responsibility: regression coverage for installed-app normalization and Spark fallback cards.
- Modify: `src/modules/updateCenter.ts`
  Responsibility: expose `loading` on the update-center store and make `open()` show the modal before the first IPC result returns.
- Modify: `src/components/UpdateCenterModal.vue`
  Responsibility: show the initial loading state and the lighter refresh-in-progress state.
- Modify: `src/components/update-center/UpdateCenterToolbar.vue`
  Responsibility: disable and visually update the refresh button while loading.
- Modify: `src/__tests__/unit/update-center/store.test.ts`
  Responsibility: prove the store opens immediately and toggles loading around `open()` and `refresh()`.
- Modify: `src/__tests__/unit/update-center/UpdateCenterModal.test.ts`
  Responsibility: prove the loading panel and disabled refresh state render correctly.
- Modify: `electron/main/backend/install-manager.ts`
  Responsibility: replace the inline Spark `dpkg-query -W` listing branch with the new desktop-discovery helper.
- Modify: `src/components/InstalledAppsModal.vue`
  Responsibility: emit `open-app` and render the new `打开` action beside `卸载`.
- Modify: `src/__tests__/unit/InstalledAppsModal.test.ts`
  Responsibility: prove the modal emits `open-app` and still keeps scroll chaining contained.
- Modify: `src/App.vue`
  Responsibility: wire `InstalledAppsModal` to `openDownloadedApp()` and use the installed-app normalization helper instead of filtering Spark apps out when they are missing from the remote catalog.

### Task 1: Update Center Store Loading Lifecycle

**Files:**

- Modify: `src/modules/updateCenter.ts`
- Test: `src/__tests__/unit/update-center/store.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUpdateCenterStore } from "@/modules/updateCenter";
import { downloads } from "@/global/downloadStatus";

const createSnapshot = (overrides = {}) => ({
  items: [
    {
      taskKey: "aptss:spark-weather",
      packageName: "spark-weather",
      displayName: "Spark Weather",
      currentVersion: "1.0.0",
      newVersion: "2.0.0",
      source: "aptss" as const,
      ignored: false,
    },
  ],
  tasks: [],
  warnings: [],
  hasRunningTasks: false,
  ...overrides,
});

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
};

describe("updateCenter store", () => {
  const open = vi.fn();
  const refresh = vi.fn();
  const start = vi.fn();
  const onState = vi.fn();
  const offState = vi.fn();

  beforeEach(() => {
    open.mockReset();
    refresh.mockReset();
    start.mockReset();
    onState.mockReset();
    offState.mockReset();
    downloads.value = [];

    Object.defineProperty(window, "updateCenter", {
      configurable: true,
      value: {
        open,
        refresh,
        ignore: vi.fn(),
        unignore: vi.fn(),
        start,
        cancel: vi.fn(),
        getState: vi.fn(),
        onState,
        offState,
      },
    });
  });

  it("opens the modal immediately while waiting for the first snapshot", async () => {
    const deferred = createDeferred<ReturnType<typeof createSnapshot>>();
    open.mockReturnValue(deferred.promise);
    const store = createUpdateCenterStore();

    const openPromise = store.open();

    expect(store.isOpen.value).toBe(true);
    expect(store.loading.value).toBe(true);

    deferred.resolve(createSnapshot());
    await openPromise;

    expect(store.snapshot.value).toEqual(createSnapshot());
    expect(store.loading.value).toBe(false);
  });

  it("toggles loading around refresh", async () => {
    const deferred = createDeferred<ReturnType<typeof createSnapshot>>();
    refresh.mockReturnValue(deferred.promise);
    const store = createUpdateCenterStore();

    const refreshPromise = store.refresh();

    expect(store.loading.value).toBe(true);

    deferred.resolve(createSnapshot({ warnings: ["refresh finished"] }));
    await refreshPromise;

    expect(store.loading.value).toBe(false);
    expect(store.snapshot.value.warnings).toEqual(["refresh finished"]);
  });
});
```

- [ ] **Step 2: Run the store test file to verify it fails**

Run: `npx vitest run src/__tests__/unit/update-center/store.test.ts`

Expected: FAIL because `UpdateCenterStore` does not expose `loading`, and `open()` only sets `isOpen` after awaiting `window.updateCenter.open()`.

- [ ] **Step 3: Write the minimal store implementation**

```ts
import { computed, ref, type ComputedRef, type Ref } from "vue";

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
  open: () => Promise<void>;
  refresh: () => Promise<void>;
  toggleSelection: (taskKey: string) => void;
  toggleSelectAll: () => void;
  getSelectedItems: () => UpdateCenterItem[];
  closeNow: () => void;
  startSelected: () => Promise<void>;
  requestClose: () => void;
}

export const createUpdateCenterStore = (): UpdateCenterStore => {
  const isOpen = ref(false);
  const loading = ref(false);
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

  const open = async (): Promise<void> => {
    resetSessionState();
    isOpen.value = true;
    loading.value = true;
    try {
      const nextSnapshot = await window.updateCenter.open();
      applySnapshot(nextSnapshot);
    } finally {
      loading.value = false;
    }
  };

  const refresh = async (): Promise<void> => {
    loading.value = true;
    try {
      const nextSnapshot = await window.updateCenter.refresh();
      applySnapshot(nextSnapshot);
    } finally {
      loading.value = false;
    }
  };

  const closeNow = (): void => {
    resetSessionState();
    loading.value = false;
    isOpen.value = false;
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
    toggleSelection,
    toggleSelectAll,
    getSelectedItems,
    closeNow,
    startSelected,
    requestClose,
  };
};
```

- [ ] **Step 4: Re-run the store test file**

Run: `npx vitest run src/__tests__/unit/update-center/store.test.ts`

Expected: PASS with both new loading-lifecycle tests green.

- [ ] **Step 5: Commit the store-loading change**

```bash
git add src/modules/updateCenter.ts src/__tests__/unit/update-center/store.test.ts
git commit -m "fix(update-center): show loading before updates load"
```

### Task 2: Update Center Loading UI

**Files:**

- Modify: `src/components/UpdateCenterModal.vue`
- Modify: `src/components/update-center/UpdateCenterToolbar.vue`
- Test: `src/__tests__/unit/update-center/UpdateCenterModal.test.ts`

- [ ] **Step 1: Write the failing loading-state UI tests**

```ts
import { computed, ref } from "vue";
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";

import UpdateCenterModal from "@/components/UpdateCenterModal.vue";
import type {
  UpdateCenterItem,
  UpdateCenterSnapshot,
  UpdateCenterTaskState,
} from "@/global/typedefinition";
import type { UpdateCenterStore } from "@/modules/updateCenter";

const createItem = (
  overrides: Partial<UpdateCenterItem> = {},
): UpdateCenterItem => ({
  taskKey: "aptss:spark-weather",
  packageName: "spark-weather",
  displayName: "Spark Weather",
  currentVersion: "1.0.0",
  newVersion: "2.0.0",
  source: "aptss",
  ...overrides,
});

const createTask = (
  overrides: Partial<UpdateCenterTaskState> = {},
): UpdateCenterTaskState => ({
  taskKey: "aptss:spark-weather",
  packageName: "spark-weather",
  source: "aptss",
  status: "downloading",
  progress: 42,
  logs: [],
  errorMessage: "",
  ...overrides,
});

const createStore = (
  overrides: Partial<UpdateCenterSnapshot> = {},
): UpdateCenterStore => {
  const snapshot = ref<UpdateCenterSnapshot>({
    items: [
      createItem({
        taskKey: "aptss:spark-weather",
        source: "aptss",
      }),
      createItem({
        taskKey: "apm:spark-clock",
        packageName: "spark-clock",
        displayName: "Spark Clock",
        source: "apm",
        isMigration: true,
        migrationTarget: "apm",
      }),
    ],
    tasks: [createTask()],
    warnings: ["更新过程中请勿关闭商店"],
    hasRunningTasks: true,
    ...overrides,
  });

  const selectedTaskKeys = ref(new Set<string>(["aptss:spark-weather"]));

  return {
    isOpen: ref(true),
    loading: ref(false),
    showCloseConfirm: ref(true),
    showMigrationConfirm: ref(false),
    searchQuery: ref(""),
    selectedTaskKeys,
    snapshot,
    filteredItems: computed(() => snapshot.value.items),
    allSelected: computed(() => true),
    someSelected: computed(() => false),
    bind: vi.fn(),
    unbind: vi.fn(),
    open: vi.fn(),
    refresh: vi.fn(),
    toggleSelection: vi.fn(),
    toggleSelectAll: vi.fn(),
    getSelectedItems: vi.fn(() =>
      snapshot.value.items.filter(
        (item) =>
          selectedTaskKeys.value.has(item.taskKey) && item.ignored !== true,
      ),
    ),
    closeNow: vi.fn(),
    startSelected: vi.fn(),
    requestClose: vi.fn(),
  };
};

describe("UpdateCenterModal", () => {
  it("shows an initial loading panel and disables refresh while loading", () => {
    const store = createStore({
      items: [],
      tasks: [],
      warnings: [],
      hasRunningTasks: false,
    });
    store.loading.value = true;

    render(UpdateCenterModal, {
      props: {
        show: true,
        store,
      },
    });

    expect(screen.getByText("正在检查更新…")).toBeTruthy();
    expect(screen.getByRole("button", { name: /刷新/ })).toBeDisabled();
  });

  it("keeps existing items visible while showing the refresh hint", () => {
    const store = createStore({ hasRunningTasks: false });
    store.loading.value = true;

    render(UpdateCenterModal, {
      props: {
        show: true,
        store,
      },
    });

    expect(screen.getByText("Spark Weather")).toBeTruthy();
    expect(screen.getByText("正在刷新更新列表…")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the modal test file to verify it fails**

Run: `npx vitest run src/__tests__/unit/update-center/UpdateCenterModal.test.ts`

Expected: FAIL because the toolbar does not accept a `loading` prop yet, and the modal renders neither `正在检查更新…` nor `正在刷新更新列表…`.

- [ ] **Step 3: Implement the loading UI in the modal and toolbar**

```vue
<!-- src/components/update-center/UpdateCenterToolbar.vue -->
<template>
  <div
    class="flex flex-col gap-4 border-b border-slate-200/70 px-6 py-5 dark:border-slate-800/70"
  >
    <div class="flex items-start gap-4">
      <div class="flex-1">
        <p class="text-2xl font-semibold text-slate-900 dark:text-white">
          软件更新
        </p>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          集中管理 APM 与传统 deb 更新任务
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          :disabled="loading"
          @click="$emit('refresh')"
        >
          <i class="fas fa-sync-alt" :class="{ 'animate-spin': loading }"></i>
          {{ loading ? "刷新中" : "刷新" }}
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-40"
          :disabled="selectedCount === 0"
          @click="$emit('start-selected')"
        >
          <i class="fas fa-play"></i>
          更新选中 ({{ selectedCount }})
        </button>
        <button
          type="button"
          aria-label="关闭"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/70 text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
          @click="$emit('request-close')"
        >
          <i class="fas fa-xmark"></i>
        </button>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <label class="inline-flex cursor-pointer items-center gap-2 select-none">
        <input
          ref="selectAllRef"
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300 accent-brand focus:ring-brand"
          :checked="allSelected"
          @change="$emit('toggle-select-all')"
        />
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200"
          >全选</span
        >
      </label>
      <span class="text-sm text-slate-400 dark:text-slate-500">
        已选 {{ selectedCount }} 项
      </span>
    </div>

    <label class="block">
      <span class="sr-only">搜索更新</span>
      <input
        :value="searchQuery"
        type="search"
        placeholder="搜索应用或包名"
        class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand/60 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900"
        @input="handleInput"
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  searchQuery: string;
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
  loading: boolean;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "start-selected"): void;
  (e: "request-close"): void;
  (e: "toggle-select-all"): void;
  (e: "update:search-query", value: string): void;
}>();

const selectAllRef = ref<HTMLInputElement | null>(null);

watch(
  [() => props.someSelected, () => props.allSelected],
  () => {
    if (selectAllRef.value) {
      selectAllRef.value.indeterminate =
        props.someSelected && !props.allSelected;
    }
  },
  { flush: "post" },
);

const handleInput = (event: Event): void => {
  const target = event.target as HTMLInputElement | null;
  emit("update:search-query", target?.value ?? props.searchQuery);
};
</script>
```

```vue
<!-- src/components/UpdateCenterModal.vue -->
<template>
  <Transition
    enter-active-class="duration-200 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/70 px-4 py-6 lg:py-10"
      @wheel="onOverlayWheel"
      @click="onOverlayClick"
    >
      <div
        class="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        @click.stop
      >
        <UpdateCenterToolbar
          :search-query="store.searchQuery.value"
          :selected-count="selectedCount"
          :all-selected="store.allSelected.value"
          :some-selected="store.someSelected.value"
          :loading="store.loading.value"
          @refresh="store.refresh"
          @start-selected="emit('request-start-selected')"
          @request-close="store.requestClose"
          @toggle-select-all="store.toggleSelectAll"
          @update:search-query="emit('update:search-query', $event)"
        />

        <div
          v-if="store.snapshot.value.warnings.length > 0"
          class="mx-6 mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <p
            v-for="warning in store.snapshot.value.warnings"
            :key="warning"
            class="leading-6"
          >
            {{ warning }}
          </p>
        </div>

        <div class="min-h-0 flex-1">
          <div
            v-if="
              store.loading.value && store.snapshot.value.items.length === 0
            "
            class="flex h-full items-center justify-center p-6"
          >
            <div
              class="rounded-2xl border border-dashed border-slate-200/80 px-6 py-12 text-center text-slate-500 dark:border-slate-800/80 dark:text-slate-400"
            >
              正在检查更新…
            </div>
          </div>
          <template v-else>
            <div
              v-if="store.loading.value"
              class="mx-6 mt-4 rounded-2xl border border-slate-200/80 bg-slate-50/90 px-4 py-3 text-sm text-slate-500 dark:border-slate-800/80 dark:bg-slate-950/80 dark:text-slate-400"
            >
              正在刷新更新列表…
            </div>
            <UpdateCenterList
              :items="store.filteredItems.value"
              :tasks="store.snapshot.value.tasks"
              :selected-task-keys="store.selectedTaskKeys.value"
              @toggle-selection="emit('toggle-selection', $event)"
            />
          </template>
        </div>

        <UpdateCenterMigrationConfirm
          :show="store.showMigrationConfirm.value"
          @close="emit('dismiss-migration-confirm')"
          @confirm="emit('confirm-migration-start')"
        />
      </div>
    </div>
  </Transition>
</template>
```

- [ ] **Step 4: Re-run the modal test file**

Run: `npx vitest run src/__tests__/unit/update-center/UpdateCenterModal.test.ts`

Expected: PASS with the new loading-panel and refresh-disabled assertions green.

- [ ] **Step 5: Commit the loading UI change**

```bash
git add src/components/UpdateCenterModal.vue src/components/update-center/UpdateCenterToolbar.vue src/__tests__/unit/update-center/UpdateCenterModal.test.ts
git commit -m "fix(update-center): show loading state in the modal"
```

### Task 3: Spark Desktop Discovery In The Main Process

**Files:**

- Create: `electron/main/backend/sparkInstalledApps.ts`
- Modify: `electron/main/backend/install-manager.ts`
- Test: `src/__tests__/unit/sparkInstalledApps.test.ts`

- [ ] **Step 1: Write the failing Spark desktop-discovery tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { listSparkInstalledApps } from "../../../electron/main/backend/sparkInstalledApps";

describe("listSparkInstalledApps", () => {
  it("builds Spark installed apps from visible desktop entries", async () => {
    const applicationsDir = "/usr/share/applications";
    const fsLike = {
      readdirSync: vi.fn(() => [
        "reader.desktop",
        "hidden.desktop",
        "reader-alt.desktop",
      ]),
      realpathSync: vi.fn((filePath: string) => filePath),
      readFileSync: vi.fn((filePath: string) => {
        const files: Record<string, string> = {
          [`${applicationsDir}/reader.desktop`]:
            "[Desktop Entry]\nName=Spark Reader\nIcon=/usr/share/pixmaps/reader.png\n",
          [`${applicationsDir}/hidden.desktop`]:
            "[Desktop Entry]\nName=Hidden Reader\nNoDisplay=true\n",
          [`${applicationsDir}/reader-alt.desktop`]:
            "[Desktop Entry]\nName=Spark Reader Alt\nIcon=reader\n",
        };

        return files[filePath] ?? "";
      }),
    };

    const runCommand = vi.fn(async (command: string, args: string[]) => {
      const key = `${command} ${args.join(" ")}`;

      if (
        key === "dpkg-query -W -f=${Package}\\t${Version}\\t${Architecture}\\n"
      ) {
        return {
          code: 0,
          stdout: "spark-reader\t1.2.3\tamd64\n",
          stderr: "",
        };
      }

      if (key === `dpkg -S ${applicationsDir}/reader.desktop`) {
        return {
          code: 0,
          stdout: "spark-reader: /usr/share/applications/reader.desktop\n",
          stderr: "",
        };
      }

      if (key === `dpkg -S ${applicationsDir}/reader-alt.desktop`) {
        return {
          code: 0,
          stdout: "spark-reader: /usr/share/applications/reader-alt.desktop\n",
          stderr: "",
        };
      }

      return { code: 1, stdout: "", stderr: "not owned" };
    });

    const result = await listSparkInstalledApps({
      applicationsDir,
      fsLike,
      runCommand,
    });

    expect(result).toEqual({
      success: true,
      apps: [
        {
          pkgname: "spark-reader",
          name: "Spark Reader",
          version: "1.2.3",
          arch: "amd64",
          flags: "[installed]",
          origin: "spark",
          icon: "/usr/share/pixmaps/reader.png",
          isDependency: false,
        },
      ],
    });
  });

  it("returns a failure object when package metadata lookup fails", async () => {
    const result = await listSparkInstalledApps({
      applicationsDir: "/usr/share/applications",
      fsLike: {
        readdirSync: vi.fn(() => []),
        realpathSync: vi.fn((filePath: string) => filePath),
        readFileSync: vi.fn(() => ""),
      },
      runCommand: vi.fn(async () => ({
        code: 1,
        stdout: "",
        stderr: "dpkg-query failed",
      })),
    });

    expect(result).toEqual({
      success: false,
      message: "Failed to list installed packages",
      apps: [],
    });
  });
});
```

- [ ] **Step 2: Run the Spark desktop-discovery tests to verify they fail**

Run: `npx vitest run src/__tests__/unit/sparkInstalledApps.test.ts`

Expected: FAIL because `electron/main/backend/sparkInstalledApps.ts` does not exist yet.

- [ ] **Step 3: Implement the Spark helper and wire it into `install-manager.ts`**

```ts
// electron/main/backend/sparkInstalledApps.ts
import fs from "node:fs";
import path from "node:path";

export interface SparkInstalledApp {
  pkgname: string;
  name: string;
  version: string;
  arch: string;
  flags: string;
  origin: "spark";
  icon?: string;
  isDependency: boolean;
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type CommandRunner = (
  command: string,
  args: string[],
) => Promise<CommandResult>;

interface FsLike {
  readdirSync: typeof fs.readdirSync;
  realpathSync: typeof fs.realpathSync;
  readFileSync: typeof fs.readFileSync;
}

const PACKAGE_QUERY_ARGS = [
  "-W",
  "-f=${Package}\t${Version}\t${Architecture}\\n",
];

const parseDesktopEntry = (content: string) => ({
  name: content.match(/^Name=(.+)$/m)?.[1]?.trim() ?? "",
  icon: content.match(/^Icon=(.+)$/m)?.[1]?.trim() ?? "",
  noDisplay: /^NoDisplay=true$/m.test(content),
});

const parsePackageMetadata = (
  stdout: string,
): Map<string, { version: string; arch: string }> => {
  const metadata = new Map<string, { version: string; arch: string }>();

  stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((line) => {
      const [pkgname, version, arch] = line.split("\t");
      if (!pkgname || !version || !arch) {
        return;
      }

      metadata.set(pkgname, { version, arch });
    });

  return metadata;
};

const parseDpkgOwner = (stdout: string): string | null => {
  const firstLine = stdout
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return null;
  }

  const ownerField = firstLine.split(":")[0]?.split(",")[0]?.trim();
  if (!ownerField) {
    return null;
  }

  return ownerField.replace(/:(amd64|arm64|i386|all)$/, "");
};

export const listSparkInstalledApps = async ({
  applicationsDir = "/usr/share/applications",
  fsLike = fs,
  runCommand,
}: {
  applicationsDir?: string;
  fsLike?: FsLike;
  runCommand: CommandRunner;
}): Promise<
  | { success: true; apps: SparkInstalledApp[] }
  | { success: false; message: string; apps: [] }
> => {
  const metadataResult = await runCommand("dpkg-query", PACKAGE_QUERY_ARGS);
  if (metadataResult.code !== 0) {
    return {
      success: false,
      message: "Failed to list installed packages",
      apps: [],
    };
  }

  const packageMetadata = parsePackageMetadata(metadataResult.stdout);
  const appsByPackage = new Map<string, SparkInstalledApp>();
  const desktopFiles = fsLike
    .readdirSync(applicationsDir)
    .filter((entry) => entry.endsWith(".desktop"))
    .sort();

  for (const desktopFile of desktopFiles) {
    const desktopPath = path.join(applicationsDir, desktopFile);

    try {
      const resolvedDesktopPath = fsLike.realpathSync(desktopPath).toString();
      const content = fsLike.readFileSync(resolvedDesktopPath, "utf-8");
      const entry = parseDesktopEntry(content.toString());
      if (entry.noDisplay) {
        continue;
      }

      const ownerResult = await runCommand("dpkg", ["-S", resolvedDesktopPath]);
      if (ownerResult.code !== 0) {
        continue;
      }

      const pkgname = parseDpkgOwner(ownerResult.stdout);
      if (!pkgname || appsByPackage.has(pkgname)) {
        continue;
      }

      const metadata = packageMetadata.get(pkgname);
      if (!metadata) {
        continue;
      }

      appsByPackage.set(pkgname, {
        pkgname,
        name: entry.name || pkgname,
        version: metadata.version,
        arch: metadata.arch,
        flags: "[installed]",
        origin: "spark",
        icon: entry.icon || undefined,
        isDependency: false,
      });
    } catch {
      continue;
    }
  }

  return {
    success: true,
    apps: [...appsByPackage.values()].sort((left, right) =>
      left.pkgname.localeCompare(right.pkgname),
    ),
  };
};
```

```ts
// electron/main/backend/install-manager.ts
import { listSparkInstalledApps } from "./sparkInstalledApps";

ipcMain.handle(
  "list-installed",
  async (_event, origin: "apm" | "spark" = "apm") => {
    const apmBasePath = "/var/lib/apm/apm/files/ace-env/var/lib/apm";

    try {
      const installedApps: Array<{
        pkgname: string;
        name: string;
        version: string;
        arch: string;
        flags: string;
        origin: "spark" | "apm";
        icon?: string;
        isDependency: boolean;
      }> = [];

      if (origin === "spark") {
        return await listSparkInstalledApps({ runCommand: runCommandCapture });
      }

      const { code, stdout } = await runCommandCapture("apm", [
        "list",
        "--installed",
      ]);

      if (code !== 0) {
        logger.warn(`Failed to list installed packages: ${stdout}`);
        return {
          success: false,
          message: "Failed to list installed packages",
          apps: [],
        };
      }

      const cleanStdout = stdout.replace(/\x1b\[[0-9;]*m/g, "");
      const lines = cleanStdout.split("\n");

      for (const line of lines) {
        const trimmed = line.trim();
        if (
          !trimmed ||
          trimmed.startsWith("Listing") ||
          trimmed.startsWith("[INFO]") ||
          trimmed.startsWith("警告")
        ) {
          continue;
        }

        const match = trimmed.match(
          /^(\S+)\/\S+(?:,\S+)?\s+(\S+)\s+(\S+)\s+\[(.+)\]$/,
        );
        if (!match) {
          logger.debug(`Failed to parse line: ${trimmed}`);
          continue;
        }

        const [, pkgname, version, arch, flags] = match;
        let appName = pkgname;
        let icon = "";
        const pkgPath = path.join(apmBasePath, pkgname);
        const entriesPath = path.join(pkgPath, "entries", "applications");
        const hasEntries = fs.existsSync(entriesPath);

        if (hasEntries) {
          try {
            const desktopFiles = fs.readdirSync(entriesPath);
            for (const file of desktopFiles) {
              if (!file.endsWith(".desktop")) {
                continue;
              }

              const desktopPath = path.join(entriesPath, file);
              const content = fs.readFileSync(desktopPath, "utf-8");
              const nameMatch = content.match(/^Name=(.+)$/m);
              const iconMatch = content.match(/^Icon=(.+)$/m);
              if (nameMatch) appName = nameMatch[1].trim();
              if (iconMatch) icon = iconMatch[1].trim();
              break;
            }
          } catch (error) {
            logger.warn(`Failed to read desktop file for ${pkgname}: ${error}`);
          }
        }

        installedApps.push({
          pkgname,
          name: appName,
          version,
          arch,
          flags,
          origin: "apm",
          icon: icon || undefined,
          isDependency: !hasEntries,
        });
      }

      installedApps.sort((left, right) =>
        left.pkgname.localeCompare(right.pkgname),
      );
      return { success: true, apps: installedApps };
    } catch (error) {
      logger.error(
        `list-installed failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return {
        success: false,
        message: error instanceof Error ? error.message : String(error),
        apps: [],
      };
    }
  },
);
```

- [ ] **Step 4: Re-run the Spark helper tests**

Run: `npx vitest run src/__tests__/unit/sparkInstalledApps.test.ts`

Expected: PASS with the desktop-discovery and metadata-failure cases green.

- [ ] **Step 5: Commit the Spark discovery change**

```bash
git add electron/main/backend/sparkInstalledApps.ts electron/main/backend/install-manager.ts src/__tests__/unit/sparkInstalledApps.test.ts
git commit -m "fix(installed-apps): discover spark apps from desktop files"
```

### Task 4: Installed App Normalization And Open Action

**Files:**

- Create: `src/modules/installedApps.ts`
- Modify: `src/App.vue`
- Modify: `src/components/InstalledAppsModal.vue`
- Create: `src/__tests__/unit/installedApps.test.ts`
- Modify: `src/__tests__/unit/InstalledAppsModal.test.ts`

- [ ] **Step 1: Write the failing installed-app normalization and open-action tests**

```ts
// src/__tests__/unit/installedApps.test.ts
import { describe, expect, it } from "vitest";

import { buildInstalledApps } from "@/modules/installedApps";
import type { App, InstalledAppInfo } from "@/global/typedefinition";

const createInstalled = (
  overrides: Partial<InstalledAppInfo> = {},
): InstalledAppInfo => ({
  pkgname: "spark-reader",
  name: "Spark Reader",
  version: "1.0.0",
  arch: "amd64",
  flags: "[installed]",
  origin: "spark",
  icon: "/usr/share/pixmaps/reader.png",
  isDependency: false,
  ...overrides,
});

const createCatalogApp = (overrides: Partial<App> = {}): App => ({
  name: "Spark Reader",
  pkgname: "spark-reader",
  version: "1.0.0",
  category: "office",
  tags: "",
  more: "",
  filename: "",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "",
  img_urls: [],
  icons: "remote-icon.png",
  origin: "spark",
  currentStatus: "not-installed",
  ...overrides,
});

describe("buildInstalledApps", () => {
  it("keeps Spark desktop apps even when they are missing from the remote catalog", () => {
    const result = buildInstalledApps({
      installed: [createInstalled()],
      catalogApps: [],
      origin: "spark",
    });

    expect(result).toMatchObject([
      {
        name: "Spark Reader",
        pkgname: "spark-reader",
        category: "unknown",
        origin: "spark",
        currentStatus: "installed",
        icons: "/usr/share/pixmaps/reader.png",
      },
    ]);
  });

  it("reuses catalog metadata when the package exists in the selected origin", () => {
    const result = buildInstalledApps({
      installed: [createInstalled({ origin: "apm", pkgname: "spark-clock" })],
      catalogApps: [
        createCatalogApp({
          name: "Spark Clock",
          pkgname: "spark-clock",
          category: "utilities",
          origin: "apm",
        }),
      ],
      origin: "apm",
    });

    expect(result[0]).toMatchObject({
      name: "Spark Clock",
      pkgname: "spark-clock",
      category: "utilities",
      origin: "apm",
      currentStatus: "installed",
    });
  });
});
```

```ts
// src/__tests__/unit/InstalledAppsModal.test.ts
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import InstalledAppsModal from "@/components/InstalledAppsModal.vue";
import type { App } from "@/global/typedefinition";

const createInstalledApp = (): App => ({
  name: "Spark Reader",
  pkgname: "spark-reader",
  version: "1.0.0",
  category: "unknown",
  tags: "",
  more: "",
  filename: "",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "",
  img_urls: [],
  icons: "/usr/share/pixmaps/reader.png",
  origin: "spark",
  currentStatus: "installed",
  arch: "amd64",
  flags: "[installed]",
  isDependency: false,
});

describe("InstalledAppsModal", () => {
  it("keeps scroll chaining inside the modal list", () => {
    const { container } = render(InstalledAppsModal, {
      props: {
        show: true,
        apps: [],
        loading: false,
        error: "",
        activeOrigin: "spark",
        storeFilter: "both",
        apmAvailable: true,
      },
    });

    expect(screen.getByText("已安装应用")).toBeTruthy();
    const scrollContainer = container.querySelector(".overflow-y-auto");

    expect(scrollContainer?.className).toContain("overscroll-contain");
  });

  it("emits open-app with pkgname and origin", async () => {
    const { emitted } = render(InstalledAppsModal, {
      props: {
        show: true,
        apps: [createInstalledApp()],
        loading: false,
        error: "",
        activeOrigin: "spark",
        storeFilter: "both",
        apmAvailable: true,
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "打开" }));

    expect(emitted()["open-app"]).toEqual([["spark-reader", "spark"]]);
  });
});
```

- [ ] **Step 2: Run the installed-app tests to verify they fail**

Run: `npx vitest run src/__tests__/unit/installedApps.test.ts src/__tests__/unit/InstalledAppsModal.test.ts`

Expected: FAIL because `src/modules/installedApps.ts` does not exist yet, and `InstalledAppsModal.vue` does not emit `open-app`.

- [ ] **Step 3: Implement normalization, remove the Spark catalog filter, and add the open button**

```ts
// src/modules/installedApps.ts
import type { App, InstalledAppInfo } from "@/global/typedefinition";

export const buildInstalledApps = ({
  installed,
  catalogApps,
  origin,
}: {
  installed: InstalledAppInfo[];
  catalogApps: App[];
  origin: "spark" | "apm";
}): App[] => {
  return installed.map((app) => {
    const catalogApp = catalogApps.find(
      (item) => item.pkgname === app.pkgname && item.origin === origin,
    );

    if (catalogApp) {
      return {
        ...catalogApp,
        flags: app.flags,
        arch: app.arch,
        currentStatus: "installed" as const,
        isDependency: app.isDependency,
      };
    }

    return {
      name: app.name || app.pkgname,
      pkgname: app.pkgname,
      version: app.version,
      category: "unknown",
      tags: "",
      more: "",
      filename: "",
      torrent_address: "",
      author: "",
      contributor: "",
      website: "",
      update: "",
      size: "",
      img_urls: [],
      icons: app.icon || "",
      origin: app.origin,
      currentStatus: "installed" as const,
      arch: app.arch,
      flags: app.flags,
      isDependency: app.isDependency,
    };
  });
};
```

```vue
<!-- src/components/InstalledAppsModal.vue -->
<template>
  <Transition
    enter-active-class="duration-200 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/70 px-4 py-10"
      @click.self="$emit('close')"
      @wheel="onOverlayWheel"
    >
      <div
        class="flex w-full max-w-4xl max-h-[85vh] flex-col rounded-3xl border border-white/10 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          class="flex items-start justify-between border-b border-slate-200/70 p-6 dark:border-slate-800/70"
        >
          <div>
            <p class="text-2xl font-semibold text-slate-900 dark:text-white">
              已安装应用
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              管理本机安装的应用程序
            </p>
          </div>
          <div class="flex items-center gap-3">
            <div
              v-if="storeFilter === 'both'"
              class="flex items-center rounded-2xl border border-slate-200/70 p-1 dark:border-slate-800/70"
            >
              <button
                type="button"
                class="rounded-xl px-4 py-1.5 text-sm font-semibold transition"
                :class="
                  activeOrigin === 'apm'
                    ? 'bg-brand/10 text-brand dark:bg-brand/15'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                "
                :disabled="!apmAvailable"
                @click="$emit('switch-origin', 'apm')"
              >
                APM 软件
              </button>
              <button
                type="button"
                class="rounded-xl px-4 py-1.5 text-sm font-semibold transition"
                :class="
                  activeOrigin === 'spark'
                    ? 'bg-brand/10 text-brand dark:bg-brand/15'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                "
                @click="$emit('switch-origin', 'spark')"
              >
                Spark 软件
              </button>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
              :disabled="loading"
              @click="$emit('refresh')"
            >
              <i class="fas fa-sync-alt"></i>
              刷新
            </button>
            <button
              type="button"
              class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-500 transition hover:text-slate-900 dark:border-slate-700"
              @click="$emit('close')"
              aria-label="关闭"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
        </div>

        <div
          class="flex-1 overflow-y-auto overscroll-contain scrollbar-nowidth scrollbar-thumb-slate-200 p-6 space-y-4 dark:scrollbar-thumb-slate-700"
        >
          <div
            v-if="loading"
            class="rounded-2xl border border-dashed border-slate-200/80 px-4 py-10 text-center text-slate-500 dark:border-slate-800/80 dark:text-slate-400"
          >
            正在读取已安装应用…
          </div>
          <div
            v-else-if="error"
            class="rounded-2xl border border-rose-200/70 bg-rose-50/60 px-4 py-6 text-center text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10"
          >
            {{ error }}
          </div>
          <div
            v-else-if="apps.length === 0"
            class="rounded-2xl border border-slate-200/70 px-4 py-10 text-center text-slate-500 dark:border-slate-800/70 dark:text-slate-400"
          >
            暂无已安装应用
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="app in apps"
              :key="app.pkgname"
              class="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex items-center gap-3">
                <div
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  <img
                    v-show="!iconErrors[app.pkgname] && getIconUrl(app)"
                    :src="getIconUrl(app)"
                    class="h-8 w-8 object-contain"
                    alt=""
                    @error="iconErrors[app.pkgname] = true"
                  />
                  <i
                    v-show="iconErrors[app.pkgname] || !getIconUrl(app)"
                    class="fas fa-cube text-xl text-slate-400"
                  ></i>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <p
                      class="text-base font-semibold text-slate-900 dark:text-white"
                    >
                      {{ app.name }}
                    </p>
                    <span
                      v-if="app.isDependency"
                      class="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                    >
                      依赖项
                    </span>
                  </div>
                  <div
                    class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
                  >
                    <span class="font-mono">{{ app.pkgname }}</span>
                    <span>·</span>
                    <span>{{ app.version }}</span>
                    <span>·</span>
                    <span>{{ app.arch }}</span>
                  </div>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-slate-300/60 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  @click="$emit('open-app', app.pkgname, app.origin)"
                >
                  <i class="fas fa-play"></i>
                  打开
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-rose-300/60 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                  :disabled="app.currentStatus === 'not-installed'"
                  @click="$emit('uninstall', app)"
                >
                  <i class="fas fa-trash"></i>
                  卸载
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { App } from "../global/typedefinition";
import { APM_STORE_BASE_URL } from "../global/storeConfig";

const iconErrors = reactive<Record<string, boolean>>({});

const getIconUrl = (app: App) => {
  if (app.icons && app.icons.startsWith("/")) return `file://${app.icons}`;
  if (!app.category || app.category === "unknown") return "";
  const arch = window.apm_store.arch || "amd64";
  const finalArch = app.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
  return `${APM_STORE_BASE_URL}/${finalArch}/${app.category}/${app.pkgname}/icon.png`;
};

defineProps<{
  show: boolean;
  apps: App[];
  loading: boolean;
  error: string;
  activeOrigin: "apm" | "spark";
  storeFilter: "spark" | "apm" | "both";
  apmAvailable: boolean;
}>();

defineEmits<{
  (e: "close"): void;
  (e: "refresh"): void;
  (e: "open-app", pkgname: string, origin: "apm" | "spark"): void;
  (e: "uninstall", app: App): void;
  (e: "switch-origin", origin: "apm" | "spark"): void;
}>();

const onOverlayWheel = (e: WheelEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest(".overflow-y-auto, .overflow-auto")) return;
  e.preventDefault();
};
</script>
```

```ts
// src/App.vue
import { buildInstalledApps } from "./modules/installedApps";

<InstalledAppsModal
  :show="showInstalledModal"
  :apps="installedApps"
  :loading="installedLoading"
  :error="installedError"
  :active-origin="activeInstalledOrigin"
  :store-filter="storeFilter"
  :apm-available="apmAvailable"
  @close="closeInstalledModal"
  @refresh="refreshInstalledApps"
  @open-app="openDownloadedApp"
  @uninstall="uninstallInstalledApp"
  @switch-origin="handleSwitchOrigin"
 />

const refreshInstalledApps = async () => {
  installedLoading.value = true;
  installedError.value = "";
  try {
    const origin = activeInstalledOrigin.value;
    const result = await window.ipcRenderer.invoke("list-installed", origin);
    if (!result?.success) {
      installedApps.value = [];
      installedError.value = result?.message || "读取已安装应用失败";
      return;
    }

    installedApps.value = buildInstalledApps({
      installed: result.apps,
      catalogApps: apps.value,
      origin,
    });
  } catch (error: unknown) {
    installedApps.value = [];
    installedError.value = (error as Error)?.message || "读取已安装应用失败";
  } finally {
    installedLoading.value = false;
  }
};
```

- [ ] **Step 4: Re-run the installed-app tests**

Run: `npx vitest run src/__tests__/unit/installedApps.test.ts src/__tests__/unit/InstalledAppsModal.test.ts`

Expected: PASS with Spark fallback-card coverage and the `open-app` emission check green.

- [ ] **Step 5: Commit the installed-app UI change**

```bash
git add src/modules/installedApps.ts src/App.vue src/components/InstalledAppsModal.vue src/__tests__/unit/installedApps.test.ts src/__tests__/unit/InstalledAppsModal.test.ts
git commit -m "feat(installed-apps): open local apps from software manager"
```

## Final Verification

Run these commands after the four tasks above are complete:

1. `npx vitest run src/__tests__/unit/update-center/store.test.ts src/__tests__/unit/update-center/UpdateCenterModal.test.ts src/__tests__/unit/sparkInstalledApps.test.ts src/__tests__/unit/installedApps.test.ts src/__tests__/unit/InstalledAppsModal.test.ts`
2. `npm run lint`
3. `npm run build:vite`

Then do one manual smoke pass in the running app:

1. Open the update center and confirm the modal appears immediately with `正在检查更新…` before the first snapshot arrives.
2. Trigger update-center refresh and confirm the refresh button is disabled while `正在刷新更新列表…` is visible.
3. Open the installed-apps modal with `Spark 软件` selected and confirm desktop apps from `/usr/share/applications` appear even when they are absent from the remote store catalog.
4. Click `打开` on one `spark` entry and one `apm` entry and confirm each one goes through the existing `launch-app` IPC path.
