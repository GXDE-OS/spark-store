import { describe, expect, it } from "vitest";

import {
  buildFavoriteAppKey,
  buildReviewAppKey,
  buildReviewTags,
  getDisplayApp,
  parsePackageArch,
} from "@/modules/appIdentity";
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
  size: "",
  more: "",
  tags: "",
  img_urls: [],
  icons: "",
  category: "office",
  origin: "apm",
  currentStatus: "not-installed",
};

describe("appIdentity", () => {
  it("builds favorite and review keys", () => {
    expect(buildFavoriteAppKey(app)).toBe("app:office:wps");
    expect(buildReviewAppKey(app, "amd64")).toBe("apm:amd64-apm:office:wps");
  });

  it("parses package arch and review tags", () => {
    expect(parsePackageArch(app.filename)).toBe("amd64");
    expect(
      buildReviewTags(app, { clientArch: "amd64", distro: "deepin 25" }),
    ).toMatchObject({
      origin: "apm",
      category: "office",
      pkgname: "wps",
      packageArch: "amd64",
    });
  });

  it("returns selected display app from merged apps", () => {
    const merged: App = {
      ...app,
      isMerged: true,
      viewingOrigin: "spark",
      sparkApp: { ...app, origin: "spark" },
      apmApp: app,
    };
    expect(getDisplayApp(merged)?.origin).toBe("spark");
  });
});
