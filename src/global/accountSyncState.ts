import { ref, watch } from "vue";

const INSTALLED_SYNC_STORAGE_KEY = "spark-store-installed-sync-enabled";
let activeSyncUserId: number | null = null;

const syncStorageKey = (userId: number | null): string =>
  userId === null
    ? INSTALLED_SYNC_STORAGE_KEY
    : `${INSTALLED_SYNC_STORAGE_KEY}:${userId}`;

const readSyncEnabled = (userId: number | null): boolean | null => {
  const savedValue = localStorage.getItem(syncStorageKey(userId));
  if (savedValue === "true") return true;
  if (savedValue === "false") return false;
  return null;
};

export const installedSyncEnabled = ref<boolean | null>(
  readSyncEnabled(activeSyncUserId),
);

export const loadInstalledSyncPreference = (userId: number | null): void => {
  activeSyncUserId = userId;
  installedSyncEnabled.value = readSyncEnabled(userId);
};

export const setInstalledSyncEnabled = (enabled: boolean): void => {
  installedSyncEnabled.value = enabled;
  localStorage.setItem(syncStorageKey(activeSyncUserId), String(enabled));
};

watch(installedSyncEnabled, (enabled) => {
  if (enabled === null) {
    localStorage.removeItem(syncStorageKey(activeSyncUserId));
    return;
  }

  localStorage.setItem(syncStorageKey(activeSyncUserId), String(enabled));
});
