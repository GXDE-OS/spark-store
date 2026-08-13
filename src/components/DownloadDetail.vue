<template>
  <Transition
    enter-active-class="duration-200 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6"
      @click="handleOverlayClick"
      @wheel="onOverlayWheel"
    >
      <div
        class="scrollbar-nowidth scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        @click.stop
      >
        <div class="flex items-start justify-between p-5 pb-3">
          <div>
            <p class="text-xl font-semibold text-slate-900 dark:text-white">
              下载详情
            </p>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              实时了解安装进度
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/60 text-slate-500 transition hover:text-slate-900 dark:border-slate-700"
            @click="close"
          >
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <div
          v-if="download"
          class="scrollbar-nowidth scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 scrollbar-track-transparent space-y-3 overflow-y-auto overscroll-contain px-5 pb-5"
        >
          <div
            class="flex items-center gap-3 rounded-2xl border border-slate-200/60 p-3 dark:border-slate-800/60"
          >
            <div
              class="h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-slate-100 dark:bg-slate-800"
            >
              <img
                :src="download.icon"
                :alt="download.name"
                class="h-full w-full object-cover"
              />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-base font-semibold text-slate-900 dark:text-white">
                {{ download.name }}
              </p>
              <p class="truncate text-xs text-slate-500 dark:text-slate-400">
                {{ download.pkgname }} · {{ download.version }}
              </p>
            </div>
          </div>

          <div
            class="space-y-3 rounded-2xl border border-slate-200/60 p-3 dark:border-slate-800/60"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-slate-500">状态</span>
              <span
                class="rounded-full px-3 py-1 text-xs font-semibold"
                :class="{
                  'bg-blue-100 text-blue-700':
                    download.status === 'downloading',
                  'bg-amber-100 text-amber-600':
                    download.status === 'installing',
                  'bg-emerald-100 text-emerald-700':
                    download.status === 'completed',
                  'bg-rose-100 text-rose-600': download.status === 'failed',
                  'bg-slate-200 text-slate-600': download.status === 'paused',
                }"
              >
                {{ getStatusText(download.status) }}
              </span>
            </div>

            <div v-if="download.status === 'downloading'" class="space-y-2">
              <div class="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  class="h-full rounded-full bg-brand"
                  :style="{ width: downloadProgress + '%' }"
                ></div>
              </div>
              <div
                class="flex flex-wrap items-center justify-between text-sm text-slate-500 dark:text-slate-400"
              >
                <span>{{ downloadProgress }}%</span>
                <span v-if="download.downloadedSize && download.totalSize">
                  {{ formatSize(download.downloadedSize) }} /
                  {{ formatSize(download.totalSize) }}
                </span>
              </div>
              <div
                v-if="download.speed"
                class="flex flex-wrap gap-3 text-sm text-slate-500 dark:text-slate-300"
              >
                <span class="flex items-center gap-2"
                  ><i class="fas fa-tachometer-alt"></i
                  >{{ formatSpeed(download.speed) }}</span
                >
                <span v-if="download.timeRemaining"
                  >剩余 {{ formatTime(download.timeRemaining) }}</span
                >
              </div>
            </div>
          </div>

          <div
            class="grid grid-cols-2 gap-x-4 gap-y-1 rounded-2xl border border-slate-200/60 p-3 text-sm text-slate-600 dark:border-slate-800/60 dark:text-slate-300"
          >
            <div class="flex justify-between gap-2">
              <span class="shrink-0 text-slate-400">下载源</span>
              <span class="truncate font-medium text-slate-900 dark:text-white">{{
                download.origin === "spark" ? "Spark Store" : "APM Store"
              }}</span>
            </div>
            <div
              v-if="download.startTime"
              class="flex justify-between gap-2"
            >
              <span class="shrink-0 text-slate-400">开始时间</span>
              <span class="truncate">{{ formatDate(download.startTime) }}</span>
            </div>
            <div
              v-if="download.endTime"
              class="flex justify-between gap-2"
            >
              <span class="shrink-0 text-slate-400">完成时间</span>
              <span class="truncate">{{ formatDate(download.endTime) }}</span>
            </div>
            <div
              v-if="download.error"
              class="col-span-2 flex justify-between gap-2 text-rose-500"
            >
              <span class="shrink-0">错误信息</span>
              <span class="truncate text-right">{{ download.error }}</span>
            </div>
          </div>

          <div
            v-if="download.logs && download.logs.length"
            class="rounded-2xl border border-slate-200/60 p-3 dark:border-slate-800/60"
          >
            <div class="mb-2 flex items-center justify-between">
              <span class="font-semibold text-slate-800 dark:text-slate-100"
                >下载日志</span
              >
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                @click="copyLogs"
              >
                <i class="fas fa-copy"></i>
                复制日志
              </button>
            </div>
            <div
              class="max-h-32 space-y-1.5 overflow-y-auto overscroll-contain rounded-2xl bg-slate-50/80 p-3 font-mono text-xs text-slate-600 dark:bg-slate-900/60 dark:text-slate-300"
            >
              <div
                v-for="(log, index) in download.logs"
                :key="index"
                class="flex gap-3"
              >
                <span class="shrink-0 text-slate-400">{{
                  formatLogTime(log.time)
                }}</span>
                <span class="break-all">{{ log.message }}</span>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap justify-end gap-3 pt-1">
            <button
              v-if="
                download.status === 'downloading' ||
                download.status === 'queued' ||
                download.status === 'paused'
              "
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-rose-200/60 px-4 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-50 dark:border-rose-500/30 dark:text-rose-400 dark:hover:bg-rose-900/20"
              @click="cancel"
            >
              <i class="fas fa-times"></i>
              取消下载
            </button>
            <button
              v-if="download.status === 'failed'"
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-rose-300/60 px-4 py-2 text-sm font-semibold text-rose-500 transition hover:bg-rose-50"
              @click="retry"
            >
              <i class="fas fa-redo"></i>
              重试下载
            </button>
            <button
              v-if="download.status === 'completed'"
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-semibold text-white shadow-lg"
              @click="openApp"
            >
              <i class="fas fa-external-link-alt"></i>
              打开应用
            </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { DownloadItem } from "../global/typedefinition";

const props = defineProps<{
  show: boolean;
  download: DownloadItem | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "pause", download: DownloadItem): void;
  (e: "resume", download: DownloadItem): void;
  (e: "cancel", download: DownloadItem): void;
  (e: "retry", download: DownloadItem): void;
  (e: "open-app", pkgname: string, origin?: "spark" | "apm"): void;
}>();

const close = () => {
  emit("close");
};

const handleOverlayClick = () => {
  close();
};

const cancel = () => {
  if (props.download) {
    emit("cancel", props.download);
  }
};

const retry = () => {
  if (props.download) {
    emit("retry", props.download);
  }
};

const openApp = () => {
  if (props.download) {
    emit("open-app", props.download.pkgname, props.download.origin);
  }
};

const getStatusText = (status: string) => {
  const statusMap: Record<string, string> = {
    pending: "等待中",
    downloading: "下载中",
    installing: "安装中",
    completed: "已完成",
    failed: "失败",
    paused: "已暂停",
    cancelled: "已取消",
  };
  return statusMap[status] || status;
};

const formatSize = (bytes: number) => {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + units[i];
};

const formatSpeed = (bytesPerSecond: number) => {
  return formatSize(bytesPerSecond) + "/s";
};

const formatTime = (seconds: number) => {
  if (seconds < 60) return `${seconds}秒`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
  return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`;
};

const formatDate = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN");
};

const formatLogTime = (timestamp: number) => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("zh-CN");
};

const copyLogs = () => {
  if (!props.download?.logs) return;
  const logsText = props.download.logs
    .map((log) => `[${formatLogTime(log.time)}] ${log.message}`)
    .join("\n");
  navigator.clipboard
    ?.writeText(logsText)
    .then(() => {
      alert("日志已复制到剪贴板");
    })
    .catch(() => {
      prompt("请手动复制日志：", logsText);
    });
};

const downloadProgress = computed(() => {
  return props.download ? Math.floor(props.download.progress * 100) : 0;
});

const onOverlayWheel = (e: WheelEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest(".overflow-y-auto, .overflow-auto")) return;
  e.preventDefault();
};
</script>
