import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const mainSource = readFileSync(
  resolve(testDir, "../../../electron/main/index.ts"),
  "utf-8",
);
const preloadSource = readFileSync(
  resolve(testDir, "../../../electron/preload/index.ts"),
  "utf-8",
);
const viteEnvSource = readFileSync(
  resolve(testDir, "../../vite-env.d.ts"),
  "utf-8",
);

describe("frameless window shell config", () => {
  it("creates the main BrowserWindow without a native frame", () => {
    expect(mainSource).toMatch(/new BrowserWindow\(\{[\s\S]*frame:\s*false/);
  });

  it("routes titlebar close through the guarded BrowserWindow close path", () => {
    expect(mainSource).toContain('ipcMain.on("window-control-close"');
    expect(mainSource).toMatch(
      /ipcMain\.on\("window-control-close"[\s\S]*win\?\.close\(\)/,
    );
    expect(mainSource).not.toMatch(
      /ipcMain\.on\("window-control-close"[\s\S]*win\?\.destroy\(\)/,
    );
  });

  it("exposes typed window controls from preload", () => {
    expect(preloadSource).toContain('exposeInMainWorld("windowControls"');
    expect(viteEnvSource).toContain("windowControls: WindowControlBridge");
  });
});
