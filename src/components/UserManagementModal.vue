<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-label="用户管理"
  >
    <button
      type="button"
      class="absolute inset-0 cursor-default"
      aria-label="关闭用户管理"
      @click="emit('close')"
    ></button>
    <div
      class="relative z-10 flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
    >
      <header
        class="flex shrink-0 items-center justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800"
      >
        <div class="min-w-0">
          <p class="text-xs uppercase tracking-[0.3em] text-slate-500">
            Account Center
          </p>
          <h2
            class="truncate text-lg font-semibold text-slate-900 dark:text-white"
          >
            星火账号用户管理
          </h2>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
            aria-label="刷新"
            @click="refreshFrame"
          >
            <i class="fas fa-rotate-right"></i>
            <span class="hidden sm:inline">刷新</span>
          </button>
          <button
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
            aria-label="在浏览器中打开"
            @click="openInBrowser"
          >
            <i class="fas fa-up-right-from-square"></i>
            <span class="hidden sm:inline">浏览器打开</span>
          </button>
          <button
            type="button"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:text-slate-900 dark:bg-slate-800 dark:text-slate-300 dark:hover:text-white"
            aria-label="关闭"
            @click="emit('close')"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
      </header>
      <div class="relative min-h-0 flex-1 bg-slate-100 dark:bg-slate-900">
        <iframe
          v-if="!loadFailed"
          :key="frameVersion"
          class="h-full w-full border-0 bg-white"
          title="星火账号用户管理"
          :src="accountFrameUrl"
          referrerpolicy="no-referrer"
          sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
          @error="handleFrameError"
        ></iframe>
        <div
          v-else
          class="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
        >
          <div
            class="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300"
          >
            <i class="fas fa-triangle-exclamation"></i>
          </div>
          <div>
            <p class="text-lg font-semibold text-slate-900 dark:text-white">
              账号页面加载失败
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              请检查网络连接后重试。
            </p>
          </div>
          <button
            type="button"
            class="rounded-full bg-sky-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
            @click="retryFrame"
          >
            重试
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { SPARK_ACCOUNT_CENTER_URL } from "@/global/storeConfig";
import { buildAccountFrameUrl } from "@/modules/accountCenterUrl";
import type { DownloadedAppRecord, SparkUser } from "@/global/typedefinition";

const props = defineProps<{
  show: boolean;
  user: SparkUser;
  downloadedApps: DownloadedAppRecord[];
  syncEnabled: boolean;
  loading: boolean;
  error: string;
  syncing?: boolean;
  syncMessage?: string;
}>();

const emit = defineEmits<{
  close: [];
  "open-forum": [];
  "edit-profile": [];
  "toggle-sync": [enabled: boolean];
  "sync-now": [];
  "refresh-downloads": [];
}>();

const loadFailed = ref(false);
const frameVersion = ref(0);

const accountFrameUrl = computed(() =>
  buildAccountFrameUrl(SPARK_ACCOUNT_CENTER_URL, props.user.username),
);

const refreshFrame = () => {
  loadFailed.value = false;
  frameVersion.value += 1;
};

const retryFrame = () => {
  refreshFrame();
};

const handleFrameError = () => {
  loadFailed.value = true;
};

const openInBrowser = () => {
  window.open(accountFrameUrl.value, "_blank", "noopener,noreferrer");
};
</script>
