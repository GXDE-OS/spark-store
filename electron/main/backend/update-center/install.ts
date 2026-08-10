import { join } from "node:path";
import { tmpdir } from "node:os";

import { runAria2Download, type Aria2DownloadResult } from "./download";
import { installPackage } from "../shared-installer";
import type { UpdateCenterQueue, UpdateCenterTask } from "./queue";
import type { UpdateCenterItem } from "./types";

const DEFAULT_DOWNLOAD_ROOT = join(
  tmpdir(),
  `spark-store-${process.pid}`,
  "update-center",
);

export interface InstallUpdateItemOptions {
  item: UpdateCenterItem;
  filePath?: string;
  superUserCmd?: string;
  onLog?: (message: string) => void;
  signal?: AbortSignal;
}

export interface TaskRunnerDownloadContext {
  item: UpdateCenterItem;
  task: UpdateCenterTask;
  onProgress: (progress: number) => void;
  onLog: (message: string) => void;
  signal: AbortSignal;
}

export interface TaskRunnerInstallContext {
  item: UpdateCenterItem;
  task: UpdateCenterTask;
  filePath?: string;
  superUserCmd?: string;
  onLog: (message: string) => void;
  signal: AbortSignal;
}

export interface TaskRunnerDependencies {
  runDownload?: (
    context: TaskRunnerDownloadContext,
  ) => Promise<Aria2DownloadResult>;
  installItem?: (context: TaskRunnerInstallContext) => Promise<void>;
}

export interface UpdateCenterTaskRunner {
  runNextTask: () => Promise<UpdateCenterTask | null>;
  cancelActiveTask: () => void;
}

export interface CreateTaskRunnerOptions extends TaskRunnerDependencies {
  superUserCmd?: string;
}

/**
 * 安装更新项
 * 使用与商店安装相同的逻辑
 */
export const installUpdateItem = async ({
  item,
  filePath,
  superUserCmd,
  onLog,
  signal,
}: InstallUpdateItemOptions): Promise<void> => {
  if (!filePath) {
    throw new Error(
      `Update task for ${item.pkgname} requires downloaded package file`,
    );
  }

  // 使用与商店安装相同的安装逻辑
  const origin = item.source === "apm" ? "apm" : "spark";

  await installPackage({
    pkgname: item.pkgname,
    filePath,
    origin,
    superUserCmd,
    onLog,
    signal,
  });
};

export const createTaskRunner = (
  queue: UpdateCenterQueue,
  options: CreateTaskRunnerOptions = {},
): UpdateCenterTaskRunner => {
  const runDownload =
    options.runDownload ??
    ((context: TaskRunnerDownloadContext) =>
      runAria2Download({
        item: context.item,
        downloadDir: join(DEFAULT_DOWNLOAD_ROOT, context.item.pkgname),
        onProgress: context.onProgress,
        onLog: context.onLog,
        signal: context.signal,
      }));
  const installItem =
    options.installItem ??
    ((context: TaskRunnerInstallContext) =>
      installUpdateItem({
        item: context.item,
        filePath: context.filePath,
        superUserCmd: context.superUserCmd,
        onLog: context.onLog,
        signal: context.signal,
      }));
  let inFlightTask: Promise<UpdateCenterTask | null> | null = null;
  let activeAbortController: AbortController | null = null;
  let activeTaskId: number | null = null;

  return {
    cancelActiveTask: () => {
      activeAbortController?.abort();
    },
    runNextTask: async () => {
      if (inFlightTask) {
        return null;
      }

      inFlightTask = (async () => {
        const task = queue.getNextQueuedTask();
        if (!task) {
          return null;
        }

        activeTaskId = task.id;
        activeAbortController = new AbortController();

        const onLog = (message: string) => {
          queue.appendTaskLog(task.id, message);
        };

        try {
          // All updates require download metadata
          if (!task.item.downloadUrl || !task.item.fileName) {
            throw new Error(
              `Update task for ${task.item.pkgname} requires download metadata (URL and filename)`,
            );
          }

          queue.markActiveTask(task.id, "downloading");
          const result = await runDownload({
            item: task.item,
            task,
            onLog,
            signal: activeAbortController.signal,
            onProgress: (progress) => {
              queue.updateTaskProgress(task.id, progress);
            },
          });
          const filePath = result.filePath;

          queue.markActiveTask(task.id, "installing");
          await installItem({
            item: task.item,
            task,
            filePath,
            superUserCmd: options.superUserCmd,
            onLog,
            signal: activeAbortController.signal,
          });

          const currentTask = queue
            .getSnapshot()
            .tasks.find((entry) => entry.id === task.id);
          if (currentTask?.status !== "cancelled") {
            queue.finishTask(task.id, "completed");
          }
          return task;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          const currentTask = queue
            .getSnapshot()
            .tasks.find((entry) => entry.id === task.id);
          if (currentTask?.status !== "cancelled") {
            queue.appendTaskLog(task.id, message);
            queue.finishTask(task.id, "failed", message);
          }
          return task;
        } finally {
          activeAbortController = null;
          activeTaskId = null;
        }
      })();

      try {
        return await inFlightTask;
      } finally {
        inFlightTask = null;
        if (activeTaskId === null) {
          activeAbortController = null;
        }
      }
    },
  };
};
