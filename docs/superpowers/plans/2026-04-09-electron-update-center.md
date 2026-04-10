# Electron Update Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the external Qt updater with an Electron-native update center that preserves the current Spark update behavior, data compatibility, and migration flow.

**Architecture:** Build a dedicated `electron/main/backend/update-center/` subsystem for refresh, query, ignore-config compatibility, download/install execution, and IPC snapshots. Keep renderer concerns in a separate `src/modules/updateCenter.ts` store plus focused Vue components so the update center UI can match the existing store design without reusing the old thin APM-only modal.

**Tech Stack:** Electron 40, Node.js `child_process`/`fs`/`path`, Vue 3 `<script setup>`, Tailwind CSS 4, Vitest, Testing Library Vue, TypeScript strict mode, Pino.

---

## File Map

- Create: `electron/main/backend/update-center/types.ts` — shared backend update-center types.
- Create: `electron/main/backend/update-center/query.ts` — parse APTSS/APM output, enrich metadata, merge dual-source updates.
- Create: `electron/main/backend/update-center/ignore-config.ts` — legacy ignore-config load/save/apply helpers for `/etc/spark-store/ignored_apps.conf`.
- Create: `electron/main/backend/update-center/queue.ts` — in-memory task queue and close-protection snapshot helpers.
- Create: `electron/main/backend/update-center/download.ts` — aria2 download runner with progress callbacks.
- Create: `electron/main/backend/update-center/install.ts` — `ssinstall`/`apm ssaudit`/migration installation helpers plus legacy Spark upgrade command builder.
- Create: `electron/main/backend/update-center/service.ts` — orchestrates refresh, ignore toggles, update start/cancel, broadcasts snapshots.
- Create: `electron/main/backend/update-center/index.ts` — registers Electron IPC handlers and forwards state events.
- Modify: `electron/main/index.ts` — load the update-center backend and remove the external `run-update-tool` launch path.
- Modify: `electron/main/backend/install-manager.ts` — stop shelling out to `spark-update-tool` for `upgradeOnly` Spark tasks.
- Modify: `electron/preload/index.ts` — expose a typed `window.updateCenter` bridge.
- Modify: `src/vite-env.d.ts` — declare the `window.updateCenter` API.
- Modify: `src/global/typedefinition.ts` — add renderer-facing update-center snapshot/item/task types.
- Create: `src/modules/updateCenter.ts` — renderer store for modal state, search, selection, warnings, and IPC subscriptions.
- Create: `src/components/UpdateCenterModal.vue` — update-center container modal.
- Create: `src/components/update-center/UpdateCenterToolbar.vue` — title, warnings, search, refresh, batch actions.
- Create: `src/components/update-center/UpdateCenterList.vue` — scrollable list container.
- Create: `src/components/update-center/UpdateCenterItem.vue` — single update row with state-specific actions.
- Create: `src/components/update-center/UpdateCenterMigrationConfirm.vue` — in-app migration confirmation modal.
- Create: `src/components/update-center/UpdateCenterCloseConfirm.vue` — in-app close confirmation while tasks are running.
- Create: `src/components/update-center/UpdateCenterLogPanel.vue` — desktop right-side log panel and narrow-screen drawer.
- Modify: `src/App.vue` — open the new modal instead of invoking `run-update-tool`.
- Delete: `src/components/UpdateAppsModal.vue` — old APM-only update modal.
- Test: `src/__tests__/unit/update-center/query.test.ts`
- Test: `src/__tests__/unit/update-center/ignore-config.test.ts`
- Test: `src/__tests__/unit/update-center/task-runner.test.ts`
- Test: `src/__tests__/unit/update-center/registerUpdateCenter.test.ts`
- Test: `src/__tests__/unit/update-center/store.test.ts`
- Test: `src/__tests__/unit/update-center/UpdateCenterModal.test.ts`

### Task 1: Query, Parse, and Merge Update Inventory

**Files:**
- Create: `electron/main/backend/update-center/types.ts`
- Create: `electron/main/backend/update-center/query.ts`
- Test: `src/__tests__/unit/update-center/query.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import {
  mergeUpdateSources,
  parseApmUpgradableList,
  parseAptssUpgradableList,
  parsePrintUrisOutput,
} from "../../../../electron/main/backend/update-center/query";

describe("update-center/query", () => {
  it("parses aptss upgradable output into normalized aptss items", () => {
    const output = [
      "firefox/stable 2.0 amd64 [upgradable from: 1.5]",
      "obs-studio/stable 31.0 amd64 [upgradable from: 30.1]",
    ].join("\n");

    expect(parseAptssUpgradableList(output)).toEqual([
      expect.objectContaining({
        taskKey: "aptss:firefox",
        packageName: "firefox",
        currentVersion: "1.5",
        newVersion: "2.0",
        source: "aptss",
      }),
      expect.objectContaining({
        taskKey: "aptss:obs-studio",
        packageName: "obs-studio",
        currentVersion: "30.1",
        newVersion: "31.0",
        source: "aptss",
      }),
    ]);
  });

  it("parses apt print-uris output into download metadata", () => {
    const output = "'https://mirror.example/firefox.deb' firefox_2.0_amd64.deb 123456 SHA512:abc123";

    expect(parsePrintUrisOutput(output)).toEqual({
      downloadUrl: "https://mirror.example/firefox.deb",
      size: "123456",
      sha512: "abc123",
    });
  });

  it("marks an apm item as migration when the same package is only installed in aptss", () => {
    const merged = mergeUpdateSources(
      [
        {
          taskKey: "aptss:firefox",
          packageName: "firefox",
          displayName: "Firefox",
          currentVersion: "1.5",
          newVersion: "1.6",
          source: "aptss",
          size: "123456",
          iconPath: "",
          downloadUrl: "",
          sha512: "",
          ignored: false,
          isMigration: false,
        },
      ],
      [
        {
          taskKey: "apm:firefox",
          packageName: "firefox",
          displayName: "Firefox",
          currentVersion: "1.5",
          newVersion: "2.0",
          source: "apm",
          size: "123456",
          iconPath: "",
          downloadUrl: "",
          sha512: "",
          ignored: false,
          isMigration: false,
        },
      ],
      {
        firefox: { aptss: true, apm: false },
      },
    );

    expect(merged[0]).toMatchObject({
      taskKey: "apm:firefox",
      source: "apm",
      isMigration: true,
      migrationSource: "aptss",
      migrationTarget: "apm",
    });
    expect(merged[1]).toMatchObject({
      taskKey: "aptss:firefox",
      source: "aptss",
      isMigration: false,
    });
  });

  it("parses apm list output into normalized apm items", () => {
    const output = "code/stable 1.108.2 amd64 [upgradable from: 1.107.0]";

    expect(parseApmUpgradableList(output)).toEqual([
      expect.objectContaining({
        taskKey: "apm:code",
        packageName: "code",
        currentVersion: "1.107.0",
        newVersion: "1.108.2",
        source: "apm",
      }),
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/query.test.ts`

Expected: FAIL with `Cannot find module '../../../../electron/main/backend/update-center/query'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// electron/main/backend/update-center/types.ts
export type UpdateSource = "aptss" | "apm";

export interface InstalledSourceState {
  aptss: boolean;
  apm: boolean;
}

export interface UpdateCenterItem {
  taskKey: string;
  packageName: string;
  displayName: string;
  currentVersion: string;
  newVersion: string;
  source: UpdateSource;
  size: string;
  iconPath: string;
  downloadUrl: string;
  sha512: string;
  ignored: boolean;
  isMigration: boolean;
  migrationSource?: UpdateSource;
  migrationTarget?: UpdateSource;
}
```

```ts
// electron/main/backend/update-center/query.ts
import type {
  InstalledSourceState,
  UpdateCenterItem,
  UpdateSource,
} from "./types";

const createBaseItem = (
  packageName: string,
  currentVersion: string,
  newVersion: string,
  source: UpdateSource,
): UpdateCenterItem => ({
  taskKey: `${source}:${packageName}`,
  packageName,
  displayName: packageName,
  currentVersion,
  newVersion,
  source,
  size: "0",
  iconPath: "",
  downloadUrl: "",
  sha512: "",
  ignored: false,
  isMigration: false,
});

const parseUpgradableLine = (line: string, source: UpdateSource) => {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.includes("/")) return null;

  const tokens = trimmed.split(/\s+/);
  const packageName = tokens[0]?.split("/")[0] ?? "";
  const newVersion = tokens[1] ?? "";
  const currentVersion =
    trimmed.match(/\[(?:upgradable from|from):\s*([^\]\s]+)\]/i)?.[1] ?? "";

  if (!packageName || !newVersion) return null;
  return createBaseItem(packageName, currentVersion, newVersion, source);
};

export const parsePrintUrisOutput = (output: string) => {
  const match = output.match(/'([^']+)'\s+\S+\s+(\d+)\s+SHA512:([^\s]+)/);
  return {
    downloadUrl: match?.[1] ?? "",
    size: match?.[2] ?? "0",
    sha512: match?.[3] ?? "",
  };
};

export const parseAptssUpgradableList = (output: string): UpdateCenterItem[] =>
  output
    .split("\n")
    .map((line) => parseUpgradableLine(line, "aptss"))
    .filter((item): item is UpdateCenterItem => item !== null);

export const parseApmUpgradableList = (output: string): UpdateCenterItem[] =>
  output
    .split("\n")
    .map((line) => parseUpgradableLine(line, "apm"))
    .filter((item): item is UpdateCenterItem => item !== null);

export const buildInstalledSourceMap = (
  aptssInstalledOutput: string,
  apmInstalledOutput: string,
): Record<string, InstalledSourceState> => {
  const installed: Record<string, InstalledSourceState> = {};

  for (const packageName of aptssInstalledOutput.split("\n").map((line) => line.trim()).filter(Boolean)) {
    installed[packageName] = {
      aptss: true,
      apm: installed[packageName]?.apm ?? false,
    };
  }

  for (const line of apmInstalledOutput.split("\n")) {
    const packageName = line.trim().split("/")[0] ?? "";
    if (!packageName) continue;
    installed[packageName] = {
      aptss: installed[packageName]?.aptss ?? false,
      apm: true,
    };
  }

  return installed;
};

export const mergeUpdateSources = (
  aptssItems: UpdateCenterItem[],
  apmItems: UpdateCenterItem[],
  installedSources: Record<string, InstalledSourceState>,
): UpdateCenterItem[] => {
  const aptssMap = new Map(aptssItems.map((item) => [item.packageName, item]));
  const apmMap = new Map(apmItems.map((item) => [item.packageName, item]));
  const packageNames = new Set([...aptssMap.keys(), ...apmMap.keys()]);
  const merged: UpdateCenterItem[] = [];

  for (const packageName of packageNames) {
    const aptssItem = aptssMap.get(packageName);
    const apmItem = apmMap.get(packageName);
    const installed = installedSources[packageName] ?? { aptss: false, apm: false };

    if (aptssItem && !apmItem) {
      merged.push(aptssItem);
      continue;
    }

    if (apmItem && !aptssItem) {
      merged.push(apmItem);
      continue;
    }

    if (!aptssItem || !apmItem) continue;

    if (installed.aptss && !installed.apm && apmItem.newVersion > aptssItem.newVersion) {
      merged.push({
        ...apmItem,
        isMigration: true,
        migrationSource: "aptss",
        migrationTarget: "apm",
      });
      merged.push(aptssItem);
      continue;
    }

    merged.push(aptssItem, apmItem);
  }

  return merged;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/query.test.ts`

Expected: PASS with 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add electron/main/backend/update-center/types.ts electron/main/backend/update-center/query.ts src/__tests__/unit/update-center/query.test.ts
git commit -m "feat(update-center): add normalized update query parsing"
```

### Task 2: Keep Legacy Ignore Configuration Compatible

**Files:**
- Create: `electron/main/backend/update-center/ignore-config.ts`
- Test: `src/__tests__/unit/update-center/ignore-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  applyIgnoredEntries,
  loadIgnoredEntries,
  saveIgnoredEntries,
} from "../../../../electron/main/backend/update-center/ignore-config";

describe("update-center/ignore-config", () => {
  let tempDir = "";

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("round-trips the legacy package|version format", async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "spark-ignore-"));
    const filePath = path.join(tempDir, "ignored_apps.conf");

    await saveIgnoredEntries(new Set(["firefox|2.0", "code|1.108.2"]), filePath);

    const content = await readFile(filePath, "utf8");
    expect(content.trim().split("\n")).toEqual(["code|1.108.2", "firefox|2.0"]);

    const loaded = await loadIgnoredEntries(filePath);
    expect(Array.from(loaded).sort()).toEqual(["code|1.108.2", "firefox|2.0"]);
  });

  it("marks only exact package/version matches as ignored", () => {
    const items = [
      {
        taskKey: "aptss:firefox",
        packageName: "firefox",
        displayName: "Firefox",
        currentVersion: "1.5",
        newVersion: "2.0",
        source: "aptss",
        size: "123456",
        iconPath: "",
        downloadUrl: "",
        sha512: "",
        ignored: false,
        isMigration: false,
      },
      {
        taskKey: "apm:firefox",
        packageName: "firefox",
        displayName: "Firefox",
        currentVersion: "1.5",
        newVersion: "2.1",
        source: "apm",
        size: "123456",
        iconPath: "",
        downloadUrl: "",
        sha512: "",
        ignored: false,
        isMigration: false,
      },
    ];

    const applied = applyIgnoredEntries(items, new Set(["firefox|2.0"]));

    expect(applied[0].ignored).toBe(true);
    expect(applied[1].ignored).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/ignore-config.test.ts`

Expected: FAIL with `Cannot find module '../../../../electron/main/backend/update-center/ignore-config'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// electron/main/backend/update-center/ignore-config.ts
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { UpdateCenterItem } from "./types";

export const IGNORE_CONFIG_PATH = "/etc/spark-store/ignored_apps.conf";

export const createIgnoreKey = (packageName: string, newVersion: string) =>
  `${packageName}|${newVersion}`;

export const parseIgnoredEntries = (content: string): Set<string> =>
  new Set(
    content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0),
  );

export const loadIgnoredEntries = async (
  filePath = IGNORE_CONFIG_PATH,
): Promise<Set<string>> => {
  try {
    const content = await readFile(filePath, "utf8");
    return parseIgnoredEntries(content);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return new Set();
    }
    throw error;
  }
};

export const saveIgnoredEntries = async (
  entries: Iterable<string>,
  filePath = IGNORE_CONFIG_PATH,
) => {
    await mkdir(path.dirname(filePath), { recursive: true });
    const content = Array.from(entries).sort().join("\n");
    await writeFile(filePath, content.length > 0 ? `${content}\n` : "", "utf8");
  };

export const applyIgnoredEntries = (
  items: UpdateCenterItem[],
  ignoredEntries: Set<string>,
): UpdateCenterItem[] =>
  items.map((item) => ({
    ...item,
    ignored: ignoredEntries.has(createIgnoreKey(item.packageName, item.newVersion)),
  }));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/ignore-config.test.ts`

Expected: PASS with 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add electron/main/backend/update-center/ignore-config.ts src/__tests__/unit/update-center/ignore-config.test.ts
git commit -m "feat(update-center): preserve legacy ignored updates"
```

### Task 3: Queue Downloads, Installs, and Legacy Spark Upgrades Without Qt

**Files:**
- Create: `electron/main/backend/update-center/queue.ts`
- Create: `electron/main/backend/update-center/download.ts`
- Create: `electron/main/backend/update-center/install.ts`
- Test: `src/__tests__/unit/update-center/task-runner.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

import { createUpdateCenterQueue } from "../../../../electron/main/backend/update-center/queue";
import {
  buildLegacySparkUpgradeCommand,
  createTaskRunner,
} from "../../../../electron/main/backend/update-center/install";

const firefox = {
  taskKey: "aptss:firefox",
  packageName: "firefox",
  displayName: "Firefox",
  currentVersion: "1.5",
  newVersion: "2.0",
  source: "aptss" as const,
  size: "123456",
  iconPath: "",
  downloadUrl: "https://mirror.example/firefox.deb",
  sha512: "abc123",
  ignored: false,
  isMigration: false,
};

describe("update-center/task-runner", () => {
  it("runs download then install and marks the task as completed", async () => {
    const queue = createUpdateCenterQueue();
    const download = vi.fn().mockResolvedValue({ debPath: "/tmp/firefox.deb" });
    const install = vi.fn().mockResolvedValue({ code: 0, stdout: "ok", stderr: "" });
    const runner = createTaskRunner({ queue, download, install });

    queue.setItems([firefox]);
    queue.enqueue([firefox]);

    await runner.runNext();

    expect(download).toHaveBeenCalledWith(
      firefox,
      expect.objectContaining({ onProgress: expect.any(Function) }),
    );
    expect(install).toHaveBeenCalledWith(
      firefox,
      "/tmp/firefox.deb",
      expect.objectContaining({ onLog: expect.any(Function) }),
    );
    expect(queue.snapshot().tasks[0]).toMatchObject({
      taskKey: "aptss:firefox",
      status: "completed",
      progress: 1,
    });
  });

  it("returns a direct aptss upgrade command instead of spark-update-tool", () => {
    expect(
      buildLegacySparkUpgradeCommand("firefox", "/usr/bin/pkexec", "/opt/spark-store/extras/shell-caller.sh"),
    ).toEqual({
      execCommand: "/usr/bin/pkexec",
      execParams: [
        "/opt/spark-store/extras/shell-caller.sh",
        "aptss",
        "install",
        "-y",
        "firefox",
        "--only-upgrade",
      ],
    });
  });

  it("blocks close while a refresh or task is still running", () => {
    const queue = createUpdateCenterQueue();
    queue.startRefresh();
    expect(queue.snapshot().hasRunningTasks).toBe(true);

    queue.finishRefresh([]);
    queue.setItems([firefox]);
    queue.enqueue([firefox]);
    queue.markActive("aptss:firefox");
    expect(queue.snapshot().hasRunningTasks).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/task-runner.test.ts`

Expected: FAIL with missing module errors for `queue` and `install`.

- [ ] **Step 3: Write minimal implementation**

```ts
// electron/main/backend/update-center/queue.ts
import type { UpdateCenterItem } from "./types";

export type UpdateTaskStatus =
  | "queued"
  | "downloading"
  | "installing"
  | "completed"
  | "failed"
  | "cancelled";

export interface UpdateCenterTaskState {
  taskKey: string;
  packageName: string;
  source: UpdateCenterItem["source"];
  status: UpdateTaskStatus;
  progress: number;
  queuePosition: number | null;
  logs: Array<{ time: number; message: string }>;
  errorMessage: string;
}

export interface UpdateCenterSnapshot {
  items: UpdateCenterItem[];
  tasks: UpdateCenterTaskState[];
  warnings: string[];
  hasRunningTasks: boolean;
}

export const createUpdateCenterQueue = () => {
  let items: UpdateCenterItem[] = [];
  let warnings: string[] = [];
  let refreshing = false;
  const taskMap = new Map<string, UpdateCenterTaskState>();
  const order: string[] = [];

  const snapshot = (): UpdateCenterSnapshot => ({
    items,
    tasks: order.map((taskKey) => taskMap.get(taskKey)!).filter(Boolean),
    warnings,
    hasRunningTasks:
      refreshing || Array.from(taskMap.values()).some((task) => ["queued", "downloading", "installing"].includes(task.status)),
  });

  return {
    snapshot,
    setItems(nextItems: UpdateCenterItem[]) {
      items = nextItems;
    },
    startRefresh() {
      refreshing = true;
    },
    finishRefresh(nextWarnings: string[]) {
      refreshing = false;
      warnings = nextWarnings;
    },
    enqueue(nextItems: UpdateCenterItem[]) {
      for (const item of nextItems) {
        if (taskMap.has(item.taskKey)) continue;
        order.push(item.taskKey);
        taskMap.set(item.taskKey, {
          taskKey: item.taskKey,
          packageName: item.packageName,
          source: item.source,
          status: "queued",
          progress: 0,
          queuePosition: order.length,
          logs: [],
          errorMessage: "",
        });
      }
    },
    markActive(taskKey: string) {
      const task = taskMap.get(taskKey);
      if (!task) return;
      task.status = task.progress === 1 ? "installing" : "downloading";
      task.queuePosition = 1;
    },
    markProgress(taskKey: string, progress: number) {
      const task = taskMap.get(taskKey);
      if (!task) return;
      task.status = progress >= 1 ? "installing" : "downloading";
      task.progress = progress;
    },
    appendLog(taskKey: string, message: string) {
      const task = taskMap.get(taskKey);
      if (!task) return;
      task.logs.push({ time: Date.now(), message });
    },
    finish(taskKey: string, status: "completed" | "failed" | "cancelled", errorMessage = "") {
      const task = taskMap.get(taskKey);
      if (!task) return;
      task.status = status;
      task.progress = status === "completed" ? 1 : task.progress;
      task.errorMessage = errorMessage;
      task.queuePosition = null;
    },
    nextQueuedTask() {
      return order.map((taskKey) => taskMap.get(taskKey)).find((task) => task?.status === "queued") ?? null;
    },
  };
};
```

```ts
// electron/main/backend/update-center/download.ts
import { spawn } from "node:child_process";

import type { UpdateCenterItem } from "./types";

export interface DownloadResult {
  debPath: string;
}

export const runAria2Download = (
  item: UpdateCenterItem,
  callbacks: {
    onLog: (message: string) => void;
    onProgress: (progress: number) => void;
  },
): Promise<DownloadResult> =>
  new Promise((resolve, reject) => {
    callbacks.onLog(`开始下载 ${item.packageName}`);
    const targetPath = `/tmp/${item.packageName}_${item.newVersion}.deb`;
    const child = spawn("aria2c", ["--allow-overwrite=true", `--out=${item.packageName}_${item.newVersion}.deb`, `--dir=/tmp`, item.downloadUrl]);

    child.stdout.on("data", (data) => {
      const text = data.toString();
      callbacks.onLog(text);
      const match = text.match(/(\d+(?:\.\d+)?)%/);
      if (match) callbacks.onProgress(Number(match[1]) / 100);
    });

    child.stderr.on("data", (data) => callbacks.onLog(data.toString()));
    child.on("close", (code) => {
      if (code === 0) {
        callbacks.onProgress(1);
        resolve({ debPath: targetPath });
        return;
      }
      reject(new Error(`aria2c exited with code ${code}`));
    });
    child.on("error", reject);
  });
```

```ts
// electron/main/backend/update-center/install.ts
import { spawn } from "node:child_process";

import type { UpdateCenterItem } from "./types";
import type { createUpdateCenterQueue } from "./queue";

export const buildLegacySparkUpgradeCommand = (
  packageName: string,
  superUserCmd: string,
  shellCallerPath: string,
) => ({
  execCommand: superUserCmd || shellCallerPath,
  execParams: superUserCmd
    ? [shellCallerPath, "aptss", "install", "-y", packageName, "--only-upgrade"]
    : ["aptss", "install", "-y", packageName, "--only-upgrade"],
});

export const installUpdateItem = (
  item: UpdateCenterItem,
  debPath: string,
  callbacks: { onLog: (message: string) => void },
): Promise<{ code: number; stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const execCommand = item.source === "apm" ? "apm" : "/usr/bin/ssinstall";
    const execParams =
      item.source === "apm"
        ? ["ssaudit", debPath]
        : [debPath, "--no-create-desktop-entry", "--delete-after-install", "--native"];
    const child = spawn(execCommand, execParams, { shell: false, env: process.env });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
      callbacks.onLog(data.toString());
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
      callbacks.onLog(data.toString());
    });
    child.on("close", (code) => resolve({ code: code ?? -1, stdout, stderr }));
    child.on("error", reject);
  });

export const createTaskRunner = (deps: {
  queue: ReturnType<typeof createUpdateCenterQueue>;
  download: typeof import("./download").runAria2Download;
  install: typeof installUpdateItem;
}) => ({
  async runNext() {
    const task = deps.queue.nextQueuedTask();
    if (!task) return;

    deps.queue.markActive(task.taskKey);
    const item = deps.queue.snapshot().items.find((entry) => entry.taskKey === task.taskKey);
    if (!item) return;

    try {
      const { debPath } = await deps.download(item, {
        onLog: (message) => deps.queue.appendLog(task.taskKey, message),
        onProgress: (progress) => deps.queue.markProgress(task.taskKey, progress),
      });

      const result = await deps.install(item, debPath, {
        onLog: (message) => deps.queue.appendLog(task.taskKey, message),
      });

      if (result.code === 0) {
        deps.queue.finish(task.taskKey, "completed");
        return;
      }

      deps.queue.finish(task.taskKey, "failed", result.stderr || result.stdout);
    } catch (error) {
      deps.queue.finish(
        task.taskKey,
        "failed",
        error instanceof Error ? error.message : String(error),
      );
    }
  },
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/task-runner.test.ts`

Expected: PASS with 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add electron/main/backend/update-center/queue.ts electron/main/backend/update-center/download.ts electron/main/backend/update-center/install.ts src/__tests__/unit/update-center/task-runner.test.ts
git commit -m "feat(update-center): add queued update execution"
```

### Task 4: Register Main-Process Service and Typed IPC Bridge

**Files:**
- Create: `electron/main/backend/update-center/service.ts`
- Create: `electron/main/backend/update-center/index.ts`
- Modify: `electron/main/index.ts`
- Modify: `electron/main/backend/install-manager.ts`
- Modify: `electron/preload/index.ts`
- Modify: `src/vite-env.d.ts`
- Test: `src/__tests__/unit/update-center/registerUpdateCenter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";

import { registerUpdateCenterIpc } from "../../../../electron/main/backend/update-center/index";

describe("update-center/ipc", () => {
  it("registers every update-center handler and forwards service calls", async () => {
    const handle = vi.fn();
    const service = {
      open: vi.fn().mockResolvedValue({ items: [], tasks: [], warnings: [], hasRunningTasks: false }),
      refresh: vi.fn().mockResolvedValue({ items: [], tasks: [], warnings: [], hasRunningTasks: false }),
      ignore: vi.fn().mockResolvedValue(undefined),
      unignore: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockReturnValue({ items: [], tasks: [], warnings: [], hasRunningTasks: false }),
      subscribe: vi.fn().mockReturnValue(() => undefined),
    };

    registerUpdateCenterIpc({ handle }, service);

    expect(handle).toHaveBeenCalledWith("update-center-open", expect.any(Function));
    expect(handle).toHaveBeenCalledWith("update-center-refresh", expect.any(Function));
    expect(handle).toHaveBeenCalledWith("update-center-ignore", expect.any(Function));
    expect(handle).toHaveBeenCalledWith("update-center-unignore", expect.any(Function));
    expect(handle).toHaveBeenCalledWith("update-center-start", expect.any(Function));
    expect(handle).toHaveBeenCalledWith("update-center-cancel", expect.any(Function));
    expect(handle).toHaveBeenCalledWith("update-center-get-state", expect.any(Function));

    const openHandler = handle.mock.calls.find(([channel]) => channel === "update-center-open")?.[1];
    await openHandler?.({}, undefined);
    expect(service.open).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/registerUpdateCenter.test.ts`

Expected: FAIL with missing module errors for `service` or `index`.

- [ ] **Step 3: Write minimal implementation**

```ts
// electron/main/backend/update-center/service.ts
import { applyIgnoredEntries, createIgnoreKey, loadIgnoredEntries, saveIgnoredEntries } from "./ignore-config";
import { runAria2Download } from "./download";
import { createTaskRunner, installUpdateItem } from "./install";
import { createUpdateCenterQueue } from "./queue";
import type { UpdateCenterItem } from "./types";

export interface UpdateCenterService {
  open: () => Promise<ReturnType<ReturnType<typeof createUpdateCenterQueue>["snapshot"]>>;
  refresh: () => Promise<ReturnType<ReturnType<typeof createUpdateCenterQueue>["snapshot"]>>;
  ignore: (payload: { packageName: string; newVersion: string }) => Promise<void>;
  unignore: (payload: { packageName: string; newVersion: string }) => Promise<void>;
  start: (taskKeys: string[]) => Promise<void>;
  cancel: (taskKey: string) => Promise<void>;
  getState: () => ReturnType<ReturnType<typeof createUpdateCenterQueue>["snapshot"]>;
  subscribe: (listener: () => void) => () => void;
}

export const createUpdateCenterService = (deps: {
  loadItems: () => Promise<UpdateCenterItem[]>;
}) => {
  const queue = createUpdateCenterQueue();
  const runner = createTaskRunner({ queue, download: runAria2Download, install: installUpdateItem });
  const listeners = new Set<() => void>();

  const emit = () => {
    for (const listener of listeners) listener();
  };

  const refresh = async () => {
    queue.startRefresh();
    emit();
    const ignored = await loadIgnoredEntries();
    const items = applyIgnoredEntries(await deps.loadItems(), ignored);
    queue.setItems(items);
    queue.finishRefresh([]);
    emit();
    return queue.snapshot();
  };

  return {
    async open() {
      return refresh();
    },
    async refresh() {
      return refresh();
    },
    async ignore(payload: { packageName: string; newVersion: string }) {
      const entries = await loadIgnoredEntries();
      entries.add(createIgnoreKey(payload.packageName, payload.newVersion));
      await saveIgnoredEntries(entries);
      await refresh();
    },
    async unignore(payload: { packageName: string; newVersion: string }) {
      const entries = await loadIgnoredEntries();
      entries.delete(createIgnoreKey(payload.packageName, payload.newVersion));
      await saveIgnoredEntries(entries);
      await refresh();
    },
    async start(taskKeys: string[]) {
      const items = queue.snapshot().items.filter((item) => taskKeys.includes(item.taskKey));
      queue.enqueue(items);
      emit();
      while (queue.nextQueuedTask()) {
        await runner.runNext();
        emit();
      }
      emit();
    },
    async cancel(taskKey: string) {
      queue.finish(taskKey, "cancelled");
      emit();
    },
    getState() {
      return queue.snapshot();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies UpdateCenterService;
};
```

```ts
// electron/main/backend/update-center/index.ts
import { spawn } from "node:child_process";
import { BrowserWindow, ipcMain } from "electron";

import {
  buildInstalledSourceMap,
  mergeUpdateSources,
  parseApmUpgradableList,
  parseAptssUpgradableList,
} from "./query";
import { createUpdateCenterService } from "./service";

export const registerUpdateCenterIpc = (
  ipc: Pick<typeof ipcMain, "handle">,
  service: Pick<ReturnType<typeof createUpdateCenterService>, "open" | "refresh" | "ignore" | "unignore" | "start" | "cancel" | "getState">,
) => {
  ipc.handle("update-center-open", () => service.open());
  ipc.handle("update-center-refresh", () => service.refresh());
  ipc.handle("update-center-ignore", (_event, payload) => service.ignore(payload));
  ipc.handle("update-center-unignore", (_event, payload) => service.unignore(payload));
  ipc.handle("update-center-start", (_event, taskKeys: string[]) => service.start(taskKeys));
  ipc.handle("update-center-cancel", (_event, taskKey: string) => service.cancel(taskKey));
  ipc.handle("update-center-get-state", () => service.getState());
};

const runCommandCapture = async (command: string, args: string[]) =>
  await new Promise<{ code: number; stdout: string; stderr: string }>((resolve) => {
    const child = spawn(command, args, { shell: false, env: process.env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("close", (code) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });

const loadItems = async () => {
  const aptssResult = await runCommandCapture("bash", [
    "-lc",
    "env LANGUAGE=en_US /usr/bin/apt -c /opt/durapps/spark-store/bin/apt-fast-conf/aptss-apt.conf list --upgradable -o Dir::Etc::sourcelist=/opt/durapps/spark-store/bin/apt-fast-conf/sources.list.d/aptss.list -o Dir::Etc::sourceparts=/dev/null -o APT::Get::List-Cleanup=0 | awk 'NR>1'",
  ]);
  const apmResult = await runCommandCapture("apm", ["list", "--upgradable"]);
  const aptssInstalledResult = await runCommandCapture("dpkg-query", ["-W", "-f=${Package}\n"]);
  const apmInstalledResult = await runCommandCapture("apm", ["list", "--installed"]);

  const installedSources = buildInstalledSourceMap(
    aptssInstalledResult.stdout,
    apmInstalledResult.stdout,
  );

  return mergeUpdateSources(
    parseAptssUpgradableList(aptssResult.stdout),
    parseApmUpgradableList(apmResult.stdout),
    installedSources,
  );
};

const service = createUpdateCenterService({
  loadItems,
});

registerUpdateCenterIpc(ipcMain, service);

service.subscribe(() => {
  const snapshot = service.getState();
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send("update-center-state", snapshot);
  }
});
```

```ts
// electron/preload/index.ts
import type { IpcRendererEvent } from "electron";

const updateCenterStateListeners = new Map<
  (snapshot: unknown) => void,
  (_event: IpcRendererEvent, snapshot: unknown) => void
>();

contextBridge.exposeInMainWorld("updateCenter", {
  open: () => ipcRenderer.invoke("update-center-open"),
  refresh: () => ipcRenderer.invoke("update-center-refresh"),
  ignore: (payload: { packageName: string; newVersion: string }) =>
    ipcRenderer.invoke("update-center-ignore", payload),
  unignore: (payload: { packageName: string; newVersion: string }) =>
    ipcRenderer.invoke("update-center-unignore", payload),
  start: (taskKeys: string[]) => ipcRenderer.invoke("update-center-start", taskKeys),
  cancel: (taskKey: string) => ipcRenderer.invoke("update-center-cancel", taskKey),
  getState: () => ipcRenderer.invoke("update-center-get-state"),
  onState: (listener: (snapshot: unknown) => void) => {
    const wrapped = (_event: IpcRendererEvent, snapshot: unknown) => {
      listener(snapshot);
    };
    updateCenterStateListeners.set(listener, wrapped);
    ipcRenderer.on("update-center-state", wrapped);
  },
  offState: (listener: (snapshot: unknown) => void) => {
    const wrapped = updateCenterStateListeners.get(listener);
    if (!wrapped) return;
    ipcRenderer.off("update-center-state", wrapped);
    updateCenterStateListeners.delete(listener);
  },
});
```

```ts
// src/vite-env.d.ts
interface Window {
  ipcRenderer: import("electron").IpcRenderer;
  apm_store: {
    arch: string;
  };
  updateCenter: {
    open: () => Promise<import("@/global/typedefinition").UpdateCenterSnapshot>;
    refresh: () => Promise<import("@/global/typedefinition").UpdateCenterSnapshot>;
    ignore: (payload: { packageName: string; newVersion: string }) => Promise<void>;
    unignore: (payload: { packageName: string; newVersion: string }) => Promise<void>;
    start: (taskKeys: string[]) => Promise<void>;
    cancel: (taskKey: string) => Promise<void>;
    getState: () => Promise<import("@/global/typedefinition").UpdateCenterSnapshot>;
    onState: (listener: (snapshot: import("@/global/typedefinition").UpdateCenterSnapshot) => void) => void;
    offState: (listener: Parameters<import("electron").IpcRenderer["off"]>[1]) => void;
  };
}
```

```ts
// electron/main/index.ts
import "./backend/update-center/index.js";

// remove the old run-update-tool handler entirely so the sidebar button
// opens the in-app modal instead of spawning pkexec spark-update-tool.
```

```ts
// electron/main/backend/install-manager.ts
if (origin === "spark") {
  if (upgradeOnly) {
    execCommand = superUserCmd || SHELL_CALLER_PATH;
    if (superUserCmd) execParams.push(SHELL_CALLER_PATH);
    execParams.push("aptss", "install", "-y", pkgname, "--only-upgrade");
  } else {
    execCommand = superUserCmd || SHELL_CALLER_PATH;
    if (superUserCmd) execParams.push(SHELL_CALLER_PATH);

    if (metalinkUrl && filename) {
      execParams.push(
        "ssinstall",
        `${downloadDir}/${filename}`,
        "--delete-after-install",
      );
    } else {
      execParams.push("aptss", "install", "-y", pkgname);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/registerUpdateCenter.test.ts`

Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add electron/main/backend/update-center/service.ts electron/main/backend/update-center/index.ts electron/main/index.ts electron/main/backend/install-manager.ts electron/preload/index.ts src/vite-env.d.ts src/__tests__/unit/update-center/registerUpdateCenter.test.ts
git commit -m "feat(update-center): add Electron update center IPC"
```

### Task 5: Build the Renderer Store and Snapshot Types

**Files:**
- Modify: `src/global/typedefinition.ts`
- Create: `src/modules/updateCenter.ts`
- Test: `src/__tests__/unit/update-center/store.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUpdateCenterStore } from "@/modules/updateCenter";

describe("updateCenter store", () => {
  let stateListener:
    | ((nextSnapshot: typeof snapshot) => void)
    | undefined;

  const snapshot = {
    items: [
      {
        taskKey: "aptss:firefox",
        packageName: "firefox",
        displayName: "Firefox",
        currentVersion: "1.5",
        newVersion: "2.0",
        source: "aptss",
        size: "123456",
        iconPath: "",
        downloadUrl: "",
        sha512: "",
        ignored: false,
        isMigration: false,
      },
    ],
    tasks: [],
    warnings: [],
    hasRunningTasks: false,
  };

  beforeEach(() => {
    Object.defineProperty(window, "updateCenter", {
      configurable: true,
      value: {
        open: vi.fn().mockResolvedValue(snapshot),
        refresh: vi.fn().mockResolvedValue(snapshot),
        ignore: vi.fn().mockResolvedValue(undefined),
        unignore: vi.fn().mockResolvedValue(undefined),
        start: vi.fn().mockResolvedValue(undefined),
        cancel: vi.fn().mockResolvedValue(undefined),
        getState: vi.fn().mockResolvedValue(snapshot),
        onState: vi.fn((listener: (nextSnapshot: typeof snapshot) => void) => {
          stateListener = listener;
        }),
        offState: vi.fn(),
      },
    });
  });

  it("opens the modal with the initial snapshot", async () => {
    const store = createUpdateCenterStore();

    await store.open();

    expect(store.show.value).toBe(true);
    expect(store.snapshot.value.items).toHaveLength(1);
    expect(window.updateCenter.open).toHaveBeenCalled();
  });

  it("starts only the selected non-ignored items", async () => {
    const store = createUpdateCenterStore();
    await store.open();
    store.toggleSelection("aptss:firefox");

    await store.startSelected();

    expect(window.updateCenter.start).toHaveBeenCalledWith(["aptss:firefox"]);
  });

  it("blocks close requests while the snapshot reports running tasks", async () => {
    const store = createUpdateCenterStore();
    await store.open();
    store.snapshot.value = { ...store.snapshot.value, hasRunningTasks: true };

    expect(store.requestClose()).toBe(false);
    expect(store.showCloseConfirm.value).toBe(true);
  });

  it("applies pushed snapshots from the main process", () => {
    const store = createUpdateCenterStore();
    store.bind();

    stateListener?.({
      ...snapshot,
      warnings: ["aptss ssupdate failed"],
    });

    expect(store.snapshot.value.warnings).toEqual(["aptss ssupdate failed"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/store.test.ts`

Expected: FAIL with `Cannot find module '@/modules/updateCenter'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/global/typedefinition.ts
export type UpdateSource = "aptss" | "apm";

export interface UpdateCenterItem {
  taskKey: string;
  packageName: string;
  displayName: string;
  currentVersion: string;
  newVersion: string;
  source: UpdateSource;
  size: string;
  iconPath: string;
  downloadUrl: string;
  sha512: string;
  ignored: boolean;
  isMigration: boolean;
  migrationSource?: UpdateSource;
  migrationTarget?: UpdateSource;
}

export type UpdateCenterTaskStatus =
  | "queued"
  | "downloading"
  | "installing"
  | "completed"
  | "failed"
  | "cancelled";

export interface UpdateCenterTaskState {
  taskKey: string;
  packageName: string;
  source: UpdateSource;
  status: UpdateCenterTaskStatus;
  progress: number;
  queuePosition: number | null;
  logs: Array<{ time: number; message: string }>;
  errorMessage: string;
}

export interface UpdateCenterSnapshot {
  items: UpdateCenterItem[];
  tasks: UpdateCenterTaskState[];
  warnings: string[];
  hasRunningTasks: boolean;
}
```

```ts
// src/modules/updateCenter.ts
import { computed, ref } from "vue";

import type { UpdateCenterSnapshot } from "@/global/typedefinition";

const createEmptySnapshot = (): UpdateCenterSnapshot => ({
  items: [],
  tasks: [],
  warnings: [],
  hasRunningTasks: false,
});

export const createUpdateCenterStore = () => {
  const show = ref(false);
  const showCloseConfirm = ref(false);
  const showMigrationConfirm = ref(false);
  const searchQuery = ref("");
  const selectedKeys = ref<Set<string>>(new Set());
  const snapshot = ref<UpdateCenterSnapshot>(createEmptySnapshot());

  const filteredItems = computed(() => {
    const keyword = searchQuery.value.trim().toLowerCase();
    if (!keyword) return snapshot.value.items;
    return snapshot.value.items.filter((item) => {
      return (
        item.displayName.toLowerCase().includes(keyword) ||
        item.packageName.toLowerCase().includes(keyword)
      );
    });
  });

  const open = async () => {
    snapshot.value = await window.updateCenter.open();
    show.value = true;
  };

  const applySnapshot = (nextSnapshot: UpdateCenterSnapshot) => {
    snapshot.value = nextSnapshot;
  };

  const stateListener = (nextSnapshot: UpdateCenterSnapshot) => {
    applySnapshot(nextSnapshot);
  };

  const bind = () => {
    window.updateCenter.onState(stateListener);
  };

  const unbind = () => {
    window.updateCenter.offState(stateListener);
  };

  const refresh = async () => {
    snapshot.value = await window.updateCenter.refresh();
  };

  const toggleSelection = (taskKey: string) => {
    const next = new Set(selectedKeys.value);
    if (next.has(taskKey)) next.delete(taskKey);
    else next.add(taskKey);
    selectedKeys.value = next;
  };

  const startSelected = async () => {
    const allowedTaskKeys = Array.from(selectedKeys.value).filter((taskKey) => {
      const item = snapshot.value.items.find((entry) => entry.taskKey === taskKey);
      return Boolean(item && !item.ignored);
    });
    if (allowedTaskKeys.length === 0) return;
    await window.updateCenter.start(allowedTaskKeys);
  };

  const requestClose = () => {
    if (snapshot.value.hasRunningTasks) {
      showCloseConfirm.value = true;
      return false;
    }
    show.value = false;
    return true;
  };

  return {
    show,
    showCloseConfirm,
    showMigrationConfirm,
    searchQuery,
    selectedKeys,
    snapshot,
    filteredItems,
    bind,
    unbind,
    open,
    refresh,
    toggleSelection,
    startSelected,
    requestClose,
  };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/store.test.ts`

Expected: PASS with 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/global/typedefinition.ts src/modules/updateCenter.ts src/__tests__/unit/update-center/store.test.ts
git commit -m "feat(update-center): add renderer update center store"
```

### Task 6: Replace the Old Modal with the New Electron Update Center UI

**Files:**
- Create: `src/components/UpdateCenterModal.vue`
- Create: `src/components/update-center/UpdateCenterToolbar.vue`
- Create: `src/components/update-center/UpdateCenterList.vue`
- Create: `src/components/update-center/UpdateCenterItem.vue`
- Create: `src/components/update-center/UpdateCenterMigrationConfirm.vue`
- Create: `src/components/update-center/UpdateCenterCloseConfirm.vue`
- Create: `src/components/update-center/UpdateCenterLogPanel.vue`
- Modify: `src/App.vue`
- Delete: `src/components/UpdateAppsModal.vue`
- Test: `src/__tests__/unit/update-center/UpdateCenterModal.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";

import UpdateCenterModal from "@/components/UpdateCenterModal.vue";

describe("UpdateCenterModal", () => {
  it("renders source tags, running state, and close confirmation", async () => {
    const onClose = vi.fn();
    const onRequestClose = vi.fn();

    render(UpdateCenterModal, {
      props: {
        show: true,
        loading: false,
        error: "",
        warnings: ["aptss ssupdate failed"],
        hasRunningTasks: true,
        searchQuery: "",
        selectedKeys: ["aptss:firefox"],
        items: [
          {
            taskKey: "aptss:firefox",
            packageName: "firefox",
            displayName: "Firefox",
            currentVersion: "1.5",
            newVersion: "2.0",
            source: "aptss",
            size: "123456",
            iconPath: "",
            downloadUrl: "",
            sha512: "",
            ignored: false,
            isMigration: true,
            migrationSource: "aptss",
            migrationTarget: "apm",
          },
        ],
        tasks: [
          {
            taskKey: "aptss:firefox",
            packageName: "firefox",
            source: "aptss",
            status: "downloading",
            progress: 0.35,
            queuePosition: 1,
            logs: [{ time: Date.now(), message: "downloading" }],
            errorMessage: "",
          },
        ],
        activeLogTaskKey: "aptss:firefox",
        showMigrationConfirm: false,
        showCloseConfirm: true,
        onClose,
        onRequestClose,
      },
    });

    expect(screen.getByText("软件更新")).toBeInTheDocument();
    expect(screen.getByText("传统deb")).toBeInTheDocument();
    expect(screen.getByText("将迁移到 APM")).toBeInTheDocument();
    expect(screen.getByText("aptss ssupdate failed")).toBeInTheDocument();
    expect(screen.getByText("35%")).toBeInTheDocument();
    expect(screen.getByText("正在更新，确认关闭？")).toBeInTheDocument();

    await fireEvent.click(screen.getByLabelText("关闭"));
    expect(onRequestClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/UpdateCenterModal.test.ts`

Expected: FAIL with `Cannot find module '@/components/UpdateCenterModal.vue'`.

- [ ] **Step 3: Write minimal implementation**

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
      class="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/70 px-4 py-6"
    >
      <div class="flex h-[88vh] w-full max-w-7xl overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div class="flex min-w-0 flex-1 flex-col">
          <UpdateCenterToolbar
            :loading="loading"
            :warnings="warnings"
            :search-query="searchQuery"
            :selected-count="selectedKeys.length"
            @refresh="$emit('refresh')"
            @update-selected="$emit('start-selected')"
            @update-all="$emit('start-all')"
            @update:search-query="$emit('update:search-query', $event)"
            @close="$emit('request-close')"
          />
          <UpdateCenterList
            :items="items"
            :tasks="tasks"
            :selected-keys="selectedKeys"
            @toggle="$emit('toggle-selection', $event)"
            @toggle-ignore="$emit('toggle-ignore', $event)"
            @start-one="$emit('start-one', $event)"
            @show-logs="$emit('show-logs', $event)"
          />
        </div>
        <UpdateCenterLogPanel
          :active-task-key="activeLogTaskKey"
          :tasks="tasks"
        />
      </div>
      <UpdateCenterMigrationConfirm
        :show="showMigrationConfirm"
        @confirm="$emit('confirm-migration')"
        @close="$emit('cancel-migration')"
      />
      <UpdateCenterCloseConfirm
        :show="showCloseConfirm"
        @confirm="$emit('close')"
        @close="$emit('cancel-close')"
      />
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { UpdateCenterItem, UpdateCenterTaskState } from "@/global/typedefinition";

import UpdateCenterToolbar from "./update-center/UpdateCenterToolbar.vue";
import UpdateCenterList from "./update-center/UpdateCenterList.vue";
import UpdateCenterMigrationConfirm from "./update-center/UpdateCenterMigrationConfirm.vue";
import UpdateCenterCloseConfirm from "./update-center/UpdateCenterCloseConfirm.vue";
import UpdateCenterLogPanel from "./update-center/UpdateCenterLogPanel.vue";

defineProps<{
  show: boolean;
  loading: boolean;
  error: string;
  warnings: string[];
  hasRunningTasks: boolean;
  searchQuery: string;
  selectedKeys: string[];
  items: UpdateCenterItem[];
  tasks: UpdateCenterTaskState[];
  activeLogTaskKey: string | null;
  showMigrationConfirm: boolean;
  showCloseConfirm: boolean;
}>();

defineEmits<{
  close: [];
  "request-close": [];
  "cancel-close": [];
  refresh: [];
  "start-selected": [];
  "start-all": [];
  "start-one": [taskKey: string];
  "toggle-selection": [taskKey: string];
  "toggle-ignore": [taskKey: string];
  "show-logs": [taskKey: string];
  "confirm-migration": [];
  "cancel-migration": [];
  "update:search-query": [value: string];
}>();
</script>
```

```vue
<!-- src/components/update-center/UpdateCenterItem.vue -->
<template>
  <article class="rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70">
    <div class="flex items-start gap-3">
      <input
        :checked="selected"
        type="checkbox"
        class="mt-1 h-4 w-4 rounded border-slate-300 accent-brand"
        @change="$emit('toggle')"
      />
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <p class="font-semibold text-slate-900 dark:text-white">{{ item.displayName }}</p>
          <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {{ item.source === 'apm' ? 'APM' : '传统deb' }}
          </span>
          <span v-if="item.isMigration" class="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            将迁移到 APM
          </span>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          {{ item.packageName }} · {{ item.currentVersion }} -> {{ item.newVersion }} · {{ item.size }}
        </p>
        <div v-if="task?.status === 'downloading'" class="mt-3">
          <div class="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
            <div class="h-2 rounded-full bg-brand" :style="{ width: `${Math.round(task.progress * 100)}%` }"></div>
          </div>
          <p class="mt-2 text-xs text-slate-500 dark:text-slate-400">{{ Math.round(task.progress * 100) }}%</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button type="button" class="rounded-2xl border border-slate-200/70 px-3 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200" @click="$emit('toggle-ignore')">
          {{ item.ignored ? '取消忽略' : '忽略' }}
        </button>
        <button type="button" class="rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-3 py-2 text-sm font-semibold text-white" @click="$emit('start')">
          更新
        </button>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import type { UpdateCenterItem, UpdateCenterTaskState } from "@/global/typedefinition";

defineProps<{
  item: UpdateCenterItem;
  task?: UpdateCenterTaskState;
  selected: boolean;
}>();

defineEmits<{
  toggle: [];
  "toggle-ignore": [];
  start: [];
}>();
</script>
```

```ts
// src/App.vue (script snippet)
import { onBeforeUnmount, onMounted } from "vue";

import UpdateCenterModal from "./components/UpdateCenterModal.vue";
import { createUpdateCenterStore } from "./modules/updateCenter";

const updateCenter = createUpdateCenterStore();

onMounted(() => {
  updateCenter.bind();
});

onBeforeUnmount(() => {
  updateCenter.unbind();
});

const handleUpdate = async () => {
  await updateCenter.open();
};
```

```vue
<!-- src/components/update-center/UpdateCenterToolbar.vue -->
<template>
  <header class="border-b border-slate-200/70 px-6 py-5 dark:border-slate-800/70">
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex-1">
        <p class="text-2xl font-semibold text-slate-900 dark:text-white">软件更新</p>
        <p class="text-sm text-slate-500 dark:text-slate-400">APTSS 与 APM 更新已合并展示</p>
      </div>
      <button type="button" class="rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200" @click="$emit('refresh')">
        刷新
      </button>
      <button type="button" class="rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-semibold text-white" @click="$emit('update-selected')">
        更新选中({{ selectedCount }})
      </button>
      <input
        :value="searchQuery"
        type="search"
        class="w-full max-w-xs rounded-2xl border border-slate-200/70 bg-white px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        placeholder="搜索包名或应用名"
        @input="$emit('update:search-query', ($event.target as HTMLInputElement).value)"
      />
      <button type="button" aria-label="关闭" class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-500 dark:border-slate-700" @click="$emit('close')">
        <i class="fas fa-xmark"></i>
      </button>
    </div>
    <div v-if="warnings.length > 0" class="mt-4 rounded-2xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
      <p v-for="warning in warnings" :key="warning">{{ warning }}</p>
    </div>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  loading: boolean;
  warnings: string[];
  searchQuery: string;
  selectedCount: number;
}>();

defineEmits<{
  refresh: [];
  close: [];
  "update-selected": [];
  "update-all": [];
  "update:search-query": [value: string];
}>();
</script>
```

```vue
<!-- src/components/update-center/UpdateCenterCloseConfirm.vue -->
<template>
  <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 px-4">
    <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
      <p class="text-lg font-semibold text-slate-900 dark:text-white">正在更新，确认关闭？</p>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">关闭后任务会继续在后台运行，再次打开更新中心时应恢复当前状态。</p>
      <div class="mt-6 flex justify-end gap-3">
        <button type="button" class="rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200" @click="$emit('close')">继续查看</button>
        <button type="button" class="rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-semibold text-white" @click="$emit('confirm')">确认关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ show: boolean }>();

defineEmits<{
  close: [];
  confirm: [];
}>();
</script>
```

```vue
<!-- src/components/update-center/UpdateCenterMigrationConfirm.vue -->
<template>
  <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/70 px-4">
    <div class="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
      <p class="text-lg font-semibold text-slate-900 dark:text-white">存在来源迁移更新</p>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">这些应用更新后会从传统 deb 切换为 APM 来源。确认后继续更新迁移项。</p>
      <div class="mt-6 flex justify-end gap-3">
        <button type="button" class="rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200" @click="$emit('close')">取消</button>
        <button type="button" class="rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-semibold text-white" @click="$emit('confirm')">继续更新</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ show: boolean }>();

defineEmits<{
  close: [];
  confirm: [];
}>();
</script>
```

```vue
<!-- src/components/update-center/UpdateCenterLogPanel.vue -->
<template>
  <aside class="hidden w-[340px] shrink-0 border-l border-slate-200/70 bg-slate-50/80 dark:border-slate-800/70 dark:bg-slate-950/70 lg:block">
    <div class="border-b border-slate-200/70 px-4 py-4 dark:border-slate-800/70">
      <p class="text-sm font-semibold text-slate-900 dark:text-white">任务日志</p>
    </div>
    <div class="h-full overflow-y-auto px-4 py-4 text-xs text-slate-600 dark:text-slate-300">
      <template v-if="activeTask">
        <p v-for="entry in activeTask.logs" :key="`${entry.time}-${entry.message}`" class="mb-2 whitespace-pre-wrap">{{ entry.message }}</p>
      </template>
      <p v-else class="text-slate-400 dark:text-slate-500">选择一项更新任务后在这里查看日志。</p>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { UpdateCenterTaskState } from "@/global/typedefinition";

const props = defineProps<{
  activeTaskKey: string | null;
  tasks: UpdateCenterTaskState[];
}>();

const activeTask = computed(() => {
  return props.tasks.find((task) => task.taskKey === props.activeTaskKey) ?? null;
});
</script>
```

```vue
<!-- src/components/update-center/UpdateCenterList.vue -->
<template>
  <div class="flex-1 overflow-y-auto px-6 py-5">
    <div class="space-y-3">
      <UpdateCenterItem
        v-for="item in items"
        :key="item.taskKey"
        :item="item"
        :task="taskMap.get(item.taskKey)"
        :selected="selectedKeys.includes(item.taskKey)"
        @toggle="$emit('toggle', item.taskKey)"
        @toggle-ignore="$emit('toggle-ignore', item.taskKey)"
        @start="$emit('start-one', item.taskKey)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { UpdateCenterItem, UpdateCenterTaskState } from "@/global/typedefinition";
import UpdateCenterItemView from "./UpdateCenterItem.vue";

const props = defineProps<{
  items: UpdateCenterItem[];
  tasks: UpdateCenterTaskState[];
  selectedKeys: string[];
}>();

defineEmits<{
  toggle: [taskKey: string];
  "toggle-ignore": [taskKey: string];
  "start-one": [taskKey: string];
}>();

const UpdateCenterItem = UpdateCenterItemView;

const taskMap = computed(() => {
  return new Map(props.tasks.map((task) => [task.taskKey, task]));
});
</script>
```

```vue
<!-- src/App.vue (template snippet) -->
<UpdateCenterModal
  :show="updateCenter.show"
  :loading="false"
  :error="''"
  :warnings="updateCenter.snapshot.warnings"
  :has-running-tasks="updateCenter.snapshot.hasRunningTasks"
  :search-query="updateCenter.searchQuery"
  :selected-keys="Array.from(updateCenter.selectedKeys)"
  :items="updateCenter.filteredItems"
  :tasks="updateCenter.snapshot.tasks"
  :active-log-task-key="null"
  :show-migration-confirm="updateCenter.showMigrationConfirm"
  :show-close-confirm="updateCenter.showCloseConfirm"
  @close="updateCenter.show = false"
  @request-close="updateCenter.requestClose"
  @cancel-close="updateCenter.showCloseConfirm = false"
  @refresh="updateCenter.refresh"
  @start-selected="updateCenter.startSelected"
  @toggle-selection="updateCenter.toggleSelection"
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/UpdateCenterModal.test.ts`

Expected: PASS with 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add src/components/UpdateCenterModal.vue src/components/update-center/UpdateCenterToolbar.vue src/components/update-center/UpdateCenterList.vue src/components/update-center/UpdateCenterItem.vue src/components/update-center/UpdateCenterMigrationConfirm.vue src/components/update-center/UpdateCenterCloseConfirm.vue src/components/update-center/UpdateCenterLogPanel.vue src/App.vue src/__tests__/unit/update-center/UpdateCenterModal.test.ts
git rm src/components/UpdateAppsModal.vue
git commit -m "feat(update-center): add integrated update center modal"
```

### Task 7: Format, Verify, and Build the Integrated Update Center

**Files:**
- Modify: `electron/main/backend/update-center/query.ts`
- Modify: `electron/main/backend/update-center/ignore-config.ts`
- Modify: `electron/main/backend/update-center/queue.ts`
- Modify: `electron/main/backend/update-center/download.ts`
- Modify: `electron/main/backend/update-center/install.ts`
- Modify: `electron/main/backend/update-center/service.ts`
- Modify: `electron/main/backend/update-center/index.ts`
- Modify: `src/components/UpdateCenterModal.vue`
- Modify: `src/components/update-center/UpdateCenterToolbar.vue`
- Modify: `src/components/update-center/UpdateCenterList.vue`
- Modify: `src/components/update-center/UpdateCenterItem.vue`
- Modify: `src/components/update-center/UpdateCenterMigrationConfirm.vue`
- Modify: `src/components/update-center/UpdateCenterCloseConfirm.vue`
- Modify: `src/components/update-center/UpdateCenterLogPanel.vue`
- Modify: `src/modules/updateCenter.ts`
- Modify: `src/App.vue`

- [ ] **Step 1: Format the changed files**

Run: `npm run format`

Expected: Prettier rewrites the changed `src/` and `electron/` files without errors.

- [ ] **Step 2: Run lint and the complete unit suite**

Run: `npm run lint && npm run test -- --run`

Expected: ESLint exits 0 and Vitest reports all unit tests passing, including the new `update-center` tests.

- [ ] **Step 3: Run the production renderer build**

Run: `npm run build:vite`

Expected: `vue-tsc` and Vite finish successfully, producing updated `dist/` and `dist-electron/` assets without type errors.

- [ ] **Step 4: Commit the final verified integration**

```bash
git add electron/main/backend/update-center electron/main/index.ts electron/main/backend/install-manager.ts electron/preload/index.ts src/vite-env.d.ts src/global/typedefinition.ts src/modules/updateCenter.ts src/components/UpdateCenterModal.vue src/components/update-center src/App.vue src/__tests__/unit/update-center
git commit -m "feat(update-center): embed spark updates into electron"
```
