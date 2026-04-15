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
  it("keeps scroll chaining inside the modal list", () => {
    const { container } = render(InstalledAppsModal, {
      props: {
        show: true,
        apps: [],
        loading: false,
        error: "",
        activeOrigin: "spark",
        storeFilter: "both",
        apmAvailable: true,
      },
    });

    expect(screen.getByText("已安装应用")).toBeTruthy();
    const scrollContainer = container.querySelector(".overflow-y-auto");

    expect(scrollContainer?.className).toContain("overscroll-contain");
  });

  it("renders open and detail actions for a store-backed installed app", () => {
    render(InstalledAppsModal, {
      props: {
        show: true,
        apps: [createApp()],
        loading: false,
        error: "",
        activeOrigin: "spark",
        storeFilter: "both",
        apmAvailable: true,
      },
    });

    expect(screen.getByRole("button", { name: "打开" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "查看详情" })).toBeTruthy();
  });

  it("emits open-app when clicking 打开", async () => {
    const rendered = render(InstalledAppsModal, {
      props: {
        show: true,
        apps: [createApp()],
        loading: false,
        error: "",
        activeOrigin: "spark",
        storeFilter: "both",
        apmAvailable: true,
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
        show: true,
        apps: [createApp()],
        loading: false,
        error: "",
        activeOrigin: "spark",
        storeFilter: "both",
        apmAvailable: true,
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
        show: true,
        apps: [createApp({ category: "unknown", more: "Has store metadata" })],
        loading: false,
        error: "",
        activeOrigin: "spark",
        storeFilter: "both",
        apmAvailable: true,
      },
    });

    expect(screen.getByRole("button", { name: "查看详情" })).toBeTruthy();
  });

  it("hides 查看详情 for unknown-category apps", () => {
    render(InstalledAppsModal, {
      props: {
        show: true,
        apps: [createApp({ category: "unknown" })],
        loading: false,
        error: "",
        activeOrigin: "spark",
        storeFilter: "both",
        apmAvailable: true,
      },
    });

    expect(screen.queryByRole("button", { name: "查看详情" })).toBeNull();
  });
});
