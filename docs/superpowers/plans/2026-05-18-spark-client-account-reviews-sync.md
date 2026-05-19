# Spark Client Account Reviews Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Spark Store's Electron/Vue client with the new backend for Flarum login, profile display, app reviews/ratings, immutable review tags, and user app-list sync/restore.

**Architecture:** Keep backend API access in focused TypeScript modules, keep global auth state in one Vue module, and add small child components instead of expanding the already-large `AppDetailModal.vue` and `InstalledAppsModal.vue`. Local system facts such as distro are exposed through Electron IPC and combined with app metadata to create immutable review tags.

**Tech Stack:** Electron 40, Vue 3 Composition API, TypeScript strict mode, Axios, Vitest, Testing Library Vue, existing IPC facade and install queue.

---

## File Structure

Existing files to modify:

- Modify: `.gitignore` - ignore `.superpowers/` visual companion artifacts.
- Modify: `electron/main/index.ts` - add `get-system-info` IPC handler that safely reads `/etc/os-release`.
- Modify: `src/vite-env.d.ts` - add auth/backend/system-info types.
- Modify: `src/global/typedefinition.ts` - add user, review, rating, app-list sync types.
- Modify: `src/global/storeConfig.ts` - add `SPARK_BACKEND_BASE_URL` config.
- Modify: `src/components/AppHeader.vue` - show login/profile action.
- Modify: `src/components/AppDetailModal.vue` - mount `ReviewsPanel` with the active display app.
- Modify: `src/components/InstalledAppsModal.vue` - add sync/restore action buttons and restore modal entry events.
- Modify: `src/App.vue` - coordinate auth modal, review props, app-list sync/restore flow, and system info loading.
- Modify: `src/__tests__/setup.ts` - extend window mocks.

New files to create:

- Create: `src/global/authState.ts` - auth state, persistence, login/logout helpers.
- Create: `src/modules/backendApi.ts` - Axios client and backend request helpers.
- Create: `src/modules/reviewTags.ts` - immutable review tag construction and app key creation.
- Create: `src/modules/appListSync.ts` - store-recognized installed-app filtering and restore-plan helpers.
- Create: `src/components/LoginModal.vue` - Flarum login UI.
- Create: `src/components/ReviewsPanel.vue` - rating summary, filters, review list, composer.
- Create: `src/components/AppListRestoreModal.vue` - cloud app-list restore selector.
- Create: `src/__tests__/unit/reviewTags.test.ts` - immutable tag tests.
- Create: `src/__tests__/unit/appListSync.test.ts` - sync filtering tests.
- Create: `src/__tests__/unit/LoginModal.test.ts` - login UI tests.
- Create: `src/__tests__/unit/ReviewsPanel.test.ts` - review panel state tests.
- Create: `src/__tests__/unit/AppListRestoreModal.test.ts` - restore modal tests.

## Task 1: Add Backend Config And Shared Types

**Files:**
- Modify: `.gitignore`
- Modify: `src/global/storeConfig.ts`
- Modify: `src/global/typedefinition.ts`
- Modify: `src/vite-env.d.ts`
- Test: `src/__tests__/setup.ts`

- [ ] **Step 1: Write type/import smoke test**

Create `src/__tests__/unit/accountTypes.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";

import { SPARK_BACKEND_BASE_URL } from "@/global/storeConfig";
import type { ReviewTags, SparkUser } from "@/global/typedefinition";

describe("account backend types", () => {
  it("exports backend url and account types", () => {
    const user: SparkUser = {
      id: 1,
      flarumUserId: "123",
      username: "momen",
      displayName: "Momen",
      avatarUrl: "https://bbs.spark-app.store/avatar.png",
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
    expect(user.displayName).toBe("Momen");
    expect(tags.packageArch).toBe("amd64");
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/__tests__/unit/accountTypes.test.ts`

Expected: FAIL because `SPARK_BACKEND_BASE_URL`, `SparkUser`, and `ReviewTags` do not exist.

- [ ] **Step 3: Ignore visual companion artifacts**

Modify `.gitignore` by adding:

```gitignore
.superpowers/
```

- [ ] **Step 4: Add backend config**

Modify `src/global/storeConfig.ts` by adding after `APM_STORE_STATS_BASE_URL`:

```typescript
export const SPARK_BACKEND_BASE_URL: string =
  import.meta.env.VITE_SPARK_BACKEND_BASE_URL || "";
```

- [ ] **Step 5: Add shared account types**

Append to `src/global/typedefinition.ts`:

```typescript
export interface SparkUser {
  id: number;
  flarumUserId: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface AuthSession {
  accessToken: string;
  tokenType: "bearer";
  user: SparkUser;
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

- [ ] **Step 6: Extend environment declarations**

Modify `src/vite-env.d.ts` by adding to `ImportMetaEnv`:

```typescript
interface ImportMetaEnv {
  readonly VITE_SPARK_BACKEND_BASE_URL?: string;
}
```

- [ ] **Step 7: Extend test setup mocks**

Modify `src/__tests__/setup.ts` so `window.apm_store.arch` is `amd64`, not `amd64-store`, and `ipcRenderer.invoke` can be overridden per test:

```typescript
Object.defineProperty(window, "apm_store", {
  value: {
    arch: "amd64",
  },
  writable: true,
});
```

- [ ] **Step 8: Run test to verify pass**

Run: `npm run test -- src/__tests__/unit/accountTypes.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit shared config/types**

Run:

```bash
git add .gitignore src/global/storeConfig.ts src/global/typedefinition.ts src/vite-env.d.ts src/__tests__/setup.ts src/__tests__/unit/accountTypes.test.ts
git commit -m "feat(account): add backend config and types"
```

Expected: commit succeeds if the user requested commits for implementation execution.

## Task 2: Add Backend API Client And Auth State

**Files:**
- Create: `src/modules/backendApi.ts`
- Create: `src/global/authState.ts`
- Test: `src/__tests__/unit/authState.test.ts`

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
    const { authSession, setAuthSession, logout } = await import("@/global/authState");

    setAuthSession({
      accessToken: "jwt",
      tokenType: "bearer",
      user: {
        id: 1,
        flarumUserId: "123",
        username: "momen",
        displayName: "Momen",
        avatarUrl: "https://bbs.spark-app.store/avatar.png",
      },
    });

    expect(authSession.value?.accessToken).toBe("jwt");
    expect(JSON.parse(localStorage.getItem("spark-store-auth") || "{}").accessToken).toBe("jwt");

    logout();

    expect(authSession.value).toBeNull();
    expect(localStorage.getItem("spark-store-auth")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/__tests__/unit/authState.test.ts`

Expected: FAIL because `authState` module does not exist.

- [ ] **Step 3: Add backend API client**

Create `src/modules/backendApi.ts` with:

```typescript
import axios from "axios";

import { SPARK_BACKEND_BASE_URL } from "@/global/storeConfig";
import type {
  AppReview,
  AuthSession,
  RatingSummary,
  ReviewTags,
  SyncedAppList,
  SyncedAppListItem,
} from "@/global/typedefinition";

const backend = axios.create({
  baseURL: SPARK_BACKEND_BASE_URL,
  timeout: 10000,
});

export const setBackendToken = (token: string | null) => {
  if (token) {
    backend.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete backend.defaults.headers.common.Authorization;
  }
};

const toCamelReview = (raw: Record<string, unknown>): AppReview => ({
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

export const exchangeFlarumToken = async (payload: {
  flarumUserId: string;
  flarumToken: string;
}): Promise<AuthSession> => {
  const response = await backend.post("/auth/flarum", {
    flarum_user_id: payload.flarumUserId,
    flarum_token: payload.flarumToken,
  });
  const data = response.data;
  return {
    accessToken: data.access_token,
    tokenType: data.token_type,
    user: {
      id: data.user.id,
      flarumUserId: data.user.flarum_user_id,
      username: data.user.username,
      displayName: data.user.display_name,
      avatarUrl: data.user.avatar_url,
    },
  };
};

export const fetchRatingSummary = async (appKey: string): Promise<RatingSummary> => {
  const response = await backend.get(`/apps/${encodeURIComponent(appKey)}/rating-summary`);
  return {
    averageRating: Number(response.data.average_rating || 0),
    reviewCount: Number(response.data.review_count || 0),
    starCounts: response.data.star_counts || {},
  };
};

export const fetchReviews = async (appKey: string, params: Record<string, string | number | undefined>): Promise<AppReview[]> => {
  const response = await backend.get(`/apps/${encodeURIComponent(appKey)}/reviews`, { params });
  return (response.data || []).map((item: Record<string, unknown>) => toCamelReview(item));
};

export const submitReview = async (appKey: string, payload: { rating: number; content: string; tags: ReviewTags }): Promise<AppReview> => {
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
  return toCamelReview(response.data);
};

export const fetchSyncedAppList = async (): Promise<SyncedAppList | null> => {
  const response = await backend.get("/me/app-list");
  if (!response.data) return null;
  return {
    snapshotName: response.data.snapshot_name,
    clientArch: response.data.client_arch,
    distro: response.data.distro,
    updatedAt: response.data.updated_at,
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
  return response.data;
};
```

- [ ] **Step 4: Add auth state**

Create `src/global/authState.ts` with:

```typescript
import { computed, ref } from "vue";

import { setBackendToken } from "@/modules/backendApi";
import type { AuthSession } from "@/global/typedefinition";

const STORAGE_KEY = "spark-store-auth";

const readStoredSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    if (!parsed.accessToken || !parsed.user) return null;
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

- [ ] **Step 5: Run auth state test and verify pass**

Run: `npm run test -- src/__tests__/unit/authState.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit API/auth state**

Run:

```bash
git add src/modules/backendApi.ts src/global/authState.ts src/__tests__/unit/authState.test.ts
git commit -m "feat(account): add backend api and auth state"
```

Expected: commit succeeds if commits are requested for implementation execution.

## Task 3: Add Flarum Login Modal And Header Account UI

**Files:**
- Create: `src/components/LoginModal.vue`
- Modify: `src/components/AppHeader.vue`
- Modify: `src/App.vue`
- Test: `src/__tests__/unit/LoginModal.test.ts`

- [ ] **Step 1: Write failing LoginModal test**

Create `src/__tests__/unit/LoginModal.test.ts` with:

```typescript
import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";

import LoginModal from "@/components/LoginModal.vue";

describe("LoginModal", () => {
  it("emits login credentials", async () => {
    const rendered = render(LoginModal, {
      props: { show: true, loading: false, error: "" },
    });

    await fireEvent.update(screen.getByLabelText("论坛账号"), "momen");
    await fireEvent.update(screen.getByLabelText("论坛密码"), "secret");
    await fireEvent.click(screen.getByRole("button", { name: "登录" }));

    expect(rendered.emitted("login")?.[0]?.[0]).toEqual({ identification: "momen", password: "secret" });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/__tests__/unit/LoginModal.test.ts`

Expected: FAIL because `LoginModal.vue` does not exist.

- [ ] **Step 3: Create LoginModal component**

Create `src/components/LoginModal.vue` with:

```vue
<template>
  <Transition enter-active-class="duration-200 ease-out" enter-from-class="opacity-0" enter-to-class="opacity-100" leave-active-class="duration-150 ease-in" leave-from-class="opacity-100" leave-to-class="opacity-0">
    <div v-if="show" class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/70 p-4" @click.self="$emit('close')">
      <form class="w-full max-w-md rounded-3xl border border-white/10 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submit">
        <div class="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 class="text-xl font-semibold text-slate-900 dark:text-white">登录星火账号</h2>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">使用 bbs.spark-app.store 论坛账号登录</p>
          </div>
          <button type="button" class="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" @click="$emit('close')" aria-label="关闭">
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <label class="block text-sm font-medium text-slate-700 dark:text-slate-200" for="flarumAccount">论坛账号</label>
        <input id="flarumAccount" v-model="identification" class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-800" autocomplete="username" />

        <label class="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200" for="flarumPassword">论坛密码</label>
        <input id="flarumPassword" v-model="password" type="password" class="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-brand dark:border-slate-700 dark:bg-slate-800" autocomplete="current-password" />

        <p v-if="error" class="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">{{ error }}</p>

        <button type="submit" class="mt-6 w-full rounded-2xl bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark disabled:opacity-50" :disabled="loading || !identification.trim() || !password">
          {{ loading ? "登录中..." : "登录" }}
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

- [ ] **Step 4: Run LoginModal test and verify pass**

Run: `npm run test -- src/__tests__/unit/LoginModal.test.ts`

Expected: PASS.

- [ ] **Step 5: Add account UI props to header**

Modify `src/components/AppHeader.vue` props and emits:

```typescript
import type { SparkUser } from "@/global/typedefinition";

const props = defineProps<{
  searchQuery: string;
  activeTab: string;
  appsCount: number;
  currentUser: SparkUser | null;
}>();

const emit = defineEmits<{
  (e: "update-search", query: string): void;
  (e: "search-focus"): void;
  (e: "open-install-settings"): void;
  (e: "open-about"): void;
  (e: "toggle-sidebar"): void;
  (e: "login"): void;
  (e: "logout"): void;
}>();
```

Add a button after the About button:

```vue
<button
  v-if="!currentUser"
  type="button"
  class="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/80 px-3 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
  @click="$emit('login')"
  title="登录"
>
  <i class="fas fa-user"></i>
  <span class="hidden sm:inline">登录</span>
</button>
<button
  v-else
  type="button"
  class="inline-flex h-10 shrink-0 items-center gap-2 rounded-2xl border border-slate-200/70 bg-white/80 px-3 text-sm font-semibold text-slate-600 shadow-sm backdrop-blur transition hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:bg-slate-800"
  @click="$emit('logout')"
  title="退出登录"
>
  <img v-if="currentUser.avatarUrl" :src="currentUser.avatarUrl" class="h-6 w-6 rounded-full" alt="" />
  <i v-else class="fas fa-user-circle"></i>
  <span class="hidden max-w-24 truncate sm:inline">{{ currentUser.displayName || currentUser.username }}</span>
</button>
```

- [ ] **Step 6: Wire login modal in App.vue**

Modify `src/App.vue` to import `LoginModal`, `currentUser`, `setAuthSession`, `logout`, and `exchangeFlarumToken`. Add state:

```typescript
const showLoginModal = ref(false);
const loginLoading = ref(false);
const loginError = ref("");
```

Pass `:current-user="currentUser"` to `AppHeader`, add `@login="showLoginModal = true"` and `@logout="logout"`, and mount:

```vue
<LoginModal
  :show="showLoginModal"
  :loading="loginLoading"
  :error="loginError"
  @close="showLoginModal = false"
  @login="handleFlarumLogin"
/>
```

Add handler:

```typescript
const handleFlarumLogin = async (payload: { identification: string; password: string }) => {
  loginLoading.value = true;
  loginError.value = "";
  try {
    const response = await axios.post("https://bbs.spark-app.store/api/token", {
      identification: payload.identification,
      password: payload.password,
    });
    const session = await exchangeFlarumToken({
      flarumUserId: String(response.data.userId),
      flarumToken: String(response.data.token),
    });
    setAuthSession(session);
    showLoginModal.value = false;
  } catch (error) {
    loginError.value = error instanceof Error ? error.message : "登录失败";
  } finally {
    loginLoading.value = false;
  }
};
```

- [ ] **Step 7: Run targeted tests**

Run: `npm run test -- src/__tests__/unit/LoginModal.test.ts src/__tests__/unit/authState.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit login UI**

Run:

```bash
git add src/components/LoginModal.vue src/components/AppHeader.vue src/App.vue src/__tests__/unit/LoginModal.test.ts
git commit -m "feat(account): add Flarum login UI"
```

Expected: commit succeeds if commits are requested for implementation execution.

## Task 4: Add System Info IPC And Immutable Review Tags

**Files:**
- Modify: `electron/main/index.ts`
- Create: `src/modules/reviewTags.ts`
- Test: `src/__tests__/unit/reviewTags.test.ts`

- [ ] **Step 1: Write failing review tag tests**

Create `src/__tests__/unit/reviewTags.test.ts` with:

```typescript
import { describe, expect, it } from "vitest";

import { buildAppKey, buildReviewTags, parsePackageArch } from "@/modules/reviewTags";
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
  currentStatus: "installed",
};

describe("reviewTags", () => {
  it("builds stable app keys", () => {
    expect(buildAppKey(app, "amd64")).toBe("apm:amd64-apm:office:wps");
  });

  it("parses package architecture from deb filename", () => {
    expect(parsePackageArch("wps_1.0.0_amd64.deb")).toBe("amd64");
  });

  it("builds immutable review tags", () => {
    expect(buildReviewTags(app, { clientArch: "amd64", distro: "deepin 25" })).toEqual({
      origin: "apm",
      category: "office",
      pkgname: "wps",
      version: "1.0.0",
      packageArch: "amd64",
      clientArch: "amd64",
      distro: "deepin 25",
    });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/__tests__/unit/reviewTags.test.ts`

Expected: FAIL because `reviewTags` module does not exist.

- [ ] **Step 3: Add review tag module**

Create `src/modules/reviewTags.ts` with:

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

export const buildAppKey = (app: App, clientArch: string): string => {
  return `${app.origin}:${buildStoreArch(app.origin, clientArch)}:${app.category}:${app.pkgname}`;
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

- [ ] **Step 4: Add system info IPC**

Modify `electron/main/index.ts` by adding near `get-app-version`:

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
    const name = values.PRETTY_NAME || values.NAME || values.ID || "unknown";
    return { distro: name };
  } catch {
    return { distro: "unknown" };
  }
};

ipcMain.handle("get-system-info", (): { distro: string } => getSystemInfo());
```

- [ ] **Step 5: Run review tag tests and verify pass**

Run: `npm run test -- src/__tests__/unit/reviewTags.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit tags/system info**

Run:

```bash
git add electron/main/index.ts src/modules/reviewTags.ts src/__tests__/unit/reviewTags.test.ts
git commit -m "feat(reviews): add immutable review tags"
```

Expected: commit succeeds if commits are requested for implementation execution.

## Task 5: Add ReviewsPanel To App Detail Modal

**Files:**
- Create: `src/components/ReviewsPanel.vue`
- Modify: `src/components/AppDetailModal.vue`
- Modify: `src/App.vue`
- Test: `src/__tests__/unit/ReviewsPanel.test.ts`

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
  it("shows login prompt for anonymous users and read-only tags", () => {
    render(ReviewsPanel, {
      props: {
        appKey: "apm:amd64-apm:office:wps",
        tags,
        loggedIn: false,
      },
    });

    expect(screen.getByText("登录后发表评论")).toBeTruthy();
    expect(screen.getByText("1.0.0")).toBeTruthy();
    expect(screen.getByText("amd64")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/__tests__/unit/ReviewsPanel.test.ts`

Expected: FAIL because `ReviewsPanel.vue` does not exist.

- [ ] **Step 3: Create ReviewsPanel component**

Create `src/components/ReviewsPanel.vue` with:

```vue
<template>
  <section class="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-800/30">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-slate-900 dark:text-white">评论与评分</h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ summary.reviewCount }} 条评论 · 平均 {{ summary.averageRating.toFixed(1) }} 分
        </p>
      </div>
      <button type="button" class="text-sm font-semibold text-brand" @click="loadReviews">刷新</button>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <span v-for="tag in tagPills" :key="tag.label" class="rounded-full bg-white px-3 py-1 text-xs text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
        {{ tag.label }}: {{ tag.value }}
      </span>
    </div>

    <div v-if="error" class="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
      {{ error }}
    </div>

    <button v-if="!loggedIn" type="button" class="mt-4 rounded-2xl border border-brand/30 px-4 py-2 text-sm font-semibold text-brand hover:bg-brand/10" @click="$emit('request-login')">
      登录后发表评论
    </button>

    <form v-else class="mt-4 space-y-3" @submit.prevent="submit">
      <label class="block text-sm font-medium text-slate-700 dark:text-slate-200" for="reviewRating">评分</label>
      <select id="reviewRating" v-model.number="rating" class="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
        <option v-for="star in [5, 4, 3, 2, 1]" :key="star" :value="star">{{ star }} 分</option>
      </select>

      <label class="block text-sm font-medium text-slate-700 dark:text-slate-200" for="reviewContent">评论</label>
      <textarea id="reviewContent" v-model="content" class="min-h-24 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-900" maxlength="5000"></textarea>

      <button type="submit" class="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" :disabled="submitting || !content.trim()">
        {{ submitting ? "提交中" : "提交评论" }}
      </button>
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

import { fetchRatingSummary, fetchReviews, submitReview } from "@/modules/backendApi";
import type { AppReview, RatingSummary, ReviewTags } from "@/global/typedefinition";

const props = defineProps<{
  appKey: string;
  tags: ReviewTags;
  loggedIn: boolean;
}>();

defineEmits<{
  "request-login": [];
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
    const [nextSummary, nextReviews] = await Promise.all([
      fetchRatingSummary(props.appKey),
      fetchReviews(props.appKey, {}),
    ]);
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

- [ ] **Step 4: Run ReviewsPanel test and verify pass**

Run: `npm run test -- src/__tests__/unit/ReviewsPanel.test.ts`

Expected: PASS.

- [ ] **Step 5: Mount ReviewsPanel in AppDetailModal**

Modify `src/components/AppDetailModal.vue`:

1. Import `ReviewsPanel`.
2. Add props:

```typescript
reviewAppKey: string;
reviewTags: ReviewTags | null;
loggedIn: boolean;
```

3. Add emit:

```typescript
(e: "request-login"): void;
```

4. Add below the screenshot block:

```vue
<ReviewsPanel
  v-if="reviewAppKey && reviewTags"
  :app-key="reviewAppKey"
  :tags="reviewTags"
  :logged-in="loggedIn"
  @request-login="$emit('request-login')"
/>
```

- [ ] **Step 6: Build review props in App.vue**

Modify `src/App.vue`:

1. Import `buildAppKey` and `buildReviewTags`.
2. Add refs:

```typescript
const systemInfo = ref<SystemInfo>({ distro: "unknown" });
```

3. On mount, call:

```typescript
systemInfo.value = await window.ipcRenderer.invoke("get-system-info");
```

4. Add computed values:

```typescript
const currentDisplayAppForReview = computed(() => {
  const app = currentApp.value;
  if (!app) return null;
  if (!app.isMerged) return app;
  return app.viewingOrigin === "spark" ? app.sparkApp || app : app.apmApp || app;
});

const currentReviewAppKey = computed(() => {
  const app = currentDisplayAppForReview.value;
  return app ? buildAppKey(app, window.apm_store.arch || "amd64") : "";
});

const currentReviewTags = computed(() => {
  const app = currentDisplayAppForReview.value;
  return app
    ? buildReviewTags(app, {
        clientArch: window.apm_store.arch || "amd64",
        distro: systemInfo.value.distro,
      })
    : null;
});
```

5. Pass these props to `AppDetailModal` and wire `@request-login="showLoginModal = true"`.

- [ ] **Step 7: Run targeted tests**

Run: `npm run test -- src/__tests__/unit/ReviewsPanel.test.ts src/__tests__/unit/reviewTags.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit review panel**

Run:

```bash
git add src/components/ReviewsPanel.vue src/components/AppDetailModal.vue src/App.vue src/__tests__/unit/ReviewsPanel.test.ts
git commit -m "feat(reviews): show app reviews in details"
```

Expected: commit succeeds if commits are requested for implementation execution.

## Task 6: Add App-List Sync Filtering

**Files:**
- Create: `src/modules/appListSync.ts`
- Test: `src/__tests__/unit/appListSync.test.ts`

- [ ] **Step 1: Write failing sync filtering tests**

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
  icons: "",
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
    ]);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ pkgname: "spark-notes", origin: "spark", category: "office" });
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/__tests__/unit/appListSync.test.ts`

Expected: FAIL because `appListSync` module does not exist.

- [ ] **Step 3: Add sync filtering module**

Create `src/modules/appListSync.ts` with:

```typescript
import type { App, SyncedAppListItem } from "@/global/typedefinition";
import { parsePackageArch } from "@/modules/reviewTags";

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

export const isCloudItemInstalled = (
  item: SyncedAppListItem,
  installedApps: App[],
): boolean => {
  return installedApps.some((app) => app.pkgname === item.pkgname && app.origin === item.origin && app.currentStatus === "installed");
};
```

- [ ] **Step 4: Run sync filtering tests and verify pass**

Run: `npm run test -- src/__tests__/unit/appListSync.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit sync helpers**

Run:

```bash
git add src/modules/appListSync.ts src/__tests__/unit/appListSync.test.ts
git commit -m "feat(sync): add app list filtering"
```

Expected: commit succeeds if commits are requested for implementation execution.

## Task 7: Add Sync And Restore UI

**Files:**
- Create: `src/components/AppListRestoreModal.vue`
- Modify: `src/components/InstalledAppsModal.vue`
- Modify: `src/App.vue`
- Test: `src/__tests__/unit/AppListRestoreModal.test.ts`
- Test: `src/__tests__/unit/InstalledAppsModal.test.ts`

- [ ] **Step 1: Write failing restore modal test**

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
        items: [
          {
            pkgname: "spark-notes",
            origin: "spark",
            category: "office",
            version: "1.0.0",
            packageArch: "amd64",
            appName: "Spark Notes",
            iconUrl: "",
          },
        ],
        installedKeys: [],
      },
    });

    await fireEvent.click(screen.getByLabelText("选择 Spark Notes"));
    await fireEvent.click(screen.getByRole("button", { name: "加入安装队列" }));

    expect(rendered.emitted("install-selected")?.[0]?.[0]).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- src/__tests__/unit/AppListRestoreModal.test.ts`

Expected: FAIL because `AppListRestoreModal.vue` does not exist.

- [ ] **Step 3: Create restore modal**

Create `src/components/AppListRestoreModal.vue` with:

1. Props `show`, `loading`, `error`, `items: SyncedAppListItem[]`, `installedKeys: string[]`.
2. Emits `close` and `install-selected`.
3. Local selected map keyed by `${origin}:${pkgname}`.
4. Checkbox per item with accessible label `选择 ${item.appName || item.pkgname}`.
5. Disable checkbox when installed key is present.
6. Button text `加入安装队列`.

- [ ] **Step 4: Run restore modal test and verify pass**

Run: `npm run test -- src/__tests__/unit/AppListRestoreModal.test.ts`

Expected: PASS.

- [ ] **Step 5: Add sync buttons to InstalledAppsModal**

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

3. Add header buttons before Refresh:

```vue
<button
  type="button"
  class="inline-flex items-center gap-2 rounded-2xl border border-brand/30 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-40"
  :disabled="syncing"
  @click="loggedIn ? $emit('sync-to-account') : $emit('request-login')"
>
  <i class="fas fa-cloud-upload-alt"></i>
  {{ syncing ? "同步中" : "同步到账号" }}
</button>
<button
  type="button"
  class="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
  @click="loggedIn ? $emit('restore-from-account') : $emit('request-login')"
>
  <i class="fas fa-cloud-download-alt"></i>
  从账号恢复
</button>
```

4. Update existing `InstalledAppsModal.test.ts` props to pass `loggedIn: false` and `syncing: false`.

- [ ] **Step 6: Wire sync/restore in App.vue**

Modify `src/App.vue`:

1. Import `AppListRestoreModal`, `buildSyncItems`, `fetchSyncedAppList`, and `uploadSyncedAppList`.
2. Add state:

```typescript
const syncLoading = ref(false);
const restoreLoading = ref(false);
const restoreError = ref("");
const showRestoreModal = ref(false);
const restoreItems = ref<SyncedAppListItem[]>([]);
```

3. Pass `:logged-in="isLoggedIn"` and `:syncing="syncLoading"` to `InstalledAppsModal`.
4. Add handlers:

```typescript
const syncInstalledAppsToAccount = async () => {
  syncLoading.value = true;
  try {
    const items = buildSyncItems(installedApps.value);
    await uploadSyncedAppList({
      clientArch: window.apm_store.arch || "amd64",
      distro: systemInfo.value.distro,
      items,
    });
  } finally {
    syncLoading.value = false;
  }
};

const openRestoreFromAccount = async () => {
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
```

5. Mount `AppListRestoreModal` and on `install-selected`, map selected cloud items to catalog `App` entries from `apps.value` by `pkgname`, `origin`, and `category`, then call existing `handleInstall(app)` for each.

- [ ] **Step 7: Run targeted tests**

Run: `npm run test -- src/__tests__/unit/AppListRestoreModal.test.ts src/__tests__/unit/InstalledAppsModal.test.ts src/__tests__/unit/appListSync.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit sync UI**

Run:

```bash
git add src/components/AppListRestoreModal.vue src/components/InstalledAppsModal.vue src/App.vue src/__tests__/unit/AppListRestoreModal.test.ts src/__tests__/unit/InstalledAppsModal.test.ts
git commit -m "feat(sync): add account app restore UI"
```

Expected: commit succeeds if commits are requested for implementation execution.

## Task 8: Final Client Verification

**Files:**
- Verify: no planned file edits in this task.

- [ ] **Step 1: Run account-related unit tests**

Run:

```bash
npm run test -- src/__tests__/unit/accountTypes.test.ts src/__tests__/unit/authState.test.ts src/__tests__/unit/LoginModal.test.ts src/__tests__/unit/reviewTags.test.ts src/__tests__/unit/ReviewsPanel.test.ts src/__tests__/unit/appListSync.test.ts src/__tests__/unit/AppListRestoreModal.test.ts src/__tests__/unit/InstalledAppsModal.test.ts
```

Expected: all listed tests PASS.

- [ ] **Step 2: Run full unit test suite**

Run: `npm run test`

Expected: all unit tests PASS.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: exits 0 with no lint errors.

- [ ] **Step 4: Run Vite build**

Run: `npm run build:vite`

Expected: exits 0 and produces renderer/main build artifacts.

- [ ] **Step 5: Check working tree**

Run: `git status --short`

Expected: only intentional changes remain. `.superpowers/` must not appear because `.gitignore` ignores it.

## Self-Review Checklist

Spec coverage:

- Login and avatar/name display: Tasks 2 and 3.
- Direct client-to-Flarum token login: Task 3.
- Backend JWT storage and use: Task 2.
- Detail-page review panel: Task 5.
- Immutable automatic tags: Task 4.
- Review filtering foundation: Task 5.
- Store-recognized app-list sync: Tasks 6 and 7.
- Restore through existing install queue: Task 7.

Placeholder scan:

- The plan has no deferred implementation sections and no placeholder tasks.

Type consistency:

- Backend snake_case payloads are mapped in `backendApi.ts`.
- UI state uses camelCase `SparkUser`, `ReviewTags`, and `SyncedAppListItem`.
- `window.apm_store.arch` is treated as bare architecture such as `amd64`.
