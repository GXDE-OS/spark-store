<template>
  <div
    class="group flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200/70 bg-white/90 p-2 transition hover:border-brand/50 dark:border-slate-800/60 dark:bg-slate-900/60"
    @click="openDetail"
  >
    <!-- 排名序号（前 3 名金/银/铜） -->
    <span
      class="w-5 shrink-0 text-center text-sm font-bold"
      :class="rankClass"
      >{{ rank }}</span
    >

    <!-- 应用图标 -->
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gradient-to-b from-slate-100 to-slate-200 shadow-inner dark:from-slate-800 dark:to-slate-700"
    >
      <img
        v-if="!iconFailed"
        :src="iconPath"
        :alt="app.name"
        class="h-full w-full object-cover"
        @error="iconFailed = true"
      />
      <i v-else class="fas fa-cube text-slate-400"></i>
    </div>

    <!-- 应用信息 -->
    <div class="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
      <div class="flex items-center gap-2">
        <div
          class="truncate text-xs font-semibold text-slate-900 dark:text-white"
        >
          {{ app.name || "" }}
        </div>
        <span
          v-if="app.origin === 'spark'"
          class="rounded-md bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
          >Spark</span
        >
        <span
          v-else
          class="rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
          >APM</span
        >
        <span
          v-if="showDownload && downloadCount"
          class="ml-auto shrink-0 text-[10px] text-slate-400 dark:text-slate-500"
          >{{ formatDownloads(downloadCount) }}</span
        >
      </div>
      <div
        class="truncate text-xs leading-tight text-slate-500 dark:text-slate-400"
      >
        {{ app.pkgname || "" }} · {{ app.version || ""
        }}<template v-if="updateTime"> · {{ updateTime }}</template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { APM_STORE_BASE_URL } from "../global/storeConfig";
import type { App } from "../global/typedefinition";

const props = defineProps<{
  app: App;
  rank: number;
  showDownload?: boolean;
  downloadCount?: number;
  updateTime?: string;
}>();

const emit = defineEmits<{ (e: "open-detail", app: App): void }>();

const iconFailed = ref(false);

const iconPath = computed(() => {
  const arch = window.apm_store.arch || "amd64";
  const finalArch =
    props.app.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
  return `${APM_STORE_BASE_URL}/${finalArch}/${props.app.category}/${props.app.pkgname}/icon.png`;
});

const rankClass = computed(() => {
  if (props.rank === 1) return "text-amber-400";
  if (props.rank === 2) return "text-slate-400";
  if (props.rank === 3) return "text-amber-600";
  return "text-slate-400 dark:text-slate-500";
});

const formatDownloads = (n?: number): string => {
  if (!n || n <= 0) return "0";
  if (n >= 10000) {
    const wan = n / 10000;
    return `${wan.toFixed(1).replace(/\.0$/, "")}万`;
  }
  return n.toLocaleString();
};

const openDetail = () => emit("open-detail", props.app);
</script>
