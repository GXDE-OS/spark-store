import { fireEvent, render, screen, waitFor } from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App.vue";
import { setAuthSession } from "@/global/authState";
import type { FavoriteFolder, FavoriteItem } from "@/global/typedefinition";

const invoke = vi.fn();

const favoriteFolders: FavoriteFolder[] = [
  {
    id: 7,
    name: "默认收藏夹",
    itemCount: 1,
    createdAt: "2026-05-18T00:00:00Z",
    updatedAt: "2026-05-18T00:00:00Z",
  },
];

const favoriteItems: FavoriteItem[] = [
  {
    id: 11,
    appKey: "app:office:wps",
    pkgname: "wps",
    name: "WPS",
    category: "office",
    iconUrl: "",
    createdAt: "2026-05-18T00:00:00Z",
  },
];

vi.mock("axios", () => {
  const get = vi.fn(async (url: string) => {
    if (url.includes("categories.json")) {
      return { data: { office: { zh: "办公" } } };
    }
    if (url.includes("/office/applist.json")) {
      return {
        data: [
          {
            Name: "WPS",
            Pkgname: "wps",
            Version: "1.0.0",
            Filename: "wps_1.0.0_amd64.deb",
            Torrent_address: "",
            Author: "",
            Contributor: "",
            Website: "",
            Update: "",
            Size: "",
            More: "",
            Tags: "",
            img_urls: [],
            icons: "",
          },
        ],
      };
    }
    return { data: [] };
  });

  return {
    default: {
      create: () => ({ get }),
    },
  };
});

vi.mock("@/modules/updateCenter", () => ({
  createUpdateCenterStore: () => ({
    isOpen: { value: false },
    showCloseConfirm: { value: false },
    showMigrationConfirm: { value: false },
    searchQuery: { value: "" },
    selectedTaskKeys: { value: new Set<string>() },
    snapshot: {
      value: { items: [], tasks: [], warnings: [], hasRunningTasks: false },
    },
    filteredItems: { value: [] },
    allSelected: { value: false },
    someSelected: { value: false },
    bind: vi.fn(),
    unbind: vi.fn(),
    open: vi.fn(),
    refresh: vi.fn(),
    ignoreItem: vi.fn(),
    unignoreItem: vi.fn(),
    toggleSelection: vi.fn(),
    toggleSelectAll: vi.fn(),
    getSelectedItems: vi.fn(() => []),
    closeNow: vi.fn(),
    startSelected: vi.fn(),
    requestClose: vi.fn(),
  }),
}));

vi.mock("@/modules/backendApi", () => ({
  addFavoriteItem: vi.fn(),
  bulkDeleteFavoriteItems: vi.fn(),
  createFavoriteFolder: vi.fn(),
  exchangeFlarumToken: vi.fn(),
  listFavoriteFolders: vi.fn(async () => favoriteFolders),
  listFavoriteItems: vi.fn(async () => favoriteItems),
  setBackendToken: vi.fn(),
}));

describe("App account placeholders", () => {
  beforeEach(() => {
    invoke.mockReset();
    invoke.mockImplementation(async (channel: string) => {
      if (channel === "get-store-filter") return "both";
      if (channel === "check-spark-available") return true;
      if (channel === "check-apm-available") return true;
      if (channel === "get-app-version") return "5.0.0";
      return [];
    });

    Object.assign(window.ipcRenderer, {
      invoke,
      on: vi.fn(),
      off: vi.fn(),
      send: vi.fn(),
    });

    window.apm_store.arch = "amd64";
    localStorage.clear();
    setAuthSession({
      accessToken: "backend-token",
      tokenType: "bearer",
      user: {
        id: 1,
        flarumUserId: "42",
        username: "momen",
        displayName: "Momen",
        avatarUrl: "https://bbs.spark-app.store/avatar.png",
        forumLevel: "管理员",
        forumGroups: ["管理员"],
      },
    });

    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
  });

  it("shows the user management placeholder from the logged-in quick menu", async () => {
    render(App);

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("用户管理"));

    expect(
      await screen.findByRole("heading", { name: "用户管理" }),
    ).toBeTruthy();
    expect(screen.queryByText("请登录后查看和管理账号信息。")).toBeNull();
  });

  it("shows the favorites placeholder from the logged-in quick menu", async () => {
    render(App);

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("我的收藏"));

    expect(
      await screen.findByRole("heading", { name: "我的收藏" }),
    ).toBeTruthy();
    expect(screen.queryByText("请登录后查看我的收藏。")).toBeNull();
  });

  it("refreshes installed apps before resolving favorite management state", async () => {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === "get-store-filter") return "both";
      if (channel === "check-spark-available") return true;
      if (channel === "check-apm-available") return true;
      if (channel === "get-app-version") return "5.0.0";
      if (channel === "list-installed") {
        return {
          success: true,
          apps: [
            {
              pkgname: "wps",
              name: "WPS",
              version: "1.0.0",
              arch: "amd64",
              flags: "installed",
              origin: "apm",
            },
          ],
        };
      }
      return [];
    });
    render(App);

    await waitFor(() => {
      expect(screen.getByText("2")).toBeTruthy();
    });

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("我的收藏"));

    expect(
      await screen.findByRole("heading", { name: "我的收藏" }),
    ).toBeTruthy();
    expect(await screen.findByText("已安装")).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith("list-installed", {
      origin: "apm",
      pkgnameList: undefined,
    });
  });

  it("refreshes Spark installed state for favorites in both mode", async () => {
    invoke.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === "get-store-filter") return "both";
      if (channel === "check-spark-available") return true;
      if (channel === "check-apm-available") return true;
      if (channel === "get-app-version") return "5.0.0";
      if (channel === "list-installed") {
        const request = payload as { origin?: string };
        if (request.origin === "spark") {
          return {
            success: true,
            apps: [
              {
                pkgname: "wps",
                name: "WPS",
                version: "1.0.0",
                arch: "amd64",
                flags: "installed",
                origin: "spark",
              },
            ],
          };
        }
        return { success: true, apps: [] };
      }
      return [];
    });
    render(App);

    await waitFor(() => {
      expect(screen.getByText("2")).toBeTruthy();
    });

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("我的收藏"));

    expect(
      await screen.findByRole("heading", { name: "我的收藏" }),
    ).toBeTruthy();
    expect(await screen.findByText("已安装")).toBeTruthy();
    expect(invoke).toHaveBeenCalledWith("list-installed", {
      origin: "spark",
      pkgnameList: ["wps"],
    });
  });
});
