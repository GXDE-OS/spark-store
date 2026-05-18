import type { App, SyncedAppListItem } from "@/global/typedefinition";
import { parsePackageArch } from "@/modules/appIdentity";

const hasUsablePackageIdentity = (app: App): boolean => {
  return app.pkgname.trim().length > 0 && Boolean(app.origin);
};

export const buildSyncItems = (apps: App[]): SyncedAppListItem[] => {
  return apps
    .filter(
      (app) =>
        app.currentStatus === "installed" &&
        app.category !== "unknown" &&
        !app.isDependency &&
        hasUsablePackageIdentity(app),
    )
    .map((app) => ({
      pkgname: app.pkgname,
      origin: app.origin,
      category: app.category,
      version: app.version,
      packageArch: app.arch || parsePackageArch(app.filename),
      appName: app.name || app.pkgname,
      iconUrl: app.icons || "",
    }));
};

export const cloudItemKey = (
  item: Pick<SyncedAppListItem, "origin" | "pkgname">,
): string => `${item.origin}:${item.pkgname}`;
