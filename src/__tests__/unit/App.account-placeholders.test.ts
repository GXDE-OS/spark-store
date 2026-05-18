import { fireEvent, render, screen } from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import App from "@/App.vue";
import { setAuthSession } from "@/global/authState";

const invoke = vi.fn();

vi.mock("axios", () => {
  const get = vi.fn(async (url: string) => {
    if (url.includes("categories.json")) return { data: {} };
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
});
