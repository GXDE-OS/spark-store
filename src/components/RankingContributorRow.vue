<template>
  <div
    class="group flex items-center gap-2 rounded-lg border border-slate-200/70 bg-white/90 p-2 transition hover:border-brand/50 dark:border-slate-800/60 dark:bg-slate-900/60"
  >
    <!-- 排名序号（前 3 名金/银/铜） -->
    <span
      class="w-5 shrink-0 text-center text-sm font-bold"
      :class="rankClass"
      >{{ rank }}</span
    >

    <!-- 贡献者头像 -->
    <div
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-gradient-to-b from-amber-100 to-amber-200 text-amber-600 shadow-inner dark:from-amber-900/40 dark:to-amber-800/40"
    >
      <i class="fas fa-user"></i>
    </div>

    <!-- 贡献者信息 -->
    <div class="flex min-w-0 flex-1 flex-col gap-1 overflow-hidden">
      <div class="truncate text-xs font-semibold text-slate-900 dark:text-white">
        {{ name }}
      </div>
      <div
        class="truncate text-xs leading-tight text-slate-500 dark:text-slate-400"
      >
        {{ label }}
      </div>
    </div>

    <!-- 数量徽标 -->
    <span
      class="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
      >{{ count }}</span
    >
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  rank: number;
  name: string;
  count: number;
  label?: string;
}>();

const rankClass = computed(() => {
  if (props.rank === 1) return "text-amber-400";
  if (props.rank === 2) return "text-slate-400";
  if (props.rank === 3) return "text-amber-600";
  return "text-slate-400 dark:text-slate-500";
});
</script>
