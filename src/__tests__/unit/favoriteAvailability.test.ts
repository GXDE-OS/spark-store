import { describe, expect, it } from "vitest";

import { resolveFavoriteItems } from "@/modules/favoriteAvailability";
import type { App, FavoriteItem } from "@/global/typedefinition";

const app = (origin: "spark" | "apm", overrides: Partial<App> = {}): App => ({
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
  origin,
  currentStatus: "not-installed",
  arch: "amd64",
  ...overrides,
});

const favorite: FavoriteItem = {
  id: 1,
  appKey: "app:office:wps",
  pkgname: "wps",
  name: "WPS",
  category: "office",
  iconUrl: "",
  createdAt: "2026-05-18T00:00:00Z",
};

describe("favoriteAvailability", () => {
  it("marks downlisted favorites", () => {
    expect(
      resolveFavoriteItems(
        [favorite],
        [],
        [],
        { spark: true, apm: true },
        "both",
      )[0].status,
    ).toBe("downlisted");
  });

  it("selects preferred installable variant", () => {
    const resolved = resolveFavoriteItems(
      [favorite],
      [app("spark"), app("apm")],
      [],
      { spark: true, apm: true },
      "both",
    )[0];
    expect(resolved.status).toBe("installable");
    expect(resolved.selectedApp?.origin).toBe("apm");
  });

  it("marks installed favorites", () => {
    const resolved = resolveFavoriteItems(
      [favorite],
      [app("apm")],
      [app("apm", { currentStatus: "installed" })],
      { spark: true, apm: true },
      "both",
    )[0];
    expect(resolved.status).toBe("installed");
  });
});
