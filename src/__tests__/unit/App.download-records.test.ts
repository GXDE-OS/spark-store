import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App.vue";
import { recordDownloadedApp } from "@/modules/backendApi";
import { setAuthSession } from "@/global/authState";
import { downloads } from "@/global/downloadStatus";
import type { DownloadResult } from "@/global/typedefinition";

const invoke = vi.fn();
const send = vi.fn();
const ipcHandlers = new Map<string, (...args: unknown[]) => void>();

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
            More: "Office suite",
            Tags: "",
            img_urls: "[]",
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
  exchangeFlarumToken: vi.fn(),
  listFavoriteFolders: vi.fn(async () => []),
  listFavoriteItems: vi.fn(async () => []),
  recordDownloadedApp: vi.fn(async () => undefined),
  setBackendToken: vi.fn(),
}));

describe("App download records", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    ipcHandlers.clear();
    downloads.value = [];
    invoke.mockImplementation(async (channel: string) => {
      if (channel === "get-store-filter") return "apm";
      if (channel === "check-spark-available") return false;
      if (channel === "check-apm-available") return true;
      if (channel === "get-app-version") return "5.0.0";
      if (channel === "get-system-info") return { distro: "deepin 25" };
      if (channel === "list-installed") return { success: true, apps: [] };
      if (channel === "check-installed") return false;
      return [];
    });

    Object.assign(window.ipcRenderer, {
      invoke,
      send,
      on: vi.fn((channel: string, handler: (...args: unknown[]) => void) => {
        ipcHandlers.set(channel, handler);
      }),
      off: vi.fn(),
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
    vi.stubGlobal("scrollTo", vi.fn());
    class MockIntersectionObserver {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
    }
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  it("records a download only after the queued install completes successfully", async () => {
    render(App);

    await fireEvent.click(
      await screen.findByRole("button", { name: "全部应用 1" }),
    );
    await fireEvent.click(await screen.findByText("WPS"));
    await fireEvent.click(await screen.findByRole("button", { name: "安装" }));

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        "queue-install",
        expect.stringContaining('"pkgname":"wps"'),
      );
    });
    expect(recordDownloadedApp).not.toHaveBeenCalled();

    const queuedPayload = vi
      .mocked(send)
      .mock.calls.find(
        ([channel]) => channel === "queue-install",
      )?.[1] as string;
    const queuedDownload = JSON.parse(queuedPayload) as { id: number };
    const completion: DownloadResult = {
      id: queuedDownload.id,
      time: Date.now(),
      message: "installed",
      success: true,
      exitCode: 0,
      status: "completed",
      origin: "apm",
    };

    ipcHandlers.get("install-complete")?.({}, completion);

    await waitFor(() => {
      expect(recordDownloadedApp).toHaveBeenCalledWith(
        expect.objectContaining({
          appKey: "app:office:wps",
          pkgname: "wps",
          selectedOrigin: "apm",
        }),
      );
    });
  });

  it("keeps a pending download record through a failed install retry", async () => {
    render(App);

    await fireEvent.click(
      await screen.findByRole("button", { name: "全部应用 1" }),
    );
    await fireEvent.click(await screen.findByText("WPS"));
    await fireEvent.click(await screen.findByRole("button", { name: "安装" }));

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        "queue-install",
        expect.stringContaining('"pkgname":"wps"'),
      );
    });

    const queuedPayload = vi
      .mocked(send)
      .mock.calls.find(
        ([channel]) => channel === "queue-install",
      )?.[1] as string;
    const queuedDownload = JSON.parse(queuedPayload) as { id: number };
    const failedCompletion: DownloadResult = {
      id: queuedDownload.id,
      time: Date.now(),
      message: "failed",
      success: false,
      exitCode: 1,
      status: "failed",
      origin: "apm",
    };

    ipcHandlers.get("install-complete")?.({}, failedCompletion);
    downloads.value[0].status = "failed";

    await waitFor(() => {
      expect(recordDownloadedApp).not.toHaveBeenCalled();
      expect(screen.getByTitle("重试")).toBeInTheDocument();
    });

    await fireEvent.click(screen.getByTitle("重试"));

    const successfulCompletion: DownloadResult = {
      id: queuedDownload.id,
      time: Date.now(),
      message: "installed",
      success: true,
      exitCode: 0,
      status: "completed",
      origin: "apm",
    };

    ipcHandlers.get("install-complete")?.({}, successfulCompletion);

    await waitFor(() => {
      expect(recordDownloadedApp).toHaveBeenCalledTimes(1);
      expect(recordDownloadedApp).toHaveBeenCalledWith(
        expect.objectContaining({
          appKey: "app:office:wps",
          pkgname: "wps",
          name: "WPS",
          category: "office",
          selectedOrigin: "apm",
          version: "1.0.0",
        }),
      );
    });
  });

  it("does not record a queued install under a later logged-in user", async () => {
    render(App);

    await fireEvent.click(
      await screen.findByRole("button", { name: "全部应用 1" }),
    );
    await fireEvent.click(await screen.findByText("WPS"));
    await fireEvent.click(await screen.findByRole("button", { name: "安装" }));

    await waitFor(() => {
      expect(send).toHaveBeenCalledWith(
        "queue-install",
        expect.stringContaining('"pkgname":"wps"'),
      );
    });

    const queuedPayload = vi
      .mocked(send)
      .mock.calls.find(
        ([channel]) => channel === "queue-install",
      )?.[1] as string;
    const queuedDownload = JSON.parse(queuedPayload) as { id: number };

    await fireEvent.click(screen.getByRole("button", { name: "Momen" }));
    await fireEvent.click(await screen.findByText("退出登录"));

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

    const completion: DownloadResult = {
      id: queuedDownload.id,
      time: Date.now(),
      message: "installed",
      success: true,
      exitCode: 0,
      status: "completed",
      origin: "apm",
    };

    ipcHandlers.get("install-complete")?.({}, completion);

    await waitFor(() => {
      expect(recordDownloadedApp).not.toHaveBeenCalled();
    });
  });
});
