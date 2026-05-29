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

export const cloudPackageKey = (
  item: Pick<SyncedAppListItem, "pkgname">,
): string => item.pkgname;

export const mergeInstalledApps = (
  currentApps: App[],
  refreshedApps: App[],
  refreshedOrigins: Array<"spark" | "apm">,
): App[] => {
  const refreshedKeys = new Set(
    refreshedApps.map((app) => `${app.origin}:${app.pkgname}`),
  );

  return [
    ...currentApps.filter(
      (app) =>
        !refreshedOrigins.includes(app.origin) &&
        !refreshedKeys.has(`${app.origin}:${app.pkgname}`),
    ),
    ...refreshedApps,
  ];
};

export const resolveCloudInstallCandidate = (
  item: SyncedAppListItem,
  apps: App[],
): App | null => {
  const exactMatch = apps.find(
    (app) =>
      app.pkgname === item.pkgname &&
      app.origin === item.origin &&
      app.category === item.category,
  );

  const sameOriginPackageMatch = apps.find(
    (app) => app.pkgname === item.pkgname && app.origin === item.origin,
  );

  return (
    exactMatch ??
    sameOriginPackageMatch ??
    apps.find((app) => app.pkgname === item.pkgname) ??
    null
  );
};
