# Spark Account Collections Client Design

## Goal

Extend the Spark Store account experience across the backend and Electron/Vue client so users can log in or register through the forum identity flow, see account management data, use comments and favorites when logged in, sync store-recognized installed apps, and batch install apps from cloud favorites without breaking anonymous browsing, installation, removal, or update features.

## Scope

### Included

1. Clone or prepare a clean working copy of `https://gitee.com/erotica-rbqs/spark-store` for client implementation.
2. Extend the existing FastAPI backend at `https://gitee.com/erotica-rbqs/spark-unionid-server` with account data APIs for favorite folders, favorite items, downloaded records, and richer user profile data.
3. Keep login identity based on the Flarum forum. The client posts credentials directly to Flarum, then sends only the Flarum token and user id to the backend.
4. The login modal provides a register action by opening the forum registration page in the system browser.
5. Replace the upper-left SparkStore title area with an account entry while preserving the logo. After login, replace the logo with the user's avatar and show the username.
6. Add a logged-in account quick menu with user management, favorites, forum home, edit forum profile, and logout actions.
7. Keep anonymous base usage intact: browsing, searching, detail viewing, software install, software uninstall, update center, and installed-app viewing must work without login.
8. Gate account-only features: comments, favorites, cloud favorite management, downloaded record history, and cloud sync require login and show a login/register prompt when used anonymously.
9. Convert app details from modal overlay to a main-content detail page that fills the current app-list area, with a back button returning to the previous list state.
10. Add favorite actions from the detail page. Users can select a favorite folder; if none exists, the backend creates a default folder.
11. Store favorites as application-level identities, not a fixed Spark/APM variant. Batch install selects the currently preferred available variant according to the active priority configuration.
12. Record logged-in user downloads to the cloud when the user clicks download. Downloads made while anonymous are not backfilled after login.
13. On each client start, refresh installed package lists in the background. For logged-in users, ask once before enabling automatic cloud sync; remember the choice.
14. Build the sync list only from store-recognized listed applications, including Spark and APM apps, excluding unknown packages and dependencies.
15. User management shows avatar, nickname, Flarum user level, forum home link, and forum profile edit link.
16. Users can manage multiple favorite folders with custom names, remove invalid/downlisted apps, select all apps in a folder, and send selected installable apps to the existing download/install queue.
17. Favorite folder entries that are not available on the current platform or architecture remain visible with status labels. Downlisted entries remain visible and can be batch removed.

### Excluded

1. Client-side Flarum account creation forms. Registration is a browser link to the forum registration page.
2. Forum profile editing inside the client. The client opens the forum profile page externally.
3. Offline-first conflict resolution for favorites. Backend state is authoritative; client caches may improve UX but do not merge conflicting edits.
4. Automatic install on startup. Users must explicitly send favorites or restore items to the download queue.
5. Admin moderation, report handling, or anti-spam systems.

## Existing Context

The current client is an Electron + Vue 3 + TypeScript application. The target repository is `https://gitee.com/erotica-rbqs/spark-store`.

Important existing integration points:

1. `src/App.vue` coordinates tabs, app loading, install queue integration, detail opening, installed-app modal, and update center.
2. `src/components/AppHeader.vue` owns the top search/settings/about area.
3. `src/components/AppSidebar.vue` owns the current upper-left logo/title area and category navigation.
4. `src/components/AppDetailModal.vue` currently renders app details as an overlay modal. It already handles Spark/APM merged apps and source switching.
5. `src/components/InstalledAppsModal.vue` renders installed apps and origin switching.
6. `src/modules/processInstall.ts` creates download queue items and sends `queue-install` IPC messages.
7. `src/global/storeConfig.ts` owns store URLs and hybrid priority rules through `getHybridDefaultOrigin`.
8. `electron/main/backend/install-manager.ts` exposes install, remove, `check-installed`, `list-installed`, and availability IPC handlers.
9. `list-installed` already supports optimized Spark checks with a `pkgnameList`, and full APM listing marks dependencies by desktop-entry availability. Sync filtering should reuse these facts rather than scanning arbitrary system packages.

The Spark developer manual identifies this repository as the current Electron GUI store (`apm-app-store` behavior), while `amber-pm` owns package-management semantics after commands leave the GUI.

## Backend Design

### User Profile Extension

The existing backend auth flow remains unchanged at the boundary: `POST /auth/flarum` receives `flarum_user_id` and `flarum_token`, validates the token owner, upserts the local user, and returns a Spark Store JWT.

The Flarum validation service should also extract user group data from the authenticated actor when available. The backend stores a compact `forum_level` string and optional `forum_groups` JSON/text summary. If Flarum does not expose groups, `forum_level` falls back to `论坛用户`.

`GET /me` should return existing profile fields plus the forum level fields needed by the client. Existing clients remain compatible because new fields are additive.

### Favorite Folders

Add backend tables:

1. `favorite_folders`: id, user_id, name, created_at, updated_at. Folder names are user-scoped and unique per user. A folder named `默认收藏夹` is created on first favorite action if the user has no folders.
2. `favorite_items`: id, folder_id, app_key, pkgname, name, category, icon_url, created_at. Items are unique per folder and `app_key`.

Favorites are stored as app-level identities. The canonical app key for favorites should be stable across Spark/APM variants when the same user-facing app exists in both sources:

```text
favorite_app_key = app:{category}:{pkgname}
```

The item keeps `pkgname`, display `name`, `category`, and optional `icon_url`. It does not permanently bind to Spark or APM. During install, the client resolves the current catalog entry and chooses Spark/APM according to current availability and priority rules.

Backend endpoints:

1. `GET /me/favorite-folders`: list folders with item counts.
2. `POST /me/favorite-folders`: create folder with custom name.
3. `PATCH /me/favorite-folders/{folder_id}`: rename folder.
4. `DELETE /me/favorite-folders/{folder_id}`: delete folder and its items.
5. `GET /me/favorite-folders/{folder_id}/items`: list items.
6. `POST /me/favorite-folders/{folder_id}/items`: add or idempotently keep an app favorite.
7. `DELETE /me/favorite-folders/{folder_id}/items/{item_id}`: remove one item.
8. `POST /me/favorite-folders/{folder_id}/items/bulk-delete`: remove selected items, including invalid/downlisted entries.

All endpoints require JWT.

### Downloaded Records

Add `downloaded_apps`: id, user_id, app_key, pkgname, name, category, selected_origin, version, package_arch, downloaded_at.

Client behavior:

1. If the user is logged in when clicking download, the client posts a downloaded record after queuing the install task.
2. If the user is anonymous, the download proceeds normally and no cloud record is written.
3. Logging in later does not backfill anonymous downloads.

Backend endpoints:

1. `GET /me/downloaded-apps`: list newest downloaded records with pagination.
2. `POST /me/downloaded-apps`: upsert or append a downloaded record. MVP can append history; duplicate suppression by `user_id`, `app_key`, and `selected_origin` is acceptable if tests define it.

### Installed Sync List

The existing `GET /me/app-list` and `PUT /me/app-list` endpoints remain the default cloud installed-app list.

Client sync payload contains only store-recognized listed apps:

1. App must exist in the current loaded Spark/APM catalog.
2. `category !== "unknown"`.
3. `isDependency !== true`.
4. App has usable `pkgname` and `origin`.

Unknown system packages, dependencies, and packages not in the store catalog are excluded.

## Client Design

### Account Entry And Login

Move the account entry into the upper-left logo/title area currently owned by the sidebar. The logo remains visible while anonymous. The title text becomes `登录 / 注册` with helper text `星火账号`.

After login:

1. The logo image is replaced by the user's avatar when available.
2. The main text is the user's display name or username.
3. Clicking the account entry opens a quick menu.
4. The quick menu includes: `用户管理`, `我的收藏`, `论坛首页`, `修改论坛资料`, and `退出登录`.

Login modal:

1. Contains forum account and password inputs.
2. Posts credentials directly to Flarum `/api/token`.
3. Sends the returned Flarum token and user id to the backend.
4. Provides `注册账号` button that opens the Flarum registration page externally.
5. Never logs or stores the forum password.

### Anonymous Behavior

Anonymous users can still:

1. Browse homepage and categories.
2. Search.
3. View app details.
4. Download/install apps.
5. Remove installed apps.
6. Use update center.
7. View installed apps.

When anonymous users use account-only actions, show a login/register prompt instead of blocking the whole page. Account-only actions are comments, submit review, favorite, cloud favorites, downloaded history, and cloud sync.

### Detail Page

Replace the overlay detail modal with a main-content detail page inside the same area currently used by `AppGrid` and `HomeView`.

State model:

1. `currentView` or equivalent distinguishes `list`, `home`, and `detail`.
2. Opening an app stores the previous list context and selected app.
3. Back returns to the prior list/search/category state.
4. Screen preview can remain an overlay because it is secondary media UI.

The detail page keeps existing detail capabilities:

1. Spark/APM merged app source switch.
2. Install/open/remove actions.
3. Metadata and screenshots.
4. Download count.

New detail capabilities:

1. Favorite button.
2. Favorite folder selector.
3. Comments/reviews panel with login prompt for anonymous users.
4. Download click writes a cloud downloaded record only when logged in.

### Favorites Management

The user management area includes favorite folder management.

Users can:

1. List favorite folders.
2. Create folders with custom names.
3. Rename folders.
4. Delete folders.
5. View folder items.
6. Remove selected items.
7. Batch remove invalid/downlisted items.
8. Select all available items and send them to the download queue.

Availability resolution is client-side because it depends on the current catalog, architecture, Spark/APM availability, store filter, and priority rules.

Favorite item states:

1. `installable`: found in catalog and current source/architecture can install a preferred variant.
2. `installed`: already installed locally.
3. `platform-unavailable`: item exists but neither Spark nor APM variant is usable under current store filter/capability.
4. `arch-unavailable`: item exists in catalog metadata but not for the current architecture.
5. `downlisted`: item no longer exists in the loaded catalog.

Batch install uses current preference:

1. If only one usable variant exists, use it.
2. If both Spark and APM variants exist, use `getHybridDefaultOrigin` and the current store filter/availability to choose.
3. If the preferred variant is unavailable, use the other usable variant.
4. If no usable variant exists, do not queue it and show the reason.

### Downloaded Records

When a logged-in user clicks download/install from detail, favorites, restore, or installed sync restore flows, the client records the selected app to the backend after the queue item is created.

Downloaded records are visible in user management. They are informational and do not alter the install queue automatically.

### Startup Installed Sync

On startup, the client refreshes installed packages in the background after the catalog is loaded enough to provide package lists.

Flow:

1. Load Spark/APM catalog as normal.
2. Call existing `list-installed` IPC for enabled origins. Use optimized package-name checks where possible for Spark and full APM listing where needed, following the current installed modal/update-center patterns.
3. Merge results with catalog metadata.
4. Filter to store-recognized non-dependency apps.
5. If logged in and the user has not made a cloud sync decision, ask once whether to enable automatic installed-list sync.
6. If enabled, upload the default app list via `PUT /me/app-list`.
7. If disabled or anonymous, keep the refreshed list local only.

The confirmation preference is stored locally. A user can later change it from user management.

## Data Flow

### Login

1. User opens login modal from the upper-left account entry.
2. Client posts credentials to Flarum `/api/token`.
3. Flarum returns token and user id.
4. Client posts token and user id to backend `/auth/flarum`.
5. Backend validates token owner, stores profile and forum level, and returns Spark JWT.
6. Client stores Spark JWT and profile in local auth state.

### Favorite Add

1. Logged-in user clicks favorite on detail page.
2. Client fetches or creates favorite folders if needed.
3. User selects a folder.
4. Client posts app-level identity to backend favorite item endpoint.
5. UI updates folder item count and favorite state.

### Batch Install From Favorites

1. User opens a favorite folder.
2. Client resolves each favorite item against current catalog and install facts.
3. UI shows installable, installed, unavailable, arch-unavailable, and downlisted states.
4. User selects installable items or clicks select all installable.
5. Client maps each item to the chosen Spark/APM `App` object based on current priority rules.
6. Client calls existing `handleInstall(app)` for each selected item.
7. If logged in, client records downloaded apps to backend after queueing.

## Error Handling

1. Login failure from Flarum or backend shows a local error in the login modal and clears partial auth state.
2. Expired backend JWT logs the user out or prompts re-login when an account endpoint returns `401`.
3. Favorites and downloaded-record failures do not block base install; show a non-fatal account sync error.
4. Startup sync failure does not block app startup; it shows a user-management warning and can be retried manually.
5. Batch install skips unavailable/downlisted items and reports counts per state.
6. Backend rejects extra fields and invalid lengths with `422`.

## Testing And Verification

Backend tests:

1. Favorite folder creation, default folder creation, rename, delete, and user isolation.
2. Favorite item add/remove/idempotency and folder scoping.
3. Downloaded record create/list and user isolation.
4. Forum level extraction fallback.
5. Existing auth/reviews/app-list tests remain passing.
6. Alembic migration upgrade succeeds.

Client tests:

1. Account entry anonymous/logged-in rendering and quick menu actions.
2. Login modal emits login and opens register URL.
3. Auth state persistence and backend token handling.
4. Detail page replaces the list area and back returns to list state.
5. Favorite folder selector login gating and folder selection.
6. Favorite availability resolver for installable, installed, platform-unavailable, arch-unavailable, and downlisted states.
7. Batch install selects Spark/APM variant according to current priority rules.
8. Startup sync filtering includes only store-listed non-dependency Spark/APM apps.
9. User management renders profile, forum level, forum links, favorite folders, downloaded records, and sync preference.
10. Existing install, update center, installed apps, search, and grid tests remain passing.

Final client verification:

1. `npm run test`
2. `npm run lint`
3. `npm run build:vite`

Final backend verification:

1. `.venv/bin/pytest -v`
2. `DATABASE_URL=<fresh test url> .venv/bin/alembic upgrade head`

## Implementation Notes

1. Use a clean client worktree or fresh clone from `https://gitee.com/erotica-rbqs/spark-store` before implementing. Do not mix previous untracked planning artifacts into code commits.
2. Keep backend and client commits separate.
3. Add `.superpowers/` to `.gitignore` so visual companion artifacts remain local.
4. Preserve existing IPC contracts for install and update flows.
5. Do not change `amber-pm` package-management behavior; only reuse GUI-side install queue paths.
6. Keep UI components focused: account entry/menu, login modal, detail page, favorite selector, user management, and favorite folder manager should be separate components rather than expanding `App.vue` further.
