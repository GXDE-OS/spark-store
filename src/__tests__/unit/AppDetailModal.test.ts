import { fireEvent, render, screen } from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AppDetailModal from "@/components/AppDetailModal.vue";
import type { App, ReviewTags } from "@/global/typedefinition";

vi.mock("axios", () => ({
  default: {
    get: vi.fn(async () => ({ status: 200, data: "42" })),
  },
}));

vi.mock("@/components/ReviewsPanel.vue", () => ({
  default: {
    name: "ReviewsPanel",
    props: ["appKey", "tags", "loggedIn", "canSubmit"],
    template:
      '<div data-testid="reviews-panel" :data-app-key="appKey" :data-origin="tags.origin" :data-version="tags.version" :data-can-submit="String(canSubmit)"></div>',
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

describe("AppDetailModal", () => {
  beforeEach(() => {
    window.apm_store.arch = "amd64";
  });

  it("renders detail content inside a popup-style modal overlay", () => {
    const { container } = render(AppDetailModal, {
      attrs: { "data-app-modal": "detail" },
      props: {
        show: true,
        app,
        screenshots: [],
        sparkInstalled: false,
        apmInstalled: false,
        loggedIn: false,
        reviewAppKey: "apm:amd64-apm:office:wps",
        reviewTags: sparkTags,
      },
    });

    const overlay = container.querySelector('[data-app-modal="detail"]');
    expect(overlay).toBeTruthy();
    expect(overlay?.className).toContain("fixed");
    expect(overlay?.querySelector(".modal-panel")).toBeTruthy();
  });

  it("updates review identity when switching a merged app origin", async () => {
    render(AppDetailModal, {
      props: {
        show: true,
        app: mergedApp,
        screenshots: [],
        sparkInstalled: true,
        apmInstalled: true,
        loggedIn: true,
        reviewAppKey: "spark:amd64-store:office:wps",
        reviewTags: sparkTags,
      },
    });

    expect(screen.getByTestId("reviews-panel")).toHaveAttribute(
      "data-app-key",
      "spark:amd64-store:office:wps",
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

  it("marks reviews read-only when the selected origin is not installed", () => {
    render(AppDetailModal, {
      props: {
        show: true,
        app,
        screenshots: [],
        sparkInstalled: false,
        apmInstalled: false,
        loggedIn: true,
        reviewAppKey: "apm:amd64-apm:office:wps",
        reviewTags: sparkTags,
      },
    });

    expect(screen.getByTestId("reviews-panel")).toHaveAttribute(
      "data-can-submit",
      "false",
    );
  });
});
