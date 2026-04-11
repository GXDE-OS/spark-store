# Update Center Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add icons to the Electron update-center list using local icon resolution first, remote URL fallback second, and a frontend placeholder last.

**Architecture:** Add a focused `icons.ts` helper in the update-center backend to resolve icon paths/URLs while loading update items, then pass the single `icon` field through the service snapshot into the renderer. Keep the Vue side minimal by rendering a fixed icon slot in `UpdateCenterItem.vue` and falling back to a placeholder icon on `img` load failure.

**Tech Stack:** Electron main process, Node.js `fs`/`path`, Vue 3 `<script setup>`, Tailwind CSS 4, Vitest, Testing Library Vue, TypeScript strict mode.

---

## File Map

- Create: `electron/main/backend/update-center/icons.ts` — resolves update-item icons from local desktop/APM metadata and remote fallback URLs.
- Modify: `electron/main/backend/update-center/types.ts` — add backend `icon?: string` field.
- Modify: `electron/main/backend/update-center/index.ts` — enrich loaded update items with resolved icons.
- Modify: `electron/main/backend/update-center/service.ts` — expose `icon` in renderer-facing snapshots.
- Modify: `src/global/typedefinition.ts` — add renderer-facing `icon?: string` field.
- Modify: `src/components/update-center/UpdateCenterItem.vue` — render icon slot and placeholder fallback.
- Test: `src/__tests__/unit/update-center/icons.test.ts` — backend icon-resolution tests.
- Modify: `src/__tests__/unit/update-center/load-items.test.ts` — verify loaded update items include icon data when available.
- Create: `src/__tests__/unit/update-center/UpdateCenterItem.test.ts` — component-level icon rendering and fallback tests.

### Task 1: Add Backend Icon Resolution Helpers

**Files:**

- Create: `electron/main/backend/update-center/icons.ts`
- Modify: `electron/main/backend/update-center/types.ts`
- Test: `src/__tests__/unit/update-center/icons.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  buildRemoteFallbackIconUrl,
  resolveApmIcon,
  resolveDesktopIcon,
} from "../../../../electron/main/backend/update-center/icons";

describe("update-center icons", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("prefers local desktop icon paths for aptss items", () => {
    const existsSync = vi.spyOn(require("node:fs"), "existsSync");
    const readdirSync = vi.spyOn(require("node:fs"), "readdirSync");
    const readFileSync = vi.spyOn(require("node:fs"), "readFileSync");

    existsSync.mockImplementation((target) =>
      String(target).includes("/usr/share/applications"),
    );
    readdirSync.mockReturnValue(["spark-weather.desktop"]);
    readFileSync.mockReturnValue(
      "Name=Spark Weather\nIcon=/usr/share/icons/hicolor/128x128/apps/spark-weather.png\n",
    );

    expect(resolveDesktopIcon("spark-weather")).toBe(
      "/usr/share/icons/hicolor/128x128/apps/spark-weather.png",
    );
  });

  it("resolves APM icon names from entries/icons when desktop icon is not absolute", () => {
    const existsSync = vi.spyOn(require("node:fs"), "existsSync");
    const readdirSync = vi.spyOn(require("node:fs"), "readdirSync");
    const readFileSync = vi.spyOn(require("node:fs"), "readFileSync");

    existsSync.mockImplementation(
      (target) =>
        String(target).includes(
          "/var/lib/apm/apm/files/ace-env/var/lib/apm/com.qihoo.360zip/entries/icons/hicolor/48x48/apps/360zip.png",
        ) ||
        String(target).includes(
          "/var/lib/apm/apm/files/ace-env/var/lib/apm/com.qihoo.360zip/entries/applications",
        ),
    );
    readdirSync.mockReturnValue(["360zip.desktop"]);
    readFileSync.mockReturnValue("Name=360压缩\nIcon=360zip\n");

    expect(resolveApmIcon("com.qihoo.360zip")).toBe(
      "/var/lib/apm/apm/files/ace-env/var/lib/apm/com.qihoo.360zip/entries/icons/hicolor/48x48/apps/360zip.png",
    );
  });

  it("builds a remote fallback URL when category and arch are available", () => {
    expect(
      buildRemoteFallbackIconUrl({
        pkgname: "spark-weather",
        source: "aptss",
        arch: "amd64",
        category: "network",
      }),
    ).toBe(
      "https://erotica.spark-app.store/amd64-store/network/spark-weather/icon.png",
    );
  });

  it("returns empty string when neither local nor remote icon can be determined", () => {
    expect(
      buildRemoteFallbackIconUrl({
        pkgname: "spark-weather",
        source: "aptss",
        arch: "amd64",
      }),
    ).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/icons.test.ts`

Expected: FAIL with `Cannot find module '../../../../electron/main/backend/update-center/icons'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// electron/main/backend/update-center/types.ts
export interface UpdateCenterItem {
  pkgname: string;
  source: UpdateSource;
  currentVersion: string;
  nextVersion: string;
  icon?: string;
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

```ts
// electron/main/backend/update-center/icons.ts
import fs from "node:fs";
import path from "node:path";

const APM_STORE_BASE_URL = "https://erotica.spark-app.store";
const APM_BASE_PATH = "/var/lib/apm/apm/files/ace-env/var/lib/apm";

export const resolveDesktopIcon = (pkgname: string): string => {
  const desktopRoots = [
    "/usr/share/applications",
    `/opt/apps/${pkgname}/entries/applications`,
  ];

  for (const root of desktopRoots) {
    if (!fs.existsSync(root)) continue;
    for (const file of fs.readdirSync(root)) {
      if (!file.endsWith(".desktop")) continue;
      const content = fs.readFileSync(path.join(root, file), "utf8");
      const match = content.match(/^Icon=(.+)$/m);
      if (!match) continue;
      const iconValue = match[1].trim();
      if (iconValue.startsWith("/")) return iconValue;
    }
  }

  return "";
};

export const resolveApmIcon = (pkgname: string): string => {
  const entriesPath = path.join(
    APM_BASE_PATH,
    pkgname,
    "entries",
    "applications",
  );
  if (!fs.existsSync(entriesPath)) return "";

  for (const file of fs.readdirSync(entriesPath)) {
    if (!file.endsWith(".desktop")) continue;
    const content = fs.readFileSync(path.join(entriesPath, file), "utf8");
    const match = content.match(/^Icon=(.+)$/m);
    if (!match) continue;
    const iconValue = match[1].trim();
    if (iconValue.startsWith("/")) return iconValue;

    const iconPath = path.join(
      APM_BASE_PATH,
      pkgname,
      "entries",
      "icons",
      "hicolor",
      "48x48",
      "apps",
      `${iconValue}.png`,
    );
    if (fs.existsSync(iconPath)) return iconPath;
  }

  return "";
};

export const buildRemoteFallbackIconUrl = (input: {
  pkgname: string;
  source: "aptss" | "apm";
  arch: string;
  category?: string;
}): string => {
  if (!input.category) return "";
  const finalArch =
    input.source === "aptss" ? `${input.arch}-store` : `${input.arch}-apm`;
  return `${APM_STORE_BASE_URL}/${finalArch}/${input.category}/${input.pkgname}/icon.png`;
};

export const resolveUpdateItemIcon = (item: {
  pkgname: string;
  source: "aptss" | "apm";
  arch?: string;
  category?: string;
}): string => {
  const localIcon =
    item.source === "apm"
      ? resolveApmIcon(item.pkgname)
      : resolveDesktopIcon(item.pkgname);

  if (localIcon) {
    return localIcon;
  }

  if (!item.arch) {
    return "";
  }

  return buildRemoteFallbackIconUrl({
    pkgname: item.pkgname,
    source: item.source,
    arch: item.arch,
    category: item.category,
  });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/icons.test.ts`

Expected: PASS with 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add electron/main/backend/update-center/types.ts electron/main/backend/update-center/icons.ts src/__tests__/unit/update-center/icons.test.ts
git commit -m "feat(update-center): add icon resolution helpers"
```

### Task 2: Enrich Loaded Update Items with Icons

**Files:**

- Modify: `electron/main/backend/update-center/index.ts`
- Modify: `electron/main/backend/update-center/service.ts`
- Modify: `src/global/typedefinition.ts`
- Modify: `src/__tests__/unit/update-center/load-items.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../electron/main/backend/update-center/icons", () => ({
  resolveUpdateItemIcon: vi.fn((item) =>
    item.pkgname === "spark-weather"
      ? "/usr/share/icons/hicolor/128x128/apps/spark-weather.png"
      : "",
  ),
}));

import { loadUpdateCenterItems } from "../../../../electron/main/backend/update-center";

describe("update-center load items", () => {
  it("adds icon data to loaded update items", async () => {
    const result = await loadUpdateCenterItems(async (command, args) => {
      const key = `${command} ${args.join(" ")}`;
      if (key.includes("list --upgradable")) {
        return {
          code: 0,
          stdout: "spark-weather/stable 2.0.0 amd64 [upgradable from: 1.0.0]",
          stderr: "",
        };
      }

      if (key.includes("dpkg-query")) {
        return {
          code: 0,
          stdout: "spark-weather\tinstall ok installed\n",
          stderr: "",
        };
      }

      return { code: 0, stdout: "", stderr: "" };
    });

    expect(result.items).toContainEqual(
      expect.objectContaining({
        pkgname: "spark-weather",
        icon: "/usr/share/icons/hicolor/128x128/apps/spark-weather.png",
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/load-items.test.ts`

Expected: FAIL because loaded items do not yet include `icon`.

- [ ] **Step 3: Write minimal implementation**

```ts
// electron/main/backend/update-center/index.ts
import { resolveUpdateItemIcon } from "./icons";

const withResolvedIcons = (items: UpdateCenterItem[]): UpdateCenterItem[] => {
  return items.map((item) => ({
    ...item,
    icon: resolveUpdateItemIcon(item),
  }));
};

export const loadUpdateCenterItems = async (
  runCommand: UpdateCenterCommandRunner = runCommandCapture,
): Promise<UpdateCenterLoadItemsResult> => {
  const [aptssResult, apmResult, aptssInstalledResult, apmInstalledResult] =
    await Promise.all([
      runCommand(
        APTSS_LIST_UPGRADABLE_COMMAND.command,
        APTSS_LIST_UPGRADABLE_COMMAND.args,
      ),
      runCommand("apm", ["list", "--upgradable"]),
      runCommand(
        DPKG_QUERY_INSTALLED_COMMAND.command,
        DPKG_QUERY_INSTALLED_COMMAND.args,
      ),
      runCommand("apm", ["list", "--installed"]),
    ]);

  const warnings = [
    getCommandError("aptss upgradable query", aptssResult),
    getCommandError("apm upgradable query", apmResult),
    getCommandError("dpkg installed query", aptssInstalledResult),
    getCommandError("apm installed query", apmInstalledResult),
  ].filter((message): message is string => message !== null);

  const aptssItems =
    aptssResult.code === 0
      ? parseAptssUpgradableOutput(aptssResult.stdout)
      : [];
  const apmItems =
    apmResult.code === 0 ? parseApmUpgradableOutput(apmResult.stdout) : [];

  if (aptssResult.code !== 0 && apmResult.code !== 0) {
    throw new Error(warnings.join("; "));
  }

  const installedSources = buildInstalledSourceMap(
    aptssInstalledResult.code === 0 ? aptssInstalledResult.stdout : "",
    apmInstalledResult.code === 0 ? apmInstalledResult.stdout : "",
  );

  const enrichedApmItems = await enrichApmItems(apmItems, runCommand);

  return {
    items: withResolvedIcons(
      mergeUpdateSources(aptssItems, enrichedApmItems.items, installedSources),
    ),
    warnings: [...warnings, ...enrichedApmItems.warnings],
  };
};
```

```ts
// electron/main/backend/update-center/service.ts
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
    icon: item.icon,
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
```

```ts
// src/global/typedefinition.ts
export interface UpdateCenterItem {
  taskKey: string;
  packageName: string;
  displayName: string;
  currentVersion: string;
  newVersion: string;
  source: UpdateSource;
  icon?: string;
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

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/load-items.test.ts`

Expected: PASS with icon assertions included.

- [ ] **Step 5: Commit**

```bash
git add electron/main/backend/update-center/index.ts electron/main/backend/update-center/service.ts src/global/typedefinition.ts src/__tests__/unit/update-center/load-items.test.ts
git commit -m "feat(update-center): pass resolved icons to renderer"
```

### Task 3: Render Update-List Icons with Placeholder Fallback

**Files:**

- Modify: `src/components/update-center/UpdateCenterItem.vue`
- Create: `src/__tests__/unit/update-center/UpdateCenterItem.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import UpdateCenterItem from "@/components/update-center/UpdateCenterItem.vue";

const item = {
  taskKey: "aptss:spark-weather",
  packageName: "spark-weather",
  displayName: "Spark Weather",
  currentVersion: "1.0.0",
  newVersion: "2.0.0",
  source: "aptss" as const,
  icon: "/usr/share/icons/hicolor/128x128/apps/spark-weather.png",
};

describe("UpdateCenterItem", () => {
  it("renders an icon image when item.icon exists", () => {
    render(UpdateCenterItem, {
      props: { item, selected: false },
    });

    const image = screen.getByRole("img", { name: "Spark Weather 图标" });
    expect(image.getAttribute("src")).toBe(
      "file:///usr/share/icons/hicolor/128x128/apps/spark-weather.png",
    );
  });

  it("falls back to a placeholder icon when the image fails", async () => {
    render(UpdateCenterItem, {
      props: { item, selected: false },
    });

    const image = screen.getByRole("img", { name: "Spark Weather 图标" });
    await fireEvent.error(image);

    expect(screen.getByTestId("update-center-icon-fallback")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/UpdateCenterItem.test.ts`

Expected: FAIL because `UpdateCenterItem.vue` does not render icon markup yet.

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- src/components/update-center/UpdateCenterItem.vue -->
<template>
  <label
    class="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70"
  >
    <div class="flex items-start gap-3">
      <input
        type="checkbox"
        class="mt-1 h-4 w-4 rounded border-slate-300 accent-brand focus:ring-brand"
        :checked="selected"
        :disabled="item.ignored === true"
        @change="$emit('toggle-selection')"
      />
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"
      >
        <img
          v-if="resolvedIcon && !iconFailed"
          :src="resolvedIcon"
          :alt="`${item.displayName} 图标`"
          class="h-8 w-8 object-contain"
          @error="iconFailed = true"
        />
        <i
          v-else
          data-testid="update-center-icon-fallback"
          class="fas fa-cube text-lg text-slate-400"
        ></i>
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-semibold text-slate-900 dark:text-white">
            {{ item.displayName }}
          </p>
          <span
            class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {{ sourceLabel }}
          </span>
          <span
            v-if="item.isMigration"
            class="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand"
          >
            将迁移到 APM
          </span>
          <span
            v-if="item.ignored === true"
            class="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
          >
            已忽略
          </span>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ item.packageName }} · 当前 {{ item.currentVersion }} · 更新至
          {{ item.newVersion }}
        </p>
        <p
          v-if="item.ignored === true"
          class="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400"
        >
          已忽略的更新不会加入本次任务。
        </p>
      </div>
      <div
        v-if="task"
        class="text-right text-sm font-semibold text-slate-600 dark:text-slate-300"
      >
        <p>{{ statusLabel }}</p>
        <p v-if="showProgress" class="mt-1">{{ progressText }}</p>
      </div>
    </div>

    <div v-if="showProgress" class="space-y-2">
      <div
        class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div
          class="h-full rounded-full bg-gradient-to-r from-brand to-brand-dark"
          :style="progressStyle"
        ></div>
      </div>
    </div>
  </label>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import type {
  UpdateCenterItem,
  UpdateCenterTaskState,
} from "@/global/typedefinition";

const props = defineProps<{
  item: UpdateCenterItem;
  task?: UpdateCenterTaskState;
  selected: boolean;
}>();

const iconFailed = ref(false);

const resolvedIcon = computed(() => {
  if (!props.item.icon) return "";
  return props.item.icon.startsWith("/")
    ? `file://${props.item.icon}`
    : props.item.icon;
});
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/UpdateCenterItem.test.ts`

Expected: PASS with 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/update-center/UpdateCenterItem.vue src/__tests__/unit/update-center/UpdateCenterItem.test.ts
git commit -m "feat(update-center): render update item icons"
```

### Task 4: Verify the Icon Feature End-to-End

**Files:**

- Modify: `electron/main/backend/update-center/icons.ts`
- Modify: `electron/main/backend/update-center/index.ts`
- Modify: `electron/main/backend/update-center/service.ts`
- Modify: `src/global/typedefinition.ts`
- Modify: `src/components/update-center/UpdateCenterItem.vue`
- Modify: `src/__tests__/unit/update-center/icons.test.ts`
- Modify: `src/__tests__/unit/update-center/load-items.test.ts`
- Modify: `src/__tests__/unit/update-center/UpdateCenterItem.test.ts`

- [ ] **Step 1: Format the changed files**

Run: `npm run format`

Expected: Prettier rewrites changed `src/` and `electron/` files without errors.

- [ ] **Step 2: Run lint and the targeted update-center suite**

Run: `npm run lint && npm run test -- --run src/__tests__/unit/update-center/icons.test.ts src/__tests__/unit/update-center/load-items.test.ts src/__tests__/unit/update-center/UpdateCenterItem.test.ts`

Expected: ESLint exits 0 and the new icon-related tests pass.

- [ ] **Step 3: Run the complete unit suite and production build**

Run: `npm run test -- --run && npm run build:vite`

Expected: all existing unit tests remain green and `vue-tsc` plus Vite production build complete successfully.

- [ ] **Step 4: Commit the verified icon feature**

```bash
git add electron/main/backend/update-center/types.ts electron/main/backend/update-center/icons.ts electron/main/backend/update-center/index.ts electron/main/backend/update-center/service.ts src/global/typedefinition.ts src/components/update-center/UpdateCenterItem.vue src/__tests__/unit/update-center/icons.test.ts src/__tests__/unit/update-center/load-items.test.ts src/__tests__/unit/update-center/UpdateCenterItem.test.ts
git commit -m "feat(update-center): show icons in update list"
```
