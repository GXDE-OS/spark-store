import { describe, expect, it } from "vitest";

import {
  buildSyncItems,
  cloudItemKey,
  cloudPackageKey,
  mergeInstalledApps,
  resolveCloudInstallCandidate,
} from "@/modules/appListSync";
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

  it("builds origin-agnostic package keys for cross-source restore detection", () => {
    expect(cloudPackageKey({ pkgname: "amber-ce" })).toBe("amber-ce");
  });

  it("merges refreshed apps without mutating active modal origin lists", () => {
    const current = [createApp({ origin: "apm", pkgname: "apm-installed" })];
    const refreshed = [
      createApp({ origin: "spark", pkgname: "spark-installed" }),
    ];

    expect(mergeInstalledApps(current, refreshed, ["spark"])).toEqual([
      expect.objectContaining({ origin: "apm", pkgname: "apm-installed" }),
      expect.objectContaining({ origin: "spark", pkgname: "spark-installed" }),
    ]);
    expect(current).toEqual([
      expect.objectContaining({ origin: "apm", pkgname: "apm-installed" }),
    ]);
  });

  it("resolves cloud restore items by exact source before package fallback", () => {
    const sparkCloudItem = {
      pkgname: "shared-app",
      origin: "spark" as const,
      category: "office",
      version: "1.0.0",
      packageArch: "amd64",
      appName: "Shared App",
      iconUrl: "",
    };
    const apmCandidate = createApp({
      origin: "apm",
      pkgname: "shared-app",
      category: "office",
    });
    const sparkCandidate = createApp({
      origin: "spark",
      pkgname: "shared-app",
      category: "office",
    });

    expect(
      resolveCloudInstallCandidate(sparkCloudItem, [
        apmCandidate,
        sparkCandidate,
      ]),
    ).toBe(sparkCandidate);
    expect(resolveCloudInstallCandidate(sparkCloudItem, [apmCandidate])).toBe(
      apmCandidate,
    );
    expect(resolveCloudInstallCandidate(sparkCloudItem, [])).toBeNull();
  });

  it("prefers same-source package fallback when the category changed", () => {
    const sparkCloudItem = {
      pkgname: "shared-app",
      origin: "spark" as const,
      category: "legacy-office",
      version: "1.0.0",
      packageArch: "amd64",
      appName: "Shared App",
      iconUrl: "",
    };
    const apmCandidate = createApp({
      origin: "apm",
      pkgname: "shared-app",
      category: "office",
    });
    const sparkCandidate = createApp({
      origin: "spark",
      pkgname: "shared-app",
      category: "productivity",
    });

    expect(
      resolveCloudInstallCandidate(sparkCloudItem, [
        apmCandidate,
        sparkCandidate,
      ]),
    ).toBe(sparkCandidate);
  });
});
