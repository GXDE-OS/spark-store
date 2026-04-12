import type { UpdateCenterItem } from "./types";

export type UpdateCenterTaskStatus =
  | "queued"
  | "downloading"
  | "installing"
  | "completed"
  | "failed"
  | "cancelled";

export interface UpdateCenterTaskLog {
  time: number;
  message: string;
}

export interface UpdateCenterTask {
  id: number;
  pkgname: string;
  item: UpdateCenterItem;
  status: UpdateCenterTaskStatus;
  progress: number;
  logs: UpdateCenterTaskLog[];
  error?: string;
}

export interface UpdateCenterQueueSnapshot {
  items: UpdateCenterItem[];
  tasks: UpdateCenterTask[];
  warnings: string[];
  hasRunningTasks: boolean;
}

export interface UpdateCenterQueue {
  setItems: (items: UpdateCenterItem[]) => void;
  startRefresh: () => void;
  finishRefresh: (warnings?: string[]) => void;
  enqueueItem: (item: UpdateCenterItem) => UpdateCenterTask;
  markActiveTask: (
    taskId: number,
    status: Extract<UpdateCenterTaskStatus, "downloading" | "installing">,
  ) => void;
  updateTaskProgress: (taskId: number, progress: number) => void;
  appendTaskLog: (taskId: number, message: string, time?: number) => void;
  finishTask: (
    taskId: number,
    status: Extract<
      UpdateCenterTaskStatus,
      "completed" | "failed" | "cancelled"
    >,
    error?: string,
  ) => void;
  getNextQueuedTask: () => UpdateCenterTask | undefined;
  getSnapshot: () => UpdateCenterQueueSnapshot;
}

const clampProgress = (progress: number): number => {
  if (!Number.isFinite(progress)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(progress)));
};

const createSnapshot = (
  items: UpdateCenterItem[],
  tasks: UpdateCenterTask[],
  warnings: string[],
  refreshing: boolean,
): UpdateCenterQueueSnapshot => ({
  items: items.map((item) => ({ ...item })),
  tasks: tasks.map((task) => ({
    ...task,
    item: { ...task.item },
    logs: task.logs.map((log) => ({ ...log })),
  })),
  warnings: [...warnings],
  hasRunningTasks:
    refreshing ||
    tasks.some((task) =>
      ["queued", "downloading", "installing"].includes(task.status),
    ),
});

export const createUpdateCenterQueue = (): UpdateCenterQueue => {
  let items: UpdateCenterItem[] = [];
  let tasks: UpdateCenterTask[] = [];
  let warnings: string[] = [];
  let refreshing = false;
  let nextTaskId = 1;

  const getTaskIndex = (taskId: number): number =>
    tasks.findIndex((task) => task.id === taskId);

  return {
    setItems: (nextItems) => {
      items = nextItems.map((item) => ({ ...item }));
    },
    startRefresh: () => {
      refreshing = true;
    },
    finishRefresh: (nextWarnings = []) => {
      refreshing = false;
      warnings = [...nextWarnings];
    },
    enqueueItem: (item) => {
      const task: UpdateCenterTask = {
        id: nextTaskId,
        pkgname: item.pkgname,
        item: { ...item },
        status: "queued",
        progress: 0,
        logs: [],
      };

      nextTaskId += 1;
      tasks = [...tasks, task];
      return task;
    },
    markActiveTask: (taskId, status) => {
      const taskIndex = getTaskIndex(taskId);
      if (taskIndex === -1) {
        return;
      }

      // 创建新的 task 对象和新的 tasks 数组以触发状态更新
      tasks = tasks.map((task, index) =>
        index === taskIndex ? { ...task, status } : task,
      );
    },
    updateTaskProgress: (taskId, progress) => {
      const taskIndex = getTaskIndex(taskId);
      if (taskIndex === -1) {
        return;
      }

      // 创建新的 task 对象和新的 tasks 数组以触发状态更新
      tasks = tasks.map((task, index) =>
        index === taskIndex
          ? { ...task, progress: clampProgress(progress) }
          : task,
      );
    },
    appendTaskLog: (taskId, message, time = Date.now()) => {
      const taskIndex = getTaskIndex(taskId);
      if (taskIndex === -1) {
        return;
      }

      // 创建新的 task 对象和新的 tasks 数组以触发状态更新
      tasks = tasks.map((task, index) =>
        index === taskIndex
          ? { ...task, logs: [...task.logs, { time, message }] }
          : task,
      );
    },
    finishTask: (taskId, status, error) => {
      const taskIndex = getTaskIndex(taskId);
      if (taskIndex === -1) {
        return;
      }

      // 创建新的 task 对象和新的 tasks 数组以触发状态更新
      tasks = tasks.map((task, index) =>
        index === taskIndex
          ? {
              ...task,
              status,
              error,
              progress: status === "completed" ? 100 : task.progress,
            }
          : task,
      );
    },
    getNextQueuedTask: () => tasks.find((task) => task.status === "queued"),
    getSnapshot: () => createSnapshot(items, tasks, warnings, refreshing),
  };
};
