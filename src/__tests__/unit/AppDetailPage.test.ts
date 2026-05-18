import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import AppDetailPage from "@/components/AppDetailPage.vue";
import type { App } from "@/global/typedefinition";

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
});
