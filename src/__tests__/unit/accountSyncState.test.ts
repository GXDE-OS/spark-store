import { beforeEach, describe, expect, it, vi } from "vitest";

describe("accountSyncState", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("scopes installed sync preference to the current user", async () => {
    const {
      installedSyncEnabled,
      loadInstalledSyncPreference,
      setInstalledSyncEnabled,
    } = await import("@/global/accountSyncState");

    loadInstalledSyncPreference(1);
    setInstalledSyncEnabled(true);

    loadInstalledSyncPreference(2);

    expect(installedSyncEnabled.value).toBeNull();

    setInstalledSyncEnabled(false);
    loadInstalledSyncPreference(1);

    expect(installedSyncEnabled.value).toBe(true);
  });
});
