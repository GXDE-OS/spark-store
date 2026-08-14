/**
 * useFavorites —— 收藏夹相关的全部状态与逻辑。
 *
 * 从原 App.vue 原样搬移（loadFavoriteFolders / loadActiveFavoriteItems /
 * loadAllFavoriteItems / loadFavoriteMetadataForDetail / refreshFavorites /
 * openFavoriteSelector / toFavoritePayload / saveCurrentFavoriteFolders /
 * createFavoriteFolderFromSelector / openFavoriteManagement / selectFavoriteFolder /
 * createFavoriteFolderFromPrompt / removeSelectedFavorites / installResolvedFavorites /
 * clearFavoriteState / 代次守卫 / currentFavoriteMetadata / currentFavoriteFolderIds /
 * resolvedFavoriteItems），逻辑零改动。
 *
 * 共享状态来自 useAppState；clientArch 来自 useAppDetail。
 */
import { computed } from "vue";
import type {
  App,
  FavoriteItem,
  ResolvedFavoriteItem,
} from "../global/typedefinition";
import {
  favoriteFolders,
  favoriteItems,
  favoriteItemsByFolder,
  favoriteLoading,
  favoriteError,
  favoriteRequestGeneration,
  favoriteTargetApp,
  favoriteSelectorDraftFolderIds,
  activeFavoriteFolderId,
  showFavoriteSelector,
  currentView,
  activeTab,
  isSidebarOpen,
  showLoginPrompt,
  apps,
  installedApps,
  availableSources,
  storeFilter,
} from "./useAppState";
import { clientArch } from "./useAppDetail";
import {
  listFavoriteFolders,
  listFavoriteItems,
  addFavoriteItem,
  deleteFavoriteItem,
  createFavoriteFolder,
  bulkDeleteFavoriteItems,
} from "../modules/backendApi";
import { buildFavoriteAppKey } from "../modules/appIdentity";
import { resolveFavoriteItems } from "../modules/favoriteAvailability";
import { isLoggedIn } from "../global/authState";
import { refreshFavoriteInstalledApps } from "./useInstalledApps";

const nextFavoriteRequestGeneration = (): number => {
  favoriteRequestGeneration.value += 1;
  return favoriteRequestGeneration.value;
};

const isCurrentFavoriteRequest = (generation: number): boolean =>
  favoriteRequestGeneration.value === generation && isLoggedIn.value;

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
  if (!requireLoginRef("收藏应用需要登录星火账号。")) return;
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
  draftFolderIds: Array<
    number | "default"
  > = favoriteSelectorDraftFolderIds.value ?? [],
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
  if (!requireLoginRef("请登录后查看我的收藏。")) return;
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
      await onDetailInstallRef(item.selectedApp);
    }
  }
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

// requireLogin / onDetailInstall 分别定义在 useAccountSync / useDownloads，
// 通过模块级可赋值引用注入，避免循环依赖。
let requireLoginRef: (message: string) => boolean = () => true;
export const registerRequireLogin = (fn: (message: string) => boolean) => {
  requireLoginRef = fn;
};
let onDetailInstallRef: (app: App) => Promise<void> = async () => undefined;
export const registerOnDetailInstall = (fn: (app: App) => Promise<void>) => {
  onDetailInstallRef = fn;
};

// 这些 computed 依赖 currentDisplayApp / favorite 状态，放在本模块汇总派生。
export const currentFavoriteMetadata = computed(
  (): {
    favorited: boolean;
    folderName: string;
  } => {
    // 延迟引用 currentDisplayApp，避免顶层循环导入时的初始化顺序问题
    const app = currentDisplayAppRef();
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

export const currentFavoriteFolderIds = computed(
  (): Array<number | "default"> => {
    if (favoriteSelectorDraftFolderIds.value) {
      return favoriteSelectorDraftFolderIds.value;
    }

    const app = favoriteTargetApp.value ?? currentDisplayAppRef();
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
  },
);

export const resolvedFavoriteItems = computed<ResolvedFavoriteItem[]>(() =>
  resolveFavoriteItems(
    favoriteItems.value,
    apps.value,
    installedApps.value,
    availableSources.value,
    storeFilter.value,
    clientArch.value,
  ),
);

// currentDisplayApp 由 useAppDetail 持有，此处通过注入引用获取，避免循环导入
let currentDisplayAppRef: () => App | null = () => null;
export const registerCurrentDisplayApp = (fn: () => App | null) => {
  currentDisplayAppRef = fn;
};

export {
  loadFavoriteFolders,
  loadActiveFavoriteItems,
  loadAllFavoriteItems,
  loadFavoriteMetadataForDetail,
  refreshFavorites,
  openFavoriteSelector,
  toFavoritePayload,
  saveCurrentFavoriteFolders,
  createFavoriteFolderFromSelector,
  openFavoriteManagement,
  selectFavoriteFolder,
  createFavoriteFolderFromPrompt,
  removeSelectedFavorites,
  installResolvedFavorites,
  clearFavoriteState,
  nextFavoriteRequestGeneration,
  isCurrentFavoriteRequest,
};
