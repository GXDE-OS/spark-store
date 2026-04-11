import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UpdateCenterItem } from "../../../../electron/main/backend/update-center/types";
import type { UpdateCenterQueue } from "../../../../electron/main/backend/update-center/queue";
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
      | ((event: unknown, taskKeys: string[]) => Promise<void>)
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
    await startHandler?.({}, ["aptss:spark-weather"]);
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
    expect(service.start).toHaveBeenCalledWith(["aptss:spark-weather"]);
    expect(service.cancel).toHaveBeenCalledWith("aptss:spark-weather");

    listener?.(snapshot);
    expect(send).toHaveBeenCalledWith("update-center-state", snapshot);
  });

  it("service subscribers receive state updates after refresh start and ignore", async () => {
    let ignoredEntries = new Set<string>();
    const service = createUpdateCenterService({
      loadItems: async () => [createItem()],
      loadIgnoredEntries: async () => new Set(ignoredEntries),
      saveIgnoredEntries: async (entries: ReadonlySet<string>) => {
        ignoredEntries = new Set(entries);
      },
      createTaskRunner: (queue: UpdateCenterQueue) => ({
        cancelActiveTask: vi.fn(),
        runNextTask: async () => {
          const task = queue.getNextQueuedTask();
          if (!task) {
            return null;
          }

          queue.markActiveTask(task.id, "installing");
          queue.finishTask(task.id, "completed");
          return task;
        },
      }),
    });
    const snapshots: UpdateCenterServiceState[] = [];

    service.subscribe((snapshot: UpdateCenterServiceState) => {
      snapshots.push(snapshot);
    });

    await service.refresh();
    await service.start(["aptss:spark-weather"]);
    await service.ignore({ packageName: "spark-weather", newVersion: "2.0.0" });

    expect(snapshots.some((snapshot) => snapshot.hasRunningTasks)).toBe(true);
    expect(
      snapshots.some((snapshot) =>
        snapshot.tasks.some(
          (task: UpdateCenterServiceState["tasks"][number]) =>
            task.taskKey === "aptss:spark-weather" &&
            task.status === "completed",
        ),
      ),
    ).toBe(true);
    expect(snapshots.at(-1)?.items[0]).toMatchObject({
      taskKey: "aptss:spark-weather",
      ignored: true,
      newVersion: "2.0.0",
    });
    expect(snapshots.at(-1)?.items[0]).not.toHaveProperty("nextVersion");
  });

  it("service task snapshots keep localIcon and remoteIcon for queued work", async () => {
    let releaseTask: (() => void) | undefined;
    const service = createUpdateCenterService({
      loadItems: async () => [
        {
          ...createItem(),
          localIcon: "/icons/weather.png",
          remoteIcon: "https://example.com/weather.png",
        },
      ],
      createTaskRunner: (queue: UpdateCenterQueue) => ({
        cancelActiveTask: vi.fn(),
        runNextTask: async () => {
          const task = queue.getNextQueuedTask();
          if (!task) {
            return null;
          }

          await new Promise<void>((resolve) => {
            releaseTask = resolve;
          });
          queue.markActiveTask(task.id, "installing");
          queue.finishTask(task.id, "completed");
          return task;
        },
      }),
    });

    await service.refresh();
    const startPromise = service.start(["aptss:spark-weather"]);
    await flushPromises();

    expect(service.getState().tasks).toMatchObject([
      {
        taskKey: "aptss:spark-weather",
        localIcon: "/icons/weather.png",
        remoteIcon: "https://example.com/weather.png",
        status: "queued",
      },
    ]);

    releaseTask?.();
    await startPromise;
  });

  it("concurrent start calls still serialize through one processing pipeline", async () => {
    const startedTaskIds: number[] = [];
    const releases: Array<() => void> = [];
    const service = createUpdateCenterService({
      loadItems: async () => [
        createItem(),
        { ...createItem(), pkgname: "spark-clock" },
      ],
      createTaskRunner: (queue: UpdateCenterQueue) => ({
        cancelActiveTask: vi.fn(),
        runNextTask: async () => {
          const task = queue.getNextQueuedTask();
          if (!task) {
            return null;
          }

          startedTaskIds.push(task.id);
          queue.markActiveTask(task.id, "installing");
          await new Promise<void>((resolve) => {
            releases.push(resolve);
          });
          queue.finishTask(task.id, "completed");
          return task;
        },
      }),
    });

    await service.refresh();

    const firstStart = service.start(["aptss:spark-weather"]);
    const secondStart = service.start(["aptss:spark-clock"]);

    await flushPromises();
    expect(startedTaskIds).toEqual([1]);

    releases.shift()?.();
    await flushPromises();
    expect(startedTaskIds).toEqual([1, 2]);

    releases.shift()?.();
    await Promise.all([firstStart, secondStart]);

    expect(service.getState().tasks).toMatchObject([
      { taskKey: "aptss:spark-weather", status: "completed" },
      { taskKey: "aptss:spark-clock", status: "completed" },
    ]);
  });

  it("cancelling an active task stops it and leaves it cancelled", async () => {
    let releaseTask: (() => void) | undefined;
    const cancelActiveTask = vi.fn(() => {
      releaseTask?.();
    });
    const service = createUpdateCenterService({
      loadItems: async () => [createItem()],
      createTaskRunner: (queue: UpdateCenterQueue) => ({
        cancelActiveTask,
        runNextTask: async () => {
          const task = queue.getNextQueuedTask();
          if (!task) {
            return null;
          }

          queue.markActiveTask(task.id, "installing");
          await new Promise<void>((resolve) => {
            releaseTask = resolve;
          });

          return (
            queue.getSnapshot().tasks.find((entry) => entry.id === task.id) ??
            null
          );
        },
      }),
    });

    await service.refresh();

    const startPromise = service.start(["aptss:spark-weather"]);
    await flushPromises();

    await service.cancel("aptss:spark-weather");
    await startPromise;

    expect(cancelActiveTask).toHaveBeenCalledTimes(1);
    expect(service.getState().tasks).toMatchObject([
      { taskKey: "aptss:spark-weather", status: "cancelled" },
    ]);
  });

  it("cancelling a queued task does not abort the currently active task", async () => {
    let releaseTask: (() => void) | undefined;
    const cancelActiveTask = vi.fn(() => {
      releaseTask?.();
    });
    const service = createUpdateCenterService({
      loadItems: async () => [
        createItem(),
        { ...createItem(), pkgname: "spark-clock" },
      ],
      createTaskRunner: (queue: UpdateCenterQueue) => ({
        cancelActiveTask,
        runNextTask: async () => {
          const task = queue.getNextQueuedTask();
          if (!task) {
            return null;
          }

          queue.markActiveTask(task.id, "installing");
          await new Promise<void>((resolve) => {
            releaseTask = resolve;
          });

          if (
            queue.getSnapshot().tasks.find((entry) => entry.id === task.id)
              ?.status !== "cancelled"
          ) {
            queue.finishTask(task.id, "completed");
          }
          return task;
        },
      }),
    });

    await service.refresh();

    const activeStart = service.start(["aptss:spark-weather"]);
    await flushPromises();
    const queuedStart = service.start(["aptss:spark-clock"]);
    await flushPromises();

    await service.cancel("aptss:spark-clock");
    expect(cancelActiveTask).not.toHaveBeenCalled();

    releaseTask?.();
    await Promise.all([activeStart, queuedStart]);

    expect(service.getState().tasks).toMatchObject([
      { taskKey: "aptss:spark-weather", status: "completed" },
      { taskKey: "aptss:spark-clock", status: "cancelled" },
    ]);
  });

  it("superUserCmdProvider failure does not leave a task stuck in queued state", async () => {
    const service = createUpdateCenterService({
      loadItems: async () => [createItem()],
      superUserCmdProvider: async () => {
        throw new Error("pkexec unavailable");
      },
      createTaskRunner: () => ({
        cancelActiveTask: vi.fn(),
        runNextTask: async () => {
          throw new Error(
            "runner should not start when privilege lookup fails",
          );
        },
      }),
    });

    await service.refresh();
    await service.start(["aptss:spark-weather"]);

    expect(service.getState()).toMatchObject({
      hasRunningTasks: false,
      tasks: [
        {
          taskKey: "aptss:spark-weather",
          status: "failed",
          errorMessage: "pkexec unavailable",
        },
      ],
    });
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
