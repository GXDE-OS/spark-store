import type { App, ReviewTags } from "@/global/typedefinition";

export const parsePackageArch = (filename: string): string => {
  const match = filename.match(/_([^_]+)\.deb$/);
  return match?.[1] || "unknown";
};

export const buildStoreArch = (
  origin: "spark" | "apm",
  clientArch: string,
): string => {
  return `${clientArch}-${origin === "spark" ? "store" : "apm"}`;
};

export const buildFavoriteAppKey = (app: App): string => {
  return `app:${app.category || "unknown"}:${app.pkgname}`;
};

export const buildReviewAppKey = (app: App, clientArch: string): string => {
  return `${app.origin}:${buildStoreArch(app.origin, clientArch)}:${app.category || "unknown"}:${app.pkgname}`;
};

export const getDisplayApp = (app: App | null): App | null => {
  if (!app) return null;
  if (!app.isMerged) return app;
  if (app.viewingOrigin === "spark") return app.sparkApp ?? app.apmApp ?? app;
  if (app.viewingOrigin === "apm") return app.apmApp ?? app.sparkApp ?? app;
  return app.sparkApp ?? app.apmApp ?? app;
};

export const buildReviewTags = (
  app: App,
  options: { clientArch: string; distro: string },
): ReviewTags => {
  return {
    origin: app.origin,
    category: app.category || "unknown",
    pkgname: app.pkgname,
    version: app.version,
    packageArch: parsePackageArch(app.filename),
    clientArch: options.clientArch,
    distro: options.distro,
  };
};
