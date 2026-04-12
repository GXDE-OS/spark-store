import { beforeEach, describe, expect, it, vi } from "vitest";

describe("processInstall queue forwarding", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("forwards update-center queue-install events back to the main install queue", async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>();
    const send = vi.fn();
    const on = vi.fn(
      (channel: string, handler: (...args: unknown[]) => void) => {
        handlers.set(channel, handler);
      },
    );

    Object.assign(window.ipcRenderer, {
      on,
      send,
      invoke: vi.fn(),
    });

    await import("@/modules/processInstall");

    const payload = JSON.stringify({
      id: 7,
      pkgname: "spark-weather",
      origin: "spark",
      upgradeOnly: true,
    });

    handlers.get("queue-install")?.({}, payload);

    expect(send).toHaveBeenCalledWith("queue-install", payload);
  });
});
