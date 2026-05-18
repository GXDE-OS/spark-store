import { ref, watch } from "vue";

const INSTALLED_SYNC_STORAGE_KEY = "spark-store-installed-sync-enabled";

const readSyncEnabled = (): boolean | null => {
  const savedValue = localStorage.getItem(INSTALLED_SYNC_STORAGE_KEY);
  if (savedValue === "true") return true;
  if (savedValue === "false") return false;
  return null;
};

export const installedSyncEnabled = ref<boolean | null>(readSyncEnabled());

export const setInstalledSyncEnabled = (enabled: boolean): void => {
  installedSyncEnabled.value = enabled;
  localStorage.setItem(INSTALLED_SYNC_STORAGE_KEY, String(enabled));
};

watch(installedSyncEnabled, (enabled) => {
  if (enabled === null) {
    localStorage.removeItem(INSTALLED_SYNC_STORAGE_KEY);
    return;
  }

  localStorage.setItem(INSTALLED_SYNC_STORAGE_KEY, String(enabled));
});
