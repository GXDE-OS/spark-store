import { beforeEach, describe, expect, it, vi } from "vitest";

import { createUpdateCenterService } from "../../../../electron/main/backend/update-center/service";

const electronMock = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: electronMock.getAllWindows,
  },
}));

describe("update-center service id forwarding", () => {
  beforeEach(() => {
    electronMock.getAllWindows.mockReset();
  });

  it("forwards renderer-assigned ids into queue-install payloads", async () => {
    const send = vi.fn();
    electronMock.getAllWindows.mockReturnValue([{ webContents: { send } }]);

    const service = createUpdateCenterService({
      loadItems: async () => [
        {
          pkgname: "spark-weather",
          source: "aptss",
          currentVersion: "1.0.0",
          nextVersion: "2.0.0",
          fileName: "spark-weather.deb",
          downloadUrl: "https://example.com/spark-weather.deb",
        },
      ],
    });

    await service.refresh();
    await service.start([{ taskKey: "aptss:spark-weather", id: 42 }]);

    expect(send).toHaveBeenCalledWith(
      "queue-install",
      JSON.stringify({
        id: 42,
        pkgname: "spark-weather",
        metalinkUrl: "https://example.com/spark-weather.deb.metalink",
        filename: "spark-weather.deb",
        upgradeOnly: true,
        origin: "spark",
        retry: false,
      }),
    );
  });
});
