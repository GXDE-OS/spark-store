import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveFavoriteItems } from "@/modules/favoriteAvailability";
import { loadPriorityConfig } from "@/global/storeConfig";
import type { App, FavoriteItem } from "@/global/typedefinition";

const originalFetch = globalThis.fetch;

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
  afterEach(async () => {
    vi.restoreAllMocks();
    globalThis.fetch = originalFetch;
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: false } as Response);
    await loadPriorityConfig("amd64");
    vi.restoreAllMocks();
  });

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

  it("selects preferred installable variant", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        sparkPriority: { pkgnames: [], categories: [], tags: [] },
        apmPriority: { pkgnames: [], categories: [], tags: [] },
      }),
    } as Response);
    await loadPriorityConfig("amd64");

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

  it("selects Spark when hybrid priority config prefers Spark", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        sparkPriority: { pkgnames: ["wps"], categories: [], tags: [] },
        apmPriority: { pkgnames: [], categories: [], tags: [] },
      }),
    } as Response);
    await loadPriorityConfig("amd64");

    const resolved = resolveFavoriteItems(
      [favorite],
      [app("spark"), app("apm")],
      [],
      { spark: true, apm: true },
      "both",
    )[0];

    expect(resolved.status).toBe("installable");
    expect(resolved.selectedApp?.origin).toBe("spark");
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
