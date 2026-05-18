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
