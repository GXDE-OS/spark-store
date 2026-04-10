import { describe, expect, it } from "vitest";

import {
  getMainWindowCloseAction,
  shouldPreventMainWindowClose,
} from "../../../../electron/main/window-close-guard";

describe("main window close guard", () => {
  it("keeps the app alive while update-center work is running", () => {
    expect(
      shouldPreventMainWindowClose({
        installTaskCount: 0,
        hasRunningUpdateCenterTasks: true,
      }),
    ).toBe(true);
  });

  it("allows close only when both install and update-center work are idle", () => {
    expect(
      shouldPreventMainWindowClose({
        installTaskCount: 0,
        hasRunningUpdateCenterTasks: false,
      }),
    ).toBe(false);
  });

  it("returns a hide action while any guarded work is active", () => {
    expect(
      getMainWindowCloseAction({
        installTaskCount: 1,
        hasRunningUpdateCenterTasks: false,
      }),
    ).toBe("hide");
  });

  it("returns a destroy action only when all guarded work is idle", () => {
    expect(
      getMainWindowCloseAction({
        installTaskCount: 0,
        hasRunningUpdateCenterTasks: false,
      }),
    ).toBe("destroy");
  });
});
