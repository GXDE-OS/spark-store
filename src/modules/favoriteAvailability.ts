import {
  HYBRID_DEFAULT_PRIORITY,
  getHybridDefaultOrigin,
} from "@/global/storeConfig";
import type {
  App,
  FavoriteItem,
  ResolvedFavoriteItem,
  StoreFilter,
} from "@/global/typedefinition";

type SourceAvailability = {
  spark: boolean;
  apm: boolean;
};

const normalizeArch = (arch: string): string =>
  arch.replace(/-(store|apm)$/, "");

const appMatchesFavorite = (app: App, item: FavoriteItem): boolean =>
  app.pkgname === item.pkgname && app.category === item.category;

const appMatchesClientArch = (app: App, clientArch: string): boolean => {
  if (!app.arch) return true;
  return normalizeArch(app.arch) === normalizeArch(clientArch);
};

const sourceAllowed = (
  origin: "spark" | "apm",
  available: SourceAvailability,
  storeFilter: StoreFilter,
): boolean => {
  if (!available[origin]) return false;
  if (storeFilter === "both") return true;
  return storeFilter === origin;
};

const choosePreferredApp = (apps: App[]): App => {
  if (apps.length === 1) return apps[0];

  const referenceApp = apps.find((app) => app.origin === "spark") ?? apps[0];
  const preferredOrigin =
    getHybridDefaultOrigin(referenceApp) === "spark"
      ? HYBRID_DEFAULT_PRIORITY
      : getHybridDefaultOrigin(referenceApp);
  return apps.find((app) => app.origin === preferredOrigin) ?? apps[0];
};

export const resolveFavoriteItems = (
  items: FavoriteItem[],
  catalogApps: App[],
  installedApps: App[],
  available: SourceAvailability,
  storeFilter: StoreFilter,
  clientArch = window.apm_store.arch || "amd64",
): ResolvedFavoriteItem[] => {
  return items.map((item) => {
    const catalogMatches = catalogApps.filter((app) =>
      appMatchesFavorite(app, item),
    );

    if (catalogMatches.length === 0) {
      return {
        item,
        status: "downlisted",
        reason: "已下架",
        selectedApp: null,
      };
    }

    const installedMatch = installedApps.find((app) =>
      appMatchesFavorite(app, item),
    );
    if (installedMatch) {
      return {
        item,
        status: "installed",
        reason: "已安装",
        selectedApp: installedMatch,
      };
    }

    const archMatches = catalogMatches.filter((app) =>
      appMatchesClientArch(app, clientArch),
    );
    if (archMatches.length === 0) {
      return {
        item,
        status: "arch-unavailable",
        reason: "当前架构不可用",
        selectedApp: null,
      };
    }

    const sourceMatches = archMatches.filter((app) =>
      sourceAllowed(app.origin, available, storeFilter),
    );
    if (sourceMatches.length === 0) {
      return {
        item,
        status: "platform-unavailable",
        reason: "当前来源不可用",
        selectedApp: null,
      };
    }

    return {
      item,
      status: "installable",
      reason: "可安装",
      selectedApp: choosePreferredApp(sourceMatches),
    };
  });
};
