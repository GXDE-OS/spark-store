<template>
  <div
    v-if="show"
    class="absolute inset-0 flex items-center justify-center bg-slate-950/45 px-4"
  >
    <div
      class="w-full max-w-md rounded-3xl border border-amber-200 bg-white p-6 shadow-2xl dark:border-amber-500/30 dark:bg-slate-900"
    >
      <p class="text-lg font-semibold text-slate-900 dark:text-white">
        关闭确认
      </p>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
        更新仍在进行中，确定关闭此窗口吗？
      </p>
      <div class="mt-4 flex justify-end gap-3">
        <button
          type="button"
          class="rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-200"
          @click="$emit('close')"
        >
          继续查看
        </button>
        <button
          type="button"
          class="rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white"
          @click="$emit('confirm')"
        >
          确认关闭
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
