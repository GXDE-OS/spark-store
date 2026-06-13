# Spark Account Reviews Sync Design

## Goal

Add a first-version account feature to Spark Store that uses the existing Flarum forum at `https://bbs.spark-app.store/` as the identity provider, while storing Spark Store-specific data in a new Python + MySQL backend.

The MVP covers:

1. Login with a Flarum account.
2. Show the logged-in user's avatar and display name in the client.
3. Show and submit app detail page comments with 1-5 star ratings.
4. Attach immutable automatic local tags to reviews and support review filtering by those tags.
5. Sync the user's local store-recognized app list so a new device can quickly reinstall old apps.
6. Create a new backend Git repository named `spark-store-backend`.

## Scope

### Included In MVP

1. Client-side Flarum token login.
2. Backend validation of Flarum tokens and backend JWT issuance.
3. User profile display in the Spark Store client.
4. Review list, rating summary, review creation, and editing the current user's own review.
5. Review filtering by automatic tags: app version, package architecture, client architecture, distro, origin, and category.
6. A default per-user cloud app list that is overwritten on each sync.
7. Restore UI that lets users choose cloud-list apps and add them to the existing install queue.

### Excluded From MVP

1. Admin moderation UI.
2. Review reports, bans, anti-spam scoring, or manual approval workflows.
3. Synchronizing reviews into Flarum discussions.
4. Multiple named app-list snapshots or historical list versions.
5. Syncing unknown system packages, dependencies, or every package from `dpkg`/APM.
6. Automatic unattended install on a new device.

## Existing Client Context

The current Spark Store client in this repository is an Electron + Vue 3 + TypeScript app.

Important existing integration points:

1. `src/components/AppDetailModal.vue` owns the app detail modal. It already renders app metadata, screenshots, install/open/remove actions, and download counts.
2. `src/components/InstalledAppsModal.vue` owns the installed-app list UI.
3. `src/App.vue` coordinates modal state, installed-app loading, detail opening, and existing install queue calls.
4. `electron/main/backend/install-manager.ts` already exposes `check-installed` and `list-installed` IPC handlers.
5. Existing install queue behavior should be reused for restore installs rather than creating a second install system.

## Architecture

Use the lightweight new-backend architecture confirmed during brainstorming.

Components:

1. Spark Store client: Vue/Electron UI, local app metadata, local package detection, and install queue integration.
2. Flarum forum: authoritative identity provider for forum username, display name, and avatar.
3. New Python backend: FastAPI service that verifies Flarum tokens, signs Spark Store JWTs, and owns reviews, ratings, and app-list sync data.
4. MySQL database: persistent storage for local user mappings, app keys, reviews, rating aggregates, and synced app-list items.

The new backend must not receive the user's forum password in the selected MVP flow.

## Authentication Flow

1. The client shows a login form for the Flarum username/email and password.
2. The client posts credentials directly to Flarum's token API.
3. Flarum returns an access token and user id.
4. The client sends the Flarum token and user id to the new backend `POST /auth/flarum`.
5. The backend calls Flarum API with that token to verify it and retrieve the user profile.
6. The backend upserts a local user row keyed by `flarum_user_id`.
7. The backend returns a Spark Store JWT plus public profile fields: display name, username, avatar URL, and Flarum user id.
8. The client stores the Spark Store JWT for backend calls and displays the avatar/name in the header or account area.

Logout clears local Spark Store auth state. MVP logout does not need to revoke the Flarum token remotely.

## Review And Rating Design

### App Identity

Reviews are keyed by a stable app key derived from store metadata:

```text
app_key = {origin}:{store_arch}:{category}:{pkgname}
```

Examples:

```text
spark:amd64-store:tools:spark-store
apm:amd64-apm:office:wps
```

This separates Spark and APM apps when they share a package name, while still allowing the UI to show each source independently in the existing hybrid detail modal.

### Automatic Review Tags

When a logged-in user writes a review, the client sends automatic tags derived from the currently viewed app and local system. The user can preview these tags but cannot edit them.

Required tags:

1. `origin`: `spark` or `apm`.
2. `category`: current store category.
3. `pkgname`: current package name.
4. `version`: current app/package version shown in the detail page.
5. `package_arch`: package architecture if known from installed-app data or store filename metadata.
6. `client_arch`: `window.apm_store.arch` such as `amd64`, `arm64`, or `loong64`.
7. `distro`: local Linux distribution id/version when available from the Electron main process.

If `package_arch` or `distro` cannot be detected, the client sends an empty string or `unknown`; the backend stores the value exactly as submitted after validation.

### Review UI

Add a `ReviewsPanel`-style component inside `AppDetailModal.vue`, below the existing app description and screenshot sections.

Behavior:

1. Anonymous users can read reviews and rating summary.
2. Anonymous users see a login prompt instead of the review composer.
3. Logged-in users can select a 1-5 rating and submit text content.
4. The composer displays the automatic tags as read-only pills.
5. The list supports filters for current version, current architecture, current distro, origin, category, and rating.
6. Users can switch filters to view comments under other versions or architectures.
7. The review list uses pagination or cursor-based loading to avoid loading all reviews at once.

### Review Rules

MVP review rules:

1. Rating must be an integer from 1 to 5.
2. Content must be non-empty after trimming and have a backend-enforced maximum length.
3. A user can have one active review per `app_key` plus exact automatic-tag tuple.
4. Submitting again for the same `app_key` and tag tuple updates the existing review.
5. Backend timestamps use UTC.

## App List Sync Design

### Upload Source

The client uses the existing installed-app flow as the source of local software state.

For MVP, upload only apps that satisfy all conditions:

1. App exists in the Spark/APM store catalog loaded by the client.
2. `category !== "unknown"`.
3. `isDependency !== true`.
4. The app has a usable `pkgname` and `origin`.

This intentionally excludes unknown system packages, dependencies, and packages that the store cannot reinstall safely.

### Sync UI

Extend `InstalledAppsModal.vue` with account-aware actions:

1. `同步到账号`: uploads the filtered installed app list as the user's default cloud list.
2. `从账号恢复`: fetches the default cloud list and opens a restore selection view.

The restore view shows each cloud item with one of these states:

1. Already installed locally.
2. Available to install on this client.
3. Not available for the current architecture/source.

The user explicitly selects items and starts restore. Restore uses the existing `handleInstall` and install queue path in the client.

### Cloud List Semantics

MVP maintains one default cloud app list per user.

Each successful sync replaces the previous default list. This avoids list merge conflicts in the first version.

## Backend Repository

Create a new sibling repository:

```text
/home/spark/Desktop/shenmo-spark-store/spark-store-backend
```

Initialize it as a new Git repository and set origin to:

```text
https://gitee.com/momen_official/spark-store-backend.git
```

The initial repository should include a `README.md`. Feature implementation can then add backend code, migrations, tests, and configuration templates.

## Backend Technology

Use:

1. FastAPI for HTTP APIs.
2. SQLAlchemy for ORM models.
3. Alembic for database migrations.
4. PyMySQL or mysqlclient for MySQL connectivity.
5. Pydantic settings for environment configuration.
6. Pytest for backend tests.

Configuration should come from environment variables, with `.env.example` committed and real `.env` ignored.

## Backend API

### Auth

`POST /auth/flarum`

Request:

```json
{
  "flarum_user_id": "123",
  "flarum_token": "..."
}
```

Response:

```json
{
  "access_token": "spark-store-jwt",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "flarum_user_id": "123",
    "username": "shenmo",
    "display_name": "shenmo",
    "avatar_url": "https://..."
  }
}
```

`GET /me`

Returns the current backend user profile from the Spark Store JWT.

### Reviews

`GET /apps/{app_key}/rating-summary`

Returns average rating, review count, and per-star counts.

`GET /apps/{app_key}/reviews`

Query parameters:

1. `version`
2. `package_arch`
3. `client_arch`
4. `distro`
5. `origin`
6. `category`
7. `rating`
8. `page` and `page_size`

`POST /apps/{app_key}/reviews`

Requires JWT. Creates or updates the current user's review for the same app and automatic-tag tuple.

Request:

```json
{
  "rating": 5,
  "content": "Works well on my machine.",
  "tags": {
    "origin": "apm",
    "category": "office",
    "pkgname": "wps",
    "version": "1.0.0",
    "package_arch": "amd64",
    "client_arch": "amd64",
    "distro": "deepin 25"
  }
}
```

### App List Sync

`GET /me/app-list`

Requires JWT. Returns the current user's default cloud app list.

`PUT /me/app-list`

Requires JWT. Replaces the current user's default cloud app list.

Request:

```json
{
  "client_arch": "amd64",
  "distro": "deepin 25",
  "items": [
    {
      "pkgname": "spark-store",
      "origin": "spark",
      "category": "tools",
      "version": "5.1.1",
      "package_arch": "amd64",
      "app_name": "Spark Store",
      "icon_url": "https://..."
    }
  ]
}
```

`POST /me/app-list/install-plan`

Requires JWT. Accepts current client catalog/install facts and returns a normalized plan with installed, installable, and unavailable items. The client may also compute this locally, but the endpoint gives the backend a stable contract for future clients.

## Database Model

Tables:

1. `users`: local user id, Flarum user id, username, display name, avatar URL, timestamps.
2. `apps`: app key, pkgname, origin, store arch, category, latest seen version, timestamps.
3. `reviews`: app id, user id, rating, content, automatic tag columns, timestamps.
4. `user_app_lists`: user id, snapshot name, client arch, distro, timestamps.
5. `user_app_list_items`: list id, pkgname, origin, category, version, package arch, app name, icon URL, timestamps.

Indexes:

1. Unique `users.flarum_user_id`.
2. Unique `apps.app_key`.
3. Index `reviews.app_id` plus tag filter columns.
4. Unique review key for user, app, version, package arch, client arch, distro, origin, and category.
5. Unique default app list per user.

## Error Handling

Client behavior:

1. If Flarum login fails, show a login error without contacting the backend.
2. If backend token exchange fails, show a backend login error and clear partial auth state.
3. If review loading fails, keep the app detail page usable and show a retry affordance in the review panel.
4. If app-list sync fails, keep the local installed-app modal usable and show the failure message near the sync action.
5. If restore install queuing fails for one item, keep the remaining selected items visible and report which item failed.

Backend behavior:

1. Invalid Flarum token returns `401`.
2. Invalid JWT returns `401`.
3. Invalid app key, rating, or tag payload returns `422`.
4. Database errors return `500` with safe generic messages and structured server logs.

## Security Notes

1. The new backend never receives forum passwords in the selected MVP architecture.
2. Real secrets, JWT keys, database URLs, and Flarum tokens must not be committed.
3. The Electron client must avoid logging Flarum tokens and backend JWTs.
4. Backend JWT expiry should be finite; refresh can be handled by reauth in MVP.
5. CORS should be restricted to expected client origins in production.

## Testing And Verification

Client verification:

1. Unit tests for review tag construction.
2. Unit tests for installed-app sync filtering.
3. Component tests for review panel anonymous/logged-in states.
4. Component tests for sync and restore UI states.
5. Existing `npm run lint` and `npm run build:vite` after implementation.

Backend verification:

1. Unit/API tests for `/auth/flarum` with mocked Flarum responses.
2. API tests for review creation, update, listing, filtering, and rating summary.
3. API tests for app-list upload and retrieval.
4. Migration verification against MySQL or a compatible test database.

## Open Implementation Notes

1. Detecting `distro` should be done through Electron main process IPC, preferably by reading `/etc/os-release` and exposing a small safe object to the renderer.
2. Package architecture can come from installed-app data when available; otherwise parse from filename only if reliable, falling back to `unknown`.
3. The existing `AppDetailModal.vue` is already large, so review UI should be isolated into a new child component rather than expanding all logic inline.
4. Restore installation should reuse existing app lookup and `handleInstall` code to preserve Spark/APM origin behavior.
