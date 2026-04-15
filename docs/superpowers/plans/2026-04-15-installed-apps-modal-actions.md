# Installed Apps Modal Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore launch and detail entry points from the installed-apps modal by wiring explicit `打开` and `查看详情` actions back to the existing parent handlers.

**Architecture:** Keep the fix local to the installed-apps modal and `App.vue`. Add two emitted events from `InstalledAppsModal.vue`, conditionally render the detail action when the app has usable store metadata, and connect those events to the existing `openDownloadedApp()` and `openDetail()` logic in the parent.

**Tech Stack:** Vue 3, TypeScript, Vitest, Testing Library Vue

---

## File Structure

- Modify: `src/components/InstalledAppsModal.vue`
  Responsibility: render open/detail actions for installed app rows and emit events upward.
- Modify: `src/App.vue`
  Responsibility: wire modal events to existing launch/detail handlers.
- Modify: `src/__tests__/unit/InstalledAppsModal.test.ts`
  Responsibility: prove action buttons render and emit correctly.

### Task 1: Add Failing Modal Tests

**Files:**

- Modify: `src/__tests__/unit/InstalledAppsModal.test.ts`

- [ ] **Step 1: Write failing tests for open/detail actions**

```ts
it("renders open and detail actions for a store-backed installed app", async () => {
  // render with one installed app whose category is not unknown
  // expect 打开 and 查看详情 buttons to exist
});

it("emits open-app when clicking 打开", async () => {
  // click open button
  // expect emitted()['open-app']
});

it("emits open-detail when clicking 查看详情", async () => {
  // click detail button
  // expect emitted()['open-detail']
});

it("hides 查看详情 for unknown-category apps", () => {
  // render app with category unknown
  // expect no 查看详情 button
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/unit/InstalledAppsModal.test.ts`
Expected: FAIL because the modal does not yet render or emit the new actions

### Task 2: Implement Modal Actions

**Files:**

- Modify: `src/components/InstalledAppsModal.vue`
- Modify: `src/App.vue`

- [ ] **Step 1: Add minimal modal action rendering and emits**

```ts
defineEmits<{
  (e: "close"): void;
  (e: "refresh"): void;
  (e: "uninstall", app: App): void;
  (e: "switch-origin", origin: "apm" | "spark"): void;
  (e: "open-app", app: App): void;
  (e: "open-detail", app: App): void;
}>();
```

- [ ] **Step 2: Add a simple detail-eligibility helper**

```ts
const canOpenDetail = (app: App) => {
  return (
    app.category !== "unknown" ||
    Boolean(app.more) ||
    Boolean(app.website) ||
    Boolean(app.author) ||
    (app.img_urls?.length ?? 0) > 0
  );
};
```

- [ ] **Step 3: Add 打开 / 查看详情 buttons to each row**

```vue
<button type="button" @click="$emit('open-app', app)">打开</button>
<button
  v-if="canOpenDetail(app)"
  type="button"
  @click="$emit('open-detail', app)"
>
  查看详情
</button>
```

- [ ] **Step 4: Wire parent events to existing handlers**

```vue
<InstalledAppsModal
  ...
  @open-app="openDownloadedApp($event.pkgname, $event.origin)"
  @open-detail="openDetail"
/>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/__tests__/unit/InstalledAppsModal.test.ts`
Expected: PASS

### Task 3: Verification And Commit

**Files:**

- Modify: `src/components/InstalledAppsModal.vue`
- Modify: `src/App.vue`
- Modify: `src/__tests__/unit/InstalledAppsModal.test.ts`

- [ ] **Step 1: Run focused modal test**

Run: `npx vitest run src/__tests__/unit/InstalledAppsModal.test.ts`
Expected: PASS

- [ ] **Step 2: Run repository lint**

Run: `npm run lint`
Expected: exit 0

- [ ] **Step 3: Run repository build**

Run: `npm run build:vite`
Expected: exit 0

- [ ] **Step 4: Review final diff**

Run: `git diff -- src/components/InstalledAppsModal.vue src/App.vue src/__tests__/unit/InstalledAppsModal.test.ts docs/superpowers/specs/2026-04-15-installed-apps-modal-actions-design.md docs/superpowers/plans/2026-04-15-installed-apps-modal-actions.md`
Expected: only installed-app actions and docs changes appear

- [ ] **Step 5: Commit**

```bash
git add src/components/InstalledAppsModal.vue src/App.vue src/__tests__/unit/InstalledAppsModal.test.ts docs/superpowers/specs/2026-04-15-installed-apps-modal-actions-design.md docs/superpowers/plans/2026-04-15-installed-apps-modal-actions.md
git commit -m "fix(installed-apps): restore open and detail actions"
```
