import axios, { type AxiosResponse } from "axios";
import pino from "pino";

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
  SparkUser,
  SyncedAppList,
  SyncedAppListItem,
} from "@/global/typedefinition";

const backend = axios.create({
  baseURL: SPARK_BACKEND_BASE_URL,
  timeout: 10000,
});
const logger = pino({ name: "backendApi" });

type ApiRecord = Record<string, unknown>;

const normalizeBackendAuthError = (error: unknown): Error => {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error : new Error("登录失败，请稍后重试。");
  }

  logger.error(
    {
      code: error.code,
      message: error.message,
      status: error.response?.status,
    },
    "Spark backend auth exchange failed",
  );

  if (!error.response) {
    return new Error("无法连接星火账号服务，请确认后端服务已启动或稍后重试。");
  }

  const status = error.response.status;
  if (status === 401) {
    return new Error("论坛登录失败，请检查账号和密码。");
  }
  if (status === 503) {
    return new Error("星火账号服务暂时无法连接论坛，请稍后重试。");
  }
  if (status === 500) {
    return new Error("星火账号服务异常，请确认后端数据库迁移已执行后重试。");
  }

  return new Error(`星火账号服务返回异常 (${status})，请稍后重试。`);
};

const asApiRecord = (value: unknown): ApiRecord => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as ApiRecord;
  }
  return {};
};

const asApiRecordArray = (value: unknown): ApiRecord[] => {
  if (!Array.isArray(value)) return [];
  return value.map(asApiRecord);
};

export const parseForumGroups = (raw: unknown): string[] => {
  if (Array.isArray(raw)) {
    return raw.filter((item): item is string => typeof item === "string");
  }
  if (typeof raw !== "string" || raw.length === 0) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
};

const toUser = (raw: ApiRecord): SparkUser => ({
  id: Number(raw.id),
  flarumUserId: String(raw.flarum_user_id || ""),
  username: String(raw.username || ""),
  displayName: String(raw.display_name || raw.username || ""),
  avatarUrl: String(raw.avatar_url || ""),
  forumLevel: String(raw.forum_level || "论坛用户"),
  forumGroups: parseForumGroups(raw.forum_groups),
});

const toReview = (raw: ApiRecord): AppReview => ({
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

const toFavoriteFolder = (raw: ApiRecord): FavoriteFolder => ({
  id: Number(raw.id),
  name: String(raw.name || ""),
  itemCount: Number(raw.item_count || 0),
  createdAt: String(raw.created_at || ""),
  updatedAt: String(raw.updated_at || ""),
});

const toFavoriteItem = (raw: ApiRecord): FavoriteItem => ({
  id: Number(raw.id),
  appKey: String(raw.app_key || ""),
  pkgname: String(raw.pkgname || ""),
  name: String(raw.name || ""),
  category: String(raw.category || ""),
  iconUrl: String(raw.icon_url || ""),
  createdAt: String(raw.created_at || ""),
});

const toDownloadedApp = (raw: ApiRecord): DownloadedAppRecord => ({
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

const toSyncedAppListItem = (raw: ApiRecord): SyncedAppListItem => ({
  id: raw.id === undefined ? undefined : Number(raw.id),
  pkgname: String(raw.pkgname || ""),
  origin: raw.origin === "spark" ? "spark" : "apm",
  category: String(raw.category || ""),
  version: String(raw.version || ""),
  packageArch: String(raw.package_arch || "unknown"),
  appName: String(raw.app_name || ""),
  iconUrl: String(raw.icon_url || ""),
});

const toSyncedAppList = (
  raw: ApiRecord,
  fallback?: { clientArch: string; distro: string; items: SyncedAppListItem[] },
): SyncedAppList => ({
  snapshotName: String(raw.snapshot_name || "默认列表"),
  clientArch: String(raw.client_arch || fallback?.clientArch || "unknown"),
  distro: String(raw.distro || fallback?.distro || "unknown"),
  updatedAt: String(raw.updated_at || ""),
  items: raw.items
    ? asApiRecordArray(raw.items).map(toSyncedAppListItem)
    : fallback?.items || [],
});

export const setBackendToken = (token: string | null): void => {
  const backendWithOptionalDefaults = backend as typeof backend & {
    defaults?: { headers?: { common?: Record<string, unknown> } };
  };
  const commonHeaders = backendWithOptionalDefaults.defaults?.headers?.common;
  if (!commonHeaders) return;

  if (token) commonHeaders.Authorization = `Bearer ${token}`;
  else delete commonHeaders.Authorization;
};

export const exchangeFlarumToken = async (payload: {
  flarumUserId: string;
  flarumToken: string;
}): Promise<AuthSession> => {
  let response: AxiosResponse;
  try {
    response = await backend.post("/auth/flarum", {
      flarum_user_id: payload.flarumUserId,
      flarum_token: payload.flarumToken,
    });
  } catch (error) {
    throw normalizeBackendAuthError(error);
  }
  const data = asApiRecord(response.data);

  return {
    accessToken: String(data.access_token || ""),
    tokenType: "bearer",
    user: toUser(asApiRecord(data.user)),
  };
};

export const fetchMe = async (): Promise<SparkUser> => {
  const response = await backend.get("/me");
  return toUser(asApiRecord(response.data));
};

export const fetchRatingSummary = async (
  appKey: string,
): Promise<RatingSummary> => {
  const response = await backend.get(
    `/apps/${encodeURIComponent(appKey)}/rating-summary`,
  );
  const data = asApiRecord(response.data);

  return {
    averageRating: Number(data.average_rating || 0),
    reviewCount: Number(data.review_count || 0),
    starCounts: Object.fromEntries(
      Object.entries(asApiRecord(data.star_counts)).map(([key, value]) => [
        Number(key),
        Number(value),
      ]),
    ),
  };
};

export const fetchReviews = async (appKey: string): Promise<AppReview[]> => {
  const response = await backend.get(
    `/apps/${encodeURIComponent(appKey)}/reviews`,
  );
  return asApiRecordArray(response.data).map(toReview);
};

export const submitReview = async (
  appKey: string,
  payload: { rating: number; content: string; tags: ReviewTags },
): Promise<AppReview> => {
  const response = await backend.post(
    `/apps/${encodeURIComponent(appKey)}/reviews`,
    {
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
    },
  );
  return toReview(asApiRecord(response.data));
};

export const listFavoriteFolders = async (): Promise<FavoriteFolder[]> => {
  const response = await backend.get("/me/favorite-folders");
  return asApiRecordArray(response.data).map(toFavoriteFolder);
};

export const createFavoriteFolder = async (
  name: string,
): Promise<FavoriteFolder> => {
  const response = await backend.post("/me/favorite-folders", { name });
  return toFavoriteFolder(asApiRecord(response.data));
};

export const renameFavoriteFolder = async (
  folderId: number,
  name: string,
): Promise<FavoriteFolder> => {
  const response = await backend.patch(`/me/favorite-folders/${folderId}`, {
    name,
  });
  return toFavoriteFolder(asApiRecord(response.data));
};

export const deleteFavoriteFolder = async (folderId: number): Promise<void> => {
  await backend.delete(`/me/favorite-folders/${folderId}`);
};

export const listFavoriteItems = async (
  folderId: number,
): Promise<FavoriteItem[]> => {
  const response = await backend.get(`/me/favorite-folders/${folderId}/items`);
  return asApiRecordArray(response.data).map(toFavoriteItem);
};

export const addFavoriteItem = async (
  folderId: number | "default",
  item: Omit<FavoriteItem, "id" | "createdAt">,
): Promise<FavoriteItem> => {
  const response = await backend.post(
    `/me/favorite-folders/${folderId}/items`,
    {
      app_key: item.appKey,
      pkgname: item.pkgname,
      name: item.name,
      category: item.category,
      icon_url: item.iconUrl,
    },
  );
  return toFavoriteItem(asApiRecord(response.data));
};

export const deleteFavoriteItem = async (
  folderId: number,
  itemId: number,
): Promise<void> => {
  await backend.delete(`/me/favorite-folders/${folderId}/items/${itemId}`);
};

export const bulkDeleteFavoriteItems = async (
  folderId: number,
  itemIds: number[],
): Promise<number> => {
  const response = await backend.post(
    `/me/favorite-folders/${folderId}/items/bulk-delete`,
    { item_ids: itemIds },
  );
  return Number(asApiRecord(response.data).deleted_count || 0);
};

export const listDownloadedApps = async (
  page = 1,
  pageSize = 20,
): Promise<DownloadedAppList> => {
  const response = await backend.get("/me/downloaded-apps", {
    params: { page, page_size: pageSize },
  });
  const data = asApiRecord(response.data);

  return {
    items: asApiRecordArray(data.items).map(toDownloadedApp),
    total: Number(data.total || 0),
    page: Number(data.page || page),
    pageSize: Number(data.page_size || pageSize),
  };
};

export const recordDownloadedApp = async (
  item: Omit<DownloadedAppRecord, "id" | "downloadedAt">,
): Promise<DownloadedAppRecord> => {
  const response = await backend.post("/me/downloaded-apps", {
    app_key: item.appKey,
    pkgname: item.pkgname,
    name: item.name,
    category: item.category,
    selected_origin: item.selectedOrigin,
    version: item.version,
    package_arch: item.packageArch,
  });
  return toDownloadedApp(asApiRecord(response.data));
};

export const fetchSyncedAppList = async (): Promise<SyncedAppList | null> => {
  const response = await backend.get("/me/app-list");
  if (!response.data) return null;
  return toSyncedAppList(asApiRecord(response.data));
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

  return toSyncedAppList(asApiRecord(response.data), payload);
};
