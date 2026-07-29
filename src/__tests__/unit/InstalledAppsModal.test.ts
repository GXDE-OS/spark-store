import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import InstalledAppsModal from "@/components/InstalledAppsModal.vue";
import type { App } from "@/global/typedefinition";

const createApp = (overrides: Partial<App> = {}): App => ({
  name: "Spark Notes",
  pkgname: "spark-notes",
  version: "1.0.0",
  filename: "spark-notes.deb",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "1 MB",
  more: "",
  tags: "",
  img_urls: [],
  icons: "",
  category: "office",
  origin: "spark",
  currentStatus: "installed",
  ...overrides,
});

describe("InstalledAppsModal", () => {
  const baseProps = {
    show: true,
    apps: [] as App[],
    loading: false,
    error: "",
    warning: "",
    loggedIn: false,
    syncing: false,
    syncMessage: "",
  };

  it("keeps scroll chaining inside the modal list", () => {
    const { container } = render(InstalledAppsModal, {
      props: baseProps,
    });

    expect(screen.getByText("已安装应用")).toBeTruthy();
    const scrollContainer = container.querySelector(".overflow-y-auto");

    expect(scrollContainer?.className).toContain("overscroll-contain");
  });

  it("renders open and detail actions for a store-backed installed app", () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [createApp()],
      },
    });

    expect(screen.getByRole("button", { name: "打开" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看详情" })).toBeTruthy();
  });

  it("renders the spark origin tag for spark apps", () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [createApp({ origin: "spark", name: "Spark Notes" })],
      },
    });

    // 精确匹配应用行内的来源标签（页头统计区也有 "Spark" 文案，getAllByText 过于宽泛）
    expect(screen.getByTestId("origin-tag-spark")).toBeTruthy();
  });

  it("renders the APM origin tag for APM apps", () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [
          createApp({
            origin: "apm",
            name: "APM Container",
            pkgname: "amber-pm-container",
            version: "1.0.0",
          }),
        ],
      },
    });

    // 精确匹配应用行内的来源标签（页头统计区也有 "APM" 文案，getAllByText 过于宽泛）
    expect(screen.getByTestId("origin-tag-apm")).toBeTruthy();
  });

  it("emits open-app when clicking 打开", async () => {
    const rendered = render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [createApp()],
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "打开" }));

    expect(rendered.emitted("open-app")).toHaveLength(1);
    expect(rendered.emitted("open-app")?.[0]?.[0]).toMatchObject({
      pkgname: "spark-notes",
    });
  });

  it("emits open-detail when clicking 查看详情", async () => {
    const rendered = render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [createApp()],
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "查看详情" }));

    expect(rendered.emitted("open-detail")).toHaveLength(1);
    expect(rendered.emitted("open-detail")?.[0]?.[0]).toMatchObject({
      pkgname: "spark-notes",
    });
  });

  it("shows 查看详情 for metadata-rich unknown-category apps", () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [createApp({ category: "unknown", more: "Has store metadata" })],
      },
    });

    expect(screen.getByRole("button", { name: "查看详情" })).toBeTruthy();
  });

  it("hides 查看详情 for unknown-category apps", () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [createApp({ category: "unknown" })],
      },
    });

    expect(screen.queryByRole("button", { name: "查看详情" })).toBeNull();
  });

  it("requests login for cloud actions when logged out", async () => {
    const rendered = render(InstalledAppsModal, {
      props: baseProps,
    });

    await fireEvent.click(screen.getByRole("button", { name: "同步到账号" }));
    await fireEvent.click(screen.getByRole("button", { name: "从账号恢复" }));

    expect(rendered.emitted("request-login")).toHaveLength(2);
  });

  it("emits cloud sync and restore events when logged in", async () => {
    const rendered = render(InstalledAppsModal, {
      props: {
        ...baseProps,
        loggedIn: true,
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "同步到账号" }));
    await fireEvent.click(screen.getByRole("button", { name: "从账号恢复" }));

    expect(rendered.emitted("sync-to-account")).toHaveLength(1);
    expect(rendered.emitted("restore-from-account")).toHaveLength(1);
  });

  it("disables sync button while syncing", () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        loggedIn: true,
        syncing: true,
      },
    });

    expect(screen.getByRole("button", { name: "同步中" })).toBeDisabled();
  });

  it("shows account sync feedback in the installed apps modal", () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        loggedIn: true,
        syncMessage: "同步完成",
      },
    });

    expect(screen.getByText("同步完成")).toBeTruthy();
  });

  it("filters installed apps by search query (name match)", async () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [
          createApp({ name: "Spark Notes", pkgname: "spark-notes" }),
          createApp({
            name: "Visual Studio Code",
            pkgname: "code",
            category: "dev",
            more: "https://code.visualstudio.com/",
          }),
        ],
      },
    });

    // 初始两条都在
    expect(screen.getByText("Spark Notes")).toBeTruthy();
    expect(screen.getByText("Visual Studio Code")).toBeTruthy();

    const input = screen.getByPlaceholderText("搜索已安装应用…");
    await fireEvent.update(input, "code");

    // "code" 只匹配到 pkgname 为 "code" 的项（名称不区分大小写）
    expect(screen.queryByText("Spark Notes")).toBeNull();
    expect(screen.getByText("Visual Studio Code")).toBeTruthy();
  });

  it("filters installed apps by search query (case-insensitive)", async () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [
          createApp({ name: "钉钉", pkgname: "com.alibaba.dingtalk" }),
        ],
      },
    });

    const input = screen.getByPlaceholderText("搜索已安装应用…");
    await fireEvent.update(input, "DINGTALK");

    // 包名大写不区分大小写匹配
    expect(screen.getByText("钉钉")).toBeTruthy();
  });

  it("shows a no-match hint when search query has no results", async () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [createApp({ name: "Spark Notes" })],
      },
    });

    const input = screen.getByPlaceholderText("搜索已安装应用…");
    await fireEvent.update(input, "不存在的关键字xyz");

    expect(screen.queryByText("Spark Notes")).toBeNull();
    expect(screen.getByText(/未找到匹配/)).toBeTruthy();
  });

  it("clears the search when clicking the clear button", async () => {
    render(InstalledAppsModal, {
      props: {
        ...baseProps,
        apps: [createApp()],
      },
    });

    const input = screen.getByPlaceholderText(
      "搜索已安装应用…",
    ) as HTMLInputElement;
    await fireEvent.update(input, "code");
    expect(input.value).toBe("code");

    // 清除按钮存在（仅在有内容时显示）
    const clearBtn = screen.getByRole("button", { name: "清除搜索" });
    await fireEvent.click(clearBtn);

    expect(input.value).toBe("");
    expect(screen.getByText("Spark Notes")).toBeTruthy();
  });
});
