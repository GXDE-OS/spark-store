# Client UI Polish Design

## Goal

Fix the client-side account, favorites, review, sync, and shell UI issues reported during QA without changing backend contracts in this pass.

## Scope

This pass is client-only. It can change Vue components, renderer state, Electron window chrome, tests, and docs. It must not invent successful backend behavior for review likes, replies, or deletes until backend endpoints exist.

## User-Visible Requirements

- Long account names must not overflow the sidebar account entry or account quick menu.
- Account quick-menu actions must close the menu immediately after selection.
- User management must open as a global modal/popup overlay instead of replacing only the right content frame.
- User management should render a profile-cover hero when a user has a background/cover URL, with a safe fallback when absent.
- Favorites should not show duplicate default-folder entries.
- The favorite selector must expose a visible new-folder action.
- Clicking a favorite item row should open app detail; the checkbox should remain only for bulk selection.
- The detail favorite button should show favorited state as `已收藏`, and opening it should allow switching folder or cancelling the favorite when client data can identify the existing item.
- Review rating input should use clickable/star UI instead of a native select.
- Reviews should expose architecture and OS/distro filters.
- Review cards should expose user detail entry points from avatar/name and show client-side action affordances for like/reply/delete. Delete must be visibly limited to the author/admin; persistence is deferred until backend APIs exist.
- The system title bar should be replaced by a frameless Electron window with an app-rendered title bar and window controls.
- Selected category capsule color must remain `#2B7FFF`.
- Manual sync must show visible feedback where the user clicked it.
- Restore-from-account should resolve cloud items by same origin first, then fall back to same package across Spark/APM when the exact origin is not loaded.

## Architecture

Keep existing component boundaries and make small additions:

- `App.vue` remains the state coordinator for account modals, favorites, sync, and restore.
- Add a small reusable `UserManagementModal.vue` wrapper around existing `UserManagementView.vue` instead of restructuring the view.
- Add a `WindowTitleBar.vue` component and Electron IPC handlers for minimize/maximize/close, preserving the existing close-to-tray guard.
- Keep review API calls in `backendApi.ts`; client-only review actions emit UI feedback until backend endpoints are added.
- Add pure helper functions for sync restore candidate resolution so cross-source matching can be unit-tested without mounting the full app.

## Data Flow

- Account menu emits actions to `App.vue`; `App.vue` toggles modal state and loads downloaded history before showing user management.
- Favorites are loaded from existing folder/item endpoints. `App.vue` computes current detail favorite metadata from loaded folders/items and passes status to detail components.
- Review filters are local to `ReviewsPanel.vue`; they filter loaded review records by package architecture and distro string.
- Sync feedback is stored in existing `syncStatusMessage` and passed to both `UserManagementView` and `InstalledAppsModal`.
- Restore resolution uses `resolveCloudInstallCandidate(item, apps)` with exact origin/category preference and package-name fallback.

## Deferred Backend Work

The following need backend API work later:

- Persistent review likes.
- Review replies and reply listing.
- Server-authorized review deletion.
- Fetching arbitrary forum user profile details and cover images. This client pass supports cover URLs when present in `SparkUser`; it does not scrape forum HTML.

## Testing

- Add/update unit tests for account modal behavior, quick-menu closing, user cover rendering, favorites selector normalization, star rating, review filters/actions, restore candidate resolution, and titlebar IPC/config.
- Run targeted Vitest files and `npm run build:vite` before completion.
