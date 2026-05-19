import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it, vi } from "vitest";

import AppDetailPage from "@/components/AppDetailPage.vue";
import type { App, ReviewTags } from "@/global/typedefinition";

vi.mock("@/components/ReviewsPanel.vue", () => ({
  default: {
    name: "ReviewsPanel",
    props: ["appKey", "tags", "loggedIn"],
    template:
      '<div data-testid="reviews-panel" :data-app-key="appKey" :data-origin="tags.origin" :data-version="tags.version"></div>',
  },
}));

const app: App = {
  name: "WPS",
  pkgname: "wps",
  version: "1.0.0",
  filename: "wps_1.0.0_amd64.deb",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "110M",
  more: "Office suite",
  tags: "office",
  img_urls: [],
  icons: "",
  category: "office",
  origin: "apm",
  currentStatus: "not-installed",
};

const sparkApp: App = {
  ...app,
  name: "WPS Spark",
  version: "2.0.0",
  filename: "wps_2.0.0_amd64.deb",
  origin: "spark",
};

const apmApp: App = {
  ...app,
  name: "WPS APM",
  version: "1.0.0",
  filename: "wps_1.0.0_amd64.deb",
  origin: "apm",
};

const mergedApp: App = {
  ...sparkApp,
  isMerged: true,
  sparkApp,
  apmApp,
  viewingOrigin: "spark",
};

const sparkTags: ReviewTags = {
  origin: "spark",
  category: "office",
  pkgname: "wps",
  version: "2.0.0",
  packageArch: "amd64",
  clientArch: "amd64",
  distro: "deepin 25",
};

describe("AppDetailPage", () => {
  it("renders as page, emits back, and gates favorite for anonymous users", async () => {
    const rendered = render(AppDetailPage, {
      props: {
        app,
        screenshots: [],
        sparkInstalled: false,
        apmInstalled: false,
        loggedIn: false,
        reviewAppKey: "apm:amd64-apm:office:wps",
        reviewTags: null,
      },
    });

    expect(screen.getByText("Office suite")).toBeTruthy();
    await fireEvent.click(screen.getByRole("button", { name: "返回" }));
    await fireEvent.click(screen.getByRole("button", { name: "收藏" }));

    expect(rendered.emitted("back")).toHaveLength(1);
    expect(rendered.emitted("request-login")?.[0]?.[0]).toBe(
      "收藏应用需要登录星火账号。",
    );
  });

  it("gates reviews for anonymous users", async () => {
    const rendered = render(AppDetailPage, {
      props: {
        app,
        screenshots: [],
        sparkInstalled: false,
        apmInstalled: false,
        loggedIn: false,
        reviewAppKey: "apm:amd64-apm:office:wps",
        reviewTags: sparkTags,
      },
    });

    expect(screen.queryByTestId("reviews-panel")).toBeNull();
    await fireEvent.click(
      screen.getByRole("button", { name: "登录后查看评价" }),
    );
    expect(rendered.emitted("request-login")?.[0]?.[0]).toBe(
      "登录后查看和发表评论。",
    );
  });

  it("updates review identity when switching a merged app origin", async () => {
    render(AppDetailPage, {
      props: {
        app: mergedApp,
        screenshots: [],
        sparkInstalled: false,
        apmInstalled: false,
        loggedIn: true,
        reviewAppKey: "spark:amd64-store:office:wps",
        reviewTags: sparkTags,
      },
    });

    expect(screen.getByTestId("reviews-panel")).toHaveAttribute(
      "data-app-key",
      "spark:amd64-store:office:wps",
    );
    expect(screen.getByTestId("reviews-panel")).toHaveAttribute(
      "data-origin",
      "spark",
    );

    await fireEvent.click(screen.getByRole("button", { name: "APM" }));

    expect(screen.getByTestId("reviews-panel")).toHaveAttribute(
      "data-app-key",
      "apm:amd64-apm:office:wps",
    );
    expect(screen.getByTestId("reviews-panel")).toHaveAttribute(
      "data-origin",
      "apm",
    );
    expect(screen.getByTestId("reviews-panel")).toHaveAttribute(
      "data-version",
      "1.0.0",
    );
  });
});
