<template>
  <div
    v-if="show"
    class="fixed inset-0 z-[90] flex items-center justify-center p-4"
  >
    <div class="absolute inset-0 bg-black/40" @click="emit('close')"></div>
    <section
      class="relative z-10 w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900"
      role="dialog"
      aria-modal="true"
      aria-label="选择收藏夹"
    >
      <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
        管理收藏夹
      </h2>
      <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        勾选要保存当前应用的收藏夹，取消勾选可移出收藏。
      </p>
      <div class="mt-5 space-y-2">
        <label
          v-if="!hasDefaultFolder"
          class="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <input
            v-model="draftSelectedIds"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            aria-label="收藏到 默认收藏夹"
            value="default"
          />
          <span>默认收藏夹</span>
        </label>
        <label
          v-for="folder in folders"
          :key="folder.id"
          class="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <input
            v-model="draftSelectedIds"
            type="checkbox"
            class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            :aria-label="`收藏到 ${folder.name}`"
            :value="folder.id"
          />
          <span>{{ folder.name }}</span>
        </label>
      </div>
      <button
        type="button"
        class="mt-4 w-full rounded-xl border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-500 dark:hover:text-blue-300"
        @click="emit('create-folder', [...draftSelectedIds])"
      >
        新建收藏夹
      </button>
      <button
        type="button"
        class="mt-5 w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
        @click="emit('save-selection', [...draftSelectedIds])"
      >
        保存收藏夹
      </button>
      <button
        type="button"
        class="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        @click="emit('close')"
      >
        取消
      </button>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { FavoriteFolder } from "@/global/typedefinition";

const props = defineProps<{
  show: boolean;
  folders: FavoriteFolder[];
  selectedFolderIds?: Array<number | "default">;
}>();

const hasDefaultFolder = computed(() =>
  props.folders.some((folder) => folder.name.trim() === "默认收藏夹"),
);

const emit = defineEmits<{
  close: [];
  "save-selection": [folderIds: Array<number | "default">];
  "create-folder": [folderIds: Array<number | "default">];
}>();

const draftSelectedIds = ref<Array<number | "default">>([]);

watch(
  () => [props.show, props.selectedFolderIds] as const,
  () => {
    if (!props.show) return;
    draftSelectedIds.value = [...(props.selectedFolderIds ?? [])];
  },
  { immediate: true },
);
</script>
