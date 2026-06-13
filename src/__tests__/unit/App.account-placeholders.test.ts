import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App.vue";
import {
  addFavoriteItem,
  deleteFavoriteItem,
  fetchRatingSummary,
  fetchReviews,
  fetchSyncedAppList,
  createFavoriteFolder,
  listDownloadedApps,
  listFavoriteFolders,
  listFavoriteItems,
  uploadSyncedAppList,
} from "@/modules/backendApi";
import { setAuthSession } from "@/global/authState";
import type {
  DownloadedAppList,
  FavoriteFolder,
  FavoriteItem,
  SyncedAppList,
} from "@/global/typedefinition";

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

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });

  return { promise, resolve };
};

const downloadedList = (
  items: DownloadedAppList["items"],
): DownloadedAppList => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 50,
});

const syncedList = (items: SyncedAppList["items"]): SyncedAppList => ({
  snapshotName: "默认列表",
  clientArch: "amd64",
  distro: "deepin 25",
  updatedAt: "2026-05-18T00:00:00Z",
  items,
});

const setSecondUserSession = () => {
  setAuthSession({
    accessToken: "backend-token-b",
    tokenType: "bearer",
    user: {
      id: 2,
      flarumUserId: "84",
      username: "second",
      displayName: "Second User",
      avatarUrl: "https://bbs.spark-app.store/avatar-b.png",
      forumLevel: "用户",
      forumGroups: ["用户"],
    },
  });
};

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
  const post = vi.fn(async () => ({ data: { ok: true } }));

  return {
    default: {
      create: () => ({ get, post }),
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
  deleteFavoriteItem: vi.fn(),
  exchangeFlarumToken: vi.fn(),
  fetchRatingSummary: vi.fn(async () => ({
    averageRating: 5,
    reviewCount: 1,
    starCounts: { 5: 1 },
  })),
  fetchReviews: vi.fn(async () => [
    {
      id: 31,
      rating: 5,
      content: "profile entry",
      version: "1.0.0",
      packageArch: "amd64",
      clientArch: "amd64",
      distro: "deepin 25",
      origin: "apm",
      category: "office",
      createdAt: "2026-05-20T00:00:00Z",
      updatedAt: "2026-05-20T00:00:00Z",
      userDisplayName: "Detail User",
      userAvatarUrl: "https://bbs.spark-app.store/avatar-detail.png",
      canDelete: false,
      replies: [],
    },
  ]),
  fetchSyncedAppList: vi.fn(async () => null),
  submitReview: vi.fn(),
  likeReview: vi.fn(),
  createReviewReply: vi.fn(),
  deleteReview: vi.fn(),
  likeReviewReply: vi.fn(),
  deleteReviewReply: vi.fn(),
  listDownloadedApps: vi.fn(async () => downloadedList([])),
  listFavoriteFolders: vi.fn(async () => favoriteFolders),
  listFavoriteItems: vi.fn(async () => favoriteItems),
  uploadSyncedAppList: vi.fn(),
  setBackendToken: vi.fn(),
}));

describe("App account placeholders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        coverUrl:
          "https://bbs.spark-app.store/assets/covers/JizZCVjiSFASrEfp.jpg",
        forumLevel: "管理员",
        forumGroups: ["管理员"],
      },
    });
    vi.mocked(fetchRatingSummary).mockResolvedValue({
      averageRating: 5,
      reviewCount: 1,
      starCounts: { 5: 1 },
    });
    vi.mocked(fetchReviews).mockResolvedValue([
      {
        id: 31,
        rating: 5,
        content: "profile entry",
        version: "1.0.0",
        packageArch: "amd64",
        clientArch: "amd64",
        distro: "deepin 25",
        origin: "apm",
        category: "office",
        createdAt: "2026-05-20T00:00:00Z",
        updatedAt: "2026-05-20T00:00:00Z",
        userDisplayName: "Detail User",
        userAvatarUrl: "https://bbs.spark-app.store/avatar-detail.png",
        canDelete: false,
        replies: [],
      },
    ]);

    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    );
    vi.stubGlobal("scrollTo", vi.fn());
    class MockIntersectionObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("shows user management as a global modal from the logged-in quick menu", async () => {
    render(App);

    await fireEvent.click(await screen.findByText("全部应用"));
    expect(await screen.findByText("wps · 1.0.0")).toBeTruthy();

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("用户管理"));

    expect(
      await screen.findByRole("dialog", { name: "用户管理" }),
    ).toBeTruthy();
    const frame = await screen.findByTitle("星火账号用户管理");
    expect(frame).toBeTruthy();
    expect((frame as HTMLIFrameElement).src).toContain(
      "account.spark-app.store",
    );
    expect(screen.getByText("wps · 1.0.0")).toBeTruthy();
    expect(screen.queryByText("请登录后查看和管理账号信息。")).toBeNull();
  });

  it("opens an in-app profile modal from review author clicks", async () => {
    render(App);

    await fireEvent.click(await screen.findByText("全部应用"));
    await fireEvent.click(await screen.findByText("WPS"));
    await fireEvent.click(
      await screen.findByRole("button", { name: "Detail User" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "用户资料" });
    expect(dialog).toBeTruthy();
    expect(within(dialog).getByText("Detail User")).toBeTruthy();
  });

  it("enriches the current user's own review profile without a review user id", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    vi.mocked(fetchReviews).mockResolvedValueOnce([
      {
        id: 32,
        rating: 5,
        content: "own profile entry",
        version: "1.0.0",
        packageArch: "amd64",
        clientArch: "amd64",
        distro: "deepin 25",
        origin: "apm",
        category: "office",
        createdAt: "2026-05-20T00:00:00Z",
        updatedAt: "2026-05-20T00:00:00Z",
        userDisplayName: "Momen",
        userAvatarUrl: "",
        isAuthor: true,
        canDelete: false,
        replies: [],
      },
    ]);

    render(App);

    await fireEvent.click(await screen.findByText("全部应用"));
    await fireEvent.click(await screen.findByText("WPS"));
    await fireEvent.click(
      await screen.findByRole("button", { name: "查看Momen的资料" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "用户资料" });
    expect(within(dialog).getByText("@momen")).toBeTruthy();
    expect(within(dialog).getByText("管理员")).toBeTruthy();
    expect(
      within(dialog).getByRole("button", { name: "查看论坛资料" }),
    ).toBeTruthy();
    expect(openSpy).not.toHaveBeenCalled();

    await fireEvent.click(
      within(dialog).getByRole("button", { name: "查看论坛资料" }),
    );

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining("/u/momen"),
      "_blank",
      "noopener,noreferrer",
    );
  });

  it("shows the favorites placeholder from the logged-in quick menu", async () => {
    render(App);

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    await fireEvent.click(screen.getByText("我的收藏"));

    expect(
      await screen.findByRole("heading", { name: "我的收藏" }),
    ).toBeTruthy();
    expect(screen.queryByText("请登录后查看我的收藏。")).toBeNull();
  });

  it("shows favorite management as a standalone page without category pills", async () => {
    render(App);

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    await fireEvent.click(screen.getByText("我的收藏"));

    expect(
      await screen.findByRole("heading", { name: "我的收藏" }),
    ).toBeTruthy();
    expect(await screen.findByText("默认收藏夹 (1)")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /办公/ })).toBeNull();
  });

  it("loads favorite state when opening app detail directly", async () => {
    render(App);

    await fireEvent.click(await screen.findByText("全部应用"));
    await fireEvent.click(await screen.findByText("wps · 1.0.0"));

    expect(
      await screen.findByRole("button", { name: "已收藏 · 默认收藏夹" }),
    ).toBeTruthy();
    expect(listFavoriteFolders).toHaveBeenCalled();
    expect(listFavoriteItems).toHaveBeenCalledWith(7);
  });

  it("shows a newly created favorite folder immediately on the management page", async () => {
    const createdFolder: FavoriteFolder = {
      id: 8,
      name: "办公收藏",
      itemCount: 0,
      createdAt: "2026-05-18T00:00:00Z",
      updatedAt: "2026-05-18T00:00:00Z",
    };
    vi.spyOn(window, "prompt").mockReturnValue("办公收藏");
    vi.mocked(createFavoriteFolder).mockResolvedValueOnce(createdFolder);
    vi.mocked(listFavoriteFolders).mockResolvedValue(favoriteFolders);

    render(App);

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    await fireEvent.click(screen.getByText("我的收藏"));
    expect(
      await screen.findByRole("heading", { name: "我的收藏" }),
    ).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "新建收藏夹" }));

    expect(createFavoriteFolder).toHaveBeenCalledWith("办公收藏");
    expect(await screen.findByText("办公收藏 (0)")).toBeTruthy();
    expect(await screen.findByText("当前收藏夹暂无应用。")).toBeTruthy();
  });

  it("shows detail favorite state for an app added to a non-active folder", async () => {
    const folders = [
      favoriteFolders[0],
      {
        id: 8,
        name: "办公收藏",
        itemCount: 0,
        createdAt: "2026-05-18T00:00:00Z",
        updatedAt: "2026-05-18T00:00:00Z",
      },
    ];
    vi.mocked(listFavoriteFolders)
      .mockResolvedValueOnce(folders)
      .mockResolvedValueOnce(folders);
    vi.mocked(listFavoriteItems).mockResolvedValue([]);
    vi.mocked(addFavoriteItem).mockResolvedValueOnce({
      ...favoriteItems[0],
      id: 12,
    });

    render(App);

    await fireEvent.click(await screen.findByText("全部应用"));
    await fireEvent.click(await screen.findByText("wps · 1.0.0"));
    expect(await screen.findByRole("heading", { name: "WPS" })).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    await fireEvent.click(await screen.findByLabelText("收藏到 办公收藏"));
    await fireEvent.click(screen.getByRole("button", { name: "保存收藏夹" }));

    expect(
      await screen.findByRole("button", { name: "已收藏 · 办公收藏" }),
    ).toBeTruthy();
  });

  it("adds a favorite through the fallback default folder", async () => {
    vi.mocked(listFavoriteFolders)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(favoriteFolders);
    vi.mocked(listFavoriteItems).mockResolvedValueOnce([]);
    vi.mocked(addFavoriteItem).mockResolvedValueOnce(favoriteItems[0]);

    render(App);

    await fireEvent.click(await screen.findByText("全部应用"));
    await fireEvent.click(await screen.findByText("wps · 1.0.0"));
    expect(await screen.findByRole("heading", { name: "WPS" })).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    await fireEvent.click(await screen.findByLabelText("收藏到 默认收藏夹"));
    await fireEvent.click(screen.getByRole("button", { name: "保存收藏夹" }));

    expect(addFavoriteItem).toHaveBeenCalledWith(
      "default",
      expect.objectContaining({ pkgname: "wps" }),
    );
  });

  it("ignores stale favorite refreshes while opening the detail selector", async () => {
    const refreshFolders = createDeferred<FavoriteFolder[]>();
    const selectorFolders = createDeferred<FavoriteFolder[]>();
    const staleFolder = {
      id: 9,
      name: "旧收藏夹",
      itemCount: 0,
      createdAt: "2026-05-18T00:00:00Z",
      updatedAt: "2026-05-18T00:00:00Z",
    };
    const currentFolder = {
      id: 8,
      name: "办公收藏",
      itemCount: 0,
      createdAt: "2026-05-18T00:00:00Z",
      updatedAt: "2026-05-18T00:00:00Z",
    };
    vi.mocked(listFavoriteFolders)
      .mockReturnValueOnce(refreshFolders.promise)
      .mockReturnValueOnce(selectorFolders.promise);
    vi.mocked(listFavoriteItems).mockResolvedValue([]);

    render(App);

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    await fireEvent.click(screen.getByText("我的收藏"));
    await fireEvent.click(await screen.findByText("全部应用"));
    await fireEvent.click(await screen.findByText("wps · 1.0.0"));
    expect(await screen.findByRole("heading", { name: "WPS" })).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    selectorFolders.resolve([currentFolder]);
    expect(await screen.findByLabelText("收藏到 办公收藏")).toBeTruthy();

    refreshFolders.resolve([staleFolder]);
    await refreshFolders.promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.getByLabelText("收藏到 办公收藏")).toBeTruthy();
    expect(screen.queryByLabelText("收藏到 旧收藏夹")).toBeNull();
  });

  it("shows detail favorite state from a non-active backend folder", async () => {
    const folders = [
      favoriteFolders[0],
      {
        id: 8,
        name: "办公收藏",
        itemCount: 1,
        createdAt: "2026-05-18T00:00:00Z",
        updatedAt: "2026-05-18T00:00:00Z",
      },
    ];
    vi.mocked(listFavoriteFolders).mockResolvedValueOnce(folders);
    vi.mocked(listFavoriteItems)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(favoriteItems);

    render(App);

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    await fireEvent.click(screen.getByText("我的收藏"));
    expect(
      await screen.findByRole("heading", { name: "我的收藏" }),
    ).toBeTruthy();

    await fireEvent.click(await screen.findByText("全部应用"));
    await fireEvent.click(await screen.findByText("wps · 1.0.0"));

    expect(
      await screen.findByRole("button", { name: "已收藏 · 办公收藏" }),
    ).toBeTruthy();
  });

  it("saves favorite folder checkbox changes from the detail selector", async () => {
    const folders = [
      favoriteFolders[0],
      {
        id: 8,
        name: "办公收藏",
        itemCount: 0,
        createdAt: "2026-05-18T00:00:00Z",
        updatedAt: "2026-05-18T00:00:00Z",
      },
    ];
    vi.mocked(listFavoriteFolders).mockResolvedValue(folders);
    vi.mocked(listFavoriteItems).mockImplementation(async (folderId: number) =>
      folderId === 7 ? favoriteItems : [],
    );
    vi.mocked(addFavoriteItem).mockResolvedValueOnce({
      ...favoriteItems[0],
      id: 12,
    });
    vi.mocked(deleteFavoriteItem).mockResolvedValueOnce(undefined);

    render(App);

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("我的收藏"));
    expect(
      await screen.findByRole("heading", { name: "我的收藏" }),
    ).toBeTruthy();

    await fireEvent.click(await screen.findByText("全部应用"));
    await fireEvent.click(await screen.findByText("wps · 1.0.0"));
    expect(await screen.findByRole("heading", { name: "WPS" })).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "已收藏 · 默认收藏夹" }),
    ).toBeTruthy();

    await fireEvent.click(
      screen.getByRole("button", { name: "已收藏 · 默认收藏夹" }),
    );
    await fireEvent.click(await screen.findByLabelText("收藏到 默认收藏夹"));
    await fireEvent.click(await screen.findByLabelText("收藏到 办公收藏"));
    await fireEvent.click(screen.getByRole("button", { name: "保存收藏夹" }));

    expect(deleteFavoriteItem).toHaveBeenCalledWith(7, 11);
    expect(addFavoriteItem).toHaveBeenCalledWith(
      8,
      expect.objectContaining({
        pkgname: "wps",
      }),
    );
  });

  it("creates a folder from the favorite selector without closing it", async () => {
    const createdFolder = {
      id: 8,
      name: "办公收藏",
      itemCount: 0,
      createdAt: "2026-05-18T00:00:00Z",
      updatedAt: "2026-05-18T00:00:00Z",
    };
    vi.spyOn(window, "prompt").mockReturnValue("办公收藏");
    vi.mocked(createFavoriteFolder).mockResolvedValueOnce(createdFolder);
    vi.mocked(listFavoriteFolders)
      .mockResolvedValueOnce(favoriteFolders)
      .mockResolvedValueOnce([favoriteFolders[0], createdFolder]);
    vi.mocked(listFavoriteItems)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    vi.mocked(addFavoriteItem).mockResolvedValueOnce(favoriteItems[0]);

    render(App);

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("我的收藏"));
    expect(
      await screen.findByRole("heading", { name: "我的收藏" }),
    ).toBeTruthy();

    await fireEvent.click(await screen.findByText("全部应用"));
    await fireEvent.click(await screen.findByText("wps · 1.0.0"));
    expect(await screen.findByRole("heading", { name: "WPS" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "收藏" }));
    await fireEvent.click(
      await screen.findByRole("button", { name: "新建收藏夹" }),
    );

    expect(createFavoriteFolder).toHaveBeenCalledWith("办公收藏");
    expect(
      await screen.findByRole("dialog", { name: "选择收藏夹" }),
    ).toBeTruthy();
    expect(await screen.findByLabelText("收藏到 办公收藏")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "保存收藏夹" }));

    expect(addFavoriteItem).toHaveBeenCalledWith(
      8,
      expect.objectContaining({ pkgname: "wps" }),
    );
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

  it("clears favorite data and leaves protected favorites view after logout", async () => {
    render(App);

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("我的收藏"));

    expect(
      await screen.findByRole("heading", { name: "我的收藏" }),
    ).toBeTruthy();
    expect(await screen.findByText("默认收藏夹 (1)")).toBeTruthy();
    expect(await screen.findByText("wps · office")).toBeTruthy();

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    if (!screen.queryByText("退出登录")) {
      await fireEvent.click(
        await screen.findByRole("button", { name: /^Momen$/ }),
      );
    }
    await fireEvent.click(screen.getByText("退出登录"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "登录 / 注册" })).toBeTruthy();
    });
    expect(screen.queryByText("默认收藏夹 (1)")).toBeNull();
    expect(screen.queryByText("wps · office")).toBeNull();
    expect(screen.queryByRole("heading", { name: "我的收藏" })).toBeNull();
  });

  it("does not reopen the favorite selector when folder loading resolves after logout", async () => {
    const slowFolders = createDeferred<FavoriteFolder[]>();
    vi.mocked(listFavoriteFolders).mockReturnValueOnce(slowFolders.promise);
    render(App);

    await fireEvent.click(await screen.findByText("全部应用"));
    await fireEvent.click(await screen.findByText("wps · 1.0.0"));
    expect(await screen.findByRole("heading", { name: "WPS" })).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "收藏" }));

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    if (!screen.queryByText("退出登录")) {
      await fireEvent.click(
        await screen.findByRole("button", { name: /^Momen$/ }),
      );
    }
    await fireEvent.click(screen.getByText("退出登录"));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "登录 / 注册" })).toBeTruthy();
    });

    slowFolders.resolve([
      {
        id: 42,
        name: "旧账号收藏夹",
        itemCount: 1,
        createdAt: "2026-05-18T00:00:00Z",
        updatedAt: "2026-05-18T00:00:00Z",
      },
    ]);
    await slowFolders.promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByText("旧账号收藏夹 (1)")).toBeNull();
    expect(screen.queryByText("wps · office")).toBeNull();
    expect(screen.queryByText("旧账号收藏夹")).toBeNull();
    expect(screen.queryByRole("dialog", { name: "选择收藏夹" })).toBeNull();
  });

  it("ignores downloaded history that resolves after switching users", async () => {
    const firstHistory = createDeferred<DownloadedAppList>();
    const secondHistory = createDeferred<DownloadedAppList>();
    vi.mocked(listDownloadedApps)
      .mockReturnValueOnce(firstHistory.promise)
      .mockReturnValueOnce(secondHistory.promise);
    render(App);

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("用户管理"));
    expect(await screen.findByTitle("星火账号用户管理")).toBeTruthy();

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    if (!screen.queryByText("退出登录")) {
      await fireEvent.click(
        await screen.findByRole("button", { name: /^Momen$/ }),
      );
    }
    await fireEvent.click(screen.getByText("退出登录"));
    setSecondUserSession();

    const secondUserButton = await screen.findByRole("button", {
      name: /^Second User$/,
    });
    if (!screen.queryByText("用户管理")) {
      await fireEvent.click(secondUserButton);
    }
    await fireEvent.click(await screen.findByText("用户管理"));
    secondHistory.resolve(downloadedList([]));
    const secondUserFrame = await screen.findByTitle("星火账号用户管理");
    expect((secondUserFrame as HTMLIFrameElement).src).toContain("user=second");

    firstHistory.resolve(
      downloadedList([
        {
          id: 77,
          appKey: "app:office:old-account-app",
          pkgname: "old-account-app",
          name: "旧账号应用",
          category: "office",
          selectedOrigin: "apm",
          version: "1.0.0",
          packageArch: "amd64",
          downloadedAt: "2026-05-18T00:00:00Z",
        },
      ]),
    );
    await firstHistory.promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByText("旧账号应用")).toBeNull();
    expect(screen.getByTitle("星火账号用户管理")).toBeTruthy();
  });

  it("ignores older downloaded history refreshes for the same user", async () => {
    const firstHistory = createDeferred<DownloadedAppList>();
    const secondHistory = createDeferred<DownloadedAppList>();
    vi.mocked(listDownloadedApps)
      .mockReturnValueOnce(firstHistory.promise)
      .mockReturnValueOnce(secondHistory.promise);
    render(App);

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("用户管理"));
    await fireEvent.click(screen.getByRole("button", { name: "刷新" }));

    secondHistory.resolve(
      downloadedList([
        {
          id: 88,
          appKey: "app:office:new-app",
          pkgname: "new-app",
          name: "新下载应用",
          category: "office",
          selectedOrigin: "apm",
          version: "2.0.0",
          packageArch: "amd64",
          downloadedAt: "2026-05-18T00:00:00Z",
        },
      ]),
    );
    expect(await screen.findByTitle("星火账号用户管理")).toBeTruthy();

    firstHistory.resolve(
      downloadedList([
        {
          id: 77,
          appKey: "app:office:old-app",
          pkgname: "old-app",
          name: "旧下载应用",
          category: "office",
          selectedOrigin: "apm",
          version: "1.0.0",
          packageArch: "amd64",
          downloadedAt: "2026-05-18T00:00:00Z",
        },
      ]),
    );
    await firstHistory.promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByText("旧下载应用")).toBeNull();
    expect(screen.queryByText("新下载应用")).toBeNull();
  });

  it("ignores older favorite folder refreshes for the same user", async () => {
    const firstFolders = createDeferred<FavoriteFolder[]>();
    const secondFolders = createDeferred<FavoriteFolder[]>();
    vi.mocked(listFavoriteFolders)
      .mockReturnValueOnce(firstFolders.promise)
      .mockReturnValueOnce(secondFolders.promise);
    render(App);

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    await fireEvent.click(screen.getByRole("button", { name: "我的收藏" }));
    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    if (!screen.queryByRole("button", { name: "我的收藏" })) {
      await fireEvent.click(
        await screen.findByRole("button", { name: /^Momen$/ }),
      );
    }
    await fireEvent.click(screen.getByRole("button", { name: "我的收藏" }));

    secondFolders.resolve([
      {
        id: 42,
        name: "新收藏夹",
        itemCount: 0,
        createdAt: "2026-05-18T00:00:00Z",
        updatedAt: "2026-05-18T00:00:00Z",
      },
    ]);
    expect(await screen.findByText("新收藏夹 (0)")).toBeTruthy();

    firstFolders.resolve([
      {
        id: 41,
        name: "旧收藏夹",
        itemCount: 0,
        createdAt: "2026-05-18T00:00:00Z",
        updatedAt: "2026-05-18T00:00:00Z",
      },
    ]);
    await firstFolders.promise;
    await Promise.resolve();
    await Promise.resolve();

    expect(screen.queryByText("旧收藏夹 (0)")).toBeNull();
    expect(screen.getByText("新收藏夹 (0)")).toBeTruthy();
  });

  it("restores cloud apps by origin and package when category changed", async () => {
    vi.mocked(fetchSyncedAppList).mockResolvedValueOnce({
      snapshotName: "默认列表",
      clientArch: "amd64",
      distro: "deepin 25",
      updatedAt: "2026-05-18T00:00:00Z",
      items: [
        {
          pkgname: "wps",
          origin: "apm",
          category: "legacy-office",
          version: "1.0.0",
          packageArch: "amd64",
          appName: "WPS Cloud",
          iconUrl: "",
        },
      ],
    });
    invoke.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === "get-store-filter") return "apm";
      if (channel === "check-spark-available") return false;
      if (channel === "check-apm-available") return true;
      if (channel === "get-app-version") return "5.0.0";
      if (channel === "get-system-info") return { distro: "deepin 25" };
      if (channel === "check-installed") return false;
      if (channel === "list-installed") {
        const request = payload as { origin?: string };
        if (request.origin === "apm") return { success: true, apps: [] };
      }
      return [];
    });
    render(App);

    await fireEvent.click(await screen.findByText("应用管理"));
    await fireEvent.click(
      await screen.findByRole("button", { name: /从账号恢复/ }),
    );
    await fireEvent.click(await screen.findByLabelText("WPS Cloud"));
    await fireEvent.click(screen.getByRole("button", { name: "加入安装队列" }));

    await waitFor(() => {
      expect(window.ipcRenderer.send).toHaveBeenCalledWith(
        "queue-install",
        expect.stringContaining('"pkgname":"wps"'),
      );
    });
  });

  it("keeps the installed modal scoped to the active origin after sync", async () => {
    invoke.mockImplementation(async (channel: string, payload?: unknown) => {
      if (channel === "get-store-filter") return "both";
      if (channel === "check-spark-available") return true;
      if (channel === "check-apm-available") return true;
      if (channel === "get-app-version") return "5.0.0";
      if (channel === "get-system-info") return { distro: "deepin 25" };
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
    vi.mocked(uploadSyncedAppList).mockResolvedValueOnce(syncedList([]));
    render(App);

    await fireEvent.click(await screen.findByText("应用管理"));
    const modal = screen.getByText("已安装应用").closest(".fixed");
    if (!(modal instanceof HTMLElement)) throw new Error("modal not found");
    expect(within(modal).getByText("暂无已安装应用")).toBeTruthy();

    await fireEvent.click(
      within(modal).getByRole("button", { name: /同步到账号/ }),
    );

    await waitFor(() => {
      expect(uploadSyncedAppList).toHaveBeenCalled();
    });
    expect(within(modal).queryByText("WPS")).toBeNull();
    expect(within(modal).getByText("暂无已安装应用")).toBeTruthy();
  });

  it("ignores overlapping installed sync requests", async () => {
    const syncUpload = createDeferred<SyncedAppList>();
    vi.mocked(uploadSyncedAppList).mockReturnValue(syncUpload.promise);
    invoke.mockImplementation(async (channel: string) => {
      if (channel === "get-store-filter") return "apm";
      if (channel === "check-spark-available") return false;
      if (channel === "check-apm-available") return true;
      if (channel === "get-app-version") return "5.0.0";
      if (channel === "get-system-info") return { distro: "deepin 25" };
      if (channel === "list-installed") return { success: true, apps: [] };
      return [];
    });
    render(App);

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("用户管理"));
    expect(await screen.findByTitle("星火账号用户管理")).toBeTruthy();
    syncUpload.resolve(syncedList([]));
    expect(uploadSyncedAppList).not.toHaveBeenCalled();
  });

  it("clears manual sync feedback before another user opens account management", async () => {
    const syncUpload = createDeferred<SyncedAppList>();
    vi.mocked(uploadSyncedAppList).mockReturnValue(syncUpload.promise);
    invoke.mockImplementation(async (channel: string) => {
      if (channel === "get-store-filter") return "apm";
      if (channel === "check-spark-available") return false;
      if (channel === "check-apm-available") return true;
      if (channel === "get-app-version") return "5.0.0";
      if (channel === "get-system-info") return { distro: "deepin 25" };
      if (channel === "list-installed") return { success: true, apps: [] };
      return [];
    });
    render(App);

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("用户管理"));
    expect(await screen.findByTitle("星火账号用户管理")).toBeTruthy();
    syncUpload.resolve(syncedList([]));
    expect(screen.queryByText("同步完成")).toBeNull();

    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    if (!screen.queryByText("退出登录")) {
      await fireEvent.click(
        await screen.findByRole("button", { name: /^Momen$/ }),
      );
    }
    await fireEvent.click(screen.getByText("退出登录"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "登录 / 注册" })).toBeTruthy();
    });

    setSecondUserSession();
    const secondUserButton = await screen.findByRole("button", {
      name: /^Second User$/,
    });
    if (!screen.queryByText("用户管理")) {
      await fireEvent.click(secondUserButton);
    }
    await fireEvent.click(await screen.findByText("用户管理"));

    expect(await screen.findByTitle("星火账号用户管理")).toBeTruthy();
    expect(screen.queryByText("同步完成")).toBeNull();
  });

  it("does not upload stale sync candidates after logout", async () => {
    const slowInstalled = createDeferred<{
      success: true;
      apps: Array<{
        pkgname: string;
        name: string;
        version: string;
        arch: string;
        flags: string;
        origin: "apm";
      }>;
    }>();
    let listInstalledCalls = 0;
    invoke.mockImplementation(async (channel: string) => {
      if (channel === "get-store-filter") return "apm";
      if (channel === "check-spark-available") return false;
      if (channel === "check-apm-available") return true;
      if (channel === "get-app-version") return "5.0.0";
      if (channel === "get-system-info") return { distro: "deepin 25" };
      if (channel === "list-installed") {
        listInstalledCalls += 1;
        if (listInstalledCalls === 1) return slowInstalled.promise;
        return { success: true, apps: [] };
      }
      return [];
    });
    vi.mocked(uploadSyncedAppList).mockResolvedValue(syncedList([]));
    render(App);

    await fireEvent.click(await screen.findByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByText("用户管理"));
    expect(await screen.findByTitle("星火账号用户管理")).toBeTruthy();
    await fireEvent.click(
      await screen.findByRole("button", { name: /^Momen$/ }),
    );
    if (!screen.queryByText("退出登录")) {
      await fireEvent.click(
        await screen.findByRole("button", { name: /^Momen$/ }),
      );
    }
    await fireEvent.click(screen.getByText("退出登录"));

    slowInstalled.resolve({
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
    });
    await slowInstalled.promise;
    await Promise.resolve();

    setSecondUserSession();
    const secondUserButton = await screen.findByRole("button", {
      name: /^Second User$/,
    });
    if (!screen.queryByText("用户管理")) {
      await fireEvent.click(secondUserButton);
    }
    await fireEvent.click(await screen.findByText("用户管理"));
    expect(await screen.findByTitle("星火账号用户管理")).toBeTruthy();
    const uploadedItemNames = vi
      .mocked(uploadSyncedAppList)
      .mock.calls.flatMap(([payload]) =>
        payload.items.map((item) => item.pkgname),
      );
    expect(uploadedItemNames).not.toContain("wps");
  });
});
