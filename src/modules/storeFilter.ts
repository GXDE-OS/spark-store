import type { StoreFilter } from "@/global/typedefinition";

export interface SourceAvailability {
  spark: boolean;
  apm: boolean;
}

export const isOriginEnabled = (
  storeFilter: StoreFilter,
  origin: "spark" | "apm",
): boolean => {
  return storeFilter === "both" || storeFilter === origin;
};

export const getDefaultInstalledOrigin = (
  storeFilter: StoreFilter,
  availability: SourceAvailability,
): "spark" | "apm" | null => {
  if (storeFilter === "spark") {
    return availability.spark ? "spark" : null;
  }

  if (storeFilter === "apm") {
    return availability.apm ? "apm" : null;
  }

  if (availability.apm) {
    return "apm";
  }

  if (availability.spark) {
    return "spark";
  }

  return null;
};

export const getEffectiveStoreFilter = (
  storeFilter: StoreFilter,
  availability: SourceAvailability,
): StoreFilter | null => {
  if (storeFilter === "spark") {
    return availability.spark ? "spark" : null;
  }

  if (storeFilter === "apm") {
    return availability.apm ? "apm" : null;
  }

  if (availability.spark && availability.apm) {
    return "both";
  }

  if (availability.spark) {
    return "spark";
  }

  if (availability.apm) {
    return "apm";
  }

  return null;
};

export const isOriginUsable = (
  storeFilter: StoreFilter,
  origin: "spark" | "apm",
  availability: SourceAvailability,
): boolean => {
  return isOriginEnabled(storeFilter, origin) && availability[origin];
};

export const getAllowedInstalledOrigin = (
  storeFilter: StoreFilter,
  requestedOrigin: "spark" | "apm",
  availability: SourceAvailability,
): "spark" | "apm" | null => {
  if (isOriginUsable(storeFilter, requestedOrigin, availability)) {
    return requestedOrigin;
  }

  return getDefaultInstalledOrigin(storeFilter, availability);
};
