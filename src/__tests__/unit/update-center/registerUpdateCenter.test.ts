import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UpdateCenterItem } from "../../../../electron/main/backend/update-center/types";
import { createUpdateCenterQueue } from "../../../../electron/main/backend/update-center/queue";
import {
  createUpdateCenterService,
  type UpdateCenterServiceState,
} from "../../../../electron/main/backend/update-center/service";
import { registerUpdateCenterIpc } from "../../../../electron/main/backend/update-center";

const flushPromises = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

const electronMock = vi.hoisted(() => ({
  getAllWindows: vi.fn(),
}));

vi.mock("electron", () => ({
  BrowserWindow: {
    getAllWindows: electronMock.getAllWindows,
  },
}));

const createItem = (): UpdateCenterItem => ({
  pkgname: "spark-weather",
  source: "aptss",
  currentVersion: "1.0.0",
  nextVersion: "2.0.0",
});

const createStartTask = (taskKey: string, id: number) => ({
  taskKey,
  id,
});

describe("update-center/ipc", () => {
  beforeEach(() => {
    electronMock.getAllWindows.mockReset();
  });

  it("registers every update-center handler and forwards service calls", async () => {
    const handle = vi.fn();
    const send = vi.fn();
    const snapshot: UpdateCenterServiceState = {
      items: [],
      tasks: [],
      warnings: [],
      hasRunningTasks: false,
    };
    let listener:
      | ((nextSnapshot: UpdateCenterServiceState) => void)
      | undefined;
    const service = {
      open: vi.fn().mockResolvedValue(snapshot),
      refresh: vi.fn().mockResolvedValue(snapshot),
      ignore: vi.fn().mockResolvedValue(undefined),
      unignore: vi.fn().mockResolvedValue(undefined),
      start: vi.fn().mockResolvedValue(undefined),
      cancel: vi.fn().mockResolvedValue(undefined),
      getState: vi.fn().mockReturnValue(snapshot),
      subscribe: vi.fn(
        (nextListener: (nextSnapshot: UpdateCenterServiceState) => void) => {
          listener = nextListener;
          return () => undefined;
        },
      ),
    };

    electronMock.getAllWindows.mockReturnValue([{ webContents: { send } }]);

    registerUpdateCenterIpc({ handle }, service);

    expect(handle).toHaveBeenCalledWith(
      "update-center-open",
      expect.any(Function),
    );
    expect(handle).toHaveBeenCalledWith(
      "update-center-refresh",
      expect.any(Function),
    );
    expect(handle).toHaveBeenCalledWith(
      "update-center-ignore",
      expect.any(Function),
    );
    expect(handle).toHaveBeenCalledWith(
      "update-center-unignore",
      expect.any(Function),
    );
    expect(handle).toHaveBeenCalledWith(
      "update-center-start",
      expect.any(Function),
    );
    expect(handle).toHaveBeenCalledWith(
      "update-center-cancel",
      expect.any(Function),
    );
    expect(handle).toHaveBeenCalledWith(
      "update-center-get-state",
      expect.any(Function),
    );
    expect(service.subscribe).toHaveBeenCalledTimes(1);

    const openHandler = handle.mock.calls.find(
      ([channel]: [string]) => channel === "update-center-open",
    )?.[1] as
      | ((event: unknown) => Promise<UpdateCenterServiceState>)
      | undefined;
    const refreshHandler = handle.mock.calls.find(
      ([channel]: [string]) => channel === "update-center-refresh",
    )?.[1] as
      | ((event: unknown) => Promise<UpdateCenterServiceState>)
      | undefined;
    const ignoreHandler = handle.mock.calls.find(
      ([channel]: [string]) => channel === "update-center-ignore",
    )?.[1] as
      | ((
          event: unknown,
          payload: { packageName: string; newVersion: string },
        ) => Promise<void>)
      | undefined;
    const unignoreHandler = handle.mock.calls.find(
      ([channel]: [string]) => channel === "update-center-unignore",
    )?.[1] as
      | ((
          event: unknown,
          payload: { packageName: string; newVersion: string },
        ) => Promise<void>)
      | undefined;
    const startHandler = handle.mock.calls.find(
      ([channel]: [string]) => channel === "update-center-start",
    )?.[1] as
      | ((
          event: unknown,
          tasks: Array<{ taskKey: string; id: number }>,
        ) => Promise<void>)
      | undefined;
    const cancelHandler = handle.mock.calls.find(
      ([channel]: [string]) => channel === "update-center-cancel",
    )?.[1] as ((event: unknown, taskKey: string) => Promise<void>) | undefined;
    const getStateHandler = handle.mock.calls.find(
      ([channel]: [string]) => channel === "update-center-get-state",
    )?.[1] as (() => UpdateCenterServiceState) | undefined;

    await openHandler?.({});
    await refreshHandler?.({});
    await ignoreHandler?.(
      {},
      { packageName: "spark-weather", newVersion: "2.0.0" },
    );
    await unignoreHandler?.(
      {},
      { packageName: "spark-weather", newVersion: "2.0.0" },
    );
    await startHandler?.({}, [{ taskKey: "aptss:spark-weather", id: 1 }]);
    await cancelHandler?.({}, "aptss:spark-weather");

    expect(getStateHandler?.()).toEqual(snapshot);
    expect(service.open).toHaveBeenCalledTimes(1);
    expect(service.refresh).toHaveBeenCalledTimes(1);
    expect(service.ignore).toHaveBeenCalledWith({
      packageName: "spark-weather",
      newVersion: "2.0.0",
    });
    expect(service.unignore).toHaveBeenCalledWith({
      packageName: "spark-weather",
      newVersion: "2.0.0",
    });
    expect(service.start).toHaveBeenCalledWith([
      { taskKey: "aptss:spark-weather", id: 1 },
    ]);
    expect(service.cancel).toHaveBeenCalledWith("aptss:spark-weather");

    listener?.(snapshot);
    expect(send).toHaveBeenCalledWith("update-center-state", snapshot);
  });

  it("service subscribers receive state updates after refresh start and ignore", async () => {
    let ignoredEntries = new Set<string>();
    const send = vi.fn();
    const service = createUpdateCenterService({
      loadItems: async () => [createItem()],
      loadIgnoredEntries: async () => new Set(ignoredEntries),
      saveIgnoredEntries: async (entries: ReadonlySet<string>) => {
        ignoredEntries = new Set(entries);
      },
    });
    const snapshots: UpdateCenterServiceState[] = [];

    electronMock.getAllWindows.mockReturnValue([{ webContents: { send } }]);

    service.subscribe((snapshot: UpdateCenterServiceState) => {
      snapshots.push(snapshot);
    });

    await service.refresh();
    await service.start([createStartTask("aptss:spark-weather", 1)]);
    await service.ignore({ packageName: "spark-weather", newVersion: "2.0.0" });

    expect(send).toHaveBeenCalledWith(
      "queue-install",
      expect.stringContaining('"pkgname":"spark-weather"'),
    );
    expect(
      snapshots.some((snapshot) =>
        snapshot.items.every(
          (item: UpdateCenterServiceState["items"][number]) =>
            item.taskKey !== "aptss:spark-weather",
        ),
      ),
    ).toBe(true);
    expect(snapshots.at(-1)?.items[0]).toMatchObject({
      taskKey: "aptss:spark-weather",
      ignored: true,
      newVersion: "2.0.0",
    });
    expect(snapshots.at(-1)?.items[0]).not.toHaveProperty("nextVersion");
    expect(snapshots.every((snapshot) => snapshot.tasks.length === 0)).toBe(
      true,
    );
    expect(
      snapshots.every((snapshot) => snapshot.hasRunningTasks === false),
    ).toBe(true);
  });

  it("service item snapshots keep localIcon and remoteIcon after refresh", async () => {
    const service = createUpdateCenterService({
      loadItems: async () => [
        {
          ...createItem(),
          localIcon: "/icons/weather.png",
          remoteIcon: "https://example.com/weather.png",
        },
      ],
    });

    await service.refresh();

    expect(service.getState().items).toMatchObject([
      {
        taskKey: "aptss:spark-weather",
        localIcon: "/icons/weather.png",
        remoteIcon: "https://example.com/weather.png",
      },
    ]);
  });

  it("service item snapshots prefer resolved app names over package names", async () => {
    const service = createUpdateCenterService({
      loadItems: async () => [
        {
          ...createItem(),
          name: "Spark Weather",
        },
      ],
    });

    const snapshot = await service.refresh();

    expect(snapshot.items).toMatchObject([
      {
        taskKey: "aptss:spark-weather",
        packageName: "spark-weather",
        displayName: "Spark Weather",
      },
    ]);
  });

  it("start forwards selected updates to the main download queue", async () => {
    const send = vi.fn();
    const service = createUpdateCenterService({
      loadItems: async () => [
        createItem(),
        { ...createItem(), pkgname: "spark-clock" },
      ],
    });

    electronMock.getAllWindows.mockReturnValue([{ webContents: { send } }]);

    await service.refresh();
    await service.start([
      createStartTask("aptss:spark-weather", 1),
      createStartTask("aptss:spark-clock", 2),
    ]);

    expect(send).toHaveBeenCalledTimes(2);
    expect(service.getState().items).toEqual([]);
  });

  it("cancel is a no-op for update-center tasks", async () => {
    const service = createUpdateCenterService({
      loadItems: async () => [createItem()],
    });

    await service.refresh();
    await service.cancel("aptss:spark-weather");

    expect(service.getState()).toMatchObject({
      items: [{ taskKey: "aptss:spark-weather" }],
      tasks: [],
      hasRunningTasks: false,
    });
  });

  it("start without a main window leaves updates actionable", async () => {
    const service = createUpdateCenterService({
      loadItems: async () => [
        createItem(),
        { ...createItem(), pkgname: "spark-clock" },
      ],
    });

    electronMock.getAllWindows.mockReturnValue([]);

    await service.refresh();

    await service.start([createStartTask("aptss:spark-weather", 1)]);

    expect(service.getState().items).toMatchObject([
      { taskKey: "aptss:spark-weather" },
      { taskKey: "aptss:spark-clock" },
    ]);
  });

  it("ignored items are not forwarded to the main download queue", async () => {
    const send = vi.fn();
    const service = createUpdateCenterService({
      loadItems: async () => [createItem()],
      loadIgnoredEntries: async () => new Set(["spark-weather|2.0.0"]),
    });

    electronMock.getAllWindows.mockReturnValue([{ webContents: { send } }]);

    await service.refresh();
    await service.start([createStartTask("aptss:spark-weather", 1)]);

    expect(service.getState()).toMatchObject({
      hasRunningTasks: false,
      items: [
        {
          taskKey: "aptss:spark-weather",
          ignored: true,
        },
      ],
      tasks: [],
    });
    expect(send).not.toHaveBeenCalled();
  });

  it("refresh exposes load-item failures as warnings", async () => {
    const service = createUpdateCenterService({
      loadItems: async () => {
        throw new Error("apt list failed");
      },
    });

    const snapshot = await service.refresh();

    expect(snapshot).toMatchObject({
      items: [],
      warnings: ["apt list failed"],
      hasRunningTasks: false,
    });
  });

  it("refresh failure clears previously loaded items so stale updates are not actionable", async () => {
    let shouldFailRefresh = false;
    const service = createUpdateCenterService({
      loadItems: async () => {
        if (shouldFailRefresh) {
          throw new Error("apt list failed");
        }

        return [createItem()];
      },
    });

    expect(await service.refresh()).toMatchObject({
      items: [{ taskKey: "aptss:spark-weather" }],
      warnings: [],
    });

    shouldFailRefresh = true;

    expect(await service.refresh()).toMatchObject({
      items: [],
      warnings: ["apt list failed"],
      hasRunningTasks: false,
    });
  });

  it("refresh preserves warnings returned alongside successful items", async () => {
    const service = createUpdateCenterService({
      loadItems: async () => ({
        items: [createItem()],
        warnings: ["apm unavailable, showing aptss updates only"],
      }),
    });

    const snapshot = await service.refresh();

    expect(snapshot).toMatchObject({
      items: [
        {
          taskKey: "aptss:spark-weather",
          packageName: "spark-weather",
        },
      ],
      warnings: ["apm unavailable, showing aptss updates only"],
      hasRunningTasks: false,
    });
  });

  it("window ipcRenderer typing matches the preload facade only", async () => {
    type IpcFacade = Window["ipcRenderer"];
    type HasOn = IpcFacade extends { on: (...args: never[]) => unknown }
      ? true
      : false;
    type HasInvoke = IpcFacade extends { invoke: (...args: never[]) => unknown }
      ? true
      : false;
    type HasPostMessage = IpcFacade extends {
      postMessage: (...args: never[]) => unknown;
    }
      ? true
      : false;

    const typeShape: [HasOn, HasInvoke, HasPostMessage] = [true, true, false];

    expect(typeShape).toEqual([true, true, false]);
  });

  it("default task runner forwards abort signals into download and install helpers", async () => {
    vi.resetModules();

    let downloadSignal: AbortSignal | undefined;
    let installAborted = false;
    let closeHandler: ((code: number | null) => void) | undefined;

    vi.doMock(
      "../../../../electron/main/backend/update-center/download",
      () => ({
        runAria2Download: vi.fn(async (context: { signal?: AbortSignal }) => {
          downloadSignal = context.signal;
          return { filePath: "/tmp/spark-weather.deb" };
        }),
      }),
    );
    vi.doMock("node:child_process", () => {
      const spawn = vi.fn(() => {
        const child = {
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          kill: vi.fn(() => {
            installAborted = true;
            closeHandler?.(1);
          }),
          on: vi.fn(
            (event: string, callback: (code: number | null) => void) => {
              if (event === "close") {
                closeHandler = callback;
              }
            },
          ),
        };

        return child;
      });

      return {
        default: { spawn },
        spawn,
      };
    });

    const { createTaskRunner } =
      await import("../../../../electron/main/backend/update-center/install");

    const queue = createUpdateCenterQueue();
    const item = {
      ...createItem(),
      downloadUrl: "https://example.invalid/spark-weather.deb",
      fileName: "spark-weather.deb",
    };

    queue.setItems([item]);
    queue.enqueueItem(item);

    const runner = createTaskRunner(queue);
    const runPromise = runner.runNextTask();

    await flushPromises();
    expect(downloadSignal).toBeInstanceOf(AbortSignal);

    runner.cancelActiveTask();

    const settled = await Promise.race([
      runPromise.then(() => true),
      new Promise<boolean>((resolve) => {
        setTimeout(() => resolve(false), 50);
      }),
    ]);

    expect(installAborted).toBe(true);
    expect(settled).toBe(true);

    vi.doUnmock("../../../../electron/main/backend/update-center/download");
    vi.doUnmock("node:child_process");
    vi.resetModules();
  });
});
