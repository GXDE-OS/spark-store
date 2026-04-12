# Update Center Icon Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change Electron update-center icons to load in the order `localIcon -> remoteIcon -> placeholder`, so a successful local icon never triggers remote/default loading, but failed local loads still fall through to the remote icon.

**Architecture:** Split the current single `icon` field into two explicit sources resolved in the main process: `localIcon` and `remoteIcon`. Keep URL/path resolution in `electron/main/backend/update-center/icons.ts`, pass both fields through the service snapshot, and let `UpdateCenterItem.vue` own the runtime fallback state when `img` emits `error`.

**Tech Stack:** Electron main process, Node.js `fs`/`path`, Vue 3 `<script setup>`, TypeScript strict mode, Vitest, Testing Library Vue.

---

## File Map

- Modify: `electron/main/backend/update-center/types.ts` - replace the single update-center icon field with `localIcon` and `remoteIcon`.
- Modify: `electron/main/backend/update-center/icons.ts` - keep local/remote resolution helpers and return both candidates via `resolveUpdateItemIcons()`.
- Modify: `electron/main/backend/update-center/index.ts` - enrich loaded update items with the two icon fields instead of one final `icon`.
- Modify: `electron/main/backend/update-center/service.ts` - expose `localIcon` and `remoteIcon` to renderer item/task snapshots.
- Modify: `src/global/typedefinition.ts` - update renderer-facing update-center item/task types.
- Modify: `src/components/update-center/UpdateCenterItem.vue` - render the current icon candidate and advance from local to remote to placeholder on load failures.
- Modify: `src/__tests__/unit/update-center/icons.test.ts` - verify icon helper output is now `{ localIcon?, remoteIcon? }`.
- Modify: `src/__tests__/unit/update-center/load-items.test.ts` - verify loaded items receive `remoteIcon` instead of the old `icon` field.
- Modify: `src/__tests__/unit/update-center/registerUpdateCenter.test.ts` - verify service task snapshots preserve both icon fields.
- Modify: `src/__tests__/unit/update-center/UpdateCenterItem.test.ts` - verify the renderer fallback order.

### Task 1: Split Backend Icon Resolution Into Local And Remote Sources

**Files:**

- Modify: `electron/main/backend/update-center/types.ts`
- Modify: `electron/main/backend/update-center/icons.ts`
- Test: `src/__tests__/unit/update-center/icons.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the single-icon assertions in `src/__tests__/unit/update-center/icons.test.ts` with these four tests:

```ts
it("returns both localIcon and remoteIcon when an aptss desktop icon resolves", async () => {
  const pkgname = "spark-weather";
  const applicationsDirectory = "/usr/share/applications";
  const desktopPath = `${applicationsDirectory}/weather-launcher.desktop`;
  const iconPath = `/usr/share/pixmaps/${pkgname}.png`;
  const { resolveUpdateItemIcons } = await loadIconsModule({
    directories: {
      [applicationsDirectory]: ["weather-launcher.desktop"],
    },
    files: {
      [desktopPath]: `[Desktop Entry]\nName=Spark Weather\nIcon=${iconPath}\n`,
      [iconPath]: "png",
    },
    packageFiles: {
      [pkgname]: [desktopPath],
    },
  });

  expect(
    resolveUpdateItemIcons({
      pkgname,
      source: "aptss",
      currentVersion: "1.0.0",
      nextVersion: "2.0.0",
      category: "tools",
      arch: "amd64",
    }),
  ).toEqual({
    localIcon: iconPath,
    remoteIcon:
      "https://erotica.spark-app.store/amd64-store/tools/spark-weather/icon.png",
  });
});

it("returns only remoteIcon when no local icon resolves", async () => {
  const { resolveUpdateItemIcons } = await loadIconsModule({});

  expect(
    resolveUpdateItemIcons({
      pkgname: "spark-clock",
      source: "apm",
      currentVersion: "1.0.0",
      nextVersion: "2.0.0",
      category: "utility",
      arch: "amd64",
    }),
  ).toEqual({
    remoteIcon:
      "https://erotica.spark-app.store/amd64-apm/utility/spark-clock/icon.png",
  });
});

it("returns only localIcon when a remote fallback URL cannot be built", async () => {
  const pkgname = "spark-reader";
  const applicationsDirectory = "/usr/share/applications";
  const desktopPath = `${applicationsDirectory}/reader-launcher.desktop`;
  const iconPath = `/usr/share/pixmaps/${pkgname}.png`;
  const { resolveUpdateItemIcons } = await loadIconsModule({
    directories: {
      [applicationsDirectory]: ["reader-launcher.desktop"],
    },
    files: {
      [desktopPath]: `[Desktop Entry]\nName=Spark Reader\nIcon=${iconPath}\n`,
      [iconPath]: "png",
    },
    packageFiles: {
      [pkgname]: [desktopPath],
    },
  });

  expect(
    resolveUpdateItemIcons({
      pkgname,
      source: "aptss",
      currentVersion: "1.0.0",
      nextVersion: "2.0.0",
    }),
  ).toEqual({
    localIcon: iconPath,
  });
});

it("returns an empty object when neither local nor remote icons are available", async () => {
  const { resolveUpdateItemIcons } = await loadIconsModule({});

  expect(
    resolveUpdateItemIcons({
      pkgname: "spark-empty",
      source: "aptss",
      currentVersion: "1.0.0",
      nextVersion: "2.0.0",
    }),
  ).toEqual({});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/icons.test.ts`

Expected: FAIL because `resolveUpdateItemIcon()` still returns a string and `resolveUpdateItemIcons()` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Update `electron/main/backend/update-center/types.ts` so the interface defines the two source fields instead of `icon`:

```ts
export interface UpdateCenterItem {
  pkgname: string;
  source: UpdateSource;
  currentVersion: string;
  nextVersion: string;
  arch?: string;
  category?: string;
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
```

Replace the old single-result helper at the end of `electron/main/backend/update-center/icons.ts` with this code:

```ts
export interface UpdateItemIcons {
  localIcon?: string;
  remoteIcon?: string;
}

export const resolveUpdateItemIcons = (
  item: UpdateCenterItem,
): UpdateItemIcons => {
  const localIcon =
    item.source === "aptss"
      ? resolveDesktopIcon(item.pkgname)
      : resolveApmIcon(item.pkgname);
  const remoteIcon =
    buildRemoteFallbackIconUrl({
      pkgname: item.pkgname,
      source: item.source,
      arch: item.arch,
      category: item.category,
    }) || undefined;

  return {
    ...(localIcon ? { localIcon } : {}),
    ...(remoteIcon ? { remoteIcon } : {}),
  };
};
```

Keep `resolveDesktopIcon()`, `resolveApmIcon()`, and `buildRemoteFallbackIconUrl()` unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/icons.test.ts`

Expected: PASS with the updated icon helper tests green.

- [ ] **Step 5: Commit**

```bash
git add electron/main/backend/update-center/types.ts electron/main/backend/update-center/icons.ts src/__tests__/unit/update-center/icons.test.ts
git commit -m "fix(update-center): split local and remote icon sources"
```

### Task 2: Propagate Icon Sources Through Loaded Items And Service Snapshots

**Files:**

- Modify: `electron/main/backend/update-center/index.ts`
- Modify: `electron/main/backend/update-center/service.ts`
- Modify: `src/global/typedefinition.ts`
- Test: `src/__tests__/unit/update-center/load-items.test.ts`
- Test: `src/__tests__/unit/update-center/registerUpdateCenter.test.ts`

- [ ] **Step 1: Write the failing tests**

Update the expected item snapshots in `src/__tests__/unit/update-center/load-items.test.ts` from `icon` to `remoteIcon`:

```ts
expect(result.items).toContainEqual({
  pkgname: "spark-weather",
  source: "apm",
  currentVersion: "1.5.0",
  nextVersion: "3.0.0",
  arch: "amd64",
  category: "tools",
  remoteIcon:
    "https://erotica.spark-app.store/amd64-apm/tools/spark-weather/icon.png",
  downloadUrl: "https://example.invalid/spark-weather_3.0.0_amd64.deb",
  fileName: "spark-weather_3.0.0_amd64.deb",
  size: 123456,
  sha512: "deadbeef",
  isMigration: true,
  migrationSource: "aptss",
  migrationTarget: "apm",
  aptssVersion: "2.0.0",
});
```

```ts
expect(result.items).toEqual([
  {
    pkgname: "spark-notes",
    source: "aptss",
    currentVersion: "1.0.0",
    nextVersion: "2.0.0",
    arch: "amd64",
    category: "office",
    remoteIcon:
      "https://erotica.spark-app.store/amd64-store/office/spark-notes/icon.png",
  },
]);
```

```ts
expect(secondResult.items).toEqual([
  {
    pkgname: "spark-notes",
    source: "aptss",
    currentVersion: "1.0.0",
    nextVersion: "2.0.0",
    arch: "amd64",
    category: "office",
    remoteIcon:
      "https://erotica.spark-app.store/amd64-store/office/spark-notes/icon.png",
  },
]);
```

```ts
expect(result.items).toEqual([
  {
    pkgname: "spark-notes",
    source: "aptss",
    currentVersion: "1.0.0",
    nextVersion: "2.0.0",
    arch: "amd64",
    category: "office",
    remoteIcon:
      "https://erotica.spark-app.store/amd64-store/office/spark-notes/icon.png",
  },
]);
```

Replace the icon-preservation test in `src/__tests__/unit/update-center/registerUpdateCenter.test.ts` with:

```ts
it("service task snapshots keep localIcon and remoteIcon for queued work", async () => {
  const service = createUpdateCenterService({
    loadItems: async () => [
      {
        ...createItem(),
        localIcon: "/icons/weather.png",
        remoteIcon: "https://example.com/weather.png",
      },
    ],
    createTaskRunner: (queue: UpdateCenterQueue) => ({
      cancelActiveTask: vi.fn(),
      runNextTask: async () => {
        const task = queue.getNextQueuedTask();
        if (!task) {
          return null;
        }

        queue.markActiveTask(task.id, "installing");
        queue.finishTask(task.id, "completed");
        return task;
      },
    }),
  });

  await service.refresh();
  await service.start(["aptss:spark-weather"]);

  expect(service.getState().tasks).toMatchObject([
    {
      taskKey: "aptss:spark-weather",
      localIcon: "/icons/weather.png",
      remoteIcon: "https://example.com/weather.png",
      status: "completed",
    },
  ]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/__tests__/unit/update-center/load-items.test.ts src/__tests__/unit/update-center/registerUpdateCenter.test.ts`

Expected: FAIL because the loader and service snapshots still publish `icon` instead of `localIcon` / `remoteIcon`.

- [ ] **Step 3: Write minimal implementation**

Update the icon enrichment function in `electron/main/backend/update-center/index.ts`:

```ts
import { resolveUpdateItemIcons } from "./icons";

const enrichItemIcons = (items: UpdateCenterItem[]): UpdateCenterItem[] => {
  return items.map((item) => {
    const { localIcon, remoteIcon } = resolveUpdateItemIcons(item);
    if (!localIcon && !remoteIcon) {
      return item;
    }

    return {
      ...item,
      ...(localIcon ? { localIcon } : {}),
      ...(remoteIcon ? { remoteIcon } : {}),
    };
  });
};
```

Update the renderer-facing item/task types and `toState()` mapping in `electron/main/backend/update-center/service.ts`:

```ts
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
  tasks: snapshot.tasks.map((task) => ({
    taskKey: getTaskKey(task.item),
    packageName: task.pkgname,
    source: task.item.source,
    localIcon: task.item.localIcon,
    remoteIcon: task.item.remoteIcon,
    status: task.status,
    progress: task.progress,
    logs: task.logs.map((log) => ({ ...log })),
    errorMessage: task.error ?? "",
  })),
  warnings: [...snapshot.warnings],
  hasRunningTasks: snapshot.hasRunningTasks,
});
```

Update the update-center renderer types in `src/global/typedefinition.ts`:

```ts
export interface UpdateCenterItem {
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

export interface UpdateCenterTaskState {
  taskKey: string;
  packageName: string;
  source: UpdateSource;
  localIcon?: string;
  remoteIcon?: string;
  status: UpdateCenterTaskStatus;
  progress: number;
  logs: Array<{ time: number; message: string }>;
  errorMessage: string;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- --run src/__tests__/unit/update-center/load-items.test.ts src/__tests__/unit/update-center/registerUpdateCenter.test.ts`

Expected: PASS with the loader and service tests green.

- [ ] **Step 5: Commit**

```bash
git add electron/main/backend/update-center/index.ts electron/main/backend/update-center/service.ts src/global/typedefinition.ts src/__tests__/unit/update-center/load-items.test.ts src/__tests__/unit/update-center/registerUpdateCenter.test.ts
git commit -m "refactor(update-center): propagate icon fallback fields"
```

### Task 3: Implement Renderer Fallback Order In UpdateCenterItem.vue

**Files:**

- Modify: `src/components/update-center/UpdateCenterItem.vue`
- Test: `src/__tests__/unit/update-center/UpdateCenterItem.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the contents of `src/__tests__/unit/update-center/UpdateCenterItem.test.ts` with:

```ts
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import UpdateCenterItem from "@/components/update-center/UpdateCenterItem.vue";
import type {
  UpdateCenterItem as UpdateCenterItemData,
  UpdateCenterTaskState,
} from "@/global/typedefinition";

const createItem = (
  overrides: Partial<UpdateCenterItemData> = {},
): UpdateCenterItemData => ({
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

describe("UpdateCenterItem", () => {
  it("renders localIcon first when both icon sources exist", () => {
    render(UpdateCenterItem, {
      props: {
        item: createItem({
          localIcon: "/usr/share/pixmaps/spark-weather.png",
          remoteIcon: "https://example.com/spark-weather.png",
        }),
        task: createTask(),
        selected: false,
      },
    });

    const icon = screen.getByRole("img", { name: "Spark Weather 图标" });

    expect(icon).toHaveAttribute(
      "src",
      "file:///usr/share/pixmaps/spark-weather.png",
    );
  });

  it("falls back to remoteIcon when localIcon fails", async () => {
    render(UpdateCenterItem, {
      props: {
        item: createItem({
          localIcon: "/usr/share/pixmaps/spark-weather.png",
          remoteIcon: "https://example.com/spark-weather.png",
        }),
        task: createTask(),
        selected: false,
      },
    });

    const icon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(icon);

    expect(icon).toHaveAttribute(
      "src",
      "https://example.com/spark-weather.png",
    );
  });

  it("falls back to the placeholder after localIcon and remoteIcon both fail", async () => {
    render(UpdateCenterItem, {
      props: {
        item: createItem({
          localIcon: "/usr/share/pixmaps/spark-weather.png",
          remoteIcon: "https://example.com/spark-weather.png",
        }),
        task: createTask(),
        selected: false,
      },
    });

    const icon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(icon);
    await fireEvent.error(icon);

    expect(icon.getAttribute("src")).toContain("data:image/svg+xml");
    expect(icon.getAttribute("src")).not.toContain(
      "https://example.com/spark-weather.png",
    );
  });

  it("restarts from localIcon when a new item is rendered", async () => {
    const { rerender } = render(UpdateCenterItem, {
      props: {
        item: createItem({
          localIcon: "/usr/share/pixmaps/spark-weather.png",
          remoteIcon: "https://example.com/spark-weather.png",
        }),
        task: createTask(),
        selected: false,
      },
    });

    const firstIcon = screen.getByRole("img", { name: "Spark Weather 图标" });

    await fireEvent.error(firstIcon);

    expect(firstIcon).toHaveAttribute(
      "src",
      "https://example.com/spark-weather.png",
    );

    await rerender({
      item: createItem({
        taskKey: "aptss:spark-clock",
        packageName: "spark-clock",
        displayName: "Spark Clock",
        localIcon: "/usr/share/pixmaps/spark-clock.png",
        remoteIcon: "https://example.com/spark-clock.png",
      }),
      task: createTask({
        taskKey: "aptss:spark-clock",
        packageName: "spark-clock",
      }),
      selected: false,
    });

    const nextIcon = screen.getByRole("img", { name: "Spark Clock 图标" });

    expect(nextIcon).toHaveAttribute(
      "src",
      "file:///usr/share/pixmaps/spark-clock.png",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/UpdateCenterItem.test.ts`

Expected: FAIL because the component still reads `item.icon` and goes straight from a single failed image to the placeholder.

- [ ] **Step 3: Write minimal implementation**

Replace the `<script setup>` block in `src/components/update-center/UpdateCenterItem.vue` with:

```ts
<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  UpdateCenterItem,
  UpdateCenterTaskState,
} from "@/global/typedefinition";

const props = defineProps<{
  item: UpdateCenterItem;
  task?: UpdateCenterTaskState;
  selected: boolean;
}>();

const PLACEHOLDER_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Crect width="48" height="48" rx="12" fill="%23e2e8f0"/%3E%3Cpath d="M17 31h14v2H17zm3-12h8a2 2 0 0 1 2 2v8H18v-8a2 2 0 0 1 2-2" fill="%2394a3b8"/%3E%3C/svg%3E';
const currentIconIndex = ref(0);
const allCandidatesFailed = ref(false);

defineEmits<{
  (e: "toggle-selection"): void;
}>();

const normalizeIconSrc = (icon: string): string => {
  if (/^[a-z]+:\/\//i.test(icon)) {
    return icon;
  }

  return icon.startsWith("/") ? `file://${icon}` : icon;
};

const iconCandidates = computed(() => {
  return [props.item.localIcon, props.item.remoteIcon]
    .filter((icon): icon is string => Boolean(icon && icon.trim().length > 0))
    .map((icon) => normalizeIconSrc(icon));
});

const resetIconFallback = () => {
  currentIconIndex.value = 0;
  allCandidatesFailed.value = false;
};

const handleIconError = () => {
  if (currentIconIndex.value < iconCandidates.value.length - 1) {
    currentIconIndex.value += 1;
    return;
  }

  allCandidatesFailed.value = true;
};

watch(
  () => props.item,
  () => {
    resetIconFallback();
  },
);

const iconSrc = computed(() => {
  if (allCandidatesFailed.value || iconCandidates.value.length === 0) {
    return PLACEHOLDER_ICON;
  }

  return iconCandidates.value[currentIconIndex.value] ?? PLACEHOLDER_ICON;
});

const sourceLabel = computed(() => {
  return props.item.source === "apm" ? "APM" : "传统deb";
});

const statusLabel = computed(() => {
  switch (props.task?.status) {
    case "downloading":
      return "下载中";
    case "installing":
      return "安装中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    default:
      return "待处理";
  }
});

const showProgress = computed(() => {
  return (
    props.task?.status === "downloading" || props.task?.status === "installing"
  );
});

const progressText = computed(() => `${props.task?.progress ?? 0}%`);
const progressStyle = computed(() => ({ width: progressText.value }));
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/UpdateCenterItem.test.ts`

Expected: PASS with all fallback-order component tests green.

- [ ] **Step 5: Commit**

```bash
git add src/components/update-center/UpdateCenterItem.vue src/__tests__/unit/update-center/UpdateCenterItem.test.ts
git commit -m "fix(update-center): cascade icon fallback in renderer"
```

### Task 4: Verify The Full Change Set

**Files:**

- Verify only: `electron/main/backend/update-center/types.ts`
- Verify only: `electron/main/backend/update-center/icons.ts`
- Verify only: `electron/main/backend/update-center/index.ts`
- Verify only: `electron/main/backend/update-center/service.ts`
- Verify only: `src/global/typedefinition.ts`
- Verify only: `src/components/update-center/UpdateCenterItem.vue`
- Verify only: `src/__tests__/unit/update-center/icons.test.ts`
- Verify only: `src/__tests__/unit/update-center/load-items.test.ts`
- Verify only: `src/__tests__/unit/update-center/registerUpdateCenter.test.ts`
- Verify only: `src/__tests__/unit/update-center/UpdateCenterItem.test.ts`

- [ ] **Step 1: Run the focused update-center test suite**

Run: `npm run test -- --run src/__tests__/unit/update-center/icons.test.ts src/__tests__/unit/update-center/load-items.test.ts src/__tests__/unit/update-center/registerUpdateCenter.test.ts src/__tests__/unit/update-center/UpdateCenterItem.test.ts`

Expected: PASS with all four update-center suites green.

- [ ] **Step 2: Run the formatter**

Run: `npm run format`

Expected: command exits 0 after formatting the touched files.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: PASS with no ESLint or Prettier violations.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: PASS with Vite/Electron build output generated successfully and no TypeScript errors.
