import { spawn } from "node:child_process";
import { join } from "node:path";

import { runAria2Download, type Aria2DownloadResult } from "./download";
import type { UpdateCenterQueue, UpdateCenterTask } from "./queue";
import type { UpdateCenterItem } from "./types";

const SHELL_CALLER_PATH = "/opt/spark-store/extras/shell-caller.sh";
const SSINSTALL_PATH = "/usr/bin/ssinstall";
const DEFAULT_DOWNLOAD_ROOT = "/tmp/spark-store/update-center";

export interface UpdateCommand {
  execCommand: string;
  execParams: string[];
}

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

const runCommand = async (
  execCommand: string,
  execParams: string[],
  onLog?: (message: string) => void,
  signal?: AbortSignal,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(execCommand, execParams, {
      shell: false,
      env: process.env,
    });

    const handleOutput = (chunk: Buffer) => {
      const message = chunk.toString().trim();
      if (message) {
        onLog?.(message);
      }
    };

    const abortCommand = () => {
      child.kill();
      reject(new Error(`Update task cancelled: ${execParams.join(" ")}`));
    };

    if (signal?.aborted) {
      abortCommand();
      return;
    }

    signal?.addEventListener("abort", abortCommand, { once: true });

    child.stdout?.on("data", handleOutput);
    child.stderr?.on("data", handleOutput);
    child.on("error", reject);
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abortCommand);
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${execCommand} exited with code ${code ?? -1}`));
    });
  });
};

const buildPrivilegedCommand = (
  command: string,
  args: string[],
  superUserCmd?: string,
): UpdateCommand => {
  if (superUserCmd) {
    return {
      execCommand: superUserCmd,
      execParams: [command, ...args],
    };
  }

  return {
    execCommand: command,
    execParams: args,
  };
};

// Removed buildLegacySparkUpgradeCommand - all updates now require downloading the deb package first
// to avoid aptss install popup. Use ssinstall with downloaded deb file instead.

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

  if (item.source === "apm") {
    const installCommand = buildPrivilegedCommand(
      SHELL_CALLER_PATH,
      ["apm", "ssinstall", filePath],
      superUserCmd,
    );
    await runCommand(
      installCommand.execCommand,
      installCommand.execParams,
      onLog,
      signal,
    );
    return;
  }

  // APTSS (Spark Store) packages use ssinstall
  const installCommand = buildPrivilegedCommand(
    SSINSTALL_PATH,
    [filePath, "--delete-after-install", "--no-create-desktop-entry", "--native"],
    superUserCmd,
  );
  await runCommand(
    installCommand.execCommand,
    installCommand.execParams,
    onLog,
    signal,
  );
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
      if (!activeAbortController || activeAbortController.signal.aborted) {
        return;
      }

      activeAbortController.abort();
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
