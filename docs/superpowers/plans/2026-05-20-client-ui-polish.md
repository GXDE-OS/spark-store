# Client UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the client-side account, favorites, reviews, sync, restore, and shell UI issues reported in QA.

**Architecture:** Preserve existing Vue component boundaries. Add thin wrappers/helpers for modal account management, custom titlebar, review star controls, and sync restore candidate resolution. Backend-dependent review actions are client-side affordances only until backend endpoints exist.

**Tech Stack:** Vue 3 Composition API, TypeScript strict mode, Electron IPC, Tailwind CSS, Vitest, Testing Library Vue.

---

## File Structure

- Create `src/components/UserManagementModal.vue` to present `UserManagementView` as a global overlay.
- Create `src/components/WindowTitleBar.vue` for frameless titlebar UI and window controls.
- Modify `src/App.vue` to mount the new account modal, pass sync feedback to installed apps modal, pass favorite status to detail modal, and use restore candidate helper.
- Modify `src/components/AppSidebar.vue` and `src/components/AccountQuickMenu.vue` for overflow-safe labels and menu closing coverage.
- Modify `src/components/UserManagementView.vue` for cover-image rendering and modal-friendly layout.
- Modify `src/components/InstalledAppsModal.vue` to show sync feedback locally.
- Modify `src/components/FavoriteFolderSelector.vue` for normalized default-folder de-dupe and favorited-state text/actions.
- Modify `src/components/FavoriteFolderManager.vue` so the entire row content opens detail while checkbox stays isolated.
- Modify `src/components/AppDetailModal.vue` and `src/components/AppDetailPage.vue` to show `已收藏` state.
- Modify `src/components/ReviewsPanel.vue` for star rating, filters, user detail affordance, and disabled backend-dependent actions.
- Modify `src/modules/appListSync.ts` for `resolveCloudInstallCandidate()`.
- Modify `electron/main/index.ts`, `electron/preload/index.ts`, and `src/vite-env.d.ts` for frameless window controls.
- Add/update unit tests under `src/__tests__/unit/`.

---

### Task 1: Account Menu And User Management Modal

**Files:**
- Create: `src/components/UserManagementModal.vue`
- Modify: `src/App.vue`
- Modify: `src/components/AppSidebar.vue`
- Modify: `src/components/AccountQuickMenu.vue`
- Modify: `src/components/UserManagementView.vue`
- Modify: `src/global/typedefinition.ts`
- Modify: `src/modules/backendApi.ts`
- Modify: `src/global/authState.ts`
- Test: `src/__tests__/unit/AppSidebar.account.test.ts`
- Test: `src/__tests__/unit/UserManagementView.test.ts`
- Test: `src/__tests__/unit/App.account-placeholders.test.ts`
- Test: `src/__tests__/unit/accountTypes.test.ts`
- Test: `src/__tests__/unit/authState.test.ts`

- [ ] **Step 1: Write failing sidebar tests**

Add tests to `src/__tests__/unit/AppSidebar.account.test.ts` that verify each quick-menu action closes the menu, and that a user with empty `displayName` and long `username` still gets truncate/min-width classes.

- [ ] **Step 2: Run sidebar tests red**

Run: `npm run test -- --run src/__tests__/unit/AppSidebar.account.test.ts`

Expected: FAIL for missing fallback username coverage or quick-menu item truncation coverage.

- [ ] **Step 3: Implement sidebar overflow and close safety**

Update account label wrappers and quick-menu item labels with `min-w-0`, `truncate`, and explicit close-before-emit behavior already used by the parent.

- [ ] **Step 4: Write failing user management modal tests**

Update `src/__tests__/unit/App.account-placeholders.test.ts` so opening “用户管理” asserts a `role="dialog"` overlay exists and the main app grid/favorites frame is not replaced by `currentView === 'account'`.

- [ ] **Step 5: Write failing cover field tests**

Update `src/__tests__/unit/accountTypes.test.ts`, `authState.test.ts`, and `UserManagementView.test.ts` for optional `coverUrl` on `SparkUser` and visible cover rendering.

- [ ] **Step 6: Implement modal and cover rendering**

Add `UserManagementModal.vue`, add `showUserManagementModal` state in `App.vue`, keep `currentView` unchanged when opening user management, and pass through `close`, `open-forum`, `edit-profile`, `toggle-sync`, `sync-now`, and `refresh-downloads` events.

- [ ] **Step 7: Run account tests green**

Run: `npm run test -- --run src/__tests__/unit/AppSidebar.account.test.ts src/__tests__/unit/UserManagementView.test.ts src/__tests__/unit/App.account-placeholders.test.ts src/__tests__/unit/accountTypes.test.ts src/__tests__/unit/authState.test.ts`

Expected: PASS.

---

### Task 2: Favorites State And Interaction Polish

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/FavoriteFolderSelector.vue`
- Modify: `src/components/FavoriteFolderManager.vue`
- Modify: `src/components/AppDetailModal.vue`
- Modify: `src/components/AppDetailPage.vue`
- Modify: `src/modules/backendApi.ts`
- Test: `src/__tests__/unit/FavoriteFolderSelector.test.ts`
- Test: `src/__tests__/unit/FavoriteFolderManager.test.ts`
- Test: `src/__tests__/unit/AppDetailModal.test.ts`
- Test: `src/__tests__/unit/App.account-placeholders.test.ts`

- [ ] **Step 1: Write failing selector de-dupe tests**

Add a test where backend returns folder name ` 默认收藏夹 ` and assert only one default folder button appears.

- [ ] **Step 2: Run selector test red**

Run: `npm run test -- --run src/__tests__/unit/FavoriteFolderSelector.test.ts`

Expected: FAIL because current de-dupe compares exact name only.

- [ ] **Step 3: Normalize default folder names**

Trim folder names before default-folder comparison.

- [ ] **Step 4: Write failing detail favorite-state tests**

Add tests asserting a favorited app renders `已收藏` in `AppDetailModal` and emits the favorite action when clicked.

- [ ] **Step 5: Implement favorite state props**

Add `favorited`/`favoriteFolderName` props to detail components and compute current favorite metadata in `App.vue` from loaded folders/items.

- [ ] **Step 6: Write failing row click test**

Add a test that clicking the favorite row text/image area opens detail while clicking the checkbox only selects.

- [ ] **Step 7: Implement row-click behavior**

Make the favorite row content area larger/clickable and keep checkbox event isolated.

- [ ] **Step 8: Run favorites tests green**

Run: `npm run test -- --run src/__tests__/unit/FavoriteFolderSelector.test.ts src/__tests__/unit/FavoriteFolderManager.test.ts src/__tests__/unit/AppDetailModal.test.ts src/__tests__/unit/App.account-placeholders.test.ts`

Expected: PASS.

---

### Task 3: Review Panel Client UX

**Files:**
- Modify: `src/components/ReviewsPanel.vue`
- Modify: `src/global/typedefinition.ts`
- Modify: `src/modules/backendApi.ts`
- Test: `src/__tests__/unit/ReviewsPanel.test.ts`

- [ ] **Step 1: Write failing star rating test**

Add a test that clicks the “3 星” star button and verifies `submitReview` receives `rating: 3`.

- [ ] **Step 2: Write failing filter test**

Add reviews with different `packageArch` and `distro`; assert selecting an architecture or OS filter hides non-matching reviews.

- [ ] **Step 3: Write failing review action/user tests**

Add a test that reviewer avatar/name are buttons emitting/showing user detail affordance, and that like/reply/delete controls render with delete disabled unless local permission allows it.

- [ ] **Step 4: Run review tests red**

Run: `npm run test -- --run src/__tests__/unit/ReviewsPanel.test.ts`

Expected: FAIL because current UI uses select rating and lacks filters/actions.

- [ ] **Step 5: Implement star rating and filters**

Replace the native rating select with five star buttons and add local filter controls for package architecture and distro.

- [ ] **Step 6: Implement client-only review actions**

Render like/reply/delete buttons. Like/reply show a local “后端接口接入后可用” message. Delete is visible only for author/admin-compatible client data; otherwise omit or disable it.

- [ ] **Step 7: Run review tests green**

Run: `npm run test -- --run src/__tests__/unit/ReviewsPanel.test.ts`

Expected: PASS.

---

### Task 4: Sync Feedback And Cross-Origin Restore

**Files:**
- Modify: `src/App.vue`
- Modify: `src/components/InstalledAppsModal.vue`
- Modify: `src/modules/appListSync.ts`
- Test: `src/__tests__/unit/appListSync.test.ts`
- Test: `src/__tests__/unit/App.account-placeholders.test.ts`

- [ ] **Step 1: Write failing restore helper tests**

Add `resolveCloudInstallCandidate()` tests for exact origin/category match, same package fallback across origin, and no candidate.

- [ ] **Step 2: Run sync helper tests red**

Run: `npm run test -- --run src/__tests__/unit/appListSync.test.ts`

Expected: FAIL because helper is missing.

- [ ] **Step 3: Implement restore helper**

Export `resolveCloudInstallCandidate(item, apps)` from `appListSync.ts` and use it in `App.vue` `installCloudItems()`.

- [ ] **Step 4: Write failing sync feedback test**

Update `App.account-placeholders.test.ts` or `InstalledAppsModal.test.ts` to assert clicking sync in the installed-apps modal shows `同步完成` or an error message in that modal.

- [ ] **Step 5: Implement modal sync feedback prop**

Add `syncMessage` prop to `InstalledAppsModal.vue` and pass `syncStatusMessage` from `App.vue`.

- [ ] **Step 6: Run sync tests green**

Run: `npm run test -- --run src/__tests__/unit/appListSync.test.ts src/__tests__/unit/App.account-placeholders.test.ts src/__tests__/unit/InstalledAppsModal.test.ts`

Expected: PASS.

---

### Task 5: Frameless Window And Shell Polish

**Files:**
- Create: `src/components/WindowTitleBar.vue`
- Modify: `src/App.vue`
- Modify: `electron/main/index.ts`
- Modify: `electron/preload/index.ts`
- Modify: `src/vite-env.d.ts`
- Test: add or update appropriate unit tests for titlebar component and source config.

- [ ] **Step 1: Write failing titlebar component test**

Create a unit test that renders `WindowTitleBar.vue`, clicks minimize/maximize/close, and verifies IPC messages are sent.

- [ ] **Step 2: Write failing Electron config test or static check**

Add a lightweight test/static assertion that `BrowserWindow` is created with `frame: false`.

- [ ] **Step 3: Implement IPC handlers and titlebar**

Set `frame: false` in `BrowserWindow`; add IPC listeners for window minimize, toggle maximize, and close using existing close guard; add `WindowTitleBar.vue` with drag/no-drag regions.

- [ ] **Step 4: Mount titlebar in App.vue**

Place the titlebar at the top of the root layout and adjust sticky header offsets as needed.

- [ ] **Step 5: Verify category capsule color**

Run existing `CategoryBar.test.ts`; no code change needed if it already asserts `#2b7fff`.

Run: `npm run test -- --run src/__tests__/unit/CategoryBar.test.ts`

Expected: PASS.

---

### Task 6: Final Verification

**Files:**
- All files touched by previous tasks.

- [ ] **Step 1: Run targeted unit tests**

Run the union of tests touched by this plan:

```bash
npm run test -- --run src/__tests__/unit/AppSidebar.account.test.ts src/__tests__/unit/UserManagementView.test.ts src/__tests__/unit/App.account-placeholders.test.ts src/__tests__/unit/accountTypes.test.ts src/__tests__/unit/authState.test.ts src/__tests__/unit/FavoriteFolderSelector.test.ts src/__tests__/unit/FavoriteFolderManager.test.ts src/__tests__/unit/AppDetailModal.test.ts src/__tests__/unit/ReviewsPanel.test.ts src/__tests__/unit/appListSync.test.ts src/__tests__/unit/InstalledAppsModal.test.ts src/__tests__/unit/CategoryBar.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run: `npm run build:vite`

Expected: PASS.

- [ ] **Step 3: Check diff whitespace**

Run: `git diff --check`

Expected: no output.

- [ ] **Step 4: Commit client changes**

Commit message: `fix(ui): polish account favorites reviews and shell`

- [ ] **Step 5: Push feature branch**

Push `fix/client-ui-account-favorites` for review or merge.
