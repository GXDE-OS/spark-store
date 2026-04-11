import { describe, expect, it } from "vitest";

import {
  countSearchMatchesByCategory,
  getSearchMatchScore,
  matchesSearch,
  rankAppsBySearch,
} from "@/modules/appSearch";
import type { App } from "@/global/typedefinition";

const createApp = (
  name: string,
  pkgname: string,
  overrides: Partial<App> = {},
): App => ({
  name,
  pkgname,
  version: "1.0.0",
  filename: "app.deb",
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
  category: "tools",
  origin: "spark",
  currentStatus: "not-installed",
  ...overrides,
});

describe("app search score", () => {
  it("scores a name match above a description-only match", () => {
    const byName = createApp("维护打包工具箱", "uos-packaging-tools");
    const byMore = createApp("QQ", "linuxqq", {
      more: "用于系统维护的聊天软件",
    });

    expect(getSearchMatchScore(byName, "维护")).toBeGreaterThan(
      getSearchMatchScore(byMore, "维护"),
    );
  });

  it("scores a name prefix match above a name contains match", () => {
    const prefix = createApp("维护打包工具箱", "toolbox");
    const contains = createApp("桌面维护助手", "desktop-maintainer");

    expect(getSearchMatchScore(prefix, "维护")).toBeGreaterThan(
      getSearchMatchScore(contains, "维护"),
    );
  });

  it("scores a name exact match above a name prefix match", () => {
    const exact = createApp("维护", "exact-match");
    const prefix = createApp("维护打包工具箱", "prefix-match");

    expect(getSearchMatchScore(exact, "维护")).toBeGreaterThan(
      getSearchMatchScore(prefix, "维护"),
    );
  });

  it("scores a pkgname match above tags and description matches", () => {
    const byPkgname = createApp("工具箱", "maintenance-toolbox");
    const byTags = createApp("应用 A", "app-a", { tags: "maintenance;tools" });
    const byMore = createApp("应用 B", "app-b", {
      more: "maintenance related guide",
    });

    expect(getSearchMatchScore(byPkgname, "maintenance")).toBeGreaterThan(
      getSearchMatchScore(byTags, "maintenance"),
    );
    expect(getSearchMatchScore(byPkgname, "maintenance")).toBeGreaterThan(
      getSearchMatchScore(byMore, "maintenance"),
    );
  });

  it("matches only against the normalized literal query", () => {
    const app = createApp("Toolbox", "maintenance-toolbox", {
      tags: "maintenance;tools",
      more: "maintenance related guide",
    });

    expect(getSearchMatchScore(app, "维护")).toBe(0);
    expect(matchesSearch(app, "维护")).toBe(false);
  });

  it("reports whether an app matches the query", () => {
    const matched = createApp("维护打包工具箱", "uos-packaging-tools");
    const ignored = createApp("Firefox", "firefox-spark", {
      more: "浏览器",
    });

    expect(matchesSearch(matched, "维护")).toBe(true);
    expect(matchesSearch(ignored, "维护")).toBe(false);
  });

  it("ranks apps in name, pkgname, tags, then description order", () => {
    const byName = createApp("maintenance 打包工具箱", "uos-packaging-tools");
    const byPkgname = createApp("工具箱", "maintenance-toolbox");
    const byTags = createApp("应用 A", "app-a", { tags: "maintenance;tool" });
    const byMore = createApp("QQ", "linuxqq", {
      more: "maintenance related chat software",
    });
    const nonMatch = createApp("Firefox", "firefox", {
      more: "browser",
    });

    expect(
      rankAppsBySearch(
        [byMore, nonMatch, byTags, byPkgname, byName],
        "maintenance",
      ).map((app) => app.pkgname),
    ).toEqual([
      "uos-packaging-tools",
      "maintenance-toolbox",
      "app-a",
      "linuxqq",
    ]);
  });

  it("keeps original order when scores tie and counts matches by category", () => {
    const first = createApp("maintenance tool A", "maint-a", {
      category: "tools",
    });
    const second = createApp("maintenance tool B", "maint-b", {
      category: "tools",
    });
    const browser = createApp("Firefox", "firefox", {
      category: "internet",
      more: "browser",
    });

    expect(rankAppsBySearch([first, second], "maintenance")).toEqual([
      first,
      second,
    ]);
    expect(
      countSearchMatchesByCategory([first, second, browser], "maintenance"),
    ).toEqual({
      all: 2,
      tools: 2,
    });
  });
});
