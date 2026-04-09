import { describe, expect, it, vi } from "vitest";

import type { UpdateCenterItem } from "../../../../electron/main/backend/update-center/types";
import {
  createTaskRunner,
  buildLegacySparkUpgradeCommand,
  installUpdateItem,
} from "../../../../electron/main/backend/update-center/install";
import { createUpdateCenterQueue } from "../../../../electron/main/backend/update-center/queue";

const childProcessMock = vi.hoisted(() => ({
  spawnCalls: [] as Array<{ command: string; args: string[] }>,
}));

vi.mock("node:child_process", () => ({
  default: {
    spawn: vi.fn((command: string, args: string[] = []) => {
      childProcessMock.spawnCalls.push({ command, args });

      return {
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
        on: vi.fn(
          (
            event: string,
            callback: ((code?: number) => void) | (() => void),
          ) => {
            if (event === "close") {
              callback(0);
            }
          },
        ),
      };
    }),
  },
  spawn: vi.fn((command: string, args: string[] = []) => {
    childProcessMock.spawnCalls.push({ command, args });

    return {
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn(
        (event: string, callback: ((code?: number) => void) | (() => void)) => {
          if (event === "close") {
            callback(0);
          }
        },
      ),
    };
  }),
}));

const createAptssItem = (): UpdateCenterItem => ({
  pkgname: "spark-weather",
  source: "aptss",
  currentVersion: "1.0.0",
  nextVersion: "2.0.0",
  downloadUrl: "https://example.invalid/spark-weather_2.0.0_amd64.deb",
  fileName: "spark-weather_2.0.0_amd64.deb",
});

const createApmItem = (): UpdateCenterItem => ({
  pkgname: "spark-player",
  source: "apm",
  currentVersion: "1.0.0",
  nextVersion: "2.0.0",
  downloadUrl: "https://example.invalid/spark-player_2.0.0_amd64.deb",
  fileName: "spark-player_2.0.0_amd64.deb",
});

describe("update-center task runner", () => {
  it("runs download then install and marks the task as completed", async () => {
    const queue = createUpdateCenterQueue();
    const item = createAptssItem();
    const steps: string[] = [];

    queue.setItems([item]);
    const task = queue.enqueueItem(item);

    const runner = createTaskRunner(queue, {
      runDownload: async (context) => {
        steps.push(`download:${context.task.pkgname}`);
        context.onLog("download-started");
        context.onProgress(40);

        return {
          filePath: `/tmp/${context.item.fileName}`,
        };
      },
      installItem: async (context) => {
        steps.push(`install:${context.task.pkgname}`);
        context.onLog("install-started");
      },
    });

    await runner.runNextTask();

    expect(steps).toEqual(["download:spark-weather", "install:spark-weather"]);
    expect(queue.getSnapshot()).toMatchObject({
      hasRunningTasks: false,
      warnings: [],
      tasks: [
        {
          id: task.id,
          pkgname: "spark-weather",
          status: "completed",
          progress: 100,
          logs: [
            expect.objectContaining({ message: "download-started" }),
            expect.objectContaining({ message: "install-started" }),
          ],
        },
      ],
    });
  });

  it("returns a direct aptss upgrade command instead of spark-update-tool", () => {
    expect(
      buildLegacySparkUpgradeCommand("spark-weather", "/usr/bin/pkexec"),
    ).toEqual({
      execCommand: "/usr/bin/pkexec",
      execParams: [
        "/opt/spark-store/extras/shell-caller.sh",
        "aptss",
        "install",
        "-y",
        "spark-weather",
        "--only-upgrade",
      ],
    });
  });

  it("blocks close while a refresh or task is still running", () => {
    const queue = createUpdateCenterQueue();
    const item = createAptssItem();

    expect(queue.getSnapshot().hasRunningTasks).toBe(false);

    queue.startRefresh();
    expect(queue.getSnapshot().hasRunningTasks).toBe(true);

    queue.finishRefresh(["metadata warning"]);
    expect(queue.getSnapshot()).toMatchObject({
      hasRunningTasks: false,
      warnings: ["metadata warning"],
    });

    const task = queue.enqueueItem(item);
    queue.markActiveTask(task.id, "downloading");
    expect(queue.getSnapshot().hasRunningTasks).toBe(true);

    queue.finishTask(task.id, "cancelled");
    expect(queue.getSnapshot().hasRunningTasks).toBe(false);
  });

  it("propagates privilege escalation into the install path", async () => {
    const queue = createUpdateCenterQueue();
    const item = createAptssItem();
    const installCalls: Array<{ superUserCmd?: string; filePath?: string }> =
      [];

    queue.setItems([item]);
    queue.enqueueItem(item);

    const runner = createTaskRunner(queue, {
      superUserCmd: "/usr/bin/pkexec",
      runDownload: async () => ({ filePath: "/tmp/spark-weather.deb" }),
      installItem: async (context) => {
        installCalls.push({
          superUserCmd: context.superUserCmd,
          filePath: context.filePath,
        });
      },
    });

    await runner.runNextTask();

    expect(installCalls).toEqual([
      {
        superUserCmd: "/usr/bin/pkexec",
        filePath: "/tmp/spark-weather.deb",
      },
    ]);
  });

  it("fails fast for apm items without a file path", async () => {
    const queue = createUpdateCenterQueue();
    const item = {
      ...createApmItem(),
      downloadUrl: undefined,
      fileName: undefined,
    };

    queue.setItems([item]);
    const task = queue.enqueueItem(item);

    const runner = createTaskRunner(queue, {
      installItem: async (context) => {
        throw new Error(`unexpected install for ${context.item.pkgname}`);
      },
    });

    await runner.runNextTask();

    expect(queue.getSnapshot()).toMatchObject({
      hasRunningTasks: false,
      tasks: [
        {
          id: task.id,
          status: "failed",
          error: "APM update task requires downloaded package metadata",
        },
      ],
    });
  });

  it("does not duplicate work across concurrent runNextTask calls", async () => {
    const queue = createUpdateCenterQueue();
    const item = createAptssItem();
    let releaseDownload: (() => void) | undefined;
    const downloadGate = new Promise<void>((resolve) => {
      releaseDownload = resolve;
    });
    const runDownload = vi.fn(async () => {
      await downloadGate;
      return { filePath: "/tmp/spark-weather.deb" };
    });
    const installItem = vi.fn(async () => {});

    queue.setItems([item]);
    queue.enqueueItem(item);

    const runner = createTaskRunner(queue, {
      runDownload,
      installItem,
    });

    const firstRun = runner.runNextTask();
    const secondRun = runner.runNextTask();
    releaseDownload?.();

    const results = await Promise.all([firstRun, secondRun]);

    expect(runDownload).toHaveBeenCalledTimes(1);
    expect(installItem).toHaveBeenCalledTimes(1);
    expect(results[1]).toBeNull();
  });

  it("marks the task as failed when install fails", async () => {
    const queue = createUpdateCenterQueue();
    const item = createAptssItem();

    queue.setItems([item]);
    const task = queue.enqueueItem(item);

    const runner = createTaskRunner(queue, {
      runDownload: async (context) => {
        context.onProgress(30);
        return { filePath: "/tmp/spark-weather.deb" };
      },
      installItem: async () => {
        throw new Error("install exploded");
      },
    });

    await runner.runNextTask();

    expect(queue.getSnapshot()).toMatchObject({
      hasRunningTasks: false,
      tasks: [
        {
          id: task.id,
          status: "failed",
          progress: 30,
          error: "install exploded",
          logs: [expect.objectContaining({ message: "install exploded" })],
        },
      ],
    });
  });

  it("does not fall through to ssinstall for apm file installs", async () => {
    childProcessMock.spawnCalls.length = 0;

    await installUpdateItem({
      item: createApmItem(),
      filePath: "/tmp/spark-player.deb",
      superUserCmd: "/usr/bin/pkexec",
    });

    expect(childProcessMock.spawnCalls).toEqual([
      {
        command: "/usr/bin/pkexec",
        args: [
          "/opt/spark-store/extras/shell-caller.sh",
          "apm",
          "ssaudit",
          "/tmp/spark-player.deb",
        ],
      },
    ]);
  });
});
