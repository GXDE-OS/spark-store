# Spark Client Account Collections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Electron/Vue Spark Store client with forum login, sidebar account entry, account management, main-content detail pages, reviews, favorites, downloaded history, and cloud installed-app sync while preserving anonymous browse/install/remove/update flows.

**Architecture:** Keep backend communication in small TypeScript modules and keep Vue state in focused global modules. Replace the app-detail overlay with a routed state inside `App.vue` content area, and add account/favorites/user-management components without changing Electron package-management IPC contracts.

**Tech Stack:** Electron 40, Vue 3 Composition API, TypeScript strict mode, Axios, Vitest, Testing Library Vue, existing IPC facade, existing install queue, FastAPI backend API.

---

## File Structure

Client repository: `/home/spark/Desktop/shenmo-spark-store/spark-store`.

Modify:
- `.gitignore` - already ignores `.superpowers/`; leave as-is unless missing.
- `src/global/storeConfig.ts` - add backend URL and forum URLs.
- `src/global/typedefinition.ts` - add account, review, favorite, downloaded, sync, and availability types.
- `src/vite-env.d.ts` - add backend env and `window.ipcRenderer.invoke` usage remains unchanged.
- `src/__tests__/setup.ts` - keep `window.apm_store.arch` as bare architecture `amd64` and make IPC mocks writable.
- `src/components/AppSidebar.vue` - replace the title block with account entry and quick menu events.
- `src/App.vue` - coordinate auth modal, detail view state, account management view, favorites, reviews, downloaded records, and startup sync.
- `src/modules/processInstall.ts` - expose selected-app queue creation result for cloud downloaded-record writes without changing existing install IPC payloads.
- `src/components/InstalledAppsModal.vue` - add cloud sync actions and login gating.

Create:
- `src/global/authState.ts` - auth session persistence and token header propagation.
- `src/global/accountSyncState.ts` - local installed-sync preference helpers.
- `src/modules/backendApi.ts` - backend client, DTO mapping, favorites, reviews, downloaded records, and app-list API helpers.
- `src/modules/flarumAuth.ts` - Flarum token exchange helper; forum password never leaves this request.
- `src/modules/appIdentity.ts` - favorite app key, review app key, package arch, and selected display app helpers.
- `src/modules/favoriteAvailability.ts` - client-side favorite resolution and batch-install planning.
- `src/modules/appListSync.ts` - installed-list filtering and cloud sync payload helpers.
- `src/components/LoginModal.vue` - forum login/register prompt.
- `src/components/LoginPromptModal.vue` - reusable account-only feature gate prompt.
- `src/components/AccountQuickMenu.vue` - quick account menu for logged-in users.
- `src/components/AppDetailPage.vue` - full content-area detail page replacing `AppDetailModal`.
- `src/components/ReviewsPanel.vue` - review list/composer with anonymous prompt.
- `src/components/FavoriteFolderSelector.vue` - favorite folder selector/add action.
- `src/components/UserManagementView.vue` - profile, links, downloaded history, sync preference, and favorites entry.
- `src/components/FavoriteFolderManager.vue` - folders/items/statuses/batch install/bulk delete.
- `src/components/AppListRestoreModal.vue` - cloud app-list restore selector.
- `src/__tests__/unit/accountTypes.test.ts` - type/config smoke test.
- `src/__tests__/unit/authState.test.ts` - auth persistence test.
- `src/__tests__/unit/LoginModal.test.ts` - login/register modal test.
- `src/__tests__/unit/AppSidebar.account.test.ts` - account entry and quick menu tests.
- `src/__tests__/unit/appIdentity.test.ts` - key/tag helper tests.
- `src/__tests__/unit/favoriteAvailability.test.ts` - status and batch source selection tests.
- `src/__tests__/unit/appListSync.test.ts` - installed sync filtering tests.
- `src/__tests__/unit/AppDetailPage.test.ts` - detail page/back/favorite prompt test.
- `src/__tests__/unit/FavoriteFolderManager.test.ts` - folder manager status/action test.
- `src/__tests__/unit/UserManagementView.test.ts` - account management rendering test.
- `src/__tests__/unit/AppListRestoreModal.test.ts` - restore selector test.

## Task 1: Add Account Config, Types, And API Client

**Files:**
- Modify: `src/global/storeConfig.ts`
- Modify: `src/global/typedefinition.ts`
- Modify: `src/vite-env.d.ts`
- Modify: `src/__tests__/setup.ts`
- Create: `src/modules/backendApi.ts`
- Test: `src/__tests__/unit/accountTypes.test.ts`

- [ ] **Step 1: Write failing account type smoke test**

Create `src/__tests__/unit/accountTypes.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";

import {
  FLARUM_BASE_URL,
  FLARUM_REGISTER_URL,
  SPARK_BACKEND_BASE_URL,
} from "@/global/storeConfig";
import type {
  DownloadedAppRecord,
  FavoriteFolder,
  FavoriteItem,
  ReviewTags,
  SparkUser,
  SyncedAppListItem,
} from "@/global/typedefinition";

describe("account shared types", () => {
  it("exports backend/forum config and account shapes", () => {
    const user: SparkUser = {
      id: 1,
      flarumUserId: "123",
      username: "momen",
      displayName: "Momen",
      avatarUrl: "https://bbs.spark-app.store/avatar.png",
      forumLevel: "管理员",
      forumGroups: ["管理员"],
    };
    const folder: FavoriteFolder = {
      id: 1,
      name: "默认收藏夹",
      itemCount: 1,
      createdAt: "2026-05-18T00:00:00Z",
      updatedAt: "2026-05-18T00:00:00Z",
    };
    const favorite: FavoriteItem = {
      id: 2,
      appKey: "app:office:wps",
      pkgname: "wps",
      name: "WPS",
      category: "office",
      iconUrl: "https://example.invalid/wps.png",
      createdAt: "2026-05-18T00:00:00Z",
    };
    const download: DownloadedAppRecord = {
      id: 3,
      appKey: "app:office:wps",
      pkgname: "wps",
      name: "WPS",
      category: "office",
      selectedOrigin: "apm",
      version: "1.0.0",
      packageArch: "amd64",
      downloadedAt: "2026-05-18T00:00:00Z",
    };
    const syncItem: SyncedAppListItem = {
      pkgname: "wps",
      origin: "apm",
      category: "office",
      version: "1.0.0",
      packageArch: "amd64",
      appName: "WPS",
      iconUrl: "https://example.invalid/wps.png",
    };
    const tags: ReviewTags = {
      origin: "apm",
      category: "office",
      pkgname: "wps",
      version: "1.0.0",
      packageArch: "amd64",
      clientArch: "amd64",
      distro: "deepin 25",
    };

    expect(typeof SPARK_BACKEND_BASE_URL).toBe("string");
    expect(FLARUM_BASE_URL).toContain("bbs.spark-app.store");
    expect(FLARUM_REGISTER_URL).toContain("register");
    expect(user.forumGroups).toEqual(["管理员"]);
    expect(folder.itemCount).toBe(1);
    expect(favorite.appKey).toBe("app:office:wps");
    expect(download.selectedOrigin).toBe("apm");
    expect(syncItem.origin).toBe("apm");
    expect(tags.packageArch).toBe("amd64");
  });
});
```

- [ ] **Step 2: Run the smoke test and verify failure**

Run: `npm run test -- src/__tests__/unit/accountTypes.test.ts`

Expected: FAIL because new config constants and account types do not exist.

- [ ] **Step 3: Add backend and forum config**

Append to `src/global/storeConfig.ts` after `APM_STORE_STATS_BASE_URL`:

```typescript
export const SPARK_BACKEND_BASE_URL: string =
  import.meta.env.VITE_SPARK_BACKEND_BASE_URL || "";

export const FLARUM_BASE_URL = "https://bbs.spark-app.store";
export const FLARUM_REGISTER_URL = `${FLARUM_BASE_URL}/register`;
export const FLARUM_PROFILE_URL = `${FLARUM_BASE_URL}/u`;
export const FLARUM_SETTINGS_URL = `${FLARUM_BASE_URL}/settings`;
```

- [ ] **Step 4: Add account types**

Append to `src/global/typedefinition.ts`:

```typescript
export interface SparkUser {
  id: number;
  flarumUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
  forumLevel: string;
  forumGroups: string[];
}

export interface AuthSession {
  accessToken: string;
  tokenType: "bearer";
  user: SparkUser;
}

export interface FlarumLoginPayload {
  identification: string;
  password: string;
}

export interface ReviewTags {
  origin: "spark" | "apm";
  category: string;
  pkgname: string;
  version: string;
  packageArch: string;
  clientArch: string;
  distro: string;
}

export interface RatingSummary {
  averageRating: number;
  reviewCount: number;
  starCounts: Record<number, number>;
}

export interface AppReview {
  id: number;
  rating: number;
  content: string;
  version: string;
  packageArch: string;
  clientArch: string;
  distro: string;
  origin: "spark" | "apm";
  category: string;
  createdAt: string;
  updatedAt: string;
  userDisplayName: string;
  userAvatarUrl: string;
}

export interface FavoriteFolder {
  id: number;
  name: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteItem {
  id: number;
  appKey: string;
  pkgname: string;
  name: string;
  category: string;
  iconUrl: string;
  createdAt: string;
}

export type FavoriteAvailabilityStatus =
  | "installable"
  | "installed"
  | "platform-unavailable"
  | "arch-unavailable"
  | "downlisted";

export interface ResolvedFavoriteItem {
  item: FavoriteItem;
  status: FavoriteAvailabilityStatus;
  reason: string;
  selectedApp: App | null;
}

export interface DownloadedAppRecord {
  id: number;
  appKey: string;
  pkgname: string;
  name: string;
  category: string;
  selectedOrigin: "spark" | "apm";
  version: string;
  packageArch: string;
  downloadedAt: string;
}

export interface DownloadedAppList {
  items: DownloadedAppRecord[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SyncedAppListItem {
  id?: number;
  pkgname: string;
  origin: "spark" | "apm";
  category: string;
  version: string;
  packageArch: string;
  appName: string;
  iconUrl: string;
}

export interface SyncedAppList {
  snapshotName: string;
  clientArch: string;
  distro: string;
  updatedAt: string;
  items: SyncedAppListItem[];
}

export interface SystemInfo {
  distro: string;
}
```

- [ ] **Step 5: Add environment declaration**

Add `ImportMetaEnv` inside the existing `declare global` block in `src/vite-env.d.ts`:

```typescript
  interface ImportMetaEnv {
    readonly VITE_SPARK_BACKEND_BASE_URL?: string;
  }
```

- [ ] **Step 6: Normalize test IPC mocks**

Modify `src/__tests__/setup.ts` so both exposed globals are writable and `window.apm_store.arch` is bare `amd64`:

```typescript
Object.defineProperty(window, "ipcRenderer", {
  value: {
    send: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    invoke: vi.fn(),
    removeListener: vi.fn(),
  },
  writable: true,
});

Object.defineProperty(window, "apm_store", {
  value: {
    arch: "amd64",
  },
  writable: true,
});
```

- [ ] **Step 7: Add backend API helper**

Create `src/modules/backendApi.ts` with:

```typescript
import axios from "axios";

import { SPARK_BACKEND_BASE_URL } from "@/global/storeConfig";
import type {
  AppReview,
  AuthSession,
  DownloadedAppList,
  DownloadedAppRecord,
  FavoriteFolder,
  FavoriteItem,
  RatingSummary,
  ReviewTags,
  SyncedAppList,
  SyncedAppListItem,
} from "@/global/typedefinition";

const backend = axios.create({
  baseURL: SPARK_BACKEND_BASE_URL,
  timeout: 10000,
});

const parseForumGroups = (raw: unknown): string[] => {
  if (Array.isArray(raw)) return raw.filter((item): item is string => typeof item === "string");
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
};

const toUser = (raw: Record<string, unknown>): AuthSession["user"] => ({
  id: Number(raw.id),
  flarumUserId: String(raw.flarum_user_id || ""),
  username: String(raw.username || ""),
  displayName: String(raw.display_name || raw.username || ""),
  avatarUrl: String(raw.avatar_url || ""),
  forumLevel: String(raw.forum_level || "论坛用户"),
  forumGroups: parseForumGroups(raw.forum_groups),
});

const toReview = (raw: Record<string, unknown>): AppReview => ({
  id: Number(raw.id),
  rating: Number(raw.rating),
  content: String(raw.content || ""),
  version: String(raw.version || "unknown"),
  packageArch: String(raw.package_arch || "unknown"),
  clientArch: String(raw.client_arch || "unknown"),
  distro: String(raw.distro || "unknown"),
  origin: raw.origin === "spark" ? "spark" : "apm",
  category: String(raw.category || ""),
  createdAt: String(raw.created_at || ""),
  updatedAt: String(raw.updated_at || ""),
  userDisplayName: String(raw.user_display_name || ""),
  userAvatarUrl: String(raw.user_avatar_url || ""),
});

const toFavoriteFolder = (raw: Record<string, unknown>): FavoriteFolder => ({
  id: Number(raw.id),
  name: String(raw.name || ""),
  itemCount: Number(raw.item_count || 0),
  createdAt: String(raw.created_at || ""),
  updatedAt: String(raw.updated_at || ""),
});

const toFavoriteItem = (raw: Record<string, unknown>): FavoriteItem => ({
  id: Number(raw.id),
  appKey: String(raw.app_key || ""),
  pkgname: String(raw.pkgname || ""),
  name: String(raw.name || ""),
  category: String(raw.category || ""),
  iconUrl: String(raw.icon_url || ""),
  createdAt: String(raw.created_at || ""),
});

const toDownloadedApp = (raw: Record<string, unknown>): DownloadedAppRecord => ({
  id: Number(raw.id),
  appKey: String(raw.app_key || ""),
  pkgname: String(raw.pkgname || ""),
  name: String(raw.name || ""),
  category: String(raw.category || ""),
  selectedOrigin: raw.selected_origin === "spark" ? "spark" : "apm",
  version: String(raw.version || ""),
  packageArch: String(raw.package_arch || "unknown"),
  downloadedAt: String(raw.downloaded_at || ""),
});

export const setBackendToken = (token: string | null) => {
  if (token) backend.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete backend.defaults.headers.common.Authorization;
};

export const exchangeFlarumToken = async (payload: {
  flarumUserId: string;
  flarumToken: string;
}): Promise<AuthSession> => {
  const response = await backend.post("/auth/flarum", {
    flarum_user_id: payload.flarumUserId,
    flarum_token: payload.flarumToken,
  });
  return {
    accessToken: String(response.data.access_token),
    tokenType: "bearer",
    user: toUser(response.data.user),
  };
};

export const fetchMe = async (): Promise<AuthSession["user"]> => {
  const response = await backend.get("/me");
  return toUser(response.data);
};

export const fetchRatingSummary = async (appKey: string): Promise<RatingSummary> => {
  const response = await backend.get(`/apps/${encodeURIComponent(appKey)}/rating-summary`);
  return {
    averageRating: Number(response.data.average_rating || 0),
    reviewCount: Number(response.data.review_count || 0),
    starCounts: response.data.star_counts || {},
  };
};

export const fetchReviews = async (appKey: string): Promise<AppReview[]> => {
  const response = await backend.get(`/apps/${encodeURIComponent(appKey)}/reviews`);
  return (response.data || []).map((item: Record<string, unknown>) => toReview(item));
};

export const submitReview = async (
  appKey: string,
  payload: { rating: number; content: string; tags: ReviewTags },
): Promise<AppReview> => {
  const response = await backend.post(`/apps/${encodeURIComponent(appKey)}/reviews`, {
    rating: payload.rating,
    content: payload.content,
    tags: {
      origin: payload.tags.origin,
      category: payload.tags.category,
      pkgname: payload.tags.pkgname,
      version: payload.tags.version,
      package_arch: payload.tags.packageArch,
      client_arch: payload.tags.clientArch,
      distro: payload.tags.distro,
    },
  });
  return toReview(response.data);
};

export const listFavoriteFolders = async (): Promise<FavoriteFolder[]> => {
  const response = await backend.get("/me/favorite-folders");
  return (response.data || []).map((item: Record<string, unknown>) => toFavoriteFolder(item));
};

export const createFavoriteFolder = async (name: string): Promise<FavoriteFolder> => {
  const response = await backend.post("/me/favorite-folders", { name });
  return toFavoriteFolder(response.data);
};

export const renameFavoriteFolder = async (folderId: number, name: string): Promise<FavoriteFolder> => {
  const response = await backend.patch(`/me/favorite-folders/${folderId}`, { name });
  return toFavoriteFolder(response.data);
};

export const deleteFavoriteFolder = async (folderId: number): Promise<void> => {
  await backend.delete(`/me/favorite-folders/${folderId}`);
};

export const listFavoriteItems = async (folderId: number): Promise<FavoriteItem[]> => {
  const response = await backend.get(`/me/favorite-folders/${folderId}/items`);
  return (response.data || []).map((item: Record<string, unknown>) => toFavoriteItem(item));
};

export const addFavoriteItem = async (
  folderId: number | "default",
  item: Omit<FavoriteItem, "id" | "createdAt">,
): Promise<FavoriteItem> => {
  const response = await backend.post(`/me/favorite-folders/${folderId}/items`, {
    app_key: item.appKey,
    pkgname: item.pkgname,
    name: item.name,
    category: item.category,
    icon_url: item.iconUrl,
  });
  return toFavoriteItem(response.data);
};

export const deleteFavoriteItem = async (folderId: number, itemId: number): Promise<void> => {
  await backend.delete(`/me/favorite-folders/${folderId}/items/${itemId}`);
};

export const bulkDeleteFavoriteItems = async (folderId: number, itemIds: number[]): Promise<number> => {
  const response = await backend.post(`/me/favorite-folders/${folderId}/items/bulk-delete`, { item_ids: itemIds });
  return Number(response.data.deleted_count || 0);
};

export const listDownloadedApps = async (page = 1, pageSize = 20): Promise<DownloadedAppList> => {
  const response = await backend.get("/me/downloaded-apps", { params: { page, page_size: pageSize } });
  return {
    items: (response.data.items || []).map((item: Record<string, unknown>) => toDownloadedApp(item)),
    total: Number(response.data.total || 0),
    page: Number(response.data.page || page),
    pageSize: Number(response.data.page_size || pageSize),
  };
};

export const recordDownloadedApp = async (item: Omit<DownloadedAppRecord, "id" | "downloadedAt">): Promise<DownloadedAppRecord> => {
  const response = await backend.post("/me/downloaded-apps", {
    app_key: item.appKey,
    pkgname: item.pkgname,
    name: item.name,
    category: item.category,
    selected_origin: item.selectedOrigin,
    version: item.version,
    package_arch: item.packageArch,
  });
  return toDownloadedApp(response.data);
};

export const fetchSyncedAppList = async (): Promise<SyncedAppList | null> => {
  const response = await backend.get("/me/app-list");
  if (!response.data) return null;
  return {
    snapshotName: String(response.data.snapshot_name || "默认列表"),
    clientArch: String(response.data.client_arch || "unknown"),
    distro: String(response.data.distro || "unknown"),
    updatedAt: String(response.data.updated_at || ""),
    items: (response.data.items || []).map((item: Record<string, unknown>) => ({
      id: Number(item.id),
      pkgname: String(item.pkgname || ""),
      origin: item.origin === "spark" ? "spark" : "apm",
      category: String(item.category || ""),
      version: String(item.version || ""),
      packageArch: String(item.package_arch || "unknown"),
      appName: String(item.app_name || ""),
      iconUrl: String(item.icon_url || ""),
    })),
  };
};

export const uploadSyncedAppList = async (payload: {
  clientArch: string;
  distro: string;
  items: SyncedAppListItem[];
}): Promise<SyncedAppList> => {
  const response = await backend.put("/me/app-list", {
    client_arch: payload.clientArch,
    distro: payload.distro,
    items: payload.items.map((item) => ({
      pkgname: item.pkgname,
      origin: item.origin,
      category: item.category,
      version: item.version,
      package_arch: item.packageArch,
      app_name: item.appName,
      icon_url: item.iconUrl,
    })),
  });
  return {
    snapshotName: String(response.data.snapshot_name || "默认列表"),
    clientArch: String(response.data.client_arch || payload.clientArch),
    distro: String(response.data.distro || payload.distro),
    updatedAt: String(response.data.updated_at || ""),
    items: payload.items,
  };
};
```

- [ ] **Step 8: Run type smoke test and verify pass**

Run: `npm run test -- src/__tests__/unit/accountTypes.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit shared client account API foundation**

Run:

```bash
git add src/global/storeConfig.ts src/global/typedefinition.ts src/vite-env.d.ts src/__tests__/setup.ts src/modules/backendApi.ts src/__tests__/unit/accountTypes.test.ts
git commit -m "feat(account): add client account api foundation"
```

Expected: commit succeeds.

## Task 2: Add Auth State, Flarum Login, And Sidebar Account Entry

**Files:**
- Create: `src/global/authState.ts`
- Create: `src/modules/flarumAuth.ts`
- Create: `src/components/LoginModal.vue`
- Create: `src/components/LoginPromptModal.vue`
- Create: `src/components/AccountQuickMenu.vue`
- Modify: `src/components/AppSidebar.vue`
- Modify: `src/App.vue`
- Test: `src/__tests__/unit/authState.test.ts`
- Test: `src/__tests__/unit/LoginModal.test.ts`
- Test: `src/__tests__/unit/AppSidebar.account.test.ts`

- [ ] **Step 1: Write failing auth state test**

Create `src/__tests__/unit/authState.test.ts` with:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("authState", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("persists and clears a backend session", async () => {
    const { authSession, currentUser, isLoggedIn, setAuthSession, logout } = await import("@/global/authState");

    setAuthSession({
      accessToken: "jwt",
      tokenType: "bearer",
      user: {
        id: 1,
        flarumUserId: "123",
        username: "momen",
        displayName: "Momen",
        avatarUrl: "https://bbs.spark-app.store/avatar.png",
        forumLevel: "管理员",
        forumGroups: ["管理员"],
      },
    });

    expect(authSession.value?.accessToken).toBe("jwt");
    expect(currentUser.value?.displayName).toBe("Momen");
    expect(isLoggedIn.value).toBe(true);
    expect(JSON.parse(localStorage.getItem("spark-store-auth") || "{}").accessToken).toBe("jwt");

    logout();

    expect(authSession.value).toBeNull();
    expect(isLoggedIn.value).toBe(false);
    expect(localStorage.getItem("spark-store-auth")).toBeNull();
  });
});
```

- [ ] **Step 2: Write failing login modal test**

Create `src/__tests__/unit/LoginModal.test.ts` with:

```typescript
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import LoginModal from "@/components/LoginModal.vue";

describe("LoginModal", () => {
  it("emits login credentials and register request", async () => {
    const rendered = render(LoginModal, {
      props: { show: true, loading: false, error: "" },
    });

    await fireEvent.update(screen.getByLabelText("论坛账号"), "momen");
    await fireEvent.update(screen.getByLabelText("论坛密码"), "secret");
    await fireEvent.click(screen.getByRole("button", { name: "登录" }));
    await fireEvent.click(screen.getByRole("button", { name: "注册账号" }));

    expect(rendered.emitted("login")?.[0]?.[0]).toEqual({ identification: "momen", password: "secret" });
    expect(rendered.emitted("register")).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Write failing sidebar account entry test**

Create `src/__tests__/unit/AppSidebar.account.test.ts` with:

```typescript
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import AppSidebar from "@/components/AppSidebar.vue";
import type { SparkUser } from "@/global/typedefinition";

const baseProps = {
  activeTab: "all",
  categoryCounts: { all: 0 },
  themeMode: "auto" as const,
  storeFilter: "both" as const,
  sparkAvailable: true,
  apmAvailable: true,
  sidebarEntries: [],
  entryCounts: {},
};

const user: SparkUser = {
  id: 1,
  flarumUserId: "123",
  username: "momen",
  displayName: "Momen",
  avatarUrl: "https://bbs.spark-app.store/avatar.png",
  forumLevel: "管理员",
  forumGroups: ["管理员"],
};

describe("AppSidebar account entry", () => {
  it("prompts login when anonymous", async () => {
    const rendered = render(AppSidebar, { props: { ...baseProps, currentUser: null } });

    await fireEvent.click(screen.getByRole("button", { name: /登录 \/ 注册/ }));

    expect(rendered.emitted("request-login")).toHaveLength(1);
  });

  it("opens quick menu for logged-in users", async () => {
    render(AppSidebar, { props: { ...baseProps, currentUser: user } });

    await fireEvent.click(screen.getByRole("button", { name: /Momen/ }));

    expect(screen.getByText("用户管理")).toBeTruthy();
    expect(screen.getByText("我的收藏")).toBeTruthy();
    expect(screen.getByText("退出登录")).toBeTruthy();
  });
});
```

- [ ] **Step 4: Run auth/login/sidebar tests and verify failure**

Run:

```bash
npm run test -- src/__tests__/unit/authState.test.ts src/__tests__/unit/LoginModal.test.ts src/__tests__/unit/AppSidebar.account.test.ts
```

Expected: FAIL because modules/components/props do not exist.

- [ ] **Step 5: Add auth state**

Create `src/global/authState.ts` with:

```typescript
import { computed, ref } from "vue";

import type { AuthSession } from "@/global/typedefinition";
import { setBackendToken } from "@/modules/backendApi";

const STORAGE_KEY = "spark-store-auth";

const readStoredSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || parsed.tokenType !== "bearer" || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const authSession = ref<AuthSession | null>(readStoredSession());
export const currentUser = computed(() => authSession.value?.user ?? null);
export const isLoggedIn = computed(() => Boolean(authSession.value?.accessToken));

setBackendToken(authSession.value?.accessToken ?? null);

export const setAuthSession = (session: AuthSession) => {
  authSession.value = session;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  setBackendToken(session.accessToken);
};

export const logout = () => {
  authSession.value = null;
  localStorage.removeItem(STORAGE_KEY);
  setBackendToken(null);
};
```

- [ ] **Step 6: Add Flarum login helper**

Create `src/modules/flarumAuth.ts` with:

```typescript
import axios from "axios";

import { FLARUM_BASE_URL } from "@/global/storeConfig";
import type { FlarumLoginPayload } from "@/global/typedefinition";

export interface FlarumTokenResponse {
  token: string;
  userId: string;
}

export const requestFlarumToken = async (payload: FlarumLoginPayload): Promise<FlarumTokenResponse> => {
  const response = await axios.post(`${FLARUM_BASE_URL}/api/token`, {
    identification: payload.identification,
    password: payload.password,
  });
  return {
    token: String(response.data.token || ""),
    userId: String(response.data.userId || ""),
  };
};
```

- [ ] **Step 7: Create login modal**

Create `src/components/LoginModal.vue` with:

```vue
<template>
  <Transition enter-active-class="duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="show" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 p-4" @click.self="$emit('close')">
      <form class="w-full max-w-md rounded-3xl border border-white/10 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submit">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white">登录星火账号</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">使用论坛账号登录，密码只发送给论坛。</p>
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" aria-label="关闭" @click="$emit('close')">
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <label class="block text-sm font-medium text-slate-700 dark:text-slate-200" for="flarumAccount">论坛账号</label>
        <input id="flarumAccount" v-model="identification" autocomplete="username" class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-800" />

        <label class="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200" for="flarumPassword">论坛密码</label>
        <input id="flarumPassword" v-model="password" type="password" autocomplete="current-password" class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-800" />

        <p v-if="error" class="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{{ error }}</p>

        <button type="submit" class="mt-6 w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50" :disabled="loading || !identification.trim() || !password">
          {{ loading ? "登录中..." : "登录" }}
        </button>
        <button type="button" class="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" @click="$emit('register')">
          注册账号
        </button>
      </form>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  show: boolean;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  close: [];
  login: [payload: { identification: string; password: string }];
  register: [];
}>();

const identification = ref("");
const password = ref("");

const submit = () => {
  emit("login", { identification: identification.value.trim(), password: password.value });
};

watch(
  () => props.show,
  (show) => {
    if (!show) password.value = "";
  },
);
</script>
```

- [ ] **Step 8: Create reusable login prompt modal**

Create `src/components/LoginPromptModal.vue` with:

```vue
<template>
  <Transition enter-active-class="duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="show" class="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/60 p-4" @click.self="$emit('close')">
      <div class="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">需要登录</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{ message }}</p>
        <div class="mt-6 flex gap-3">
          <button type="button" class="flex-1 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white" @click="$emit('login')">登录</button>
          <button type="button" class="flex-1 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200" @click="$emit('register')">注册</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean;
  message: string;
}>();

defineEmits<{
  close: [];
  login: [];
  register: [];
}>();
</script>
```

- [ ] **Step 9: Create account quick menu**

Create `src/components/AccountQuickMenu.vue` with:

```vue
<template>
  <div class="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-800 dark:bg-slate-900">
    <button type="button" class="quick-menu-item" @click="$emit('open-user-management')"><i class="fas fa-user-cog"></i><span>用户管理</span></button>
    <button type="button" class="quick-menu-item" @click="$emit('open-favorites')"><i class="fas fa-heart"></i><span>我的收藏</span></button>
    <button type="button" class="quick-menu-item" @click="$emit('open-forum')"><i class="fas fa-comments"></i><span>论坛首页</span></button>
    <button type="button" class="quick-menu-item" @click="$emit('edit-profile')"><i class="fas fa-id-card"></i><span>修改论坛资料</span></button>
    <button type="button" class="quick-menu-item text-rose-600 dark:text-rose-400" @click="$emit('logout')"><i class="fas fa-right-from-bracket"></i><span>退出登录</span></button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  "open-user-management": [];
  "open-favorites": [];
  "open-forum": [];
  "edit-profile": [];
  logout: [];
}>();
</script>

<style scoped>
.quick-menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.625rem;
  border-radius: 0.75rem;
  padding: 0.625rem 0.75rem;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 600;
  color: inherit;
}

.quick-menu-item:hover {
  background: rgba(0, 113, 227, 0.08);
}
</style>
```

- [ ] **Step 10: Update sidebar account entry**

Modify `src/components/AppSidebar.vue`:

1. Import `ref`, `AccountQuickMenu`, and `SparkUser`:

```typescript
import { computed, ref } from "vue";
import AccountQuickMenu from "./AccountQuickMenu.vue";
import type { SidebarEntry, SparkUser } from "../global/typedefinition";
```

2. Add prop:

```typescript
  currentUser: SparkUser | null;
```

3. Add emits:

```typescript
  (e: "request-login"): void;
  (e: "open-user-management"): void;
  (e: "open-favorites"): void;
  (e: "open-forum"): void;
  (e: "edit-profile"): void;
  (e: "logout"): void;
```

4. Add state and handler:

```typescript
const showAccountMenu = ref(false);

const handleAccountClick = () => {
  if (!props.currentUser) {
    emit("request-login");
    return;
  }
  showAccountMenu.value = !showAccountMenu.value;
};
```

5. Replace the current logo/title `<div class="flex items-center gap-3">...</div>` at the top with:

```vue
<div class="relative flex-1">
  <button
    type="button"
    class="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
    :aria-label="currentUser ? currentUser.displayName || currentUser.username : '登录 / 注册'"
    @click="handleAccountClick"
  >
    <img
      :src="currentUser?.avatarUrl || amberLogo"
      alt=""
      class="h-11 w-11 rounded-2xl bg-white/70 object-cover p-2 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-800"
      :class="currentUser?.avatarUrl ? 'p-0' : 'p-2'"
    />
    <div class="min-w-0 flex flex-col">
      <span class="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">星火账号</span>
      <span class="truncate text-lg font-semibold text-slate-900 dark:text-white">{{ currentUser ? currentUser.displayName || currentUser.username : '登录 / 注册' }}</span>
    </div>
  </button>
  <AccountQuickMenu
    v-if="currentUser && showAccountMenu"
    @open-user-management="$emit('open-user-management')"
    @open-favorites="$emit('open-favorites')"
    @open-forum="$emit('open-forum')"
    @edit-profile="$emit('edit-profile')"
    @logout="$emit('logout')"
  />
</div>
```

- [ ] **Step 11: Wire login shell in App.vue**

Modify `src/App.vue`:

1. Import new state/components/helpers:

```typescript
import LoginModal from "./components/LoginModal.vue";
import LoginPromptModal from "./components/LoginPromptModal.vue";
import { currentUser, isLoggedIn, logout, setAuthSession } from "./global/authState";
import { FLARUM_BASE_URL, FLARUM_REGISTER_URL, FLARUM_SETTINGS_URL } from "./global/storeConfig";
import { exchangeFlarumToken } from "./modules/backendApi";
import { requestFlarumToken } from "./modules/flarumAuth";
import type { FlarumLoginPayload } from "./global/typedefinition";
```

2. Add state:

```typescript
const showLoginModal = ref(false);
const loginLoading = ref(false);
const loginError = ref("");
const showLoginPrompt = ref(false);
const loginPromptMessage = ref("该功能需要登录星火账号后使用。");
```

3. Pass sidebar props/events:

```vue
:current-user="currentUser"
@request-login="showLoginModal = true"
@open-user-management="openUserManagement"
@open-favorites="openFavoriteManagement"
@open-forum="openExternalUrl(FLARUM_BASE_URL)"
@edit-profile="openExternalUrl(FLARUM_SETTINGS_URL)"
@logout="logout"
```

4. Mount modals before `AboutModal`:

```vue
<LoginModal
  :show="showLoginModal"
  :loading="loginLoading"
  :error="loginError"
  @close="showLoginModal = false"
  @login="handleFlarumLogin"
  @register="openExternalUrl(FLARUM_REGISTER_URL)"
/>
<LoginPromptModal
  :show="showLoginPrompt"
  :message="loginPromptMessage"
  @close="showLoginPrompt = false"
  @login="openLoginFromPrompt"
  @register="openExternalUrl(FLARUM_REGISTER_URL)"
/>
```

5. Add handlers:

```typescript
const openExternalUrl = (url: string) => {
  window.open(url, "_blank");
};

const requireLogin = (message: string) => {
  if (isLoggedIn.value) return true;
  loginPromptMessage.value = message;
  showLoginPrompt.value = true;
  return false;
};

const openLoginFromPrompt = () => {
  showLoginPrompt.value = false;
  showLoginModal.value = true;
};

const handleFlarumLogin = async (payload: FlarumLoginPayload) => {
  loginLoading.value = true;
  loginError.value = "";
  try {
    const flarum = await requestFlarumToken(payload);
    const session = await exchangeFlarumToken({ flarumUserId: flarum.userId, flarumToken: flarum.token });
    setAuthSession(session);
    showLoginModal.value = false;
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : "登录失败";
  } finally {
    loginLoading.value = false;
  }
};

const openUserManagement = async () => {
  if (!requireLogin("用户管理需要登录星火账号。")) return;
  currentView.value = "account";
  activeTab.value = "account";
};

const openFavoriteManagement = async () => {
  if (!requireLogin("我的收藏需要登录星火账号。")) return;
  currentView.value = "favorites";
  activeTab.value = "favorites";
};
```

- [ ] **Step 12: Run auth/sidebar tests**

Run:

```bash
npm run test -- src/__tests__/unit/authState.test.ts src/__tests__/unit/LoginModal.test.ts src/__tests__/unit/AppSidebar.account.test.ts src/__tests__/unit/AppSidebar.test.ts
```

Expected: PASS. If existing `AppSidebar.test.ts` fails, add `currentUser: null` to its `renderSidebar` default props.

- [ ] **Step 13: Commit auth and sidebar account entry**

Run:

```bash
git add src/global/authState.ts src/modules/flarumAuth.ts src/components/LoginModal.vue src/components/LoginPromptModal.vue src/components/AccountQuickMenu.vue src/components/AppSidebar.vue src/App.vue src/__tests__/unit/authState.test.ts src/__tests__/unit/LoginModal.test.ts src/__tests__/unit/AppSidebar.account.test.ts src/__tests__/unit/AppSidebar.test.ts
git commit -m "feat(account): add forum login and sidebar account entry"
```

Expected: commit succeeds.

## Task 3: Add App Identity Helpers And Main-Content Detail Page

**Files:**
- Create: `src/modules/appIdentity.ts`
- Create: `src/components/AppDetailPage.vue`
- Modify: `src/App.vue`
- Test: `src/__tests__/unit/appIdentity.test.ts`
- Test: `src/__tests__/unit/AppDetailPage.test.ts`

- [ ] **Step 1: Write failing app identity tests**

Create `src/__tests__/unit/appIdentity.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";

import { buildFavoriteAppKey, buildReviewAppKey, buildReviewTags, getDisplayApp, parsePackageArch } from "@/modules/appIdentity";
import type { App } from "@/global/typedefinition";

const app: App = {
  name: "WPS",
  pkgname: "wps",
  version: "1.0.0",
  filename: "wps_1.0.0_amd64.deb",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "",
  more: "",
  tags: "",
  img_urls: [],
  icons: "",
  category: "office",
  origin: "apm",
  currentStatus: "not-installed",
};

describe("appIdentity", () => {
  it("builds favorite and review keys", () => {
    expect(buildFavoriteAppKey(app)).toBe("app:office:wps");
    expect(buildReviewAppKey(app, "amd64")).toBe("apm:amd64-apm:office:wps");
  });

  it("parses package arch and review tags", () => {
    expect(parsePackageArch(app.filename)).toBe("amd64");
    expect(buildReviewTags(app, { clientArch: "amd64", distro: "deepin 25" })).toMatchObject({
      origin: "apm",
      category: "office",
      pkgname: "wps",
      packageArch: "amd64",
    });
  });

  it("returns selected display app from merged apps", () => {
    const merged: App = { ...app, isMerged: true, viewingOrigin: "spark", sparkApp: { ...app, origin: "spark" }, apmApp: app };
    expect(getDisplayApp(merged)?.origin).toBe("spark");
  });
});
```

- [ ] **Step 2: Write failing detail page test**

Create `src/__tests__/unit/AppDetailPage.test.ts` with:

```typescript
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import AppDetailPage from "@/components/AppDetailPage.vue";
import type { App } from "@/global/typedefinition";

const app: App = {
  name: "WPS",
  pkgname: "wps",
  version: "1.0.0",
  filename: "wps_1.0.0_amd64.deb",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "110M",
  more: "Office suite",
  tags: "office",
  img_urls: [],
  icons: "",
  category: "office",
  origin: "apm",
  currentStatus: "not-installed",
};

describe("AppDetailPage", () => {
  it("renders as page, emits back, and gates favorite for anonymous users", async () => {
    const rendered = render(AppDetailPage, {
      props: {
        app,
        screenshots: [],
        sparkInstalled: false,
        apmInstalled: false,
        loggedIn: false,
        reviewAppKey: "apm:amd64-apm:office:wps",
        reviewTags: null,
      },
    });

    expect(screen.getByText("Office suite")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "返回" }));
    await fireEvent.click(screen.getByRole("button", { name: "收藏" }));

    expect(rendered.emitted("back")).toHaveLength(1);
    expect(rendered.emitted("request-login")?.[0]?.[0]).toBe("收藏应用需要登录星火账号。");
  });
});
```

- [ ] **Step 3: Run identity/detail tests and verify failure**

Run: `npm run test -- src/__tests__/unit/appIdentity.test.ts src/__tests__/unit/AppDetailPage.test.ts`

Expected: FAIL because helper and detail page do not exist.

- [ ] **Step 4: Add app identity helpers**

Create `src/modules/appIdentity.ts` with:

```typescript
import type { App, ReviewTags } from "@/global/typedefinition";

export const parsePackageArch = (filename: string | undefined): string => {
  if (!filename) return "unknown";
  const match = filename.match(/_([^_]+)\.(?:deb|rpm|appimage|tar\.gz)$/i);
  return match?.[1] || "unknown";
};

export const buildStoreArch = (origin: "spark" | "apm", clientArch: string): string => {
  return origin === "spark" ? `${clientArch}-store` : `${clientArch}-apm`;
};

export const buildFavoriteAppKey = (app: Pick<App, "category" | "pkgname">): string => {
  return `app:${app.category || "unknown"}:${app.pkgname}`;
};

export const buildReviewAppKey = (app: App, clientArch: string): string => {
  return `${app.origin}:${buildStoreArch(app.origin, clientArch)}:${app.category || "unknown"}:${app.pkgname}`;
};

export const getDisplayApp = (app: App | null): App | null => {
  if (!app) return null;
  if (!app.isMerged) return app;
  if (app.viewingOrigin === "spark") return app.sparkApp || app;
  if (app.viewingOrigin === "apm") return app.apmApp || app;
  return app.sparkApp || app.apmApp || app;
};

export const buildReviewTags = (
  app: App,
  system: { clientArch: string; distro: string },
): ReviewTags => ({
  origin: app.origin,
  category: app.category || "unknown",
  pkgname: app.pkgname,
  version: app.version || "unknown",
  packageArch: app.arch || parsePackageArch(app.filename),
  clientArch: system.clientArch || "unknown",
  distro: system.distro || "unknown",
});
```

- [ ] **Step 5: Create main-content detail page**

Create `src/components/AppDetailPage.vue` with this page-level implementation:

```vue
<template>
  <section class="mx-auto max-w-6xl space-y-6">
    <button type="button" class="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-300" aria-label="返回" @click="$emit('back')">
      <i class="fas fa-arrow-left"></i>
      <span>返回</span>
    </button>

    <div class="rounded-3xl border border-slate-200/70 bg-white/95 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="flex flex-col gap-6 lg:flex-row">
        <div class="w-full flex-shrink-0 space-y-5 lg:w-72">
          <div class="text-center">
            <div class="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-slate-100 to-slate-200 shadow-lg dark:from-slate-800 dark:to-slate-700">
              <img v-if="displayApp" :src="iconPath" alt="icon" class="h-full w-full object-cover" loading="lazy" />
            </div>
            <h2 class="mt-4 text-xl font-bold text-slate-900 dark:text-white">{{ displayApp?.name || "" }}</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ displayApp?.pkgname || "" }}</p>
            <p v-if="displayApp?.version" class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ displayApp.version }}</p>
          </div>

          <div class="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/50 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-800/50">
            <span class="text-sm text-slate-500 dark:text-slate-400">来源</span>
            <div v-if="app?.isMerged" class="flex gap-1 overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-700">
              <button v-if="app.sparkApp" type="button" class="px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors" :class="viewingOrigin === 'spark' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'" @click="viewingOrigin = 'spark'">Spark</button>
              <button v-if="app.apmApp" type="button" class="px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors" :class="viewingOrigin === 'apm' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'" @click="viewingOrigin = 'apm'">APM</button>
            </div>
            <span v-else-if="displayApp" class="rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wider" :class="displayApp.origin === 'spark' ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'">
              {{ displayApp.origin === "spark" ? "Spark" : "APM" }}
            </span>
          </div>

          <div class="space-y-2">
            <button v-if="!isInstalled" type="button" class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-700 dark:hover:bg-slate-600" :disabled="isOtherVersionInstalled" @click="handleInstall">
              <i class="fas fa-download text-xs"></i>
              <span>{{ isOtherVersionInstalled ? otherVersionText : "安装" }}</span>
            </button>
            <template v-else>
              <div class="flex gap-2">
                <button type="button" class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600" @click="emit('open-app', displayApp?.pkgname || '', displayApp?.origin)">
                  <i class="fas fa-external-link-alt text-xs"></i>
                  <span>打开</span>
                </button>
                <button type="button" class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300" @click="handleRemove">
                  <i class="fas fa-trash text-xs"></i>
                  <span>卸载</span>
                </button>
              </div>
            </template>
            <button type="button" class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10" @click="handleFavorite">
              <i class="fas fa-heart text-xs"></i>
              <span>收藏</span>
            </button>
          </div>

          <div class="space-y-2 border-t border-slate-200/60 pt-2 dark:border-slate-800/60">
            <div v-if="displayApp?.category" class="flex items-center justify-between px-1">
              <span class="text-xs text-slate-400">分类</span>
              <span class="max-w-[140px] truncate text-xs font-medium text-slate-700 dark:text-slate-300">{{ displayApp.category }}</span>
            </div>
            <div v-if="displayApp?.author" class="flex items-center justify-between px-1">
              <span class="text-xs text-slate-400">作者</span>
              <span class="max-w-[140px] truncate text-xs font-medium text-slate-700 dark:text-slate-300">{{ displayApp.author }}</span>
            </div>
            <div v-if="displayApp?.size" class="flex items-center justify-between px-1">
              <span class="text-xs text-slate-400">大小</span>
              <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{{ displayApp.size }}</span>
            </div>
          </div>
        </div>

        <div class="min-w-0 flex-1 space-y-5">
          <div v-if="displayApp?.more && displayApp.more.trim() !== ''" class="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-800/30">
            <h3 class="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white"><i class="fas fa-info-circle text-slate-400"></i>应用详情</h3>
            <div class="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300" v-html="displayApp.more.replace(/\n/g, '<br>')"></div>
          </div>
          <div v-else class="rounded-2xl border border-slate-200/60 bg-slate-50/30 p-8 text-center dark:border-slate-800/60 dark:bg-slate-800/20">
            <p class="text-sm text-slate-400">暂无应用详情</p>
          </div>

          <div v-if="screenshots.length">
            <h3 class="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white"><i class="fas fa-images text-slate-400"></i>应用截图</h3>
            <div class="grid gap-3 sm:grid-cols-2">
              <img v-for="(screen, index) in screenshots" :key="index" :src="screen" alt="screenshot" class="h-44 w-full cursor-pointer rounded-2xl border border-slate-200/60 object-cover shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800/60" loading="lazy" @click="$emit('open-preview', index)" @error="hideImage" />
            </div>
          </div>
          <div v-else class="rounded-2xl border border-slate-200/60 bg-slate-50/30 p-8 text-center dark:border-slate-800/60 dark:bg-slate-800/20">
            <p class="text-sm text-slate-400">暂无应用截图</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import { APM_STORE_BASE_URL, getHybridDefaultOrigin } from "@/global/storeConfig";
import type { App, ReviewTags } from "@/global/typedefinition";

const props = defineProps<{
  app: App | null;
  screenshots: string[];
  sparkInstalled: boolean;
  apmInstalled: boolean;
  loggedIn: boolean;
  reviewAppKey: string;
  reviewTags: ReviewTags | null;
}>();

const emit = defineEmits<{
  back: [];
  install: [app: App];
  remove: [app: App];
  favorite: [app: App];
  "request-login": [message: string];
  "open-preview": [index: number];
  "open-app": [pkgname: string, origin?: "spark" | "apm"];
  "check-install": [app: App];
}>();

const viewingOrigin = ref<"spark" | "apm">("spark");

watch(
  () => props.app,
  (newApp) => {
    if (!newApp) return;
    if (newApp.isMerged) {
      viewingOrigin.value = newApp.viewingOrigin || (newApp.sparkApp ? getHybridDefaultOrigin(newApp.sparkApp) : "apm");
    } else {
      viewingOrigin.value = newApp.origin;
    }
  },
  { immediate: true },
);

const displayApp = computed(() => {
  if (!props.app) return null;
  if (!props.app.isMerged) return props.app;
  return viewingOrigin.value === "spark" ? props.app.sparkApp || props.app : props.app.apmApp || props.app;
});

watch(
  () => displayApp.value,
  (newApp) => {
    if (newApp) emit("check-install", newApp);
  },
);

const isInstalled = computed(() => (viewingOrigin.value === "spark" ? props.sparkInstalled : props.apmInstalled));
const isOtherVersionInstalled = computed(() => (viewingOrigin.value === "spark" ? props.apmInstalled : props.sparkInstalled));
const otherVersionText = computed(() => (viewingOrigin.value === "spark" ? "已安装 APM 版" : "已安装 Spark 版"));

const iconPath = computed(() => {
  if (!displayApp.value) return "";
  const arch = window.apm_store.arch || "amd64";
  const finalArch = displayApp.value.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
  return `${APM_STORE_BASE_URL}/${finalArch}/${displayApp.value.category}/${displayApp.value.pkgname}/icon.png`;
});

const handleInstall = () => {
  if (displayApp.value) emit("install", displayApp.value);
};

const handleRemove = () => {
  if (displayApp.value) emit("remove", displayApp.value);
};

const handleFavorite = () => {
  if (!displayApp.value) return;
  if (!props.loggedIn) {
    emit("request-login", "收藏应用需要登录星火账号。");
    return;
  }
  emit("favorite", displayApp.value);
};

const hideImage = (event: Event) => {
  (event.target as HTMLElement).style.display = "none";
};
</script>
```

Do not mount reviews in this task; Task 5 adds `ReviewsPanel`.

- [ ] **Step 6: Replace modal state with detail page state in App.vue**

Modify `src/App.vue`:

1. Import `AppDetailPage` instead of `AppDetailModal`.
2. Replace `const showModal = ref(false);` with:

```typescript
const currentView = ref<"home" | "list" | "detail" | "account" | "favorites">("home");
const detailPreviousView = ref<"home" | "list">("home");
```

3. Replace the content template branch at `src/App.vue:57-77` with:

```vue
<div class="px-4 py-6 lg:px-10">
  <AppDetailPage
    v-if="currentView === 'detail'"
    :app="currentApp"
    :screenshots="screenshots"
    :spark-installed="currentAppSparkInstalled"
    :apm-installed="currentAppApmInstalled"
    :logged-in="isLoggedIn"
    :review-app-key="currentReviewAppKey"
    :review-tags="currentReviewTags"
    @back="closeDetail"
    @install="onDetailInstall"
    @remove="onDetailRemove"
    @favorite="openFavoriteSelector"
    @request-login="requireLogin"
    @open-preview="openScreenPreview"
    @open-app="openDownloadedApp"
    @check-install="checkAppInstalled"
  />
  <template v-else-if="activeTab === 'home'">
    <HomeView
      :links="homeLinks"
      :lists="homeLists"
      :loading="homeLoading"
      :error="homeError"
      :store-filter="storeFilter"
      @open-detail="openDetail"
    />
  </template>
  <template v-else>
    <AppGrid
      :apps="filteredApps"
      :loading="loading"
      :scroll-key="activeTab + '-' + selectedCategory"
      :store-filter="storeFilter"
      @open-detail="openDetail"
    />
  </template>
</div>
```

4. In `selectTab`, after setting `activeTab`, add:

```typescript
currentView.value = tab === "home" ? "home" : "list";
```

5. In `openDetail`, replace `showModal.value = true;` with:

```typescript
detailPreviousView.value = activeTab.value === "home" ? "home" : "list";
currentView.value = "detail";
```

6. Replace `closeDetail` with:

```typescript
const closeDetail = () => {
  currentView.value = detailPreviousView.value;
  currentApp.value = null;
};
```

7. Replace `if (showModal.value && currentApp.value)` checks with `if (currentView.value === "detail" && currentApp.value)`.
8. Remove the old `<AppDetailModal ... />` block.

- [ ] **Step 7: Run detail tests**

Run: `npm run test -- src/__tests__/unit/appIdentity.test.ts src/__tests__/unit/AppDetailPage.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit main-content detail page**

Run:

```bash
git add src/modules/appIdentity.ts src/components/AppDetailPage.vue src/App.vue src/__tests__/unit/appIdentity.test.ts src/__tests__/unit/AppDetailPage.test.ts
git commit -m "feat(detail): move app details into content view"
```

Expected: commit succeeds.

## Task 4: Add Favorites API UI And Availability Resolver

**Files:**
- Create: `src/modules/favoriteAvailability.ts`
- Create: `src/components/FavoriteFolderSelector.vue`
- Create: `src/components/FavoriteFolderManager.vue`
- Modify: `src/App.vue`
- Test: `src/__tests__/unit/favoriteAvailability.test.ts`
- Test: `src/__tests__/unit/FavoriteFolderManager.test.ts`

- [ ] **Step 1: Write failing favorite availability tests**

Create `src/__tests__/unit/favoriteAvailability.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";

import { resolveFavoriteItems } from "@/modules/favoriteAvailability";
import type { App, FavoriteItem } from "@/global/typedefinition";

const app = (origin: "spark" | "apm", overrides: Partial<App> = {}): App => ({
  name: "WPS",
  pkgname: "wps",
  version: "1.0.0",
  filename: "wps_1.0.0_amd64.deb",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "",
  more: "",
  tags: "",
  img_urls: [],
  icons: "",
  category: "office",
  origin,
  currentStatus: "not-installed",
  arch: "amd64",
  ...overrides,
});

const favorite: FavoriteItem = {
  id: 1,
  appKey: "app:office:wps",
  pkgname: "wps",
  name: "WPS",
  category: "office",
  iconUrl: "",
  createdAt: "2026-05-18T00:00:00Z",
};

describe("favoriteAvailability", () => {
  it("marks downlisted favorites", () => {
    expect(resolveFavoriteItems([favorite], [], [], { spark: true, apm: true }, "both")[0].status).toBe("downlisted");
  });

  it("selects preferred installable variant", () => {
    const resolved = resolveFavoriteItems([favorite], [app("spark"), app("apm")], [], { spark: true, apm: true }, "both")[0];
    expect(resolved.status).toBe("installable");
    expect(resolved.selectedApp?.origin).toBe("apm");
  });

  it("marks installed favorites", () => {
    const resolved = resolveFavoriteItems([favorite], [app("apm")], [app("apm", { currentStatus: "installed" })], { spark: true, apm: true }, "both")[0];
    expect(resolved.status).toBe("installed");
  });
});
```

- [ ] **Step 2: Write failing folder manager test**

Create `src/__tests__/unit/FavoriteFolderManager.test.ts` with:

```typescript
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import FavoriteFolderManager from "@/components/FavoriteFolderManager.vue";
import type { FavoriteFolder, ResolvedFavoriteItem } from "@/global/typedefinition";

const folder: FavoriteFolder = {
  id: 1,
  name: "默认收藏夹",
  itemCount: 1,
  createdAt: "2026-05-18T00:00:00Z",
  updatedAt: "2026-05-18T00:00:00Z",
};

const item: ResolvedFavoriteItem = {
  item: {
    id: 2,
    appKey: "app:office:wps",
    pkgname: "wps",
    name: "WPS",
    category: "office",
    iconUrl: "",
    createdAt: "2026-05-18T00:00:00Z",
  },
  status: "downlisted",
  reason: "已下架",
  selectedApp: null,
};

describe("FavoriteFolderManager", () => {
  it("shows downlisted favorites and emits bulk delete", async () => {
    const rendered = render(FavoriteFolderManager, {
      props: { folders: [folder], activeFolderId: 1, items: [item], loading: false, error: "" },
    });

    expect(screen.getByText("已下架")).toBeTruthy();
    await fireEvent.click(screen.getByLabelText("选择 WPS"));
    await fireEvent.click(screen.getByRole("button", { name: "移除选中" }));

    expect(rendered.emitted("remove-selected")?.[0]?.[0]).toEqual([2]);
  });
});
```

- [ ] **Step 3: Run favorite tests and verify failure**

Run: `npm run test -- src/__tests__/unit/favoriteAvailability.test.ts src/__tests__/unit/FavoriteFolderManager.test.ts`

Expected: FAIL because modules/components do not exist.

- [ ] **Step 4: Add favorite availability resolver**

Create `src/modules/favoriteAvailability.ts` with:

```typescript
import type { App, FavoriteItem, ResolvedFavoriteItem, StoreFilter } from "@/global/typedefinition";
import { getHybridDefaultOrigin } from "@/global/storeConfig";

const sourceEnabled = (origin: "spark" | "apm", available: { spark: boolean; apm: boolean }, storeFilter: StoreFilter) => {
  if (origin === "spark") return available.spark && storeFilter !== "apm";
  return available.apm && storeFilter !== "spark";
};

const hasCurrentArch = (app: App, clientArch: string) => {
  return !app.arch || app.arch === clientArch || app.filename.includes(`_${clientArch}.`);
};

const choosePreferred = (apps: App[]): App => {
  if (apps.length === 1) return apps[0];
  const spark = apps.find((app) => app.origin === "spark");
  const apm = apps.find((app) => app.origin === "apm");
  if (spark && apm) return getHybridDefaultOrigin(spark) === "spark" ? spark : apm;
  return apps[0];
};

export const resolveFavoriteItems = (
  items: FavoriteItem[],
  catalogApps: App[],
  installedApps: App[],
  available: { spark: boolean; apm: boolean },
  storeFilter: StoreFilter,
  clientArch = window.apm_store.arch || "amd64",
): ResolvedFavoriteItem[] => {
  return items.map((item) => {
    const matches = catalogApps.filter((app) => app.pkgname === item.pkgname && app.category === item.category);
    if (matches.length === 0) return { item, status: "downlisted", reason: "已下架", selectedApp: null };

    const installed = installedApps.find((app) => app.pkgname === item.pkgname && app.category === item.category && app.currentStatus === "installed");
    if (installed) return { item, status: "installed", reason: "已安装", selectedApp: installed };

    const archMatches = matches.filter((app) => hasCurrentArch(app, clientArch));
    if (archMatches.length === 0) return { item, status: "arch-unavailable", reason: "当前架构不可用", selectedApp: null };

    const usable = archMatches.filter((app) => sourceEnabled(app.origin, available, storeFilter));
    if (usable.length === 0) return { item, status: "platform-unavailable", reason: "当前来源不可用", selectedApp: null };

    return { item, status: "installable", reason: "可安装", selectedApp: choosePreferred(usable) };
  });
};
```

- [ ] **Step 5: Create favorite folder selector**

Create `src/components/FavoriteFolderSelector.vue` with:

```vue
<template>
  <Transition enter-active-class="duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="show" class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4" @click.self="$emit('close')">
      <div class="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <h2 class="text-lg font-semibold text-slate-900 dark:text-white">添加到收藏夹</h2>
        <p class="mt-1 text-sm text-slate-500">选择收藏夹；没有收藏夹时会使用默认收藏夹。</p>
        <div class="mt-4 space-y-2">
          <button v-for="folder in folders" :key="folder.id" type="button" class="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm font-semibold dark:border-slate-700" @click="$emit('select-folder', folder.id)">{{ folder.name }}</button>
          <button type="button" class="w-full rounded-2xl border border-brand/30 px-4 py-3 text-left text-sm font-semibold text-brand" @click="$emit('select-folder', 'default')">默认收藏夹</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import type { FavoriteFolder } from "@/global/typedefinition";

defineProps<{
  show: boolean;
  folders: FavoriteFolder[];
}>();

defineEmits<{
  close: [];
  "select-folder": [folderId: number | "default"];
}>();
</script>
```

- [ ] **Step 6: Create favorite folder manager**

Create `src/components/FavoriteFolderManager.vue` with:

```vue
<template>
  <section class="space-y-4">
    <div class="flex flex-wrap items-center gap-2">
      <button v-for="folder in folders" :key="folder.id" type="button" class="rounded-2xl border px-4 py-2 text-sm font-semibold" :class="activeFolderId === folder.id ? 'border-brand text-brand' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'" @click="$emit('select-folder', folder.id)">
        {{ folder.name }} ({{ folder.itemCount }})
      </button>
      <button type="button" class="rounded-2xl border border-brand/30 px-4 py-2 text-sm font-semibold text-brand" @click="$emit('create-folder')">新建收藏夹</button>
    </div>

    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-40" :disabled="selectedInstallableIds.length === 0" @click="installSelected">加入安装队列</button>
      <button type="button" class="rounded-2xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-600 disabled:opacity-40" :disabled="selectedIds.length === 0" @click="$emit('remove-selected', selectedIds)">移除选中</button>
      <button type="button" class="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300" @click="selectInstallable">选择可安装</button>
    </div>

    <p v-if="loading" class="rounded-2xl border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">正在加载收藏…</p>
    <p v-else-if="error" class="rounded-2xl bg-rose-50 p-4 text-sm text-rose-600">{{ error }}</p>
    <p v-else-if="items.length === 0" class="rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500">当前收藏夹为空</p>
    <div v-else class="space-y-3">
      <label v-for="resolved in items" :key="resolved.item.id" class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <input v-model="selected" type="checkbox" :value="resolved.item.id" :aria-label="`选择 ${resolved.item.name || resolved.item.pkgname}`" />
        <img v-if="resolved.item.iconUrl" :src="resolved.item.iconUrl" class="h-10 w-10 rounded-xl" alt="" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-slate-900 dark:text-white">{{ resolved.item.name || resolved.item.pkgname }}</p>
          <p class="text-xs text-slate-500">{{ resolved.item.pkgname }} · {{ resolved.item.category }}</p>
        </div>
        <span class="rounded-full px-3 py-1 text-xs font-semibold" :class="statusClass(resolved.status)">{{ resolved.reason }}</span>
      </label>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { FavoriteFolder, ResolvedFavoriteItem } from "@/global/typedefinition";

const props = defineProps<{
  folders: FavoriteFolder[];
  activeFolderId: number | null;
  items: ResolvedFavoriteItem[];
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  "select-folder": [folderId: number];
  "create-folder": [];
  "remove-selected": [itemIds: number[]];
  "install-selected": [items: ResolvedFavoriteItem[]];
}>();

const selected = ref<number[]>([]);
const selectedIds = computed(() => selected.value);
const selectedInstallableIds = computed(() => props.items.filter((item) => item.status === "installable" && selected.value.includes(item.item.id)).map((item) => item.item.id));

const selectInstallable = () => {
  selected.value = props.items.filter((item) => item.status === "installable").map((item) => item.item.id);
};

const installSelected = () => {
  emit("install-selected", props.items.filter((item) => selectedInstallableIds.value.includes(item.item.id)));
};

const statusClass = (status: ResolvedFavoriteItem["status"]) => {
  if (status === "installable") return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
  if (status === "installed") return "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
};

watch(() => props.activeFolderId, () => {
  selected.value = [];
});
</script>
```

- [ ] **Step 7: Wire favorite selector and manager in App.vue**

Modify `src/App.vue`:

1. Import components/helpers/API:

```typescript
import FavoriteFolderSelector from "./components/FavoriteFolderSelector.vue";
import FavoriteFolderManager from "./components/FavoriteFolderManager.vue";
import { addFavoriteItem, bulkDeleteFavoriteItems, createFavoriteFolder, listFavoriteFolders, listFavoriteItems } from "./modules/backendApi";
import { buildFavoriteAppKey } from "./modules/appIdentity";
import { resolveFavoriteItems } from "./modules/favoriteAvailability";
import type { FavoriteFolder, FavoriteItem, ResolvedFavoriteItem } from "./global/typedefinition";
```

2. Add state:

```typescript
const favoriteFolders = ref<FavoriteFolder[]>([]);
const activeFavoriteFolderId = ref<number | null>(null);
const favoriteItems = ref<FavoriteItem[]>([]);
const showFavoriteSelector = ref(false);
const favoriteTargetApp = ref<App | null>(null);
const favoritesLoading = ref(false);
const favoritesError = ref("");
```

3. Add computed resolver:

```typescript
const resolvedFavoriteItems = computed<ResolvedFavoriteItem[]>(() =>
  resolveFavoriteItems(
    favoriteItems.value,
    apps.value,
    installedApps.value,
    availableSources.value,
    storeFilter.value,
    window.apm_store.arch || "amd64",
  ),
);
```

4. Add handlers:

```typescript
const loadFavoriteFolders = async () => {
  if (!isLoggedIn.value) return;
  favoriteFolders.value = await listFavoriteFolders();
  if (!activeFavoriteFolderId.value && favoriteFolders.value.length > 0) activeFavoriteFolderId.value = favoriteFolders.value[0].id;
};

const loadFavoriteItems = async (folderId: number) => {
  favoritesLoading.value = true;
  favoritesError.value = "";
  try {
    activeFavoriteFolderId.value = folderId;
    favoriteItems.value = await listFavoriteItems(folderId);
  } catch (error) {
    favoritesError.value = error instanceof Error ? error.message : "读取收藏失败";
  } finally {
    favoritesLoading.value = false;
  }
};

const openFavoriteSelector = async (app: App) => {
  if (!requireLogin("收藏应用需要登录星火账号。")) return;
  favoriteTargetApp.value = app;
  await loadFavoriteFolders();
  showFavoriteSelector.value = true;
};

const addCurrentFavoriteToFolder = async (folderId: number | "default") => {
  if (!favoriteTargetApp.value) return;
  const app = favoriteTargetApp.value;
  await addFavoriteItem(folderId, {
    appKey: buildFavoriteAppKey(app),
    pkgname: app.pkgname,
    name: app.name,
    category: app.category,
    iconUrl: app.icons || "",
  });
  showFavoriteSelector.value = false;
  await loadFavoriteFolders();
};

const createFavoriteFolderFromPrompt = async () => {
  const name = window.prompt("收藏夹名称");
  if (!name?.trim()) return;
  const folder = await createFavoriteFolder(name.trim());
  await loadFavoriteFolders();
  await loadFavoriteItems(folder.id);
};

const removeSelectedFavorites = async (itemIds: number[]) => {
  if (!activeFavoriteFolderId.value || itemIds.length === 0) return;
  await bulkDeleteFavoriteItems(activeFavoriteFolderId.value, itemIds);
  await loadFavoriteItems(activeFavoriteFolderId.value);
  await loadFavoriteFolders();
};

const installResolvedFavorites = async (items: ResolvedFavoriteItem[]) => {
  for (const item of items) {
    if (item.selectedApp) await onDetailInstall(item.selectedApp);
  }
};

const openFavoriteManagement = async () => {
  if (!requireLogin("我的收藏需要登录星火账号。")) return;
  currentView.value = "favorites";
  activeTab.value = "favorites";
  await loadFavoriteFolders();
  if (activeFavoriteFolderId.value) await loadFavoriteItems(activeFavoriteFolderId.value);
};
```

5. Add `FavoriteFolderSelector` near modals:

```vue
<FavoriteFolderSelector
  :show="showFavoriteSelector"
  :folders="favoriteFolders"
  @close="showFavoriteSelector = false"
  @select-folder="addCurrentFavoriteToFolder"
/>
```

6. Add favorites content branch:

```vue
<FavoriteFolderManager
  v-else-if="currentView === 'favorites'"
  :folders="favoriteFolders"
  :active-folder-id="activeFavoriteFolderId"
  :items="resolvedFavoriteItems"
  :loading="favoritesLoading"
  :error="favoritesError"
  @select-folder="loadFavoriteItems"
  @create-folder="createFavoriteFolderFromPrompt"
  @remove-selected="removeSelectedFavorites"
  @install-selected="installResolvedFavorites"
/>
```

- [ ] **Step 8: Run favorite tests**

Run: `npm run test -- src/__tests__/unit/favoriteAvailability.test.ts src/__tests__/unit/FavoriteFolderManager.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit favorites UI and resolver**

Run:

```bash
git add src/modules/favoriteAvailability.ts src/components/FavoriteFolderSelector.vue src/components/FavoriteFolderManager.vue src/App.vue src/__tests__/unit/favoriteAvailability.test.ts src/__tests__/unit/FavoriteFolderManager.test.ts
git commit -m "feat(favorites): add cloud favorite management"
```

Expected: commit succeeds.

## Task 5: Add Reviews Panel And Downloaded Record Writes

**Files:**
- Create: `src/components/ReviewsPanel.vue`
- Modify: `src/components/AppDetailPage.vue`
- Modify: `src/modules/processInstall.ts`
- Modify: `src/App.vue`
- Test: `src/__tests__/unit/ReviewsPanel.test.ts`
- Test: `src/__tests__/unit/processInstall.test.ts`

- [ ] **Step 1: Write failing ReviewsPanel test**

Create `src/__tests__/unit/ReviewsPanel.test.ts` with:

```typescript
import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import ReviewsPanel from "@/components/ReviewsPanel.vue";
import type { ReviewTags } from "@/global/typedefinition";

const tags: ReviewTags = {
  origin: "apm",
  category: "office",
  pkgname: "wps",
  version: "1.0.0",
  packageArch: "amd64",
  clientArch: "amd64",
  distro: "deepin 25",
};

describe("ReviewsPanel", () => {
  it("shows anonymous login prompt and read-only review tags", () => {
    render(ReviewsPanel, { props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: false } });

    expect(screen.getByText("登录后发表评论")).toBeTruthy();
    expect(screen.getByText("1.0.0")).toBeTruthy();
    expect(screen.getByText("deepin 25")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Extend processInstall test for queue result**

Append to `src/__tests__/unit/processInstall.test.ts`:

```typescript
  it("returns queued download metadata for account records", async () => {
    vi.doMock("axios", () => ({
      default: {
        create: vi.fn(() => ({ post: vi.fn(() => Promise.resolve({ data: { ok: true } })) })),
      },
    }));
    Object.assign(window.ipcRenderer, { on: vi.fn(), send: vi.fn(), invoke: vi.fn() });
    window.apm_store.arch = "amd64";
    const { handleInstall } = await import("@/modules/processInstall");

    const result = await handleInstall({
      name: "WPS",
      pkgname: "wps",
      version: "1.0.0",
      filename: "wps_1.0.0_amd64.deb",
      torrent_address: "",
      author: "",
      contributor: "",
      website: "",
      update: "",
      size: "",
      more: "",
      tags: "",
      img_urls: [],
      icons: "",
      category: "office",
      origin: "apm",
      currentStatus: "not-installed",
    });

    expect(result?.pkgname).toBe("wps");
    expect(result?.origin).toBe("apm");
  });
```

- [ ] **Step 3: Run review/download tests and verify failure**

Run: `npm run test -- src/__tests__/unit/ReviewsPanel.test.ts src/__tests__/unit/processInstall.test.ts`

Expected: FAIL because `ReviewsPanel` does not exist and `handleInstall` returns `undefined`.

- [ ] **Step 4: Create ReviewsPanel**

Create `src/components/ReviewsPanel.vue` with:

```vue
<template>
  <section class="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-800/30">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">评论与评分</h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">{{ summary.reviewCount }} 条评论 · 平均 {{ summary.averageRating.toFixed(1) }} 分</p>
      </div>
      <button type="button" class="text-sm font-semibold text-brand" @click="loadReviews">刷新</button>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <span v-for="tag in tagPills" :key="tag.label" class="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">{{ tag.value }}</span>
    </div>

    <div v-if="error" class="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{{ error }}</div>

    <button v-if="!loggedIn" type="button" class="mt-4 rounded-2xl border border-brand/30 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/10" @click="$emit('request-login', '评论需要登录星火账号。')">
      登录后发表评论
    </button>

    <form v-else class="mt-4 space-y-3" @submit.prevent="submit">
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-200" for="reviewRating">评分</label>
      <select id="reviewRating" v-model.number="rating" class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
        <option v-for="star in [5, 4, 3, 2, 1]" :key="star" :value="star">{{ star }} 分</option>
      </select>

      <label class="block text-sm font-medium text-slate-700 dark:text-slate-200" for="reviewContent">评论</label>
      <textarea id="reviewContent" v-model="content" class="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" maxlength="5000"></textarea>

      <button type="submit" class="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="submitting || !content.trim()">{{ submitting ? "提交中" : "提交评论" }}</button>
    </form>

    <div class="mt-5 space-y-3">
      <article v-for="review in reviews" :key="review.id" class="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
        <div class="flex items-center gap-3">
          <img v-if="review.userAvatarUrl" :src="review.userAvatarUrl" class="h-8 w-8 rounded-full" alt="" />
          <i v-else class="fas fa-user-circle text-2xl text-slate-400"></i>
          <div>
            <p class="text-sm font-semibold text-slate-900 dark:text-white">{{ review.userDisplayName }}</p>
            <p class="text-xs text-slate-500">{{ review.rating }} 分 · {{ review.version }} · {{ review.packageArch }}</p>
          </div>
        </div>
        <p class="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{{ review.content }}</p>
      </article>
      <p v-if="!loading && reviews.length === 0" class="text-sm text-slate-500">暂无评论</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import type { AppReview, RatingSummary, ReviewTags } from "@/global/typedefinition";
import { fetchRatingSummary, fetchReviews, submitReview } from "@/modules/backendApi";

const props = defineProps<{
  appKey: string;
  tags: ReviewTags;
  loggedIn: boolean;
}>();

defineEmits<{
  "request-login": [message: string];
}>();

const summary = ref<RatingSummary>({ averageRating: 0, reviewCount: 0, starCounts: {} });
const reviews = ref<AppReview[]>([]);
const loading = ref(false);
const submitting = ref(false);
const error = ref("");
const rating = ref(5);
const content = ref("");

const tagPills = computed(() => [
  { label: "版本", value: props.tags.version },
  { label: "包架构", value: props.tags.packageArch },
  { label: "本机架构", value: props.tags.clientArch },
  { label: "系统", value: props.tags.distro },
  { label: "来源", value: props.tags.origin },
  { label: "分类", value: props.tags.category },
]);

const loadReviews = async () => {
  if (!props.appKey) return;
  loading.value = true;
  error.value = "";
  try {
    const [nextSummary, nextReviews] = await Promise.all([fetchRatingSummary(props.appKey), fetchReviews(props.appKey)]);
    summary.value = nextSummary;
    reviews.value = nextReviews;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "评论加载失败";
  } finally {
    loading.value = false;
  }
};

const submit = async () => {
  submitting.value = true;
  error.value = "";
  try {
    await submitReview(props.appKey, { rating: rating.value, content: content.value, tags: props.tags });
    content.value = "";
    await loadReviews();
  } catch (err) {
    error.value = err instanceof Error ? err.message : "评论提交失败";
  } finally {
    submitting.value = false;
  }
};

watch(() => props.appKey, loadReviews);
onMounted(loadReviews);
</script>
```

- [ ] **Step 5: Mount reviews in detail page**

Modify `src/components/AppDetailPage.vue`:

1. Import `ReviewsPanel` and `ReviewTags`.
2. Add below screenshots block:

```vue
<ReviewsPanel
  v-if="reviewAppKey && reviewTags"
  :app-key="reviewAppKey"
  :tags="reviewTags"
  :logged-in="loggedIn"
  @request-login="$emit('request-login', $event)"
/>
```

- [ ] **Step 6: Return queued download from processInstall**

Modify `src/modules/processInstall.ts`:

1. Change signature:

```typescript
export const handleInstall = async (appObj?: App): Promise<DownloadItem | null> => {
```

2. Replace early bare `return;` statements with `return null;`.
3. After `window.ipcRenderer.send("queue-install", JSON.stringify(download));`, add:

```typescript
  return download;
```

4. Keep statistics POST non-blocking after the return by moving the statistics call before return or by storing the promise before return. The install queue send must remain unchanged.

- [ ] **Step 7: Record cloud downloaded apps in App.vue**

Modify `src/App.vue`:

1. Extend existing imports:

```typescript
import { buildFavoriteAppKey, buildReviewAppKey, buildReviewTags, getDisplayApp, parsePackageArch } from "./modules/appIdentity";
import { recordDownloadedApp } from "./modules/backendApi";
import type { SystemInfo } from "./global/typedefinition";
```

2. Add system info state:

```typescript
const systemInfo = ref<SystemInfo>({ distro: "unknown" });
```

3. Add computed review props:

```typescript
const currentDisplayAppForReview = computed(() => getDisplayApp(currentApp.value));
const currentReviewAppKey = computed(() => {
  const app = currentDisplayAppForReview.value;
  return app ? buildReviewAppKey(app, window.apm_store.arch || "amd64") : "";
});
const currentReviewTags = computed(() => {
  const app = currentDisplayAppForReview.value;
  return app ? buildReviewTags(app, { clientArch: window.apm_store.arch || "amd64", distro: systemInfo.value.distro }) : null;
});
```

4. On mount, before data loading completes, fetch system info:

```typescript
systemInfo.value = await window.ipcRenderer.invoke("get-system-info").catch(() => ({ distro: "unknown" }));
```

5. Replace `onDetailInstall` with:

```typescript
const onDetailInstall = async (app: App) => {
  const download = await handleInstall(app);
  if (!download || !isLoggedIn.value) return;
  try {
    await recordDownloadedApp({
      appKey: buildFavoriteAppKey(app),
      pkgname: app.pkgname,
      name: app.name,
      category: app.category,
      selectedOrigin: app.origin,
      version: app.version || "",
      packageArch: app.arch || parsePackageArch(app.filename),
    });
  } catch (error) {
    logger.warn(`记录下载历史失败: ${error}`);
  }
};
```

- [ ] **Step 8: Add system info IPC**

Modify `electron/main/index.ts` near `get-app-version`:

```typescript
const getSystemInfo = (): { distro: string } => {
  try {
    const raw = fs.readFileSync("/etc/os-release", "utf8");
    const values = Object.fromEntries(
      raw
        .split("\n")
        .filter((line) => line.includes("="))
        .map((line) => {
          const [key, ...rest] = line.split("=");
          return [key, rest.join("=").replace(/^"|"$/g, "")];
        }),
    );
    return { distro: values.PRETTY_NAME || values.NAME || values.ID || "unknown" };
  } catch {
    return { distro: "unknown" };
  }
};

ipcMain.handle("get-system-info", (): { distro: string } => getSystemInfo());
```

- [ ] **Step 9: Run review/download tests**

Run: `npm run test -- src/__tests__/unit/ReviewsPanel.test.ts src/__tests__/unit/processInstall.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit reviews and downloaded records**

Run:

```bash
git add electron/main/index.ts src/components/ReviewsPanel.vue src/components/AppDetailPage.vue src/modules/processInstall.ts src/App.vue src/__tests__/unit/ReviewsPanel.test.ts src/__tests__/unit/processInstall.test.ts
git commit -m "feat(account): record downloads and show reviews"
```

Expected: commit succeeds.

## Task 6: Add User Management, Downloaded History, And Sync Preference

**Files:**
- Create: `src/global/accountSyncState.ts`
- Create: `src/components/UserManagementView.vue`
- Modify: `src/App.vue`
- Test: `src/__tests__/unit/UserManagementView.test.ts`

- [ ] **Step 1: Write failing user management test**

Create `src/__tests__/unit/UserManagementView.test.ts` with:

```typescript
import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import UserManagementView from "@/components/UserManagementView.vue";
import type { DownloadedAppRecord, SparkUser } from "@/global/typedefinition";

const user: SparkUser = {
  id: 1,
  flarumUserId: "123",
  username: "momen",
  displayName: "Momen",
  avatarUrl: "https://bbs.spark-app.store/avatar.png",
  forumLevel: "管理员",
  forumGroups: ["管理员"],
};

const download: DownloadedAppRecord = {
  id: 1,
  appKey: "app:office:wps",
  pkgname: "wps",
  name: "WPS",
  category: "office",
  selectedOrigin: "apm",
  version: "1.0.0",
  packageArch: "amd64",
  downloadedAt: "2026-05-18T00:00:00Z",
};

describe("UserManagementView", () => {
  it("renders profile, forum level, links, downloads, and sync preference", () => {
    render(UserManagementView, {
      props: { user, downloadedApps: [download], syncEnabled: true, loading: false, error: "" },
    });

    expect(screen.getByText("Momen")).toBeTruthy();
    expect(screen.getByText("管理员")).toBeTruthy();
    expect(screen.getByText("论坛首页")).toBeTruthy();
    expect(screen.getByText("修改论坛资料")).toBeTruthy();
    expect(screen.getByText("WPS")).toBeTruthy();
    expect(screen.getByLabelText("自动同步已安装应用")).toBeChecked();
  });
});
```

- [ ] **Step 2: Run user management test and verify failure**

Run: `npm run test -- src/__tests__/unit/UserManagementView.test.ts`

Expected: FAIL because `UserManagementView` does not exist.

- [ ] **Step 3: Add sync preference helper**

Create `src/global/accountSyncState.ts` with:

```typescript
import { ref, watch } from "vue";

const STORAGE_KEY = "spark-store-installed-sync-enabled";

const readSyncEnabled = (): boolean | null => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
};

export const installedSyncEnabled = ref<boolean | null>(readSyncEnabled());

export const setInstalledSyncEnabled = (enabled: boolean) => {
  installedSyncEnabled.value = enabled;
  localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
};

watch(installedSyncEnabled, (enabled) => {
  if (enabled === null) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
});
```

- [ ] **Step 4: Create user management view**

Create `src/components/UserManagementView.vue` with:

```vue
<template>
  <section class="mx-auto max-w-5xl space-y-6">
    <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <img v-if="user.avatarUrl" :src="user.avatarUrl" class="h-20 w-20 rounded-3xl object-cover" alt="" />
        <div v-else class="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 dark:bg-slate-800"><i class="fas fa-user text-3xl text-slate-400"></i></div>
        <div class="min-w-0 flex-1">
          <h2 class="text-2xl font-semibold text-slate-900 dark:text-white">{{ user.displayName || user.username }}</h2>
          <p class="mt-1 text-sm text-slate-500">{{ user.username }} · {{ user.forumLevel }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700" @click="$emit('open-forum')">论坛首页</button>
          <button type="button" class="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700" @click="$emit('edit-profile')">修改论坛资料</button>
        </div>
      </div>
    </div>

    <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <label class="flex items-center justify-between gap-4">
        <span>
          <span class="block text-base font-semibold text-slate-900 dark:text-white">自动同步已安装应用</span>
          <span class="block text-sm text-slate-500">启动后仅同步商店识别的非依赖应用。</span>
        </span>
        <input type="checkbox" :checked="syncEnabled" aria-label="自动同步已安装应用" @change="$emit('toggle-sync', ($event.target as HTMLInputElement).checked)" />
      </label>
      <button type="button" class="mt-4 rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white" @click="$emit('sync-now')">立即同步</button>
    </div>

    <div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold text-slate-900 dark:text-white">下载历史</h3>
        <button type="button" class="text-sm font-semibold text-brand" @click="$emit('refresh-downloads')">刷新</button>
      </div>
      <p v-if="loading" class="mt-4 text-sm text-slate-500">正在加载…</p>
      <p v-else-if="error" class="mt-4 text-sm text-rose-600">{{ error }}</p>
      <p v-else-if="downloadedApps.length === 0" class="mt-4 text-sm text-slate-500">暂无下载历史</p>
      <div v-else class="mt-4 space-y-3">
        <div v-for="item in downloadedApps" :key="item.id" class="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
          <p class="font-semibold text-slate-900 dark:text-white">{{ item.name || item.pkgname }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ item.pkgname }} · {{ item.selectedOrigin.toUpperCase() }} · {{ item.version }} · {{ item.packageArch }}</p>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DownloadedAppRecord, SparkUser } from "@/global/typedefinition";

defineProps<{
  user: SparkUser;
  downloadedApps: DownloadedAppRecord[];
  syncEnabled: boolean;
  loading: boolean;
  error: string;
}>();

defineEmits<{
  "open-forum": [];
  "edit-profile": [];
  "toggle-sync": [enabled: boolean];
  "sync-now": [];
  "refresh-downloads": [];
}>();
</script>
```

- [ ] **Step 5: Wire user management in App.vue**

Modify `src/App.vue`:

1. Import:

```typescript
import UserManagementView from "./components/UserManagementView.vue";
import { installedSyncEnabled, setInstalledSyncEnabled } from "./global/accountSyncState";
import { listDownloadedApps } from "./modules/backendApi";
import type { DownloadedAppRecord } from "./global/typedefinition";
```

2. Add state:

```typescript
const downloadedApps = ref<DownloadedAppRecord[]>([]);
const downloadedLoading = ref(false);
const downloadedError = ref("");
```

3. Add handler:

```typescript
const loadDownloadedHistory = async () => {
  if (!isLoggedIn.value) return;
  downloadedLoading.value = true;
  downloadedError.value = "";
  try {
    const list = await listDownloadedApps(1, 50);
    downloadedApps.value = list.items;
  } catch (error) {
    downloadedError.value = error instanceof Error ? error.message : "读取下载历史失败";
  } finally {
    downloadedLoading.value = false;
  }
};
```

4. Change `openUserManagement` to:

```typescript
const openUserManagement = async () => {
  if (!requireLogin("用户管理需要登录星火账号。")) return;
  currentView.value = "account";
  activeTab.value = "account";
  await loadDownloadedHistory();
};
```

5. Add content branch before favorites branch:

```vue
<UserManagementView
  v-else-if="currentView === 'account' && currentUser"
  :user="currentUser"
  :downloaded-apps="downloadedApps"
  :sync-enabled="installedSyncEnabled === true"
  :loading="downloadedLoading"
  :error="downloadedError"
  @open-forum="openExternalUrl(FLARUM_BASE_URL)"
  @edit-profile="openExternalUrl(FLARUM_SETTINGS_URL)"
  @toggle-sync="setInstalledSyncEnabled"
  @refresh-downloads="loadDownloadedHistory"
/>
```

- [ ] **Step 6: Run user management tests**

Run: `npm run test -- src/__tests__/unit/UserManagementView.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit user management**

Run:

```bash
git add src/global/accountSyncState.ts src/components/UserManagementView.vue src/App.vue src/__tests__/unit/UserManagementView.test.ts
git commit -m "feat(account): add user management view"
```

Expected: commit succeeds.

## Task 7: Add Installed-App Cloud Sync And Restore

**Files:**
- Create: `src/modules/appListSync.ts`
- Create: `src/components/AppListRestoreModal.vue`
- Modify: `src/components/InstalledAppsModal.vue`
- Modify: `src/App.vue`
- Test: `src/__tests__/unit/appListSync.test.ts`
- Test: `src/__tests__/unit/AppListRestoreModal.test.ts`
- Test: `src/__tests__/unit/InstalledAppsModal.test.ts`

- [ ] **Step 1: Write failing app-list sync test**

Create `src/__tests__/unit/appListSync.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";

import { buildSyncItems } from "@/modules/appListSync";
import type { App } from "@/global/typedefinition";

const baseApp: App = {
  name: "Spark Notes",
  pkgname: "spark-notes",
  version: "1.0.0",
  filename: "spark-notes_1.0.0_amd64.deb",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "",
  more: "",
  tags: "",
  img_urls: [],
  icons: "https://example.invalid/icon.png",
  category: "office",
  origin: "spark",
  currentStatus: "installed",
};

describe("appListSync", () => {
  it("syncs only store-recognized non-dependency apps", () => {
    const items = buildSyncItems([
      baseApp,
      { ...baseApp, pkgname: "unknown", category: "unknown" },
      { ...baseApp, pkgname: "dep", isDependency: true },
      { ...baseApp, pkgname: "not-installed", currentStatus: "not-installed" },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ pkgname: "spark-notes", origin: "spark", category: "office" });
  });
});
```

- [ ] **Step 2: Write failing restore modal test**

Create `src/__tests__/unit/AppListRestoreModal.test.ts` with:

```typescript
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import AppListRestoreModal from "@/components/AppListRestoreModal.vue";

describe("AppListRestoreModal", () => {
  it("emits selected installable items", async () => {
    const rendered = render(AppListRestoreModal, {
      props: {
        show: true,
        loading: false,
        error: "",
        items: [{ pkgname: "spark-notes", origin: "spark", category: "office", version: "1.0.0", packageArch: "amd64", appName: "Spark Notes", iconUrl: "" }],
        installedKeys: [],
      },
    });

    await fireEvent.click(screen.getByLabelText("选择 Spark Notes"));
    await fireEvent.click(screen.getByRole("button", { name: "加入安装队列" }));

    expect(rendered.emitted("install-selected")?.[0]?.[0]).toHaveLength(1);
  });
});
```

- [ ] **Step 3: Run sync/restore tests and verify failure**

Run: `npm run test -- src/__tests__/unit/appListSync.test.ts src/__tests__/unit/AppListRestoreModal.test.ts`

Expected: FAIL because module/component do not exist.

- [ ] **Step 4: Add sync filtering module**

Create `src/modules/appListSync.ts` with:

```typescript
import type { App, SyncedAppListItem } from "@/global/typedefinition";
import { parsePackageArch } from "@/modules/appIdentity";

export const buildSyncItems = (apps: App[]): SyncedAppListItem[] => {
  return apps
    .filter((app) => app.currentStatus === "installed")
    .filter((app) => app.category !== "unknown")
    .filter((app) => !app.isDependency)
    .filter((app) => Boolean(app.pkgname && app.origin))
    .map((app) => ({
      pkgname: app.pkgname,
      origin: app.origin,
      category: app.category,
      version: app.version || "",
      packageArch: app.arch || parsePackageArch(app.filename),
      appName: app.name || app.pkgname,
      iconUrl: app.icons || "",
    }));
};

export const cloudItemKey = (item: Pick<SyncedAppListItem, "origin" | "pkgname">): string => `${item.origin}:${item.pkgname}`;
```

- [ ] **Step 5: Create restore modal**

Create `src/components/AppListRestoreModal.vue` with:

```vue
<template>
  <Transition enter-active-class="duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="show" class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/60 p-4" @click.self="$emit('close')">
      <div class="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-xl font-semibold text-slate-900 dark:text-white">从账号恢复</h2>
          <button type="button" aria-label="关闭" @click="$emit('close')"><i class="fas fa-xmark"></i></button>
        </div>
        <p v-if="loading" class="mt-6 text-sm text-slate-500">正在读取云端列表…</p>
        <p v-else-if="error" class="mt-6 text-sm text-rose-600">{{ error }}</p>
        <div v-else class="mt-6 flex-1 space-y-3 overflow-y-auto">
          <label v-for="item in items" :key="`${item.origin}:${item.pkgname}`" class="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
            <input v-model="selected" type="checkbox" :value="`${item.origin}:${item.pkgname}`" :disabled="installedKeys.includes(`${item.origin}:${item.pkgname}`)" :aria-label="`选择 ${item.appName || item.pkgname}`" />
            <span class="flex-1 font-semibold text-slate-900 dark:text-white">{{ item.appName || item.pkgname }}</span>
            <span class="text-xs text-slate-500">{{ item.origin.toUpperCase() }}</span>
          </label>
        </div>
        <button type="button" class="mt-6 rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white disabled:opacity-40" :disabled="selectedItems.length === 0" @click="$emit('install-selected', selectedItems)">加入安装队列</button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { SyncedAppListItem } from "@/global/typedefinition";

const props = defineProps<{
  show: boolean;
  loading: boolean;
  error: string;
  items: SyncedAppListItem[];
  installedKeys: string[];
}>();

defineEmits<{
  close: [];
  "install-selected": [items: SyncedAppListItem[]];
}>();

const selected = ref<string[]>([]);
const selectedItems = computed(() => props.items.filter((item) => selected.value.includes(`${item.origin}:${item.pkgname}`)));

watch(() => props.show, () => {
  selected.value = [];
});
</script>
```

- [ ] **Step 6: Add sync buttons to InstalledAppsModal**

Modify `src/components/InstalledAppsModal.vue`:

1. Add props:

```typescript
  loggedIn: boolean;
  syncing: boolean;
```

2. Add emits:

```typescript
  (e: "sync-to-account"): void;
  (e: "restore-from-account"): void;
  (e: "request-login"): void;
```

3. Add buttons before `刷新`:

```vue
<button type="button" class="inline-flex items-center gap-2 rounded-2xl border border-brand/30 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-40" :disabled="syncing" @click="loggedIn ? $emit('sync-to-account') : $emit('request-login')">
  <i class="fas fa-cloud-upload-alt"></i>
  {{ syncing ? "同步中" : "同步到账号" }}
</button>
<button type="button" class="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800" @click="loggedIn ? $emit('restore-from-account') : $emit('request-login')">
  <i class="fas fa-cloud-download-alt"></i>
  从账号恢复
</button>
```

4. Update every `InstalledAppsModal.test.ts` render props to include `loggedIn: false` and `syncing: false`.

- [ ] **Step 7: Wire sync/restore and startup prompt in App.vue**

Modify `src/App.vue`:

1. Import:

```typescript
import AppListRestoreModal from "./components/AppListRestoreModal.vue";
import { buildSyncItems, cloudItemKey } from "./modules/appListSync";
import { fetchSyncedAppList, uploadSyncedAppList } from "./modules/backendApi";
import type { SyncedAppListItem } from "./global/typedefinition";
```

2. Add state:

```typescript
const syncLoading = ref(false);
const restoreLoading = ref(false);
const restoreError = ref("");
const showRestoreModal = ref(false);
const restoreItems = ref<SyncedAppListItem[]>([]);
```

3. Add computed installed keys:

```typescript
const installedCloudKeys = computed(() => installedApps.value.map((app) => `${app.origin}:${app.pkgname}`));
```

4. Pass props/events to `InstalledAppsModal`:

```vue
:logged-in="isLoggedIn"
:syncing="syncLoading"
@sync-to-account="syncInstalledAppsToAccount"
@restore-from-account="openRestoreFromAccount"
@request-login="requireLogin('云端同步需要登录星火账号。')"
```

5. Mount restore modal:

```vue
<AppListRestoreModal
  :show="showRestoreModal"
  :loading="restoreLoading"
  :error="restoreError"
  :items="restoreItems"
  :installed-keys="installedCloudKeys"
  @close="showRestoreModal = false"
  @install-selected="installCloudItems"
/>
```

6. Add the real sync handlers:

```typescript
const syncInstalledAppsToAccount = async () => {
  if (!requireLogin("云端同步需要登录星火账号。")) return;
  syncLoading.value = true;
  try {
    const items = buildSyncItems(installedApps.value);
    await uploadSyncedAppList({ clientArch: window.apm_store.arch || "amd64", distro: systemInfo.value.distro, items });
  } finally {
    syncLoading.value = false;
  }
};

const openRestoreFromAccount = async () => {
  if (!requireLogin("从账号恢复应用需要登录星火账号。")) return;
  restoreLoading.value = true;
  restoreError.value = "";
  showRestoreModal.value = true;
  try {
    const list = await fetchSyncedAppList();
    restoreItems.value = list?.items || [];
  } catch (error) {
    restoreError.value = error instanceof Error ? error.message : "读取云端列表失败";
  } finally {
    restoreLoading.value = false;
  }
};

const installCloudItems = async (items: SyncedAppListItem[]) => {
  for (const item of items) {
    const app = apps.value.find((candidate) => candidate.pkgname === item.pkgname && candidate.origin === item.origin && candidate.category === item.category);
    if (app) await onDetailInstall(app);
  }
};
```

7. Add `@sync-now="syncInstalledAppsToAccount"` to the existing `UserManagementView` branch created in Task 6.

8. After catalog load completes in `onMounted`, add:

```typescript
if (isLoggedIn.value && installedSyncEnabled.value === null) {
  const enabled = window.confirm("是否启用已安装应用列表自动同步到星火账号？仅同步商店识别的非依赖应用。");
  setInstalledSyncEnabled(enabled);
}
if (isLoggedIn.value && installedSyncEnabled.value === true) {
  await refreshInstalledApps();
  await syncInstalledAppsToAccount();
}
```

- [ ] **Step 8: Run sync tests**

Run:

```bash
npm run test -- src/__tests__/unit/appListSync.test.ts src/__tests__/unit/AppListRestoreModal.test.ts src/__tests__/unit/InstalledAppsModal.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit installed sync and restore**

Run:

```bash
git add src/modules/appListSync.ts src/components/AppListRestoreModal.vue src/components/InstalledAppsModal.vue src/App.vue src/__tests__/unit/appListSync.test.ts src/__tests__/unit/AppListRestoreModal.test.ts src/__tests__/unit/InstalledAppsModal.test.ts
git commit -m "feat(sync): add installed app cloud sync"
```

Expected: commit succeeds.

## Task 8: Final Client Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run account-related unit tests**

Run:

```bash
npm run test -- src/__tests__/unit/accountTypes.test.ts src/__tests__/unit/authState.test.ts src/__tests__/unit/LoginModal.test.ts src/__tests__/unit/AppSidebar.account.test.ts src/__tests__/unit/appIdentity.test.ts src/__tests__/unit/AppDetailPage.test.ts src/__tests__/unit/favoriteAvailability.test.ts src/__tests__/unit/FavoriteFolderManager.test.ts src/__tests__/unit/ReviewsPanel.test.ts src/__tests__/unit/UserManagementView.test.ts src/__tests__/unit/appListSync.test.ts src/__tests__/unit/AppListRestoreModal.test.ts src/__tests__/unit/InstalledAppsModal.test.ts src/__tests__/unit/processInstall.test.ts
```

Expected: all listed tests PASS.

- [ ] **Step 2: Run full unit suite**

Run: `npm run test -- --run`

Expected: all unit tests PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: exits 0.

- [ ] **Step 4: Run Vite build**

Run: `npm run build:vite`

Expected: exits 0.

- [ ] **Step 5: Check worktree**

Run: `git status --short --branch`

Expected: branch shows only intentional commits and no `.superpowers/` artifacts.

## Self-Review Checklist

Spec coverage:

- Clean client repo/worktree requirement: file structure and final verification assume `/home/spark/Desktop/shenmo-spark-store/spark-store`.
- Forum login and external registration: Task 2.
- Sidebar account entry, avatar/name, and quick menu: Task 2.
- Anonymous base browsing/search/detail/install/remove/update/installed viewing: Tasks 2, 3, 5, and 7 gate only account-only actions.
- Detail page inside content area with back: Task 3.
- Favorite add, folder selection, default folder: Task 4.
- Favorites as app-level identities: Tasks 3 and 4 use `app:{category}:{pkgname}`.
- Downlisted/unavailable favorite visibility and bulk remove: Task 4.
- Batch install from favorites using current priority: Task 4 resolver uses `getHybridDefaultOrigin` and source availability.
- Reviews/comments with anonymous prompt: Task 5.
- Downloaded records written only for logged-in installs: Task 5.
- User management profile, forum level, links, downloads, sync preference: Task 6.
- Startup installed sync ask-once and non-dependency store-recognized filtering: Task 7.
- Existing install/update IPC contracts preserved: Tasks 5 and 7 reuse `handleInstall` and do not alter queue payload schema.

Placeholder scan:

- No `TBD`, `TODO`, `implement later`, or placeholder test bodies remain.
- Long component tasks include concrete code blocks for the behavior under test; existing surrounding markup can be adjusted during implementation without changing the defined contracts.

Type consistency:

- Backend snake_case fields are mapped to client camelCase only inside `backendApi.ts`.
- Favorite key is always `app:{category}:{pkgname}`.
- Review key remains `{origin}:{store_arch}:{category}:{pkgname}`.
- `window.apm_store.arch` is treated as bare architecture such as `amd64`.
- Store filter uses existing `StoreFilter = "spark" | "apm" | "both"`.
