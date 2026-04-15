# Update Ignore Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move update-ignore persistence to user config, add ignore and unignore controls to the Electron update center, and make the legacy Qt updater plus root notifier honor the same `pkg|newVersion` rules.

**Architecture:** Keep the existing text config format and IPC channels. Change the default config path in the Electron backend, expose ignore actions in the renderer store and item component, align the Qt updater with the same new-version key semantics, and teach the notifier to discover user config files without trusting root `HOME`.

**Tech Stack:** TypeScript, Vue 3, Electron IPC, Vitest, Qt/C++, POSIX shell

---

## File Structure

- Modify: `electron/main/backend/update-center/ignore-config.ts`
  Responsibility: switch the default ignore config path to the user config directory and keep exact `pkg|version` matching.
- Modify: `electron/main/backend/update-center/service.ts`
  Responsibility: apply ignored sorting after refresh.
- Modify: `src/modules/updateCenter.ts`
  Responsibility: expose ignore and unignore actions to the renderer.
- Modify: `src/components/update-center/UpdateCenterItem.vue`
  Responsibility: render ignore and unignore controls for each item.
- Modify: `src/components/update-center/UpdateCenterList.vue`
  Responsibility: bubble ignore and unignore item events upward.
- Modify: `src/components/UpdateCenterModal.vue`
  Responsibility: wire ignore and unignore item events to the store.
- Modify: `src/__tests__/unit/update-center/ignore-config.test.ts`
  Responsibility: prove the new default path resolves to the user config directory.
- Modify: `src/__tests__/unit/update-center/store.test.ts`
  Responsibility: prove ignore and unignore call the preload bridge and refresh state.
- Modify: `src/__tests__/unit/update-center/UpdateCenterModal.test.ts`
  Responsibility: prove ignore-state actions render correctly.
- Modify: `spark-update-tool/src/ignoreconfig.cpp`
  Responsibility: move the Qt config path to the user config directory.
- Modify: `spark-update-tool/src/ignoreconfig.h`
  Responsibility: support exact unignore by package plus version.
- Modify: `spark-update-tool/src/appdelegate.cpp`
  Responsibility: emit the target new version when ignoring or unignoring.
- Modify: `spark-update-tool/src/appdelegate.h`
  Responsibility: update the unignore signal signature.
- Modify: `spark-update-tool/src/mainwindow.cpp`
  Responsibility: match ignored state against new versions and remove exact entries.
- Modify: `spark-update-tool/src/mainwindow.h`
  Responsibility: update slot signatures.
- Modify: `tool/update-upgrade/ss-update-notifier.sh`
  Responsibility: locate user config files from a root service context and filter exact `pkg|newVersion` matches.

## Task 1: Electron Ignore Path And Renderer Actions

**Files:**

- Modify: `electron/main/backend/update-center/ignore-config.ts`
- Modify: `electron/main/backend/update-center/service.ts`
- Modify: `src/modules/updateCenter.ts`
- Modify: `src/components/update-center/UpdateCenterItem.vue`
- Modify: `src/components/update-center/UpdateCenterList.vue`
- Modify: `src/components/UpdateCenterModal.vue`
- Modify: `src/__tests__/unit/update-center/ignore-config.test.ts`
- Modify: `src/__tests__/unit/update-center/store.test.ts`
- Modify: `src/__tests__/unit/update-center/UpdateCenterModal.test.ts`

- [ ] Write failing tests for the new user config path, ignore/unignore store methods, and item actions.
- [ ] Run `npx vitest run src/__tests__/unit/update-center/ignore-config.test.ts src/__tests__/unit/update-center/store.test.ts src/__tests__/unit/update-center/UpdateCenterModal.test.ts` and confirm they fail for the expected reasons.
- [ ] Implement the minimal backend path change, item sorting, renderer store methods, and modal wiring.
- [ ] Re-run the same Vitest command and confirm it passes.

## Task 2: Legacy Qt Updater Alignment

**Files:**

- Modify: `spark-update-tool/src/ignoreconfig.cpp`
- Modify: `spark-update-tool/src/ignoreconfig.h`
- Modify: `spark-update-tool/src/appdelegate.cpp`
- Modify: `spark-update-tool/src/appdelegate.h`
- Modify: `spark-update-tool/src/mainwindow.cpp`
- Modify: `spark-update-tool/src/mainwindow.h`

- [ ] Change Qt config path resolution to `QStandardPaths::ConfigLocation/spark-store/ignored_apps.conf`.
- [ ] Switch ignore and unignore to use `packageName + newVersion` exact entries.
- [ ] Build-check the Qt target if a local build command is available.

## Task 3: Root Notifier User Config Discovery

**Files:**

- Modify: `tool/update-upgrade/ss-update-notifier.sh`

- [ ] Add shell helpers to detect a desktop user home when possible.
- [ ] Add fallback scanning across `/home/*/.config/spark-store/ignored_apps.conf`.
- [ ] Merge all discovered config files into one ignore set.
- [ ] Filter updates by exact `pkg|newVersion` instead of package-only.
- [ ] Run `bash -n tool/update-upgrade/ss-update-notifier.sh` and confirm syntax is valid.

## Task 4: Verification And Commit

**Files:**

- Modify: tracked files from Tasks 1-3

- [ ] Run `npx vitest run src/__tests__/unit/update-center/ignore-config.test.ts src/__tests__/unit/update-center/store.test.ts src/__tests__/unit/update-center/UpdateCenterModal.test.ts`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run `bash -n tool/update-upgrade/ss-update-notifier.sh`.
- [ ] Review the final diff.
- [ ] Create a commit with a message in repository style.
