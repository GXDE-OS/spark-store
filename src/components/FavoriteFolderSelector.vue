<template>
  <div
    v-if="show"
    class="fixed inset-0 z-50 flex items-center justify-center p-4"
  >
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <section
      class="relative z-10 w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      role="dialog"
      aria-modal="true"
      aria-label="选择收藏夹"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
        添加到收藏夹
      </h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        选择要保存当前应用的收藏夹。
      </p>
      <div class="mt-5 space-y-2">
        <button
          type="button"
          class="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="emit('select-folder', 'default')"
        >
          默认收藏夹
        </button>
        <button
          v-for="folder in folders"
          :key="folder.id"
          type="button"
          class="w-full rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="emit('select-folder', folder.id)"
        >
          {{ folder.name }}
        </button>
      </div>
      <button
        type="button"
        class="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
        @click="emit('close')"
      >
        取消
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import type { FavoriteFolder } from "@/global/typedefinition";

defineProps<{
  show: boolean;
  folders: FavoriteFolder[];
}>();

const emit = defineEmits<{
  close: [];
  "select-folder": [folderId: number | "default"];
}>();
</script>
