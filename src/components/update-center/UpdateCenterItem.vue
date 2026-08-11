<template>
  <label
    class="relative flex items-center gap-3 rounded-xl border p-2.5 shadow-sm transition"
    :class="
      item.ignored === true
        ? 'border-slate-200/50 bg-slate-50/60 opacity-70 dark:border-slate-800/50 dark:bg-slate-900/40'
        : 'border-slate-200/70 bg-white/90 dark:border-slate-800/70 dark:bg-slate-900/70'
    "
  >
    <input
      type="checkbox"
      class="h-4 w-4 shrink-0 rounded border-slate-300 accent-brand focus:ring-brand"
      :checked="selected"
      :disabled="item.ignored === true"
      @change="$emit('toggle-selection')"
    />

    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
      :class="item.ignored === true ? 'opacity-60' : ''"
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
        <p
          class="truncate font-semibold"
          :class="
            item.ignored === true
              ? 'text-sm text-slate-400 dark:text-slate-500'
              : 'text-sm text-slate-900 dark:text-white'
          "
        >
          {{ item.displayName }}
        </p>
        <span
          class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {{ sourceLabel }}
        </span>
        <span
          v-if="item.ignored === true"
          class="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
        >
          已忽略
        </span>
      </div>
      <p class="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
        {{ item.packageName }} · {{ item.currentVersion }} →
        {{ item.newVersion }}
      </p>
    </div>

    <div
      v-if="task"
      class="shrink-0 text-right text-xs font-semibold text-slate-600 dark:text-slate-300"
    >
      <p>{{ statusLabel }}</p>
      <p v-if="showProgress" class="mt-0.5">{{ progressText }}</p>
    </div>

    <div
      v-if="item.ignored !== true"
      class="flex shrink-0 flex-col items-end gap-0.5"
    >
      <span class="text-[11px] font-semibold text-brand dark:text-amber-300">{{
        timeLabel
      }}</span>
      <span class="text-[10px] text-slate-400">{{ sizeLabel }}</span>
    </div>
    <div v-else class="flex shrink-0 flex-col items-end gap-0.5">
      <span class="text-[11px] font-semibold text-slate-400">{{
        timeLabel
      }}</span>
      <span class="text-[10px] text-slate-400">{{ sizeLabel }}</span>
    </div>

    <button
      v-if="item.ignored === true"
      type="button"
      class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-300/80 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      aria-label="取消忽略"
      @click.stop="$emit('unignore-item')"
    >
      <i class="fas fa-rotate-left text-xs"></i>
    </button>
    <button
      v-else
      type="button"
      class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-amber-600 transition hover:bg-amber-50 dark:text-amber-300 dark:hover:bg-amber-500/10"
      aria-label="忽略更新"
      @click.stop="$emit('ignore-item')"
    >
      <i class="fas fa-eye-slash text-xs"></i>
    </button>

    <div
      v-if="showProgress"
      class="absolute inset-x-0 bottom-0 h-1 overflow-hidden rounded-b-xl bg-slate-200 dark:bg-slate-800"
    >
      <div
        class="h-full rounded-full bg-gradient-to-r from-brand to-brand-dark"
        :style="progressStyle"
      ></div>
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
const iconIndex = ref(0);

defineEmits<{
  (e: "toggle-selection"): void;
  (e: "ignore-item"): void;
  (e: "unignore-item"): void;
}>();

const normalizeIconSrc = (icon: string): string => {
  if (/^[a-z]+:\/\//i.test(icon)) {
    return icon;
  }

  return icon.startsWith("/") ? `file://${icon}` : icon;
};

const iconCandidates = computed(() => {
  return [props.item.localIcon, props.item.remoteIcon].filter(
    (icon): icon is string => Boolean(icon),
  );
});

const handleIconError = () => {
  if (iconIndex.value < iconCandidates.value.length) {
    iconIndex.value += 1;
  }
};

watch(
  [() => props.item, () => props.item.localIcon, () => props.item.remoteIcon],
  () => {
    iconIndex.value = 0;
  },
);

const iconSrc = computed(() => {
  const icon = iconCandidates.value[iconIndex.value];

  return icon ? normalizeIconSrc(icon) : PLACEHOLDER_ICON;
});

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

// 相对时间（如「3天前」），无数据降级为 「—」
const timeLabel = computed(() => {
  const t = props.item.updateTime;
  if (!t || typeof t !== "number") return "—";
  const diff = Date.now() - t;
  const day = 24 * 60 * 60 * 1000;
  if (diff < 0) return "刚刚";
  if (diff < day) return "今天";
  if (diff < 2 * day) return "昨天";
  if (diff < 30 * day) return `${Math.floor(diff / day)}天前`;
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}个月前`;
  return `${Math.floor(diff / (365 * day))}年前`;
});

// 大小格式化（如 45 MB / 1.2 GB）
const sizeLabel = computed(() => {
  const size = props.item.size;
  if (!size || size <= 0) return "—";
  const mb = size / (1024 * 1024);
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
});
</script>
