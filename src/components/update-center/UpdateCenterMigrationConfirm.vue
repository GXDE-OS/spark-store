<template>
  <div
    v-if="show"
    class="absolute inset-0 flex items-center justify-center bg-slate-950/45 px-4"
  >
    <div
      class="w-full max-w-md rounded-3xl border border-slate-200/70 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
    >
      <p class="text-lg font-semibold text-slate-900 dark:text-white">
        迁移确认
      </p>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        部分传统 deb 更新将迁移到 APM 管理。
      </p>
      <div class="mt-4 flex justify-end gap-3">
        <button
          type="button"
          class="rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200"
          @click="$emit('close')"
        >
          取消
        </button>
        <button
          type="button"
          class="rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-semibold text-white"
          @click="$emit('confirm')"
        >
          继续更新
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean;
}>();

defineEmits<{
  (e: "close"): void;
  (e: "confirm"): void;
}>();
</script>
