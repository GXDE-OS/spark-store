<template>
  <SubmitterWindow v-if="isSubmitterView" />
  <div
    v-else
    class="flex h-screen flex-col overflow-hidden bg-slate-50 text-slate-900 transition-colors duration-300 dark:bg-slate-950 dark:text-slate-100"
  >
    <WindowTitleBar
      :search-query="searchQuery"
      @update:search-query="handleSearchInput"
      @search-focus="handleSearchFocus"
      @open-install-settings="handleOpenInstallSettings"
      @open-about="openAboutModal"
      @toggle-sidebar="isSidebarOpen = !isSidebarOpen"
      @spk-link="handleSpkLink"
    />

    <div class="flex min-h-0 flex-1 flex-col lg:flex-row">
      <!-- 移动端侧边栏遮罩 -->
      <div
        v-if="isSidebarOpen"
        class="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
        @click="isSidebarOpen = false"
      ></div>

      <aside
        class="fixed top-10 bottom-0 left-0 z-50 w-64 shrink-0 transform border-r border-slate-200/70 bg-white px-4 py-6 transition-transform duration-300 ease-in-out dark:border-slate-800/70 dark:bg-slate-900 lg:sticky lg:top-10 lg:flex lg:h-[calc(100vh-2.5rem)] lg:translate-x-0 lg:flex-col lg:border-b-0"
        :class="
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        "
      >
        <AppSidebar
          :active-tab="activeTab"
          :category-counts="categoryCounts"
          :theme-mode="themeMode"
          :spark-available="sparkAvailable"
          :apm-available="apmAvailable"
          :store-filter="storeFilter"
          :sidebar-entries="sidebarEntries"
          :entry-counts="entryCounts"
          :current-user="currentUser"
          @toggle-theme="toggleTheme"
          @select-tab="selectTab"
          @close="isSidebarOpen = false"
          @list="handleList"
          @update="handleUpdate"
          @submit="handleSubmit"
          @request-login="showLoginModal = true"
          @open-user-management="openUserManagement"
          @open-favorites="openFavoriteManagement"
          @open-forum="openExternalUrl(FLARUM_BASE_URL)"
          @edit-profile="openExternalUrl(FLARUM_SETTINGS_URL)"
          @logout="handleLogout"
        />
      </aside>

      <main class="flex h-full min-h-0 flex-1 flex-col">
        <CategoryBar
          v-if="
            currentView === 'default' &&
            activeTab !== 'home' &&
            Object.keys(displayCategories).length > 0
          "
          class="shrink-0"
          :categories="displayCategories"
          :selected-category="selectedCategory"
          :category-counts="categoryCounts"
          @select-category="selectSubCategory"
        />
        <div
          class="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-6 lg:px-10"
        >
          <FavoriteFolderManager
            v-if="currentView === 'favorites'"
            :folders="favoriteFolders"
            :active-folder-id="activeFavoriteFolderId"
            :items="resolvedFavoriteItems"
            :loading="favoriteLoading"
            :error="favoriteError"
            @select-folder="selectFavoriteFolder"
            @create-folder="createFavoriteFolderFromPrompt"
            @remove-selected="removeSelectedFavorites"
            @install-selected="installResolvedFavorites"
            @open-detail="openDetail"
          />
          <template v-else-if="activeTab === 'home'">
            <div class="h-full min-h-0 overflow-hidden">
              <HomeView
                :links="homeLinks"
                :loading="homeLoading"
                :error="homeError"
                :store-filter="storeFilter"
                @open-detail="handleAppCardOpenDetail"
                @select-section="selectTab"
              />
            </div>
          </template>
          <template v-else-if="activeTab === 'ranking'">
            <div class="h-full min-h-0 overflow-hidden">
              <RankingView
                :apps="apps"
                :apm-ranking="apmRanking"
                :spark-ranking="sparkRanking"
                :ranking-loading="rankingLoading"
                :store-filter="storeFilter"
                @open-detail="handleAppCardOpenDetail"
              />
            </div>
          </template>
          <template v-else-if="activeTab === 'honor'">
            <div class="h-full min-h-0 overflow-hidden">
              <HonorView
                :apps="apps"
                :store-filter="storeFilter"
                @open-detail="handleAppCardOpenDetail"
              />
            </div>
          </template>
          <template v-else>
            <div class="min-h-0 flex-1">
              <AppGrid
                :apps="filteredApps"
                :loading="effectiveLoading"
                :scroll-key="activeTab + '-' + selectedCategory"
                :store-filter="storeFilter"
                :show-origin="storeFilter === 'both' && !isHomeListTab"
                @open-detail="handleAppCardOpenDetail"
              />
            </div>
          </template>
        </div>
      </main>
    </div>

    <AppDetailModal
      data-app-modal="detail"
      :show="showModal"
      :app="currentApp"
      :screenshots="screenshots"
      :spark-installed="currentAppSparkInstalled"
      :apm-installed="currentAppApmInstalled"
      :logged-in="isLoggedIn"
      :review-app-key="currentReviewAppKey"
      :review-tags="currentReviewTags"
      :favorited="currentFavoriteMetadata.favorited"
      :favorite-folder-name="currentFavoriteMetadata.folderName"
      @select-origin="selectDetailOrigin"
      @close="closeDetail"
      @install="onDetailInstall"
      @remove="onDetailRemove"
      @favorite="onDetailFavorite"
      @request-login="handleDetailRequestLogin"
      @open-preview="openScreenPreview"
      @open-app="openDownloadedApp"
      @check-install="checkAppInstalled"
      @show-user="openReviewUserProfile"
    />

    <ScreenPreview
      :show="showPreview"
      :screenshots="screenshots"
      :current-screen-index="currentScreenIndex"
      @close="closeScreenPreview"
      @prev="prevScreen"
      @next="nextScreen"
    />

    <DownloadQueue
      :downloads="downloads"
      @pause="pauseDownload"
      @resume="resumeDownload"
      @cancel="cancelDownload"
      @retry="retryDownload"
      @clear-completed="clearCompletedDownloads"
      @show-detail="showDownloadDetailModalFunc"
    />

    <DownloadDetail
      :show="showDownloadDetailModal"
      :download="currentDownload"
      @close="closeDownloadDetail"
      @pause="pauseDownload"
      @resume="resumeDownload"
      @cancel="cancelDownload"
      @retry="retryDownload"
      @open-app="openDownloadedApp"
    />

    <InstalledAppsModal
      :show="showInstalledModal"
      :apps="installedApps"
      :loading="installedLoading"
      :error="installedError"
      :warning="installedWarning"
      :logged-in="isLoggedIn"
      :syncing="syncLoading"
      :sync-message="syncStatusMessage"
      @close="closeInstalledModal"
      @refresh="refreshInstalledApps"
      @open-app="openDownloadedApp($event.pkgname, $event.origin)"
      @open-detail="openDetailFromInstalled"
      @uninstall="uninstallInstalledApp"
      @sync-to-account="syncInstalledAppsToAccount"
      @restore-from-account="openRestoreFromAccount"
      @request-login="requireLogin('云端同步需要登录星火账号。')"
    />

    <AppListRestoreModal
      :show="showRestoreModal"
      :loading="restoreLoading"
      :error="restoreError"
      :items="restoreItems"
      :installed-keys="installedCloudKeys"
      :installed-package-keys="installedCloudPackageKeys"
      @close="showRestoreModal = false"
      @install-selected="installCloudItems"
    />

    <UpdateCenterModal
      :show="updateCenterStore.isOpen.value"
      :store="updateCenterStore"
      @update:search-query="updateCenterStore.searchQuery.value = $event"
      @toggle-selection="updateCenterStore.toggleSelection"
      @request-start-selected="handleStartSelectedUpdates"
      @confirm-migration-start="confirmMigrationStart"
      @dismiss-migration-confirm="
        updateCenterStore.showMigrationConfirm.value = false
      "
      @confirm-close="updateCenterStore.closeNow()"
      @dismiss-close-confirm="updateCenterStore.showCloseConfirm.value = false"
    />

    <UninstallConfirmModal
      :show="showUninstallModal"
      :app="uninstallTargetApp"
      @close="closeUninstallModal"
      @success="onUninstallSuccess"
    />

    <ApmInstallConfirmModal
      :show="showApmInstallDialog"
      @close="closeApmInstallDialog"
      @confirm="confirmApmInstall"
    />

    <AboutModal :show="showAboutModal" @close="closeAboutModal" />

    <SettingsModal :show="showSettingsModal" @close="closeSettingsModal" />

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

    <UserManagementModal
      v-if="currentUser"
      :show="showUserManagementModal"
      :user="currentUser"
      :downloaded-apps="downloadedApps"
      :sync-enabled="installedSyncEnabled ?? false"
      :loading="downloadedLoading"
      :error="downloadedError"
      :syncing="syncLoading"
      :sync-message="syncStatusMessage"
      @close="showUserManagementModal = false"
      @open-forum="openExternalUrl(FLARUM_BASE_URL)"
      @edit-profile="openExternalUrl(FLARUM_SETTINGS_URL)"
      @toggle-sync="setInstalledSyncEnabled"
      @sync-now="syncInstalledAppsNow"
      @refresh-downloads="loadDownloadedHistory"
    />

    <ReviewUserProfileModal
      :show="showReviewUserProfileModal"
      :profile="selectedReviewUserProfile"
      @close="showReviewUserProfileModal = false"
      @open-forum-profile="openExternalUrl"
    />

    <FavoriteFolderSelector
      :show="showFavoriteSelector"
      :folders="favoriteFolders"
      :selected-folder-ids="currentFavoriteFolderIds"
      @close="showFavoriteSelector = false"
      @save-selection="saveCurrentFavoriteFolders"
      @create-folder="createFavoriteFolderFromSelector"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from "vue";
import axios, { AxiosError } from "axios";
import pino from "pino";
import AppSidebar from "./components/AppSidebar.vue";
import AppGrid from "./components/AppGrid.vue";
import HomeView from "./components/HomeView.vue";
import RankingView from "./components/RankingView.vue";
import HonorView from "./components/HonorView.vue";
import CategoryBar from "./components/CategoryBar.vue";
import AppDetailModal from "./components/AppDetailModal.vue";
import ScreenPreview from "./components/ScreenPreview.vue";
import DownloadQueue from "./components/DownloadQueue.vue";
import DownloadDetail from "./components/DownloadDetail.vue";
import InstalledAppsModal from "./components/InstalledAppsModal.vue";
import AppListRestoreModal from "./components/AppListRestoreModal.vue";
import UpdateCenterModal from "./components/UpdateCenterModal.vue";
import UninstallConfirmModal from "./components/UninstallConfirmModal.vue";
import ApmInstallConfirmModal from "./components/ApmInstallConfirmModal.vue";
import AboutModal from "./components/AboutModal.vue";
import SettingsModal from "./components/SettingsModal.vue";
import LoginModal from "./components/LoginModal.vue";
import LoginPromptModal from "./components/LoginPromptModal.vue";
import FavoriteFolderSelector from "./components/FavoriteFolderSelector.vue";
import FavoriteFolderManager from "./components/FavoriteFolderManager.vue";
import UserManagementModal from "./components/UserManagementModal.vue";
import ReviewUserProfileModal from "./components/ReviewUserProfileModal.vue";
import WindowTitleBar from "./components/WindowTitleBar.vue";
import SubmitterWindow from "./components/SubmitterWindow.vue";
import {
  APM_STORE_BASE_URL,
  FLARUM_BASE_URL,
  FLARUM_REGISTER_URL,
  FLARUM_SETTINGS_URL,
  currentApp,
  currentAppSparkInstalled,
  currentAppApmInstalled,
  currentStoreMode,
  showApmInstallDialog,
  getHybridDefaultOrigin,
  loadPriorityConfig,
} from "./global/storeConfig";
import {
  downloads,
  removeDownloadItem,
  watchDownloadsChange,
} from "./global/downloadStatus";
import {
  installedSyncEnabled,
  loadInstalledSyncPreference,
  setInstalledSyncEnabled,
} from "./global/accountSyncState";
import {
  countSearchMatchesByCategory,
  rankAppsBySearch,
} from "./modules/appSearch";
import { handleInstall, handleRetry } from "./modules/processInstall";
import {
  addFavoriteItem,
  bulkDeleteFavoriteItems,
  createFavoriteFolder,
  deleteFavoriteItem,
  exchangeFlarumToken,
  fetchSyncedAppList,
  listDownloadedApps,
  listFavoriteFolders,
  listFavoriteItems,
  recordDownloadedApp,
  uploadSyncedAppList,
} from "./modules/backendApi";
import { requestFlarumToken } from "./modules/flarumAuth";
import {
  currentUser,
  isLoggedIn,
  logout,
  setAuthSession,
} from "./global/authState";
import {
  getEffectiveStoreFilter,
  isOriginEnabled,
  isOriginUsable,
} from "./modules/storeFilter";
import { createUpdateCenterStore } from "./modules/updateCenter";
import {
  buildReviewAppKey,
  buildFavoriteAppKey,
  buildReviewTags,
  getDisplayApp,
  parsePackageArch,
} from "./modules/appIdentity";
import { resolveFavoriteItems } from "./modules/favoriteAvailability";
import {
  buildSyncItems,
  cloudItemKey,
  cloudPackageKey,
  mergeInstalledApps,
  resolveCloudInstallCandidate,
} from "./modules/appListSync";
import type {
  App,
  AppJson,
  DownloadItem,
  DownloadResult,
  ChannelPayload,
  CategoryInfo,
  HomeLink,
  FlarumLoginPayload,
  SidebarEntry,
  UpdateCenterItem,
  ReviewTags,
  FavoriteFolder,
  FavoriteItem,
  InstalledAppInfo,
  ResolvedFavoriteItem,
  SystemInfo,
  DownloadedAppRecord,
  SyncedAppListItem,
  AppReview,
  ReviewUserProfile,
} from "./global/typedefinition";
import type { Ref } from "vue";
import type { IpcRendererEvent } from "electron";
const logger = pino();

// Axios 全局配置
const axiosInstance = axios.create({
  baseURL: APM_STORE_BASE_URL,
  timeout: 5000, // 增加到 5 秒，避免网络波动导致的超时
});

const fetchWithRetry = async <T,>(
  url: string,
  signal?: AbortSignal,
  retries = 3,
  delay = 1000,
): Promise<T> => {
  try {
    const response = await axiosInstance.get<T>(url, { signal });
    return response.data;
  } catch (error) {
    // 请求被取消（AbortSignal）时直接抛出，不再重试
    if (signal?.aborted) throw error;
    const axiosError = error as AxiosError;
    const status = axiosError.response?.status;
    // 仅对网络错误（无响应）、服务端 5xx 错误或超时进行重试；
    // 4xx（如 404/400）属于明确的客户端错误，直接抛出以避免无谓重试。
    const isNetworkError = status === undefined;
    const isServerError = typeof status === "number" && status >= 500;
    const isTimeout =
      axiosError.code === "ECONNABORTED" || axiosError.code === "ETIMEDOUT";

    if (retries > 0 && (isNetworkError || isServerError || isTimeout)) {
      // 若已取消则提前退出，避免对已卸载组件发起新请求
      if (signal?.aborted) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, signal, retries - 1, delay * 2);
    }
    throw error;
  }
};

// 根级请求取消控制器：组件卸载时 abort，避免对已卸载组件发起/重试请求
const rootAbortController = new AbortController();

// 渲染进程从 IPC 拿到的 result.apps 实际类型为 any（ipcRenderer.invoke 返回 Promise<any>），
// 直接断言成 InstalledAppInfo[] 会绕过运行时类型检查。后端字段缺失时会引发运行时错误。
// 此守卫仅校验本项目实际使用的关键字段，后端字段缺失时跳过即可，避免整批失败。
const isInstalledAppInfo = (value: unknown): value is InstalledAppInfo => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Partial<InstalledAppInfo>;
  return (
    typeof v.pkgname === "string" &&
    typeof v.name === "string" &&
    typeof v.version === "string" &&
    typeof v.arch === "string" &&
    (v.origin === "spark" || v.origin === "apm") &&
    typeof v.flags === "string" &&
    typeof v.isDependency === "boolean" &&
    // icon 在类型中为可选字段（string | undefined），需显式校验其类型，
    // 避免非字符串值进入下游 app.icon || "" 触发隐式转换异常
    (typeof v.icon === "string" || v.icon === undefined)
  );
};

// 单来源已安装查询超时时间：某个来源（如 APM）响应极慢或挂起时，
// 不应阻塞其它来源整体返回，超时后该来源标记为失败并走 warning/error 流程。
const LIST_INSTALLED_TIMEOUT_MS = 15000;

// 为 Promise 增加超时控制：超时即 reject，配合 Promise.allSettled 让单来源失败不影响其它来源。
const withTimeout = <T,>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} 超时（${ms}ms）`)), ms),
    ),
  ]);
};

// 响应式状态
const themeMode = ref<"light" | "dark" | "auto">("auto");
const systemIsDark = ref(
  window.matchMedia("(prefers-color-scheme: dark)").matches,
);
const isDarkTheme = computed(() => {
  if (themeMode.value === "auto") return systemIsDark.value;
  return themeMode.value === "dark";
});

const isSubmitterView = ref(false);

const categories: Ref<Record<string, CategoryInfo>> = ref({});
const apps: Ref<App[]> = ref([]);
const tabCategories: Ref<Record<string, Record<string, CategoryInfo>>> = ref(
  {},
);
const tabApps: Ref<Record<string, App[]>> = ref({});
// 正在加载中的入口 ID 集合，用于显示骨架屏并防止重复加载
const loadingTabs = ref<Set<string>>(new Set());
// 首页推荐列表入口对应的各来源 jsonUrl：{ [entryId]: { spark?, apm? } }
const homeListUrls = ref<Record<string, { spark?: string; apm?: string }>>({});
const activeTab = ref("home");
type MainView = "default" | "favorites";
const currentView = ref<MainView>("default");
const selectedCategory = ref("all");
const searchQuery = ref("");
const isSidebarOpen = ref(false);
const showModal = ref(false);
const showPreview = ref(false);
const currentScreenIndex = ref(0);
const screenshots = ref<string[]>([]);
const loading = ref(true);
const showDownloadDetailModal = ref(false);
const currentDownload: Ref<DownloadItem | null> = ref(null);
const showInstalledModal = ref(false);
const installedApps = ref<App[]>([]);
const installedLoading = ref(false);
const installedError = ref("");
// 部分来源失败（如 Spark/APM 之一不可用）时使用更轻量的 warning 提示，避免与已有列表同时呈现红色致命错误条造成 UX 混淆
const installedWarning = ref("");
// refreshInstalledApps 的代次计数器，用于异步竞态防护：新进入一次刷新自增，await 后若代次已变则放弃本轮写入
const installedRefreshGeneration = ref(0);
const updateCenterStore = createUpdateCenterStore();
const showUninstallModal = ref(false);
const uninstallTargetApp: Ref<App | null> = ref(null);
const showAboutModal = ref(false);
const showSettingsModal = ref(false);
const showLoginModal = ref(false);
const loginLoading = ref(false);
const loginError = ref("");
const showLoginPrompt = ref(false);
const loginPromptMessage = ref("请登录星火账号后继续操作。");
const showUserManagementModal = ref(false);
const selectedReviewUserProfile = ref<ReviewUserProfile | null>(null);
const showReviewUserProfileModal = ref(false);
const sparkAvailable = ref(false);
const apmAvailable = ref(false);
const sidebarEntries: Ref<SidebarEntry[]> = ref([]);
const favoriteFolders = ref<FavoriteFolder[]>([]);
const activeFavoriteFolderId = ref<number | null>(null);
const favoriteItems = ref<FavoriteItem[]>([]);
const favoriteItemsByFolder = ref<Record<number, FavoriteItem[]>>({});
const showFavoriteSelector = ref(false);
const favoriteTargetApp = ref<App | null>(null);
const favoriteSelectorDraftFolderIds = ref<Array<number | "default"> | null>(
  null,
);
const favoriteLoading = ref(false);
const favoriteError = ref("");
const favoriteRequestGeneration = ref(0);
const downloadedApps = ref<DownloadedAppRecord[]>([]);
const downloadedLoading = ref(false);
const downloadedError = ref("");
const downloadedRequestGeneration = ref(0);
const syncLoading = ref(false);
const syncStatusMessage = ref("");
const syncRequestGeneration = ref(0);
const syncCandidateApps = ref<App[]>([]);
const restoreLoading = ref(false);
const restoreError = ref("");
const showRestoreModal = ref(false);
const restoreItems = ref<SyncedAppListItem[]>([]);
const restoreRequestGeneration = ref(0);
const installedSyncPromptShown = ref(false);
const systemInfo = ref<SystemInfo>({ distro: "unknown" });
type PendingDownloadRecord = Omit<
  DownloadedAppRecord,
  "id" | "downloadedAt"
> & {
  userId: number;
};
const pendingDownloadRecords = new Map<number, PendingDownloadRecord>();

/** 启动参数 --no-apm => 仅 Spark；--no-spark => 仅 APM；由主进程 IPC 提供 */
const storeFilter = ref<"spark" | "apm" | "both">("both");
const availableSources = computed(() => ({
  spark: sparkAvailable.value,
  apm: apmAvailable.value,
}));
const effectiveStoreFilter = computed(() =>
  getEffectiveStoreFilter(storeFilter.value, availableSources.value),
);

// 计算属性
const baseApps = computed(() => {
  let result = [...apps.value];

  // 合并相同包名的应用 (混合模式)
  if (currentStoreMode.value === "hybrid") {
    const mergedMap = new Map<string, App>();
    for (const app of result) {
      const existing = mergedMap.get(app.pkgname);
      if (existing) {
        if (!existing.isMerged) {
          existing.isMerged = true;
          // 根据当前的 origin 分配到对应的属性
          if (existing.origin === "spark") existing.sparkApp = { ...existing };
          else if (existing.origin === "apm") existing.apmApp = { ...existing };
        }
        if (app.origin === "spark") existing.sparkApp = app;
        else if (app.origin === "apm") existing.apmApp = app;
      } else {
        mergedMap.set(app.pkgname, { ...app });
      }
    }
    result = Array.from(mergedMap.values());
  }

  return result;
});

const displayCategories = computed(() => {
  if (activeTab.value === "all") return categories.value;
  return tabCategories.value[activeTab.value] || {};
});

const displayApps = computed(() => {
  if (activeTab.value === "all") return baseApps.value;
  return tabApps.value[activeTab.value] || [];
});

// 当前的加载状态：全局加载中，或当前入口正在加载中
const effectiveLoading = computed(
  () =>
    loading.value ||
    (activeTab.value !== "home" &&
      activeTab.value !== "all" &&
      loadingTabs.value.has(activeTab.value) &&
      !tabApps.value[activeTab.value]),
);

const filteredApps = computed(() => {
  let result = [...displayApps.value];

  const effectiveCategory = getEffectiveCategory();
  if (effectiveCategory && effectiveCategory !== "all") {
    result = result.filter((app) => app.category === effectiveCategory);
  }

  if (searchQuery.value.trim()) {
    return rankAppsBySearch(result, searchQuery.value);
  }

  return result;
});

const categoryCounts = computed(() => {
  const sourceApps = displayApps.value;

  if (searchQuery.value.trim()) {
    // all 统计所有应用中的搜索匹配数（不随 tab 变化）
    const allCounts = countSearchMatchesByCategory(
      baseApps.value,
      searchQuery.value,
    );
    // 各分类统计当前 tab 中的搜索匹配数
    const tabCounts = countSearchMatchesByCategory(
      sourceApps,
      searchQuery.value,
    );
    return { ...tabCounts, all: allCounts.all };
  }

  const counts: Record<string, number> = { all: baseApps.value.length };
  sourceApps.forEach((app) => {
    if (!counts[app.category]) counts[app.category] = 0;
    counts[app.category]++;
  });
  return counts;
});

const entryCounts = computed(() => {
  const counts: Record<string, number> = {};
  const allApps = baseApps.value;

  sidebarEntries.value.forEach((entry) => {
    if (entry.type === "category" && entry.value) {
      // 优先使用已加载的入口应用总数；未加载时回退到全局分类计数
      const tabLen = tabApps.value[entry.id]?.length;
      counts[entry.id] =
        tabLen !== undefined
          ? tabLen
          : allApps.filter((app) => app.category === entry.value).length;
    } else if (entry.type === "homeList") {
      counts[entry.id] = tabApps.value[entry.id]?.length || 0;
    } else {
      counts[entry.id] = 0;
    }
  });

  return counts;
});

const currentDisplayApp = computed(() => getDisplayApp(currentApp.value));

// 当前激活的侧栏入口是否为首页推荐列表类型
const isHomeListTab = computed(
  () =>
    activeTab.value !== "home" &&
    activeTab.value !== "all" &&
    sidebarEntries.value.some(
      (e) => e.id === activeTab.value && e.type === "homeList",
    ),
);

// 应用卡片点击：首页推荐列表复用首页逻辑，标记 _fromHomeView 以便从双仓库获取完整信息
const handleAppCardOpenDetail = (app: App) => {
  if (isHomeListTab.value) {
    openDetail({ ...app, _fromHomeView: true });
  } else {
    openDetail(app);
  }
};

const clientArch = computed(() => window.apm_store.arch || "amd64");

const currentReviewAppKey = computed(() => {
  if (!currentDisplayApp.value) return "";
  return buildReviewAppKey(currentDisplayApp.value, clientArch.value);
});

const currentReviewTags = computed<ReviewTags | null>(() => {
  if (!currentDisplayApp.value) return null;
  return buildReviewTags(currentDisplayApp.value, {
    clientArch: clientArch.value,
    distro: systemInfo.value.distro,
  });
});

const currentFavoriteMetadata = computed(
  (): {
    favorited: boolean;
    folderName: string;
  } => {
    const app = currentDisplayApp.value;
    if (!app) return { favorited: false, folderName: "" };

    const folder = favoriteFolders.value.find((favoriteFolder) => {
      const items = favoriteItemsByFolder.value[favoriteFolder.id] ?? [];
      return items.some(
        (favorite) =>
          favorite.pkgname === app.pkgname &&
          favorite.category === app.category,
      );
    });
    if (!folder) return { favorited: false, folderName: "" };

    return { favorited: true, folderName: folder.name.trim() };
  },
);

const currentFavoriteFolderIds = computed((): Array<number | "default"> => {
  if (favoriteSelectorDraftFolderIds.value) {
    return favoriteSelectorDraftFolderIds.value;
  }

  const app = favoriteTargetApp.value ?? currentDisplayApp.value;
  if (!app) return [];

  return favoriteFolders.value
    .filter((folder) =>
      (favoriteItemsByFolder.value[folder.id] ?? []).some(
        (favorite) =>
          favorite.pkgname === app.pkgname &&
          favorite.category === app.category,
      ),
    )
    .map((folder) => folder.id);
});

const resolvedFavoriteItems = computed<ResolvedFavoriteItem[]>(() =>
  resolveFavoriteItems(
    favoriteItems.value,
    apps.value,
    installedApps.value,
    availableSources.value,
    storeFilter.value,
    clientArch.value,
  ),
);

const installedCloudKeys = computed(
  () => new Set(installedApps.value.map((app) => cloudItemKey(app))),
);

const installedCloudPackageKeys = computed(
  () => new Set(syncCandidateApps.value.map((app) => cloudPackageKey(app))),
);

// 方法
const syncThemePreference = () => {
  document.documentElement.classList.toggle("dark", isDarkTheme.value);
};

const initTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  if (
    savedTheme === "dark" ||
    savedTheme === "light" ||
    savedTheme === "auto"
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    themeMode.value = savedTheme as any;
  } else {
    themeMode.value = "auto";
  }
  window.ipcRenderer.send(
    "set-theme-source",
    themeMode.value === "auto" ? "system" : themeMode.value,
  );
  syncThemePreference();

  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", (e) => {
      systemIsDark.value = e.matches;
    });
};

const toggleTheme = () => {
  if (themeMode.value === "auto") themeMode.value = "light";
  else if (themeMode.value === "light") themeMode.value = "dark";
  else themeMode.value = "auto";
};

const selectTab = (tab: string) => {
  currentView.value = "default";
  activeTab.value = tab;
  selectedCategory.value = "all";
  isSidebarOpen.value = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (tab === "home" && homeLinks.value.length === 0) {
    loadHome();
  }
  if (tab !== "home" && tab !== "all") {
    const entry = sidebarEntries.value.find((e) => e.id === tab);
    if (entry && entry.type === "category") {
      loadTabApps(tab);
    } else if (entry && entry.type === "homeList") {
      loadHomeListApps(tab);
    }
  }
};

const selectSubCategory = (category: string) => {
  currentView.value = "default";
  selectedCategory.value = category;
  window.scrollTo({ top: 0, behavior: "smooth" });
};

const getEffectiveCategory = (): string => {
  if (activeTab.value === "home") return "";
  if (activeTab.value === "all") return selectedCategory.value;

  const entry = sidebarEntries.value.find((e) => e.id === activeTab.value);
  if (entry) {
    if (entry.type === "category") return selectedCategory.value;
    if (entry.type === "search") {
      searchQuery.value = entry.value || "";
      return selectedCategory.value;
    }
  }

  return selectedCategory.value;
};

// 从仓库获取应用详细信息的辅助函数
const fetchAppFromStore = async (
  pkgname: string,
  category: string,
  origin: "spark" | "apm",
): Promise<App | null> => {
  try {
    const arch = window.apm_store.arch || "amd64";
    const finalArch = origin === "spark" ? `${arch}-store` : `${arch}-apm`;
    const appJsonUrl = `${APM_STORE_BASE_URL}/${finalArch}/${category}/${pkgname}/app.json`;
    const response = await fetch(appJsonUrl);
    if (!response.ok) return null;
    const appJson = await response.json();
    return {
      name: appJson.Name || "",
      pkgname: appJson.Pkgname || pkgname,
      version: appJson.Version || "",
      filename: appJson.Filename || "",
      torrent_address: appJson.Torrent_address || "",
      author: appJson.Author || "",
      contributor: appJson.Contributor || "",
      website: appJson.Website || "",
      update: appJson.Update || "",
      size: appJson.Size || "",
      more: appJson.More || "",
      tags: appJson.Tags || "",
      img_urls:
        typeof appJson.img_urls === "string"
          ? (JSON.parse(appJson.img_urls) as string[])
          : appJson.img_urls || [],
      icons: appJson.icons || "",
      category: category,
      origin: origin,
      currentStatus: "not-installed",
    };
  } catch (e) {
    console.warn(`Failed to fetch ${origin} app info for ${pkgname}`, e);
    return null;
  }
};

// 已安装应用页查看详情：复用所有应用页的合并详情视图（始终展示 APM/Spark 两种包）
const openDetailFromInstalled = (app: App) => {
  openDetail({ ...app, _fromInstalled: true });
};

// openDetail 输入类型：完整 App 或仅含必要字段的轻量对象（含内部来源标记）
interface OpenDetailInput extends Partial<App> {
  pkgname?: string;
  category?: string;
  _fromHomeView?: boolean;
  _fromInstalled?: boolean;
  _fromDeepLink?: boolean;
  origin?: "spark" | "apm";
}

const openDetail = async (app: App | OpenDetailInput) => {
  // 提取 pkgname 和 category（必须存在）
  const pkgname = app?.pkgname;
  if (!pkgname) {
    console.warn("openDetail called without pkgname");
    return;
  }
  const category = app.category || "unknown";
  // 检查是否来自 HomeView 或 DeepLink（需要重新获取完整信息）
  // 内部来源标记仅存在于轻量输入对象上，按 OpenDetailInput 读取以兼容联合类型
  const marker = app as OpenDetailInput;
  const fromHomeView = marker._fromHomeView === true;
  const fromDeepLink = marker._fromDeepLink === true;
  // 已安装应用页：始终按"所有应用页"的方式双来源拉取并合并展示（不移除另一类型）
  const fromInstalled = marker._fromInstalled === true;
  const needFetchFromStore = fromHomeView || fromDeepLink || fromInstalled;

  // 首先尝试从当前已经处理好（合并/筛选）的 filteredApps 中查找
  // 优先匹配点击来源 origin（例如排行点击 APM 应用时不应误匹配到 Spark 版）
  const clickedOrigin = app.origin as "spark" | "apm" | undefined;
  let fullApp = filteredApps.value.find(
    (a) =>
      a.pkgname === pkgname && (!clickedOrigin || a.origin === clickedOrigin),
  );
  // 如果没找到，回退到全局 apps 中查找（同样优先 origin）
  if (!fullApp) {
    fullApp = apps.value.find(
      (a) =>
        a.pkgname === pkgname && (!clickedOrigin || a.origin === clickedOrigin),
    );
  }
  // 仍无匹配则退化为仅按 pkgname 匹配（兼容无 origin 的场景，如搜索结果）
  if (!fullApp) {
    fullApp =
      filteredApps.value.find((a) => a.pkgname === pkgname) ||
      apps.value.find((a) => a.pkgname === pkgname);
  }

  let finalApp: App;

  // 来自 HomeView 或 DeepLink 的应用需要重新从仓库获取完整信息
  if (needFetchFromStore) {
    // 从 Spark 和 APM 仓库获取完整的应用信息
    // 已安装页忽略当前商店单一模式限制，始终尝试拉取两种来源，保证另一类型不被隐藏
    let [sparkApp, apmApp] = await Promise.all([
      fromInstalled || storeFilter.value !== "apm"
        ? fetchAppFromStore(pkgname, category, "spark")
        : Promise.resolve(null),
      fromInstalled || storeFilter.value !== "spark"
        ? fetchAppFromStore(pkgname, category, "apm")
        : Promise.resolve(null),
    ]);

    // 已安装页：若某来源仓库拉取失败（如分类不匹配），用本地已合并的应用补全，避免丢失另一类型
    if (fromInstalled && fullApp && fullApp.isMerged) {
      const merged = fullApp as App;
      if (!sparkApp && merged.sparkApp) sparkApp = merged.sparkApp;
      if (!apmApp && merged.apmApp) apmApp = merged.apmApp;
    }

    // 构建合并的应用对象
    if (sparkApp || apmApp) {
      // 如果两个仓库都有这个应用，创建合并对象
      if (sparkApp && apmApp) {
        // 优先遵从点击来源 origin；无点击来源时再按优先级配置决定默认显示
        const defaultOrigin =
          clickedOrigin && (clickedOrigin === "spark" ? sparkApp : apmApp)
            ? clickedOrigin
            : getHybridDefaultOrigin(sparkApp);
        finalApp = {
          ...(defaultOrigin === "spark" ? sparkApp : apmApp), // 根据优先级选择主显示
          isMerged: true,
          sparkApp: sparkApp,
          apmApp: apmApp,
          viewingOrigin: defaultOrigin, // 默认查看来源版本
        };
      } else if (sparkApp) {
        finalApp = sparkApp;
      } else {
        finalApp = apmApp!;
      }
    } else if (fullApp) {
      finalApp = fullApp;
    } else {
      // 两个仓库都没有找到，且本地也没有，构造一个最小可用的 App 对象
      finalApp = {
        name: ((app as Record<string, unknown>).name as string) || "",
        pkgname: pkgname,
        version: ((app as Record<string, unknown>).version as string) || "",
        filename: ((app as Record<string, unknown>).filename as string) || "",
        category: category,
        torrent_address: "",
        author: "",
        contributor: "",
        website: "",
        update: "",
        size: "",
        more: ((app as Record<string, unknown>).more as string) || "",
        tags: "",
        img_urls: [],
        icons: "",
        origin:
          ((app as Record<string, unknown>).origin as "spark" | "apm") || "apm",
        currentStatus: "not-installed",
      } as App;
    }
  } else {
    // 非 HomeView 来源，使用原来的逻辑
    if (fullApp) {
      finalApp = fullApp;
    } else {
      // 构造一个最小可用的 App 对象
      finalApp = {
        name: ((app as Record<string, unknown>).name as string) || "",
        pkgname: pkgname,
        version: ((app as Record<string, unknown>).version as string) || "",
        filename: ((app as Record<string, unknown>).filename as string) || "",
        category: category,
        torrent_address: "",
        author: "",
        contributor: "",
        website: "",
        update: "",
        size: "",
        more: ((app as Record<string, unknown>).more as string) || "",
        tags: "",
        img_urls: [],
        icons: "",
        origin:
          ((app as Record<string, unknown>).origin as "spark" | "apm") || "apm",
        currentStatus: "not-installed",
      } as App;
    }
  }

  // 检查 Spark/APM 安装状态，已安装的版本优先展示
  if (finalApp.isMerged && (finalApp.sparkApp || finalApp.apmApp)) {
    const [sparkInstalled, apmInstalled] = await Promise.all([
      finalApp.sparkApp
        ? (window.ipcRenderer.invoke("check-installed", {
            pkgname: finalApp.sparkApp.pkgname,
            origin: "spark",
          }) as Promise<boolean>)
        : Promise.resolve(false),
      finalApp.apmApp
        ? (window.ipcRenderer.invoke("check-installed", {
            pkgname: finalApp.apmApp.pkgname,
            origin: "apm",
          }) as Promise<boolean>)
        : Promise.resolve(false),
    ]);
    // 优先遵从点击来源 origin（未安装时、已安装时都应以用户点击的版本为准）
    let preferred = (app as Record<string, unknown>).origin as
      | "spark"
      | "apm"
      | undefined;
    if (fromInstalled) {
      // 已安装页：依据实际安装来源决定默认展示
      const installedOrigins = (app as Record<string, unknown>).origins as
        | Array<"spark" | "apm">
        | undefined;
      if (installedOrigins && installedOrigins.length > 0) {
        if (
          installedOrigins.includes("spark") &&
          installedOrigins.includes("apm")
        ) {
          // 两种类型都已安装：保持所有应用页的自动显示模式（不强制指定来源）
          preferred = undefined;
        } else {
          // 仅安装一种类型：优先显示已安装的类型（另一类型仍可在来源切换中查看）
          preferred = installedOrigins[0];
        }
      }
    }
    if (preferred && (preferred === "spark" ? finalApp.sparkApp : finalApp.apmApp)) {
      finalApp.viewingOrigin = preferred;
    } else if (sparkInstalled && !apmInstalled) {
      // 无点击来源时：仅一个仓库已安装则优先展示已安装版本
      finalApp.viewingOrigin = "spark";
    } else if (apmInstalled && !sparkInstalled) {
      finalApp.viewingOrigin = "apm";
    } else {
      // 都安装/都未安装且未指定来源：按优先级配置决定默认展示
      finalApp.viewingOrigin = getHybridDefaultOrigin(
        finalApp.sparkApp || finalApp,
      );
    }
  }

  const displayAppForScreenshots =
    finalApp.viewingOrigin !== undefined && finalApp.isMerged
      ? ((finalApp.viewingOrigin === "spark"
          ? finalApp.sparkApp
          : finalApp.apmApp) ?? finalApp)
      : finalApp;

  currentApp.value = finalApp;
  currentScreenIndex.value = 0;
  loadScreenshots(displayAppForScreenshots);
  showModal.value = true;

  currentAppSparkInstalled.value = false;
  currentAppApmInstalled.value = false;
  checkAppInstalled(finalApp);
  if (
    isLoggedIn.value &&
    favoriteFolders.value.length === 0 &&
    !favoriteLoading.value
  ) {
    void loadFavoriteMetadataForDetail();
  }

  nextTick(() => {
    const modal = document.querySelector(
      '[data-app-modal="detail"] [data-testid="detail-scroll-content"]',
    );
    if (modal) modal.scrollTop = 0;
  });
};

const checkAppInstalled = (app: App) => {
  if (app.isMerged) {
    if (app.sparkApp) {
      window.ipcRenderer
        .invoke("check-installed", {
          pkgname: app.sparkApp.pkgname,
          origin: "spark",
        })
        .then((isInstalled: boolean) => {
          currentAppSparkInstalled.value = isInstalled;
        });
    }
    if (app.apmApp) {
      window.ipcRenderer
        .invoke("check-installed", {
          pkgname: app.apmApp.pkgname,
          origin: "apm",
        })
        .then((isInstalled: boolean) => {
          currentAppApmInstalled.value = isInstalled;
        });
    }
  } else {
    window.ipcRenderer
      .invoke("check-installed", { pkgname: app.pkgname, origin: app.origin })
      .then((isInstalled: boolean) => {
        if (app.origin === "spark") {
          currentAppSparkInstalled.value = isInstalled;
        } else {
          currentAppApmInstalled.value = isInstalled;
        }
      });
  }
};

const loadScreenshots = (app: App) => {
  screenshots.value = [];
  const arch = window.apm_store.arch || "amd64";
  const finalArch = app.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
  for (let i = 1; i <= 5; i++) {
    const screenshotUrl = `${APM_STORE_BASE_URL}/${finalArch}/${app.category}/${app.pkgname}/screen_${i}.png`;
    screenshots.value.push(screenshotUrl);
  }
};

const closeDetail = () => {
  showModal.value = false;
  currentApp.value = null;
};

const openScreenPreview = (index: number) => {
  currentScreenIndex.value = index;
  showPreview.value = true;
};

const closeScreenPreview = () => {
  showPreview.value = false;
};

// Home data
const homeLinks = ref<HomeLink[]>([]);
const homeLoading = ref(false);
const homeError = ref("");

// 首页三区域：区域2 板块（已迁移至「全部应用」等分类入口，首页不再展示）
const apmRanking = ref<App[]>([]);
const sparkRanking = ref<App[]>([]);

// 区域3 · 下载排行（全站）：从全量应用目录逐应用拉取 download-times.txt，
// 按 origin 分别排 APM / Spark 两榜。用代次守卫避免竞态。
// 优化：localStorage 缓存（1 小时 TTL）避免重复请求；并发 48；每个批次完成后立即发布
// 增量排名，边拉边显；fetchDownloadCount 优先命中缓存。
let rankingGeneration = 0;
const rankingLoading = ref(false);

const DOWNLOAD_COUNT_CACHE_KEY = "spark-store:download-counts:v1";
const DOWNLOAD_COUNT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时

interface CachedCount {
  count: number;
  ts: number;
}

const downloadCountCache = new Map<string, CachedCount>();

const cacheKey = (app: App) => `${app.origin}:${app.category}:${app.pkgname}`;

const loadCacheFromStorage = () => {
  try {
    const raw = localStorage.getItem(DOWNLOAD_COUNT_CACHE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Record<string, CachedCount>;
    const now = Date.now();
    for (const [k, v] of Object.entries(data)) {
      if (now - v.ts < DOWNLOAD_COUNT_CACHE_TTL_MS) {
        downloadCountCache.set(k, v);
      }
    }
  } catch {
    // ignore corrupted cache
  }
};

const saveCacheToStorage = () => {
  try {
    const obj: Record<string, CachedCount> = {};
    downloadCountCache.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem(DOWNLOAD_COUNT_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
};

const fetchDownloadCount = async (app: App): Promise<number> => {
  const key = cacheKey(app);
  const cached = downloadCountCache.get(key);
  if (cached) return cached.count;
  const arch = window.apm_store.arch || "amd64";
  const finalArch = app.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
  try {
    const resp = await fetch(
      `${APM_STORE_BASE_URL}/${finalArch}/${app.category}/${app.pkgname}/download-times.txt`,
    );
    if (!resp.ok) return 0;
    const text = (await resp.text()).trim();
    const n = parseInt(text, 10);
    const count = Number.isFinite(n) ? n : 0;
    downloadCountCache.set(key, { count, ts: Date.now() });
    return count;
  } catch {
    return 0;
  }
};

const publishRanking = (results: App[]) => {
  apmRanking.value = results
    .filter((a) => a.origin === "apm")
    .sort((x, y) => (y.downloadCount || 0) - (x.downloadCount || 0))
    .slice(0, 10);
  sparkRanking.value = results
    .filter((a) => a.origin === "spark")
    .sort((x, y) => (y.downloadCount || 0) - (x.downloadCount || 0))
    .slice(0, 10);
};

const loadRanking = async () => {
  if (apps.value.length === 0) return;
  const gen = ++rankingGeneration;
  rankingLoading.value = true;
  const all = apps.value.slice();
  const CONCURRENCY = 15;
  const results: App[] = [];
  for (let i = 0; i < all.length; i += CONCURRENCY) {
    if (gen !== rankingGeneration) {
      saveCacheToStorage();
      return;
    }
    const batch = all.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (app) => ({
        ...app,
        downloadCount: await fetchDownloadCount(app),
      })),
    );
    results.push(...settled);
    // 边拉边发：每批完成后立即发布增量排名
    if (gen === rankingGeneration) publishRanking(results);
  }
  if (gen !== rankingGeneration) {
    saveCacheToStorage();
    return;
  }
  rankingLoading.value = false;
  saveCacheToStorage();
};

// 启动时即加载本地缓存（无需等待 apps），二次启动首屏即可见缓存排行
loadCacheFromStorage();

// 排行榜在 loadApps 全量完成后（onMounted）触发一次，确保 spark/apm 应用均已就绪

const loadHome = async () => {
  homeLoading.value = true;
  homeError.value = "";
  homeLinks.value = [];
  try {
    const arch = window.apm_store.arch || "amd64";
    const modes: Array<"spark" | "apm"> =
      storeFilter.value === "both" ? ["spark", "apm"] : [storeFilter.value];

    // 按名称去重，spark 优先：同名链接 spark 覆盖 apm
    const seenNames = new Set<string>();

    // 并行请求各来源的 homelinks.json，缩短首页加载耗时
    const modeResults = await Promise.all(
      modes.map(async (mode) => {
        const finalArch = mode === "spark" ? `${arch}-store` : `${arch}-apm`;
        const base = `${APM_STORE_BASE_URL}/${finalArch}/home`;
        try {
          const res = await fetch(`${base}/homelinks.json`);
          if (res.ok) return { mode, raw: (await res.json()) as unknown };
        } catch (e) {
          console.warn(`Failed to load ${mode} homelinks.json`, e);
        }
        return { mode, raw: undefined };
      }),
    );

    for (const { mode, raw } of modeResults) {
      if (!raw) continue;
      // 校验 links 为数组，且每项均为对象（避免后端返回异常结构导致运行时错误）
      const links = Array.isArray(raw)
        ? (raw.filter((x) => x && typeof x === "object") as Record<
            string,
            unknown
          >[])
        : [];
      for (const l of links) {
        const name = (l.Name as string) || (l.name as string) || "";
        if (!name) continue; // 跳过空名称，避免空字符串污染 seenNames 与去重逻辑
        if (seenNames.has(name)) continue; // 已由更高优先级来源（spark）占据
        // 仅校验 url 必需；远程 homelinks.json 不含 icon 字段（图片由 imgUrl 提供），
        // 故 icon 不作为硬性校验，缺省为空串以兼容 HomeLink 类型。
        const url = (l.Url as string) || (l.url as string) || "";
        if (!url) continue;
        const icon = (l.Icon as string) || (l.icon as string) || "";
        seenNames.add(name);
        // 显式提取已知字段构造，避免通过展开运算符 { ...l } 把远程不可信数据中的未知属性注入响应式状态
        const safeLink: HomeLink = {
          name,
          url,
          icon,
          more: (l.more as string) || undefined,
          imgUrl: (l.imgUrl as string) || undefined,
          type: (l.type as string) || undefined,
          origin: mode,
        };
        homeLinks.value.push(safeLink);
      }
    }
  } catch (error: unknown) {
    homeError.value = (error as Error)?.message || "加载首页失败";
  } finally {
    homeLoading.value = false;
  }
};

// 加载首页推荐列表为侧边栏入口（按名称合并 spark/apm，置于分类入口上方）
const loadHomeListEntries = async () => {
  try {
    const arch = window.apm_store.arch || "amd64";
    const modes: Array<"spark" | "apm"> =
      storeFilter.value === "both" ? ["spark", "apm"] : [storeFilter.value];

    // 按列表名称合并各来源的 jsonUrl
    const byName = new Map<
      string,
      { name: string; urls: { spark?: string; apm?: string } }
    >();

    for (const mode of modes) {
      const finalArch = mode === "spark" ? `${arch}-store` : `${arch}-apm`;
      const base = `${APM_STORE_BASE_URL}/${finalArch}/home`;

      try {
        const res = await fetch(`${base}/homelist.json`);
        if (res.ok) {
          const lists = await res.json();
          lists.forEach(
            (item: { name?: string; type?: string; jsonUrl?: string }) => {
              if (item.type === "appList" && item.jsonUrl) {
                const name = item.name || "推荐";
                const existing = byName.get(name);
                if (existing) {
                  existing.urls[mode] = item.jsonUrl;
                } else {
                  byName.set(name, {
                    name,
                    urls: { [mode]: item.jsonUrl } as {
                      spark?: string;
                      apm?: string;
                    },
                  });
                }
              }
            },
          );
        }
      } catch (e) {
        console.warn(`Failed to load ${mode} homelist.json`, e);
      }
    }

    const entries: SidebarEntry[] = [];
    const urlsMap: Record<string, { spark?: string; apm?: string }> = {};

    byName.forEach((info, name) => {
      const id = `home-list-${name}`;
      entries.push({
        id,
        name,
        icon: "fas fa-star",
        type: "homeList",
      });
      urlsMap[id] = info.urls;
    });

    if (entries.length > 0) {
      // 首页推荐入口置于分类入口上方
      sidebarEntries.value = [...entries, ...sidebarEntries.value];
      homeListUrls.value = { ...homeListUrls.value, ...urlsMap };
      logger.info(`已加载 ${entries.length} 个首页推荐列表入口`);
    }
  } catch (error) {
    logger.warn(`加载首页推荐列表入口失败: ${error}`);
  }
};

// 加载首页推荐列表的应用数据（合并展示 spark+apm，按 pkgname 去重，spark 优先）
const loadHomeListApps = async (entryId: string) => {
  if (tabApps.value[entryId]) return;
  // 防止重复加载：如果正在加载中则跳过
  if (loadingTabs.value.has(entryId)) return;

  const urls = homeListUrls.value[entryId];
  if (!urls) return;

  // 标记为加载中
  loadingTabs.value = new Set(loadingTabs.value).add(entryId);

  const arch = window.apm_store.arch || "amd64";
  const loadedApps: App[] = [];
  const seenPkgnames = new Set<string>();

  const parseAppList = (
    rawApps: Record<string, string>[],
    mode: "spark" | "apm",
  ): App[] =>
    rawApps.map((a) => {
      const category = a.Category || a.category || "unknown";

      let img_urls: string[] = [];
      const rawImgUrls = a.img_urls;
      if (typeof rawImgUrls === "string") {
        try {
          img_urls = JSON.parse(rawImgUrls);
        } catch {
          img_urls = [];
        }
      } else if (Array.isArray(rawImgUrls)) {
        img_urls = rawImgUrls;
      }

      return {
        name: a.Name || a.name || a.Pkgname || a.pkgname || "",
        pkgname: a.Pkgname || a.pkgname || "",
        version: a.Version || "",
        filename: a.Filename || a.filename || "",
        torrent_address: a.Torrent_address || "",
        author: a.Author || "",
        contributor: a.Contributor || "",
        website: a.Website || "",
        update: a.Update || "",
        size: a.Size || "",
        more: a.More || a.more || "",
        tags: a.Tags || "",
        img_urls,
        icons: a.icons || "",
        category,
        origin: mode,
        currentStatus: "not-installed" as const,
      } as App;
    });

  // 按优先级顺序加载：spark 优先，apm 中与 spark 同名的跳过
  const modes: Array<"spark" | "apm"> = ["spark", "apm"];
  for (const mode of modes) {
    const jsonUrl = urls[mode];
    if (!jsonUrl) continue;
    const finalArch = mode === "spark" ? `${arch}-store` : `${arch}-apm`;

    try {
      const path = `/${finalArch}${jsonUrl}`;
      const rawApps =
        (await fetchWithRetry<Record<string, string>[]>(path, rootAbortController.signal)) || [];
      const apps = parseAppList(rawApps, mode);
      for (const app of apps) {
        if (!app.pkgname || seenPkgnames.has(app.pkgname)) continue;
        seenPkgnames.add(app.pkgname);
        loadedApps.push(app);
      }
    } catch (e) {
      logger.warn(`加载首页列表 ${entryId} (${mode}) 失败: ${e}`);
    }
  }

  tabApps.value = { ...tabApps.value, [entryId]: loadedApps };

  // 移除加载标记
  const next = new Set(loadingTabs.value);
  next.delete(entryId);
  loadingTabs.value = next;

  logger.info(`首页列表 "${entryId}" 加载完成，共 ${loadedApps.length} 个应用`);
};

// 仅并行预加载首页 homeList 板块入口（区域2 数据来源，不依赖全量应用）
const preloadHomeListApps = (): Promise<void> => {
  const tasks: Promise<void>[] = [];
  for (const entry of sidebarEntries.value) {
    if (entry.type === "homeList") {
      tasks.push(
        loadHomeListApps(entry.id).catch((e: unknown) =>
          logger.warn(`预加载首页列表 ${entry.id} 失败: ${e}`),
        ),
      );
    }
  }
  return Promise.all(tasks).then(() => undefined);
};

// 并行预加载其余分类侧边栏入口（用户点击分类时才需要，可延后）
const preloadSidebarTabApps = (): Promise<void> => {
  const tasks: Promise<void>[] = [];
  for (const entry of sidebarEntries.value) {
    if (entry.type === "category") {
      tasks.push(
        loadTabApps(entry.id).catch((e: unknown) =>
          logger.warn(`预加载入口 ${entry.id} 失败: ${e}`),
        ),
      );
    }
  }
  return Promise.all(tasks).then(() => undefined);
};

const prevScreen = () => {
  if (currentScreenIndex.value > 0) {
    currentScreenIndex.value--;
  }
};

const nextScreen = () => {
  if (currentScreenIndex.value < screenshots.value.length - 1) {
    currentScreenIndex.value++;
  }
};

const handleUpdate = async () => {
  await openUpdateModal();
};

const handleOpenInstallSettings = () => {
  showSettingsModal.value = true;
};

const handleList = () => {
  openInstalledModal();
};

const handleSubmit = async () => {
  try {
    const result = await window.ipcRenderer.invoke("launch-submitter");
    if (!result?.success) {
      logger.error(
        "Failed to launch submitter: " + (result?.message || "unknown error"),
      );
    }
  } catch (error) {
    logger.error(`Failed to launch submitter: ${error}`);
  }
};

const openUpdateModal = async () => {
  try {
    if (!effectiveStoreFilter.value) {
      return;
    }

    await updateCenterStore.open(effectiveStoreFilter.value);
  } catch (error) {
    logger.error(`打开更新中心失败: ${error}`);
  }
};

const hasMigrationSelection = (items: UpdateCenterItem[]): boolean => {
  return items.some((item) => item.isMigration === true);
};

const handleStartSelectedUpdates = async () => {
  const selectedItems = updateCenterStore.getSelectedItems();
  if (selectedItems.length === 0) {
    return;
  }

  if (hasMigrationSelection(selectedItems)) {
    updateCenterStore.showMigrationConfirm.value = true;
    return;
  }

  await updateCenterStore.startSelected();
};

const confirmMigrationStart = async () => {
  // 确认即关闭对话框（UX：确认动作立即生效），再执行异步迁移启动
  updateCenterStore.showMigrationConfirm.value = false;
  try {
    await updateCenterStore.startSelected();
  } catch (error) {
    logger.error(
      `启动迁移失败 (startSelected): ${error instanceof Error ? error.message : String(error)}`,
    );
  }
};

const openInstalledModal = () => {
  if (
    getEffectiveStoreFilter(storeFilter.value, availableSources.value) === null
  ) {
    return;
  }

  showInstalledModal.value = true;
  refreshInstalledApps();
};

const closeInstalledModal = () => {
  showInstalledModal.value = false;
  // 关闭模态框时同步清空错误 / 警告，避免下次打开时残留过期状态
  installedError.value = "";
  installedWarning.value = "";
};

// 根据当前启动模式和系统可用性，确定需要查询哪些 origin 的已安装应用
const resolveInstalledOrigins = (): Array<"spark" | "apm"> => {
  const origins: Array<"spark" | "apm"> = [];
  if (isOriginUsable(storeFilter.value, "spark", availableSources.value)) {
    origins.push("spark");
  }
  if (isOriginUsable(storeFilter.value, "apm", availableSources.value)) {
    origins.push("apm");
  }
  return origins;
};

const refreshInstalledApps = async () => {
  // 异步竞态防护：进入时若模态框已关闭（极小概率），直接放弃本轮请求
  if (!showInstalledModal.value) return;
  installedLoading.value = true;
  installedError.value = "";
  installedWarning.value = "";
  // 代次计数器：每次进入自增；await 之后若代次已变（新一轮刷新 / 关闭重开），丢弃本轮结果
  const generation = ++installedRefreshGeneration.value;
  try {
    const origins = resolveInstalledOrigins();
    // Spark 已安装列表依赖商店目录（apps.value）来枚举包名。
    // 仅当目录中存在可枚举的 Spark 包时才查询 Spark，
    // 否则空目录会触发"全量扫描整个系统"的陷阱导致列表被全部跳过而误报为空。
    const sparkPkgnameList = apps.value
      .filter((a) => a.origin === "spark")
      .map((a) => a.pkgname);
    const effectiveOrigins = origins.filter(
      (o) => o !== "spark" || sparkPkgnameList.length > 0,
    );

    if (effectiveOrigins.length === 0) {
      installedApps.value = [];
      // 目录尚未加载完成（但来源可用）时给出过渡提示，待目录加载后会自动重查
      installedError.value =
        apps.value.length === 0
          ? "正在加载应用目录，请稍候…"
          : "当前系统不可用应用管理功能";
      return;
    }

    // 并行查询每个 origin 的已安装应用：
    // 用 allSettled + 每源超时，避免单一来源（如 APM）响应慢/挂起阻塞整体；
    // 超时或失败的来源在下方循环标记为 failedOrigin，不影响其它来源结果。
    const results = await Promise.allSettled(
      effectiveOrigins.map((origin) =>
        withTimeout(
          window.ipcRenderer.invoke("list-installed", {
            origin,
            pkgnameList: origin === "spark" ? sparkPkgnameList : undefined,
          }),
          LIST_INSTALLED_TIMEOUT_MS,
          `${origin} list-installed`,
        ),
      ),
    );

    // 异步结束后的回调阶段重新校验代次与模态可见性，避免陈旧竞态写入 ref
    if (generation !== installedRefreshGeneration.value) return;
    if (!showInstalledModal.value) return;

    const combinedApps: App[] = [];
    // 同一 pkgname 可能同时以 APM 与 Spark 两种来源安装，这里聚合其来源集合
    const originsByPkg = new Map<string, Set<"spark" | "apm">>();
    const failedOrigins: string[] = [];

    for (let i = 0; i < effectiveOrigins.length; i++) {
      const origin = effectiveOrigins[i];
      const settled = results[i];
      // allSettled: rejected（超时/异常）或 success=false 都视为该来源失败
      if (settled.status !== "fulfilled" || !settled.value?.success) {
        failedOrigins.push(origin);
        continue;
      }
      const result = settled.value;

      const appList = Array.isArray(result?.apps) ? result.apps : [];
      for (const rawApp of appList) {
        // 运行时类型守卫，避免后端字段缺失造成下游访问 undefined 抛出
        if (!isInstalledAppInfo(rawApp)) continue;
        const app = rawApp;

        // Find matching remote app to enrich data. We look exactly for that origin.
        let appInfo = apps.value.find(
          (a) => a.pkgname === app.pkgname && a.origin === origin,
        );

        if (origin === "spark" && !appInfo) {
          // Only show Spark packages that exist in the App Store catalogue
          continue;
        }

        if (appInfo) {
          appInfo.flags = app.flags;
          appInfo.arch = app.arch;
          appInfo.currentStatus = "installed";
          appInfo.isDependency = app.isDependency;
        } else {
          // 如果在当前应用列表中找不到该应用，创建一个最小的 App 对象
          appInfo = {
            name: app.name || app.pkgname,
            pkgname: app.pkgname,
            version: app.version,
            category: "unknown",
            tags: "",
            more: "",
            filename: "",
            torrent_address: "",
            author: "",
            contributor: "",
            website: "",
            update: "",
            size: "",
            img_urls: [],
            icons: app.icon || "",
            origin: app.origin || (app.arch?.includes("apm") ? "apm" : "spark"),
            currentStatus: "installed",
            arch: app.arch,
            flags: app.flags,
            isDependency: app.isDependency,
          };
        }
        // 合并同一 pkgname 在多个来源的安装记录为单条，避免列表出现重复项（相同 pkgname 键冲突）
        const existingIdx = combinedApps.findIndex(
          (a) => a.pkgname === appInfo.pkgname,
        );
        if (existingIdx === -1) {
          combinedApps.push(appInfo);
        }
        // 记录该 pkgname 当前这一来源，供卸载时判断走 APM 还是 Spark
        const originSet =
          originsByPkg.get(appInfo.pkgname) ?? new Set<"spark" | "apm">();
        originSet.add(origin);
        originsByPkg.set(appInfo.pkgname, originSet);
      }
    }

    // 将来源集合回写到每条已安装应用，供卸载时判断应走 APM 还是 Spark
    for (const app of combinedApps) {
      const set = originsByPkg.get(app.pkgname);
      if (set) app.origins = Array.from(set);
    }

    installedApps.value = combinedApps;

    // 部分来源失败使用轻量 warning（不与列表同时呈现红色致命错误条），致命/全失败仍用 error
    if (failedOrigins.length > 0) {
      const labels = failedOrigins
        .map((o) => (o === "spark" ? "Spark" : "APM"))
        .join("、");
      if (combinedApps.length > 0) {
        installedWarning.value = `部分来源加载失败（${labels}），已安装列表可能不完整`;
      } else {
        installedError.value = `读取${labels}已安装应用失败`;
      }
    }
  } catch (error: unknown) {
    if (generation !== installedRefreshGeneration.value) return;
    if (!showInstalledModal.value) return;
    installedApps.value = [];
    installedError.value = (error as Error)?.message || "读取已安装应用失败";
  } finally {
    // 仅最末一代次负责清理 loading，防止陈旧代次提前关闭 loading 影响后续刷新
    if (generation === installedRefreshGeneration.value) {
      installedLoading.value = false;
    }
  }
};

// 应用目录（apps.value）可能在打开"已安装应用"模态框之后才加载完成。
// 当目录长度变化、且模态框处于打开状态时，自动重查已安装应用，避免列表一直为空。
// 注意：上一版仅在 prevLen===0→len>0 触发，会遗漏目录后续更新（例如分类切换触发目录重建）。
// 现改为 len 任意 >0 的正向变化都允许触发；密集分批推送由下方 300ms 防抖合并最后一次写入。
// 每次变化都先自增 installedRefreshGeneration：即使上一轮刷新仍在加载中，也会立即失效，
// 避免用陈旧目录数据覆盖已安装列表（清理不单纯依赖定时器，代次校验兜底）。
let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(
  () => apps.value.length,
  (len) => {
    if (!showInstalledModal.value || len <= 0) {
      return;
    }
    installedRefreshGeneration.value++;
    if (refreshDebounceTimer !== null) {
      clearTimeout(refreshDebounceTimer);
    }
    refreshDebounceTimer = setTimeout(() => {
      refreshDebounceTimer = null;
      void refreshInstalledApps();
    }, 300);
  },
);
onUnmounted(() => {
  if (refreshDebounceTimer !== null) {
    clearTimeout(refreshDebounceTimer);
  }
});

const mapInstalledAppToCatalogApp = (
  app: InstalledAppInfo,
  origin: "spark" | "apm",
): App | null => {
  let appInfo = apps.value.find(
    (catalogApp) =>
      catalogApp.pkgname === app.pkgname && catalogApp.origin === origin,
  );

  if (origin === "spark" && !appInfo) {
    return null;
  }

  if (appInfo) {
    appInfo.flags = app.flags;
    appInfo.arch = app.arch;
    appInfo.currentStatus = "installed";
    appInfo.isDependency = app.isDependency;
    return appInfo;
  }

  return {
    name: app.name || app.pkgname,
    pkgname: app.pkgname,
    version: app.version,
    category: "unknown",
    tags: "",
    more: "",
    filename: "",
    torrent_address: "",
    author: "",
    contributor: "",
    website: "",
    update: "",
    size: "",
    img_urls: [],
    icons: app.icon || "",
    origin: app.origin || (app.arch?.includes("apm") ? "apm" : "spark"),
    currentStatus: "installed",
    arch: app.arch,
    flags: app.flags,
    isDependency: app.isDependency,
  };
};

const refreshFavoriteInstalledApps = async (): Promise<void> => {
  const origins: Array<"spark" | "apm"> = [];
  if (isOriginEnabled(storeFilter.value, "spark") && sparkAvailable.value) {
    origins.push("spark");
  }
  if (isOriginEnabled(storeFilter.value, "apm") && apmAvailable.value) {
    origins.push("apm");
  }

  const refreshedApps: App[] = [];
  await Promise.all(
    origins.map(async (origin) => {
      const pkgnameList =
        origin === "spark"
          ? apps.value
              .filter((app) => app.origin === "spark")
              .map((app) => app.pkgname)
          : undefined;
      const result = await window.ipcRenderer.invoke("list-installed", {
        origin,
        pkgnameList,
      });
      if (!result?.success) return;

      const appList = Array.isArray(result?.apps) ? result.apps : [];
      for (const rawApp of appList) {
        // 运行时类型守卫：避免后端字段缺失时下游访问 undefined
        if (!isInstalledAppInfo(rawApp)) continue;
        const appInfo = mapInstalledAppToCatalogApp(rawApp, origin);
        if (appInfo) refreshedApps.push(appInfo);
      }
    }),
  );

  const refreshedKeys = new Set(
    refreshedApps.map((app) => `${app.origin}:${app.pkgname}`),
  );
  installedApps.value = [
    ...installedApps.value.filter(
      (app) =>
        !origins.includes(app.origin) &&
        !refreshedKeys.has(`${app.origin}:${app.pkgname}`),
    ),
    ...refreshedApps,
  ];
};

const requestUninstall = (app: App) => {
  uninstallTargetApp.value = app;
  showUninstallModal.value = true;
  removeDownloadItem(app.pkgname);
};

const onDetailRemove = (app: App) => {
  requestUninstall(app);
};

const onDetailInstall = async (app: App) => {
  const initiatingUserId = currentUser.value?.id ?? null;
  const download = await handleInstall(app);
  if (
    !download ||
    initiatingUserId === null ||
    !isLoggedIn.value ||
    currentUser.value?.id !== initiatingUserId
  ) {
    return;
  }

  pendingDownloadRecords.set(download.id, {
    userId: initiatingUserId,
    appKey: buildFavoriteAppKey(app),
    pkgname: app.pkgname,
    name: app.name,
    category: app.category,
    selectedOrigin: app.origin,
    version: app.version,
    packageArch: app.arch || parsePackageArch(app.filename),
  });
};

const handleInstallCompleteForDownloadRecord = async (
  _event: IpcRendererEvent,
  result: DownloadResult,
) => {
  const pendingRecord = pendingDownloadRecords.get(result.id);
  if (!pendingRecord) return;

  if (result.success) {
    pendingDownloadRecords.delete(result.id);
  }

  if (
    !result.success ||
    !isLoggedIn.value ||
    currentUser.value?.id !== pendingRecord.userId
  ) {
    return;
  }

  const downloadRecord: Omit<DownloadedAppRecord, "id" | "downloadedAt"> = {
    appKey: pendingRecord.appKey,
    pkgname: pendingRecord.pkgname,
    name: pendingRecord.name,
    category: pendingRecord.category,
    selectedOrigin: pendingRecord.selectedOrigin,
    version: pendingRecord.version,
    packageArch: pendingRecord.packageArch,
  };

  try {
    await recordDownloadedApp(downloadRecord);
  } catch (error: unknown) {
    logger.warn({ err: error }, "记录下载应用失败");
  }
};

const onDetailFavorite = async (app: App) => {
  await openFavoriteSelector(app);
};

const selectDetailOrigin = (origin: "spark" | "apm") => {
  if (currentApp.value?.isMerged) {
    currentApp.value = { ...currentApp.value, viewingOrigin: origin };
  }
};

const handleDetailRequestLogin = (message: string) => {
  requireLogin(message);
};

const closeUninstallModal = () => {
  showUninstallModal.value = false;
  uninstallTargetApp.value = null;
};

const onUninstallSuccess = () => {
  // 刷新已安装列表（如果在显示）
  if (showInstalledModal.value) {
    refreshInstalledApps();
  }
  // 更新当前详情页状态（如果在显示）
  if (showModal.value && currentApp.value) {
    checkAppInstalled(currentApp.value);
  }
};

const closeApmInstallDialog = () => {
  showApmInstallDialog.value = false;
};

const confirmApmInstall = async () => {
  showApmInstallDialog.value = false;
  closeDetail();
  await nextTick();
  const apmApp = apps.value.find((a) => a.pkgname === "apm");
  if (apmApp) {
    openDetail(apmApp);
  } else {
    searchQuery.value = "apm";
  }
};

const installCompleteCallback = (pkgname?: string) => {
  if (currentApp.value && (!pkgname || currentApp.value.pkgname === pkgname)) {
    checkAppInstalled(currentApp.value);
  }
};

watchDownloadsChange(installCompleteCallback);

const uninstallInstalledApp = (app: App) => {
  requestUninstall(app);
};

const openAboutModal = () => {
  showAboutModal.value = true;
};

const closeAboutModal = () => {
  showAboutModal.value = false;
};

const closeSettingsModal = () => {
  showSettingsModal.value = false;
};

const openExternalUrl = (url: string) => {
  window.open(url, "_blank", "noopener,noreferrer");
};

const openReviewUserProfile = (review: AppReview): void => {
  const current = currentUser.value;
  const isCurrentUser =
    review.isAuthor === true ||
    (review.userId !== undefined &&
      current?.id !== undefined &&
      review.userId === current.id);

  selectedReviewUserProfile.value = {
    displayName: review.userDisplayName || "星火用户",
    username: isCurrentUser ? current?.username : undefined,
    avatarUrl:
      review.userAvatarUrl || (isCurrentUser ? current?.avatarUrl : undefined),
    coverUrl: isCurrentUser ? current?.coverUrl : undefined,
    forumGroups: isCurrentUser ? current?.forumGroups : undefined,
  };
  showReviewUserProfileModal.value = true;
};

const requireLogin = (message: string): boolean => {
  if (isLoggedIn.value) return true;
  loginPromptMessage.value = message;
  showLoginPrompt.value = true;
  return false;
};

const openLoginFromPrompt = () => {
  showLoginPrompt.value = false;
  showLoginModal.value = true;
};

const clearFavoriteState = () => {
  favoriteRequestGeneration.value += 1;
  favoriteFolders.value = [];
  activeFavoriteFolderId.value = null;
  favoriteItems.value = [];
  favoriteItemsByFolder.value = {};
  showFavoriteSelector.value = false;
  favoriteTargetApp.value = null;
  favoriteSelectorDraftFolderIds.value = null;
  favoriteLoading.value = false;
  favoriteError.value = "";
};

const clearDownloadedState = () => {
  downloadedRequestGeneration.value += 1;
  downloadedApps.value = [];
  downloadedLoading.value = false;
  downloadedError.value = "";
};

const clearRestoreState = () => {
  restoreRequestGeneration.value += 1;
  restoreItems.value = [];
  restoreLoading.value = false;
  restoreError.value = "";
  showRestoreModal.value = false;
};

const clearInstalledSyncState = () => {
  syncRequestGeneration.value += 1;
  syncLoading.value = false;
  syncStatusMessage.value = "";
  syncCandidateApps.value = [];
};

const nextFavoriteRequestGeneration = (): number => {
  favoriteRequestGeneration.value += 1;
  return favoriteRequestGeneration.value;
};

const nextDownloadedRequestGeneration = (): number => {
  downloadedRequestGeneration.value += 1;
  return downloadedRequestGeneration.value;
};

const isCurrentFavoriteRequest = (generation: number): boolean =>
  favoriteRequestGeneration.value === generation && isLoggedIn.value;

const isCurrentDownloadedRequest = (
  generation: number,
  userId: number,
): boolean =>
  downloadedRequestGeneration.value === generation &&
  currentUser.value?.id === userId;

const isCurrentRestoreRequest = (generation: number, userId: number): boolean =>
  restoreRequestGeneration.value === generation &&
  currentUser.value?.id === userId;

const handleLogout = () => {
  logout();
  pendingDownloadRecords.clear();
  clearFavoriteState();
  clearDownloadedState();
  clearRestoreState();
  clearInstalledSyncState();
  loadInstalledSyncPreference(null);
  showLoginModal.value = false;
  showLoginPrompt.value = false;
  isSidebarOpen.value = false;
  showUserManagementModal.value = false;
  if (currentView.value === "favorites") {
    currentView.value = "default";
    activeTab.value = "home";
    selectedCategory.value = "all";
  }
};

const handleFlarumLogin = async (payload: FlarumLoginPayload) => {
  loginLoading.value = true;
  loginError.value = "";

  try {
    const flarumToken = await requestFlarumToken(payload);
    const session = await exchangeFlarumToken({
      flarumUserId: flarumToken.userId,
      flarumToken: flarumToken.token,
    });
    setAuthSession(session);
    clearInstalledSyncState();
    loadInstalledSyncPreference(session.user.id);
    showLoginModal.value = false;
  } catch (error: unknown) {
    loginError.value = (error as Error)?.message || "登录失败，请稍后重试";
  } finally {
    loginLoading.value = false;
  }
};

const loadDownloadedHistory = async (): Promise<void> => {
  if (!requireLogin("请登录后查看和管理账号信息。")) return;
  const userId = currentUser.value?.id;
  if (userId === undefined) return;
  const generation = nextDownloadedRequestGeneration();

  downloadedLoading.value = true;
  downloadedError.value = "";
  try {
    const result = await listDownloadedApps(1, 50);
    if (!isCurrentDownloadedRequest(generation, userId)) return;
    downloadedApps.value = result.items;
  } catch (error: unknown) {
    if (!isCurrentDownloadedRequest(generation, userId)) return;
    downloadedApps.value = [];
    downloadedError.value = (error as Error)?.message || "读取下载历史失败";
  } finally {
    if (isCurrentDownloadedRequest(generation, userId)) {
      downloadedLoading.value = false;
    }
  }
};

const refreshInstalledSyncCandidates = async (
  isCurrentRequest: () => boolean,
): Promise<boolean> => {
  const origins: Array<"spark" | "apm"> = [];
  if (isOriginEnabled(storeFilter.value, "spark") && sparkAvailable.value) {
    origins.push("spark");
  }
  if (isOriginEnabled(storeFilter.value, "apm") && apmAvailable.value) {
    origins.push("apm");
  }

  const refreshedApps: App[] = [];
  await Promise.all(
    origins.map(async (origin) => {
      const pkgnameList =
        origin === "spark"
          ? apps.value
              .filter((app) => app.origin === "spark")
              .map((app) => app.pkgname)
          : undefined;
      const result = await window.ipcRenderer.invoke("list-installed", {
        origin,
        pkgnameList,
      });
      if (!result?.success) return;

      const appList = Array.isArray(result?.apps) ? result.apps : [];
      for (const rawApp of appList) {
        // 运行时类型守卫：避免后端字段缺失时下游访问 undefined
        if (!isInstalledAppInfo(rawApp)) continue;
        const appInfo = mapInstalledAppToCatalogApp(rawApp, origin);
        if (appInfo) refreshedApps.push(appInfo);
      }
    }),
  );

  if (!isCurrentRequest()) {
    return false;
  }

  syncCandidateApps.value = mergeInstalledApps(
    syncCandidateApps.value,
    refreshedApps,
    origins,
  );
  return true;
};

const syncInstalledAppsToAccount = async (): Promise<void> => {
  if (!requireLogin("云端同步需要登录星火账号。")) return;
  if (syncLoading.value) return;
  const userId = currentUser.value?.id;
  if (userId === undefined) return;
  const generation = syncRequestGeneration.value + 1;
  syncRequestGeneration.value = generation;
  syncLoading.value = true;
  syncStatusMessage.value = "";
  try {
    const refreshed = await refreshInstalledSyncCandidates(
      () =>
        syncRequestGeneration.value === generation &&
        currentUser.value?.id === userId,
    );
    if (!refreshed) return;
    const items = buildSyncItems(syncCandidateApps.value);
    await uploadSyncedAppList({
      clientArch: window.apm_store.arch || "amd64",
      distro: systemInfo.value.distro,
      items,
    });
    if (
      syncRequestGeneration.value !== generation ||
      currentUser.value?.id !== userId
    ) {
      return;
    }
    downloadedError.value = "";
    syncStatusMessage.value = "同步完成";
  } catch (error: unknown) {
    if (
      syncRequestGeneration.value !== generation ||
      currentUser.value?.id !== userId
    ) {
      return;
    }
    downloadedError.value = (error as Error)?.message || "同步已安装应用失败";
    syncStatusMessage.value = downloadedError.value;
  } finally {
    if (
      syncRequestGeneration.value === generation &&
      currentUser.value?.id === userId
    ) {
      syncLoading.value = false;
    }
  }
};

const syncInstalledAppsNow = (): void => {
  void syncInstalledAppsToAccount();
};

const openRestoreFromAccount = async (): Promise<void> => {
  if (!requireLogin("云端同步需要登录星火账号。")) return;
  const userId = currentUser.value?.id;
  if (userId === undefined) return;
  const generation = restoreRequestGeneration.value + 1;
  restoreRequestGeneration.value = generation;
  showRestoreModal.value = true;
  restoreLoading.value = true;
  restoreError.value = "";
  restoreItems.value = [];
  try {
    const refreshed = await refreshInstalledSyncCandidates(() =>
      isCurrentRestoreRequest(generation, userId),
    );
    if (!refreshed) return;
    const result = await fetchSyncedAppList();
    if (!isCurrentRestoreRequest(generation, userId)) return;
    restoreItems.value = result?.items || [];
  } catch (error: unknown) {
    if (!isCurrentRestoreRequest(generation, userId)) return;
    restoreError.value = (error as Error)?.message || "读取云端应用列表失败";
  } finally {
    if (isCurrentRestoreRequest(generation, userId)) {
      restoreLoading.value = false;
    }
  }
};

const installCloudItems = (items: SyncedAppListItem[]): void => {
  for (const item of items) {
    const app = resolveCloudInstallCandidate(item, apps.value);
    if (!app) continue;
    void onDetailInstall(app);
  }
  showRestoreModal.value = false;
};

const maybePromptInstalledSync = async (): Promise<void> => {
  if (
    import.meta.env.MODE === "test" ||
    !isLoggedIn.value ||
    installedSyncPromptShown.value ||
    installedSyncEnabled.value !== null
  ) {
    if (isLoggedIn.value && installedSyncEnabled.value === true) {
      await syncInstalledAppsToAccount();
    }
    return;
  }

  installedSyncPromptShown.value = true;
  const enabled = window.confirm(
    "是否启用已安装应用列表自动同步到星火账号？仅同步商店识别的非依赖应用。",
  );
  setInstalledSyncEnabled(enabled);
  if (enabled) await syncInstalledAppsToAccount();
};

const openUserManagement = async () => {
  if (!requireLogin("请登录后查看和管理账号信息。")) return;
  showUserManagementModal.value = true;
  isSidebarOpen.value = false;
  showLoginPrompt.value = false;
  await loadDownloadedHistory();
};

const loadFavoriteFolders = async (
  generation = favoriteRequestGeneration.value,
): Promise<boolean> => {
  const folders = await listFavoriteFolders();
  if (!isCurrentFavoriteRequest(generation)) return false;

  favoriteFolders.value = folders;
  const activeFolderExists = folders.some(
    (folder) => folder.id === activeFavoriteFolderId.value,
  );
  if (!activeFolderExists) {
    activeFavoriteFolderId.value = folders[0]?.id ?? null;
  }
  return true;
};

const loadActiveFavoriteItems = async (
  generation = favoriteRequestGeneration.value,
): Promise<boolean> => {
  if (!activeFavoriteFolderId.value) {
    if (!isCurrentFavoriteRequest(generation)) return false;
    favoriteItems.value = [];
    return true;
  }
  const items = await listFavoriteItems(activeFavoriteFolderId.value);
  if (!isCurrentFavoriteRequest(generation)) return false;

  favoriteItems.value = items;
  favoriteItemsByFolder.value = {
    ...favoriteItemsByFolder.value,
    [activeFavoriteFolderId.value]: items,
  };
  return true;
};

const loadAllFavoriteItems = async (
  generation = favoriteRequestGeneration.value,
): Promise<boolean> => {
  const folderIds = favoriteFolders.value.map((folder) => folder.id);
  const entries = await Promise.all(
    folderIds.map(async (folderId) => ({
      folderId,
      items: await listFavoriteItems(folderId),
    })),
  );
  if (!isCurrentFavoriteRequest(generation)) return false;

  favoriteItemsByFolder.value = Object.fromEntries(
    entries.map(({ folderId, items }) => [folderId, items]),
  );
  favoriteItems.value = activeFavoriteFolderId.value
    ? (favoriteItemsByFolder.value[activeFavoriteFolderId.value] ?? [])
    : [];
  return true;
};

const loadFavoriteMetadataForDetail = async (): Promise<void> => {
  const generation = favoriteRequestGeneration.value;
  try {
    const folders = await listFavoriteFolders();
    if (!isCurrentFavoriteRequest(generation)) return;
    const entries = await Promise.all(
      folders.map(async (folder) => ({
        folderId: folder.id,
        items: await listFavoriteItems(folder.id),
      })),
    );
    if (!isCurrentFavoriteRequest(generation)) return;

    favoriteFolders.value = folders;
    favoriteItemsByFolder.value = Object.fromEntries(
      entries.map(({ folderId, items }) => [folderId, items]),
    );
  } catch (error: unknown) {
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteError.value = (error as Error)?.message || "读取收藏夹失败";
  }
};

const refreshFavorites = async (): Promise<void> => {
  const generation = nextFavoriteRequestGeneration();
  favoriteLoading.value = true;
  favoriteError.value = "";
  try {
    await Promise.all([
      refreshFavoriteInstalledApps(),
      loadFavoriteFolders(generation),
    ]);
    if (!isCurrentFavoriteRequest(generation)) return;
    await loadAllFavoriteItems(generation);
  } catch (error: unknown) {
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteError.value = (error as Error)?.message || "读取收藏夹失败";
  } finally {
    if (isCurrentFavoriteRequest(generation)) favoriteLoading.value = false;
  }
};

const openFavoriteSelector = async (app: App) => {
  if (!requireLogin("收藏应用需要登录星火账号。")) return;
  const generation = nextFavoriteRequestGeneration();
  favoriteTargetApp.value = app;
  favoriteSelectorDraftFolderIds.value = null;
  favoriteError.value = "";
  try {
    const foldersLoaded = await loadFavoriteFolders(generation);
    if (!foldersLoaded || !isCurrentFavoriteRequest(generation)) return;
    const itemsLoaded = await loadAllFavoriteItems(generation);
    if (!itemsLoaded || !isCurrentFavoriteRequest(generation)) return;
    showFavoriteSelector.value = true;
  } catch (error: unknown) {
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteError.value = (error as Error)?.message || "读取收藏夹失败";
  }
};

const toFavoritePayload = (
  app: App,
): Omit<FavoriteItem, "id" | "createdAt"> => ({
  appKey: buildFavoriteAppKey(app),
  pkgname: app.pkgname,
  name: app.name,
  category: app.category,
  iconUrl: app.icons,
});

const saveCurrentFavoriteFolders = async (
  folderIds: Array<number | "default">,
) => {
  const generation = favoriteRequestGeneration.value;
  const app = favoriteTargetApp.value;
  if (!app) return;
  try {
    const numericFolderIds = folderIds.filter(
      (folderId): folderId is number => typeof folderId === "number",
    );
    const includesFallbackDefault = folderIds.includes("default");
    const nextFolderIds = new Set(numericFolderIds);
    const existingByFolder = favoriteFolders.value
      .map((folder) => ({
        folderId: folder.id,
        item: (favoriteItemsByFolder.value[folder.id] ?? []).find(
          (favorite) =>
            favorite.pkgname === app.pkgname &&
            favorite.category === app.category,
        ),
      }))
      .filter(
        (entry): entry is { folderId: number; item: FavoriteItem } =>
          entry.item !== undefined,
      );
    const existingFolderIds = new Set(
      existingByFolder.map((entry) => entry.folderId),
    );
    const payload = toFavoritePayload(app);
    const addedItemPromises = numericFolderIds
      .filter((folderId) => !existingFolderIds.has(folderId))
      .map(async (folderId) => ({
        folderId,
        item: await addFavoriteItem(folderId, payload),
      }));
    const deletedEntries = existingByFolder.filter(
      ({ folderId }) => !nextFolderIds.has(folderId),
    );

    const [addedEntries] = await Promise.all([
      Promise.all(addedItemPromises),
      ...(includesFallbackDefault ? [addFavoriteItem("default", payload)] : []),
      ...deletedEntries.map(({ folderId, item }) =>
        deleteFavoriteItem(folderId, item.id),
      ),
    ]);
    if (!isCurrentFavoriteRequest(generation)) return;
    const nextItemsByFolder = { ...favoriteItemsByFolder.value };
    deletedEntries.forEach(({ folderId, item }) => {
      nextItemsByFolder[folderId] = (nextItemsByFolder[folderId] ?? []).filter(
        (favorite) => favorite.id !== item.id,
      );
    });
    addedEntries.forEach(({ folderId, item }) => {
      nextItemsByFolder[folderId] = [
        ...(nextItemsByFolder[folderId] ?? []).filter(
          (favorite) =>
            favorite.pkgname !== app.pkgname ||
            favorite.category !== app.category,
        ),
        item,
      ];
    });
    favoriteItemsByFolder.value = nextItemsByFolder;
    if (activeFavoriteFolderId.value) {
      favoriteItems.value =
        nextItemsByFolder[activeFavoriteFolderId.value] ?? [];
    }
    showFavoriteSelector.value = false;
    favoriteTargetApp.value = null;
    favoriteSelectorDraftFolderIds.value = null;
    if (includesFallbackDefault) await refreshFavorites();
  } catch (error: unknown) {
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteError.value = (error as Error)?.message || "更新收藏失败";
  }
};

const createFavoriteFolderFromSelector = async (
  draftFolderIds: Array<number | "default"> = currentFavoriteFolderIds.value,
): Promise<void> => {
  const generation = favoriteRequestGeneration.value;
  const name = window.prompt("请输入收藏夹名称");
  const folderName = name?.trim();
  if (!folderName) return;
  const app = favoriteTargetApp.value;
  if (!app) return;
  favoriteLoading.value = true;
  favoriteError.value = "";
  try {
    const folder = await createFavoriteFolder(folderName);
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteFolders.value = [
      ...favoriteFolders.value.filter((item) => item.id !== folder.id),
      folder,
    ];
    favoriteItemsByFolder.value = {
      ...favoriteItemsByFolder.value,
      [folder.id]: favoriteItemsByFolder.value[folder.id] ?? [],
    };
    favoriteSelectorDraftFolderIds.value = [
      ...new Set([...draftFolderIds, folder.id]),
    ];
    showFavoriteSelector.value = true;
  } catch (error: unknown) {
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteError.value = (error as Error)?.message || "创建收藏夹失败";
  } finally {
    if (isCurrentFavoriteRequest(generation)) favoriteLoading.value = false;
  }
};

const openFavoriteManagement = async () => {
  if (!requireLogin("请登录后查看我的收藏。")) return;
  currentView.value = "favorites";
  activeTab.value = "favorites";
  isSidebarOpen.value = false;
  showLoginPrompt.value = false;
  await refreshFavorites();
};

const selectFavoriteFolder = async (folderId: number) => {
  const generation = nextFavoriteRequestGeneration();
  activeFavoriteFolderId.value = folderId;
  favoriteLoading.value = true;
  favoriteError.value = "";
  try {
    await loadActiveFavoriteItems(generation);
  } catch (error: unknown) {
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteError.value = (error as Error)?.message || "读取收藏应用失败";
  } finally {
    if (isCurrentFavoriteRequest(generation)) favoriteLoading.value = false;
  }
};

const createFavoriteFolderFromPrompt = async () => {
  const name = window.prompt("请输入收藏夹名称");
  const folderName = name?.trim();
  if (!folderName) return;
  const generation = favoriteRequestGeneration.value;
  favoriteLoading.value = true;
  favoriteError.value = "";
  try {
    const folder = await createFavoriteFolder(folderName);
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteFolders.value = [
      ...favoriteFolders.value.filter((item) => item.id !== folder.id),
      folder,
    ];
    favoriteItemsByFolder.value = {
      ...favoriteItemsByFolder.value,
      [folder.id]: favoriteItemsByFolder.value[folder.id] ?? [],
    };
    favoriteItems.value = [];
    activeFavoriteFolderId.value = folder.id;
  } catch (error: unknown) {
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteError.value = (error as Error)?.message || "创建收藏夹失败";
  } finally {
    if (isCurrentFavoriteRequest(generation)) favoriteLoading.value = false;
  }
};

const removeSelectedFavorites = async (ids: number[]) => {
  if (!activeFavoriteFolderId.value || ids.length === 0) return;
  const generation = favoriteRequestGeneration.value;
  favoriteLoading.value = true;
  favoriteError.value = "";
  try {
    await bulkDeleteFavoriteItems(activeFavoriteFolderId.value, ids);
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteItemsByFolder.value = {
      ...favoriteItemsByFolder.value,
      [activeFavoriteFolderId.value]: (
        favoriteItemsByFolder.value[activeFavoriteFolderId.value] ?? []
      ).filter((favorite) => !ids.includes(favorite.id)),
    };
    await refreshFavorites();
  } catch (error: unknown) {
    if (!isCurrentFavoriteRequest(generation)) return;
    favoriteError.value = (error as Error)?.message || "移除收藏失败";
  } finally {
    if (isCurrentFavoriteRequest(generation)) favoriteLoading.value = false;
  }
};

const installResolvedFavorites = async (items: ResolvedFavoriteItem[]) => {
  for (const item of items) {
    if (item.selectedApp) {
      await onDetailInstall(item.selectedApp);
    }
  }
};

// TODO: 目前 APM 商店不能暂停下载
const pauseDownload = (id: DownloadItem) => {
  const download = downloads.value.find((d) => d.id === id.id);
  if (download && download.status === "installing") {
    // 'installing' matches type definition, previously 'downloading'
    download.status = "paused";
    download.logs.push({
      time: Date.now(),
      message: "下载已暂停",
    });
  }
};

// TODO: 同理，暂未实现
const resumeDownload = (id: DownloadItem) => {
  const download = downloads.value.find((d) => d.id === id.id);
  if (download && download.status === "paused") {
    download.status = "installing"; // previously 'downloading'
    download.logs.push({
      time: Date.now(),
      message: "继续下载...",
    });
    // simulateDownload(download); // removed or undefined?
  }
};

const cancelDownload = (id: DownloadItem) => {
  const index = downloads.value.findIndex((d) => d.id === id.id);
  if (index !== -1) {
    const download = downloads.value[index];
    // 发送到主进程取消
    window.ipcRenderer.send("cancel-install", download.id);

    download.status = "failed";
    download.logs.push({
      time: Date.now(),
      message: "下载已取消",
    });
    // 保留在队列中以便用户可以重试或查看日志
  }
};

const retryDownload = (id: DownloadItem) => {
  const download = downloads.value.find((d) => d.id === id.id);
  if (download && download.status === "failed") {
    download.status = "queued";
    download.progress = 0;
    download.downloadedSize = 0;
    download.logs.push({
      time: Date.now(),
      message: "重新开始下载...",
    });
    handleRetry(download);
  }
};

const clearCompletedDownloads = () => {
  downloads.value = downloads.value.filter((d) => d.status !== "completed");
};

const showDownloadDetailModalFunc = (download: DownloadItem) => {
  currentDownload.value = download;
  showDownloadDetailModal.value = true;
};

const closeDownloadDetail = () => {
  showDownloadDetailModal.value = false;
  currentDownload.value = null;
};

const openDownloadedApp = (pkgname: string, origin?: "spark" | "apm") => {
  // const encodedPkg = encodeURIComponent(download.pkgname);
  // openApmStoreUrl(`apmstore://launch?pkg=${encodedPkg}`, {
  //   fallbackText: `打开应用: ${download.pkgname}`
  // });
  window.ipcRenderer
    .invoke("launch-app", { pkgname, origin })
    .catch((err) => logger.error("启动应用失败 (launch-app):", err));
};

const loadCategories = async () => {
  try {
    const arch = window.apm_store.arch || "amd64";
    const modes: Array<"spark" | "apm"> =
      storeFilter.value === "both" ? ["spark", "apm"] : [storeFilter.value];

    const categoryData: Record<string, { zh: string; origins: string[] }> = {};

    for (const mode of modes) {
      const finalArch = mode === "spark" ? `${arch}-store` : `${arch}-apm`;
      const path = `/${finalArch}/categories.json`;

      try {
        const response = await axiosInstance.get(path);
        const data = response.data;
        Object.keys(data).forEach((key) => {
          if (categoryData[key]) {
            if (!categoryData[key].origins.includes(mode)) {
              categoryData[key].origins.push(mode);
            }
          } else {
            categoryData[key] = {
              zh: data[key].zh || data[key],
              origins: [mode],
            };
          }
        });
      } catch (e) {
        logger.error(`读取 ${mode} categories.json 失败: ${e}`);
      }
    }
    categories.value = categoryData;

    // 加载优先级配置（从 spark 目录）
    await loadPriorityConfig(arch);
  } catch (error) {
    logger.error(`读取 categories 失败: ${error}`);
  }
};

const loadSidebarConfig = async () => {
  try {
    const arch = window.apm_store.arch || "amd64";
    const modes: Array<"spark" | "apm"> =
      storeFilter.value === "both" ? ["spark", "apm"] : [storeFilter.value];

    const entryMap = new Map<string, SidebarEntry>();

    for (const mode of modes) {
      const finalArch = mode === "spark" ? `${arch}-store` : `${arch}-apm`;
      const path = `/${finalArch}/sidebar-config.json`;

      try {
        const response = await axiosInstance.get(path);
        const data = response.data;
        const entries = Array.isArray(data) ? data : data.entries || [];

        for (const entry of entries) {
          if (entry.id && entry.name) {
            const existing = entryMap.get(entry.id);
            if (existing) {
              // 多仓库共有入口，合并来源
              if (existing.origins && !existing.origins.includes(mode)) {
                existing.origins.push(mode);
              }
            } else {
              entryMap.set(entry.id, {
                id: entry.id,
                name: entry.name,
                icon: entry.icon || "",
                type: entry.type || "category",
                value: entry.value || entry.id,
                origins: [mode],
              });
            }
          }
        }
      } catch (e) {
        logger.warn(`读取 ${mode} sidebar-config.json 失败: ${e}`);
      }
    }

    sidebarEntries.value = Array.from(entryMap.values());
    if (sidebarEntries.value.length > 0) {
      logger.info(`已加载 ${sidebarEntries.value.length} 个侧边栏配置入口`);
    }
  } catch (error) {
    logger.warn(`读取 sidebar-config 失败: ${error}`);
  }
};

const normalizeAppJson = (
  appJson: AppJson,
  category: string,
  origin: "spark" | "apm",
): App => ({
  name: appJson.Name,
  pkgname: appJson.Pkgname,
  version: appJson.Version,
  filename: appJson.Filename,
  torrent_address: appJson.Torrent_address,
  author: appJson.Author,
  contributor: appJson.Contributor,
  website: appJson.Website,
  update: appJson.Update,
  size: appJson.Size,
  more: appJson.More,
  tags: appJson.Tags,
  img_urls:
    typeof appJson.img_urls === "string"
      ? (JSON.parse(appJson.img_urls) as string[])
      : appJson.img_urls,
  icons: appJson.icons,
  category: category,
  origin: origin,
  currentStatus: "not-installed" as const,
});

const loadTabCategories = async () => {
  const arch = window.apm_store.arch || "amd64";
  const modes: Array<"spark" | "apm"> =
    storeFilter.value === "both" ? ["spark", "apm"] : [storeFilter.value];
  const newTabCategories: Record<string, Record<string, CategoryInfo>> = {};

  // 并行加载所有侧边栏入口的子分类，减少串行等待
  const categoryEntries = sidebarEntries.value.filter(
    (e) => e.type === "category",
  );

  await Promise.all(
    categoryEntries.map(async (entry) => {
      const folderName = entry.value || entry.id;
      const catData: Record<string, { zh: string; origins: string[] }> = {};
      // 只查询该入口实际存在的来源仓库，避免对不存在目录的 404 重试
      const entryModes = entry.origins?.length
        ? entry.origins.filter((o) => modes.includes(o))
        : modes;

      await Promise.all(
        entryModes.map(async (mode) => {
          const finalArch = mode === "spark" ? `${arch}-store` : `${arch}-apm`;
          const path = `/${finalArch}/${folderName}/categories.json`;

          try {
            const response = await axiosInstance.get(path);
            const data = response.data;
            Object.keys(data).forEach((key) => {
              if (catData[key]) {
                if (!catData[key].origins.includes(mode)) {
                  catData[key].origins.push(mode);
                }
              } else {
                catData[key] = {
                  zh: data[key].zh || data[key],
                  origins: [mode],
                };
              }
            });
          } catch {
            // 该入口没有子分类，静默忽略
          }
        }),
      );

      if (Object.keys(catData).length > 0) {
        newTabCategories[entry.id] = catData;
        logger.info(
          `入口 "${entry.id}" 加载到 ${Object.keys(catData).length} 个子分类`,
        );
      }
    }),
  );

  tabCategories.value = newTabCategories;
};

const loadTabApps = async (entryId: string) => {
  if (tabApps.value[entryId]) return;
  // 防止重复加载：如果正在加载中则跳过
  if (loadingTabs.value.has(entryId)) return;

  const entry = sidebarEntries.value.find((e) => e.id === entryId);
  if (!entry || entry.type !== "category") return;

  // 标记为加载中
  loadingTabs.value = new Set(loadingTabs.value).add(entryId);

  const arch = window.apm_store.arch || "amd64";
  const allModes: Array<"spark" | "apm"> =
    storeFilter.value === "both" ? ["spark", "apm"] : [storeFilter.value];
  // 只查询该入口实际存在的来源仓库，避免对不存在目录的 404 重试
  const modes = entry.origins?.length
    ? entry.origins.filter((o) => allModes.includes(o))
    : allModes;
  const folderName = entry.value || entry.id;
  const subCats = tabCategories.value[entryId];

  // 收集所有需要发起的请求任务（mode × 子分类），然后全并发加载
  const tasks: Promise<App[]>[] = [];

  for (const mode of modes) {
    const finalArch = mode === "spark" ? `${arch}-store` : `${arch}-apm`;

    if (subCats && Object.keys(subCats).length > 0) {
      for (const [subCat, catInfo] of Object.entries(subCats)) {
        if (
          catInfo.origins &&
          catInfo.origins.length > 0 &&
          !catInfo.origins.includes(mode)
        )
          continue;

        const path = `/${finalArch}/${folderName}/${subCat}/applist.json`;
        logger.info(`加载入口子分类: ${entryId}/${subCat} (来源: ${mode})`);
        tasks.push(
          fetchWithRetry<AppJson[]>(path, rootAbortController.signal)
            .then((categoryApps) =>
              (categoryApps || []).map((aj) =>
                normalizeAppJson(aj, subCat, mode),
              ),
            )
            .catch((e: unknown) => {
              logger.warn(
                `加载入口子分类 ${entryId}/${subCat} (${mode}) 失败: ${e}`,
              );
              return [] as App[];
            }),
        );
      }
    } else {
      const path = `/${finalArch}/${folderName}/applist.json`;
      logger.info(`加载入口目录: ${entryId} (来源: ${mode})`);
      tasks.push(
        fetchWithRetry<AppJson[]>(path, rootAbortController.signal)
          .then((categoryApps) =>
            (categoryApps || []).map((aj) =>
              normalizeAppJson(aj, folderName, mode),
            ),
          )
          .catch((e: unknown) => {
            logger.warn(`加载入口目录 ${entryId} (${mode}) 失败: ${e}`);
            return [] as App[];
          }),
      );
    }
  }

  const results = await Promise.all(tasks);
  const loadedApps = results.flat();

  tabApps.value = { ...tabApps.value, [entryId]: loadedApps };

  // 移除加载标记
  const next = new Set(loadingTabs.value);
  next.delete(entryId);
  loadingTabs.value = next;

  logger.info(`入口 "${entryId}" 加载完成，共 ${loadedApps.length} 个应用`);
};

const loadApps = async (onFirstBatch?: () => void) => {
  try {
    logger.info("开始加载应用数据（全并发带重试）...");

    const categoriesList = Object.keys(categories.value || {});
    let firstBatchCallDone = false;
    const arch = window.apm_store.arch || "amd64";

    // 并发加载所有分类，每个分类自带重试机制
    await Promise.all(
      categoriesList.map(async (category) => {
        const catInfo = categories.value[category];
        if (!catInfo) return;
        const origins = (catInfo.origins ||
          (catInfo.origin ? [catInfo.origin] : [])) as string[];

        await Promise.all(
          origins.map(async (mode) => {
            try {
              const finalArch =
                mode === "spark" ? `${arch}-store` : `${arch}-apm`;

              const path = `/${finalArch}/${category}/applist.json`;

              logger.info(`加载分类: ${category} (来源: ${mode})`);
              const categoryApps = await fetchWithRetry<AppJson[]>(path, rootAbortController.signal);

              const normalizedApps = (categoryApps || []).map((appJson) =>
                normalizeAppJson(appJson, category, mode as "spark" | "apm"),
              );

              // 增量式更新，让用户尽快看到部分数据
              apps.value.push(...normalizedApps);

              // 只要有一个分类加载成功，就可以考虑关闭整体 loading（如果是首批逻辑）
              if (!firstBatchCallDone && typeof onFirstBatch === "function") {
                firstBatchCallDone = true;
                onFirstBatch();
              }
            } catch (error) {
              logger.warn(
                `加载分类 ${category} 来源 ${mode} 最终失败: ${error}`,
              );
            }
          }),
        );
      }),
    );

    // 确保即使全部失败也结束 loading
    if (!firstBatchCallDone && typeof onFirstBatch === "function") {
      onFirstBatch();
    }
  } catch (error) {
    logger.error(`加载应用数据流程异常: ${error}`);
  }
};

const handleSearchInput = (value: string) => {
  currentView.value = "default";
  searchQuery.value = value;
};

const handleSpkLink = (pkgname: string) => {
  currentView.value = "default";
  activeTab.value = "all";
  // 尝试从已加载的应用中查找
  const target = apps.value.find((a) => a.pkgname === pkgname);
  if (target) {
    openDetail({ ...target, _fromDeepLink: true });
  } else {
    // 找不到时回退到搜索
    searchQuery.value = pkgname;
  }
};

const handleSearchFocus = () => {
  currentView.value = "default";
  if (activeTab.value === "home") activeTab.value = "all";
};

// 窗口尺寸变化（含无边框窗口鼠标拉边角）时，防抖通知主进程保存当前尺寸
let saveBoundsTimer: number | undefined;
const handleWindowResize = () => {
  if (saveBoundsTimer) clearTimeout(saveBoundsTimer);
  saveBoundsTimer = window.setTimeout(() => {
    void window.ipcRenderer.invoke("save-window-bounds");
  }, 400);
};

// 生命周期钩子
onMounted(async () => {
  initTheme();
  updateCenterStore.bind();

  const handleHashChange = () => {
    isSubmitterView.value = window.location.hash === "#submitter";
  };

  handleHashChange();
  window.addEventListener("hashchange", handleHashChange);

  // 窗口尺寸变化（含无边框窗口鼠标拉边角）时，防抖通知主进程保存当前尺寸
  window.addEventListener("resize", handleWindowResize);

  try {
    systemInfo.value = await window.ipcRenderer.invoke("get-system-info");
  } catch (error: unknown) {
    logger.warn({ err: error }, "读取系统信息失败");
    systemInfo.value = { distro: "unknown" };
  }

  // 从主进程获取启动参数（--no-apm / --no-spark），再加载数据
  storeFilter.value = await window.ipcRenderer.invoke("get-store-filter");

  if (storeFilter.value !== "apm") {
    sparkAvailable.value = await window.ipcRenderer.invoke(
      "check-spark-available",
    );
  }

  // 检查 apm 是否可用
  if (storeFilter.value !== "spark") {
    apmAvailable.value = await window.ipcRenderer.invoke("check-apm-available");
  }

  await loadCategories();

  await loadSidebarConfig();

  await loadHomeListEntries();

  await loadTabCategories();

  loading.value = true;
  homeLoading.value = true;

  // 区域1(links) 与 区域2 板块(homeList) 并行；全量应用也并行加载
  await Promise.all([
    loadHome(),
    preloadHomeListApps(),
    loadApps(() => {
      loading.value = false; // 首屏：已有部分应用即可显示，排行稍后刷新
    }),
  ]);

  // 全量应用加载完成后再刷新排行榜，确保 spark/apm 应用均已就绪
  loadRanking();

  // 其余分类入口预加载（用户点击分类时才需要，延后）
  preloadSidebarTabApps().then(() => {
    logger.info("侧边栏入口预加载完成");
  });

  void maybePromptInstalledSync();
  logger.info("所有应用数据加载完成");

  // 设置键盘导航
  document.addEventListener("keydown", (e) => {
    if (showPreview.value) {
      if (e.key === "Escape") closeScreenPreview();
      if (e.key === "ArrowLeft") prevScreen();
      if (e.key === "ArrowRight") nextScreen();
    }
    if (showModal.value && e.key === "Escape") {
      closeDetail();
    }
  });

  // Deep link Handlers
  window.ipcRenderer.on("deep-link-update", () => {
    if (loading.value) {
      const stop = watch(loading, (val) => {
        if (!val) {
          openUpdateModal();
          stop();
        }
      });
    } else {
      openUpdateModal();
    }
  });

  window.ipcRenderer.on("deep-link-installed", () => {
    if (loading.value) {
      const stop = watch(loading, (val) => {
        if (!val) {
          openInstalledModal();
          stop();
        }
      });
    } else {
      openInstalledModal();
    }
  });

  window.ipcRenderer.on("trigger-apm-install-dialog", () => {
    showApmInstallDialog.value = true;
  });

  window.ipcRenderer.on(
    "deep-link-install",
    (_event: IpcRendererEvent, pkgname: string) => {
      const tryOpen = () => {
        const target = apps.value.find((a) => a.pkgname === pkgname);
        if (target) {
          openDetail(target);
        } else {
          logger.warn(`Deep link: app ${pkgname} not found`);
        }
      };

      if (loading.value) {
        const stop = watch(loading, (val) => {
          if (!val) {
            tryOpen();
            stop();
          }
        });
      } else {
        tryOpen();
      }
    },
  );

  window.ipcRenderer.on(
    "deep-link-search",
    (_event: IpcRendererEvent, data: { pkgname: string }) => {
      // 根据包名直接打开应用详情
      const tryOpen = () => {
        // 先切换到"全部应用"分类
        currentView.value = "default";
        activeTab.value = "all";
        // 使用类似 HomeView 的方式打开应用，从两个仓库获取完整信息
        const target = apps.value.find((a) => a.pkgname === data.pkgname);
        if (target) {
          openDetail({ ...target, _fromDeepLink: true });
        } else {
          // 如果找不到应用，回退到搜索模式
          searchQuery.value = data.pkgname;
          logger.warn(
            `Deep link: app ${data.pkgname} not found, fallback to search`,
          );
        }
      };

      if (loading.value) {
        const stop = watch(loading, (val) => {
          if (!val) {
            tryOpen();
            stop();
          }
        });
      } else {
        tryOpen();
      }
    },
  );

  window.ipcRenderer.on(
    "install-complete",
    handleInstallCompleteForDownloadRecord,
  );

  window.ipcRenderer.on(
    "remove-complete",
    (_event: IpcRendererEvent, payload: ChannelPayload) => {
      const pkgname = currentApp.value?.pkgname;
      if (payload.success && pkgname) {
        removeDownloadItem(pkgname);
      }
    },
  );

  window.ipcRenderer.send("renderer-ready", { status: true });
  logger.info("Renderer process is ready!");
});

onUnmounted(() => {
  rootAbortController.abort();
  updateCenterStore.unbind();
  window.ipcRenderer.off(
    "install-complete",
    handleInstallCompleteForDownloadRecord,
  );
  window.removeEventListener("resize", handleWindowResize);
});

// 观察器
watch(
  () => currentUser.value?.id ?? null,
  (userId, previousUserId) => {
    loadInstalledSyncPreference(userId);
    if (previousUserId !== undefined && userId !== previousUserId) {
      syncRequestGeneration.value += 1;
      syncLoading.value = false;
      syncCandidateApps.value = [];
    }
  },
  { immediate: true },
);

watch(themeMode, (newVal) => {
  localStorage.setItem("theme", newVal);
  window.ipcRenderer.send(
    "set-theme-source",
    newVal === "auto" ? "system" : newVal,
  );
});

watch(isDarkTheme, () => {
  syncThemePreference();
});
</script>
