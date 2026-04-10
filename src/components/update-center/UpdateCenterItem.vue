<template>
  <label
    class="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70"
  >
    <div class="flex items-start gap-3">
      <input
        type="checkbox"
        class="mt-1 h-4 w-4 rounded border-slate-300 accent-brand focus:ring-brand"
        :checked="selected"
        :disabled="item.ignored === true"
        @change="$emit('toggle-selection')"
      />
      <div
        class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
      >
        <img
          :src="iconSrc"
          :alt="`${item.displayName} 图标`"
          class="h-full w-full object-cover"
          @error="handleIconError"
        />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <p class="font-semibold text-slate-900 dark:text-white">
            {{ item.displayName }}
          </p>
          <span
            class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {{ sourceLabel }}
          </span>
          <span
            v-if="item.isMigration"
            class="rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand"
          >
            将迁移到 APM
          </span>
          <span
            v-if="item.ignored === true"
            class="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
          >
            已忽略
          </span>
        </div>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ item.packageName }} · 当前 {{ item.currentVersion }} · 更新至
          {{ item.newVersion }}
        </p>
        <p
          v-if="item.ignored === true"
          class="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400"
        >
          已忽略的更新不会加入本次任务。
        </p>
      </div>
      <div
        v-if="task"
        class="text-right text-sm font-semibold text-slate-600 dark:text-slate-300"
      >
        <p>{{ statusLabel }}</p>
        <p v-if="showProgress" class="mt-1">{{ progressText }}</p>
      </div>
    </div>

    <div v-if="showProgress" class="space-y-2">
      <div
        class="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
      >
        <div
          class="h-full rounded-full bg-gradient-to-r from-brand to-brand-dark"
          :style="progressStyle"
        ></div>
      </div>
    </div>
  </label>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type {
  UpdateCenterItem,
  UpdateCenterTaskState,
} from "@/global/typedefinition";

const props = defineProps<{
  item: UpdateCenterItem;
  task?: UpdateCenterTaskState;
  selected: boolean;
}>();

const PLACEHOLDER_ICON =
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"%3E%3Crect width="48" height="48" rx="12" fill="%23e2e8f0"/%3E%3Cpath d="M17 31h14v2H17zm3-12h8a2 2 0 0 1 2 2v8H18v-8a2 2 0 0 1 2-2" fill="%2394a3b8"/%3E%3C/svg%3E';
const failedIcon = ref<string | null>(null);

defineEmits<{
  (e: "toggle-selection"): void;
}>();

const normalizeIconSrc = (icon?: string): string => {
  if (!icon || failedIcon.value === icon) {
    return PLACEHOLDER_ICON;
  }

  if (/^[a-z]+:\/\//i.test(icon)) {
    return icon;
  }

  return icon.startsWith("/") ? `file://${icon}` : icon;
};

const handleIconError = () => {
  failedIcon.value = props.item.icon ?? null;
};

watch(
  () => props.item,
  () => {
    failedIcon.value = null;
  },
);

const iconSrc = computed(() => normalizeIconSrc(props.item.icon));

const sourceLabel = computed(() => {
  return props.item.source === "apm" ? "APM" : "传统deb";
});

const statusLabel = computed(() => {
  switch (props.task?.status) {
    case "downloading":
      return "下载中";
    case "installing":
      return "安装中";
    case "completed":
      return "已完成";
    case "failed":
      return "失败";
    case "cancelled":
      return "已取消";
    default:
      return "待处理";
  }
});

const showProgress = computed(() => {
  return (
    props.task?.status === "downloading" || props.task?.status === "installing"
  );
});

const progressText = computed(() => `${props.task?.progress ?? 0}%`);
const progressStyle = computed(() => ({ width: progressText.value }));
</script>
