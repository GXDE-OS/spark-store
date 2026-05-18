import { describe, expect, it } from "vitest";

import { buildSyncItems, cloudItemKey } from "@/modules/appListSync";
import type { App } from "@/global/typedefinition";

const createApp = (overrides: Partial<App> = {}): App => ({
  name: "Spark Notes",
  pkgname: "spark-notes",
  version: "1.0.0",
  filename: "spark-notes_1.0.0_amd64.deb",
  torrent_address: "",
  author: "",
  contributor: "",
  website: "",
  update: "",
  size: "1 MB",
  more: "",
  tags: "",
  img_urls: [],
  icons: "https://example.test/icon.png",
  category: "office",
  origin: "spark",
  currentStatus: "installed",
  ...overrides,
});

describe("appListSync", () => {
  it("builds cloud sync items for installed store-recognized user apps", () => {
    expect(buildSyncItems([createApp()])).toEqual([
      {
        pkgname: "spark-notes",
        origin: "spark",
        category: "office",
        version: "1.0.0",
        packageArch: "amd64",
        appName: "Spark Notes",
        iconUrl: "https://example.test/icon.png",
      },
    ]);
  });

  it("filters out non-installed unknown dependency and unusable package entries", () => {
    const items = buildSyncItems([
      createApp({ pkgname: "not-installed", currentStatus: "not-installed" }),
      createApp({ pkgname: "unknown-app", category: "unknown" }),
      createApp({ pkgname: "dependency", isDependency: true }),
      createApp({ pkgname: "" }),
      createApp({ pkgname: "blank-origin", origin: "spark" }),
      createApp({ pkgname: "kept", origin: "apm", arch: "arm64" }),
    ]);

    expect(items).toEqual([
      expect.objectContaining({ pkgname: "blank-origin" }),
      expect.objectContaining({ pkgname: "kept", packageArch: "arm64" }),
    ]);
  });

  it("uses pkgname as appName and blank icon when optional display fields are missing", () => {
    const app = createApp({ icons: "", pkgname: "fallback-name" });
    app.name = "";
    const [syncItem] = buildSyncItems([app]);

    expect(syncItem).toMatchObject({
      appName: "fallback-name",
      iconUrl: "",
    });
  });

  it("builds stable installed keys from origin and package", () => {
    expect(cloudItemKey({ origin: "apm", pkgname: "amber-ce" })).toBe(
      "apm:amber-ce",
    );
  });
});
