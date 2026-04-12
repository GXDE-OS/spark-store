<template>
  <aside
    class="hidden min-h-0 flex-col border-t border-slate-200/70 bg-slate-50/70 p-6 lg:flex lg:border-t-0 dark:border-slate-800/70 dark:bg-slate-950/50"
  >
    <div class="flex items-center justify-between gap-3">
      <p class="text-sm font-semibold text-slate-900 dark:text-white">
        任务日志
      </p>
      <span class="text-xs text-slate-500 dark:text-slate-400"
        >{{ tasks.length }} 项</span
      >
    </div>
    <div class="mt-4 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain">
      <div
        v-if="tasks.length === 0"
        class="rounded-2xl border border-dashed border-slate-200/80 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-800/80 dark:text-slate-400"
      >
        暂无运行日志
      </div>
      <div
        v-for="task in tasks"
        :key="task.taskKey"
        class="rounded-2xl border border-slate-200/70 bg-white/80 p-4 dark:border-slate-800/70 dark:bg-slate-900/70"
      >
        <p class="text-sm font-semibold text-slate-900 dark:text-white">
          {{ task.packageName }}
        </p>
        <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {{ task.status }}
        </p>
        <p class="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
          {{ task.logs.at(-1)?.message || task.errorMessage || "等待日志输出" }}
        </p>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { UpdateCenterTaskState } from "@/global/typedefinition";

defineProps<{
  tasks: UpdateCenterTaskState[];
}>();
</script>
