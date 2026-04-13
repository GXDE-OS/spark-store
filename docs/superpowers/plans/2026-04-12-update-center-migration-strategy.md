# Update Center Migration Strategy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make update-center behavior follow installed-source-aware rules, including aptss-to-apm migration as a single visible update that removes the aptss package before installing the apm version.

**Architecture:** Keep the existing update-center pipeline, but change it at three narrow seams: source merging in `query.ts`, task payload creation in `service.ts`, and migration execution in the main-process install path. The renderer keeps showing update items and download queue entries, while the main process becomes the only place that performs the ordered `aptss remove -> apm install` migration.

**Tech Stack:** TypeScript, Electron IPC, Vue 3, Vitest

---

### Task 1: Installed-Source Merge Rules

**Files:**

- Modify: `electron/main/backend/update-center/query.ts:325-374`
- Test: `src/__tests__/unit/update-center/query.test.ts`

- [ ] **Step 1: Write the failing merge-rule tests**

Add these tests to `src/__tests__/unit/update-center/query.test.ts` next to the existing `mergeUpdateSources()` coverage:

```ts
it("returns only the migration item when only aptss is installed and apm has a higher version", () => {
  const merged = mergeUpdateSources(
    [
      {
        pkgname: "spark-weather",
        source: "aptss",
        currentVersion: "1.9.0",
        nextVersion: "2.0.0",
      },
    ],
    [
      {
        pkgname: "spark-weather",
        source: "apm",
        currentVersion: "1.8.0",
        nextVersion: "3.0.0",
      },
    ],
    new Map([["spark-weather", { aptss: true, apm: false }]]),
  );

  expect(merged).toEqual([
    {
      pkgname: "spark-weather",
      source: "apm",
      currentVersion: "1.8.0",
      nextVersion: "3.0.0",
      isMigration: true,
      migrationSource: "aptss",
      migrationTarget: "apm",
      aptssVersion: "2.0.0",
    },
  ]);
});

it("returns only the aptss item when only aptss is installed and apm is not newer", () => {
  const merged = mergeUpdateSources(
    [
      {
        pkgname: "spark-notes",
        source: "aptss",
        currentVersion: "1.0.0",
        nextVersion: "2.0.0",
      },
    ],
    [
      {
        pkgname: "spark-notes",
        source: "apm",
        currentVersion: "1.0.0",
        nextVersion: "1.5.0",
      },
    ],
    new Map([["spark-notes", { aptss: true, apm: false }]]),
  );

  expect(merged).toEqual([
    {
      pkgname: "spark-notes",
      source: "aptss",
      currentVersion: "1.0.0",
      nextVersion: "2.0.0",
    },
  ]);
});

it("returns only the apm item when only apm is installed", () => {
  const merged = mergeUpdateSources(
    [
      {
        pkgname: "spark-player",
        source: "aptss",
        currentVersion: "1.0.0",
        nextVersion: "2.0.0",
      },
    ],
    [
      {
        pkgname: "spark-player",
        source: "apm",
        currentVersion: "1.1.0",
        nextVersion: "3.0.0",
      },
    ],
    new Map([["spark-player", { aptss: false, apm: true }]]),
  );

  expect(merged).toEqual([
    {
      pkgname: "spark-player",
      source: "apm",
      currentVersion: "1.1.0",
      nextVersion: "3.0.0",
    },
  ]);
});

it("returns both items when aptss and apm are both installed", () => {
  const merged = mergeUpdateSources(
    [
      {
        pkgname: "spark-browser",
        source: "aptss",
        currentVersion: "10.0",
        nextVersion: "11.0",
      },
    ],
    [
      {
        pkgname: "spark-browser",
        source: "apm",
        currentVersion: "11.0",
        nextVersion: "12.0",
      },
    ],
    new Map([["spark-browser", { aptss: true, apm: true }]]),
  );

  expect(merged).toEqual([
    {
      pkgname: "spark-browser",
      source: "aptss",
      currentVersion: "10.0",
      nextVersion: "11.0",
    },
    {
      pkgname: "spark-browser",
      source: "apm",
      currentVersion: "11.0",
      nextVersion: "12.0",
    },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/query.test.ts`
Expected: FAIL because the current implementation still returns both the migration item and the aptss item for the aptss-only migration case, and still returns both sources in the apm-only case.

- [ ] **Step 3: Write the minimal merge logic**

Update `electron/main/backend/update-center/query.ts` so `mergeUpdateSources()` uses installed-source-aware branching instead of unconditional double inclusion. Replace the body with this implementation shape:

```ts
export const mergeUpdateSources = (
  aptssItems: UpdateCenterItem[],
  apmItems: UpdateCenterItem[],
  installedSources: Map<string, InstalledSourceState>,
): UpdateCenterItem[] => {
  const aptssMap = new Map(aptssItems.map((item) => [item.pkgname, item]));
  const apmMap = new Map(apmItems.map((item) => [item.pkgname, item]));
  const pkgnames = new Set([...aptssMap.keys(), ...apmMap.keys()]);
  const merged: UpdateCenterItem[] = [];

  for (const pkgname of pkgnames) {
    const aptssItem = aptssMap.get(pkgname);
    const apmItem = apmMap.get(pkgname);
    const installedState = installedSources.get(pkgname);

    if (installedState?.aptss === true && installedState.apm === false) {
      if (aptssItem && apmItem) {
        if (compareVersions(apmItem.nextVersion, aptssItem.nextVersion) > 0) {
          merged.push({
            ...apmItem,
            isMigration: true,
            migrationSource: "aptss",
            migrationTarget: "apm",
            aptssVersion: aptssItem.nextVersion,
          });
        } else {
          merged.push(aptssItem);
        }
        continue;
      }

      if (aptssItem) {
        merged.push(aptssItem);
      }
      continue;
    }

    if (installedState?.aptss === false && installedState.apm === true) {
      if (apmItem) {
        merged.push(apmItem);
      }
      continue;
    }

    if (installedState?.aptss === true && installedState.apm === true) {
      if (aptssItem) merged.push(aptssItem);
      if (apmItem) merged.push(apmItem);
      continue;
    }

    if (aptssItem) merged.push(aptssItem);
    if (apmItem) merged.push(apmItem);
  }

  return merged;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/query.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/unit/update-center/query.test.ts electron/main/backend/update-center/query.ts
git commit -m "fix(update-center): apply installed-source merge rules"
```

### Task 2: Migration Payload and Main-Process Execution

**Files:**

- Modify: `electron/main/backend/update-center/service.ts:191-245`
- Modify: `src/global/typedefinition.ts:29-54`
- Modify: `src/modules/updateCenter.ts:148-205`
- Modify: `electron/main/backend/install-manager.ts:251-299`
- Test: `src/__tests__/unit/update-center/registerUpdateCenter.test.ts`
- Test: `src/__tests__/unit/update-center/task-runner.test.ts`

- [ ] **Step 1: Write the failing IPC payload test**

Add this test to `src/__tests__/unit/update-center/registerUpdateCenter.test.ts` near the existing `service.start()` coverage:

```ts
it("sends migration metadata to the main install queue", async () => {
  const send = vi.fn();
  electronMock.getAllWindows.mockReturnValue([{ webContents: { send } }]);

  const service = createUpdateCenterService({
    loadItems: async () => [
      {
        ...createItem(),
        source: "apm",
        isMigration: true,
        migrationSource: "aptss",
        migrationTarget: "apm",
        fileName: "spark-weather_3.0.0_amd64.deb",
        downloadUrl: "https://example.invalid/spark-weather_3.0.0_amd64.deb",
      },
    ],
  });

  await service.refresh();
  await service.start(["apm:spark-weather"]);

  expect(send).toHaveBeenCalledWith(
    "queue-install",
    JSON.stringify(
      expect.objectContaining({
        pkgname: "spark-weather",
        origin: "apm",
        upgradeOnly: true,
        isMigration: true,
        migrationSource: "aptss",
        migrationTarget: "apm",
      }),
    ),
  );
});
```

- [ ] **Step 2: Write the failing migration install test**

Add this test to `src/__tests__/unit/update-center/task-runner.test.ts` after the direct install command tests:

```ts
it("runs aptss remove before apm ssinstall for migration items", async () => {
  childProcessMock.spawnCalls.length = 0;

  await installUpdateItem({
    item: {
      ...createApmItem(),
      isMigration: true,
      migrationSource: "aptss",
      migrationTarget: "apm",
    },
    filePath: "/tmp/spark-player.deb",
    superUserCmd: "/usr/bin/pkexec",
  });

  expect(childProcessMock.spawnCalls).toEqual([
    {
      command: "/usr/bin/pkexec",
      args: [
        "/opt/spark-store/extras/shell-caller.sh",
        "aptss",
        "remove",
        "spark-player",
      ],
    },
    {
      command: "/usr/bin/pkexec",
      args: [
        "/opt/spark-store/extras/shell-caller.sh",
        "apm",
        "ssinstall",
        "/tmp/spark-player.deb",
      ],
    },
  ]);
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -- --run src/__tests__/unit/update-center/registerUpdateCenter.test.ts src/__tests__/unit/update-center/task-runner.test.ts`
Expected: FAIL because the queue-install payload does not include migration metadata yet, and the install path still runs only the apm install command.

- [ ] **Step 4: Extend the task payload types**

Add these optional fields to `DownloadItem`-adjacent transport types in `src/global/typedefinition.ts` or the local payload interface that already carries queue-install data:

```ts
  isMigration?: boolean;
  migrationSource?: "aptss" | "apm";
  migrationTarget?: "aptss" | "apm";
```

If the queue payload is not typed centrally, create a narrow local type in `electron/main/backend/update-center/service.ts` and a matching parsing shape in `electron/main/backend/install-manager.ts`.

- [ ] **Step 5: Send migration metadata from the update-center service**

Change `installTaskData` in `electron/main/backend/update-center/service.ts` to include the migration fields when present:

```ts
const installTaskData = {
  id: updateTaskId,
  pkgname: item.pkgname,
  metalinkUrl,
  filename: item.fileName,
  upgradeOnly: true,
  origin: item.source === "apm" ? "apm" : "spark",
  retry: false,
  isMigration: item.isMigration === true,
  migrationSource: item.migrationSource,
  migrationTarget: item.migrationTarget,
};
```

- [ ] **Step 6: Preserve migration state in the renderer queue item**

Extend the temporary queue item created in `src/modules/updateCenter.ts` so migration items show up as migration work instead of generic updates:

```ts
          logs: [
            {
              time: Date.now(),
              message: item.isMigration === true ? "开始迁移到 APM..." : "开始更新...",
            },
          ],
```

Also carry the same optional migration flags if the renderer-side queue type supports them.

- [ ] **Step 7: Implement ordered migration execution in the main process**

In the main install path used by update-center file installs, add a migration branch before the normal `origin === "apm"` handling. The shape should be:

```ts
if (isMigration === true && migrationSource === "aptss" && origin === "apm") {
  const removeCommand = superUserCmd || SHELL_CALLER_PATH;
  const removeParams: string[] = [];
  if (superUserCmd) {
    removeParams.push(SHELL_CALLER_PATH);
  }
  removeParams.push("aptss", "remove", pkgname);

  await runInstallCommand({
    command: removeCommand,
    args: removeParams,
    webContents,
    id,
    stageLabel: "迁移卸载旧版本",
  });
}
```

Then fall through to the existing apm install branch so the next command remains:

```ts
execParams.push("apm");
execParams.push("ssinstall", `${downloadDir}/${filename}`);
```

Use the existing install-log/install-complete reporting path rather than inventing a second event system.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm run test -- --run src/__tests__/unit/update-center/registerUpdateCenter.test.ts src/__tests__/unit/update-center/task-runner.test.ts`
Expected: PASS for the new migration payload and command-order tests

- [ ] **Step 9: Commit**

```bash
git add electron/main/backend/update-center/service.ts src/global/typedefinition.ts src/modules/updateCenter.ts electron/main/backend/install-manager.ts src/__tests__/unit/update-center/registerUpdateCenter.test.ts src/__tests__/unit/update-center/task-runner.test.ts
git commit -m "feat(update-center): run aptss-to-apm migrations"
```

### Task 3: Migration Confirmation Copy and Renderer Regression

**Files:**

- Modify: `src/components/update-center/UpdateCenterMigrationConfirm.vue`
- Test: `src/__tests__/unit/update-center/UpdateCenterModal.test.ts`

- [ ] **Step 1: Write the failing migration-copy test**

Update `src/__tests__/unit/update-center/UpdateCenterModal.test.ts` so the migration confirmation assertion expects the new copy:

```ts
it("renders migration confirmation copy explaining aptss removal and apm install", () => {
  const store = createStore({ hasRunningTasks: false });
  store.showMigrationConfirm.value = true;

  render(UpdateCenterModal, {
    props: {
      show: true,
      store,
    },
  });

  expect(screen.getByText("迁移确认")).toBeTruthy();
  expect(
    screen.getByText(/会先卸载现有 aptss 版本，再安装 APM 版本/),
  ).toBeTruthy();
  expect(screen.getByText(/后续更新将由 APM 管理/)).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/update-center/UpdateCenterModal.test.ts`
Expected: FAIL because the current modal copy only says that some deb updates will migrate to APM.

- [ ] **Step 3: Update the modal copy with the approved behavior**

Change the body text in `src/components/update-center/UpdateCenterMigrationConfirm.vue` to this:

```vue
<p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        该应用将从传统 aptss 管理迁移到 APM 管理。迁移过程会先卸载现有 aptss 版本，再安装 APM 版本；迁移完成后，后续更新将由 APM 管理。
      </p>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/update-center/UpdateCenterModal.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/update-center/UpdateCenterMigrationConfirm.vue src/__tests__/unit/update-center/UpdateCenterModal.test.ts
git commit -m "docs(update-center): clarify migration confirmation"
```

### Task 4: Final Verification

**Files:**

- Modify: none
- Test: `src/__tests__/unit/update-center/query.test.ts`
- Test: `src/__tests__/unit/update-center/registerUpdateCenter.test.ts`
- Test: `src/__tests__/unit/update-center/task-runner.test.ts`
- Test: `src/__tests__/unit/update-center/UpdateCenterModal.test.ts`

- [ ] **Step 1: Run focused regression suite**

Run:

```bash
npm run test -- --run src/__tests__/unit/update-center/query.test.ts src/__tests__/unit/update-center/registerUpdateCenter.test.ts src/__tests__/unit/update-center/task-runner.test.ts src/__tests__/unit/update-center/UpdateCenterModal.test.ts
```

Expected: PASS

- [ ] **Step 2: Run lint if the touched files are lint-clean**

Run: `npm run lint`
Expected: either PASS or the same known unrelated pre-existing lint failures already present in the branch. Do not claim a clean lint run unless the command output is actually clean.

- [ ] **Step 3: Review the final diff**

Run:

```bash
git diff -- electron/main/backend/update-center/query.ts electron/main/backend/update-center/service.ts electron/main/backend/install-manager.ts src/modules/updateCenter.ts src/components/update-center/UpdateCenterMigrationConfirm.vue src/__tests__/unit/update-center/query.test.ts src/__tests__/unit/update-center/registerUpdateCenter.test.ts src/__tests__/unit/update-center/task-runner.test.ts src/__tests__/unit/update-center/UpdateCenterModal.test.ts
```

Expected: diff only covers merge rules, migration payload/execution, and migration confirmation copy.

- [ ] **Step 4: Commit final verification state if needed**

```bash
git status --short
```

If uncommitted changes remain from verification-only edits, either commit them with a focused message or fold them into the last task commit before handing off.
