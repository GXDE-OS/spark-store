<template>
  <div
    class="flex flex-col gap-4 border-b border-slate-200/70 px-6 py-5 dark:border-slate-800/70"
  >
    <div class="flex items-start gap-4">
      <div class="flex-1">
        <p class="text-2xl font-semibold text-slate-900 dark:text-white">
          软件更新
        </p>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          集中管理 APM 与传统 deb 更新任务
        </p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="$emit('refresh')"
        >
          <i class="fas fa-sync-alt"></i>
          刷新
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-semibold text-white shadow-lg disabled:opacity-40"
          :disabled="selectedCount === 0"
          @click="$emit('start-selected')"
        >
          <i class="fas fa-play"></i>
          更新选中 ({{ selectedCount }})
        </button>
        <button
          type="button"
          aria-label="关闭"
          class="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200/70 text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:text-slate-300"
          @click="$emit('request-close')"
        >
          <i class="fas fa-xmark"></i>
        </button>
      </div>
    </div>

    <div class="flex items-center gap-3">
      <label class="inline-flex cursor-pointer items-center gap-2 select-none">
        <input
          ref="selectAllRef"
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300 accent-brand focus:ring-brand"
          :checked="allSelected"
          @change="$emit('toggle-select-all')"
        />
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200"
          >全选</span
        >
      </label>
      <span class="text-sm text-slate-400 dark:text-slate-500">
        已选 {{ selectedCount }} 项
      </span>
    </div>

    <label class="block relative">
      <span class="sr-only">搜索更新</span>
      <input
        :value="searchQuery"
        type="search"
        placeholder="搜索应用或包名"
        class="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-brand/60 focus:bg-white dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:bg-slate-900"
        @input="handleInput"
      />
      <button
        v-if="searchQuery"
        type="button"
        class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
        @click="clearSearch"
        title="清除搜索"
      >
        <i class="fas fa-times-circle"></i>
      </button>
    </label>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  searchQuery: string;
  selectedCount: number;
  allSelected: boolean;
  someSelected: boolean;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "start-selected"): void;
  (e: "request-close"): void;
  (e: "toggle-select-all"): void;
  (e: "update:search-query", value: string): void;
}>();

const selectAllRef = ref<HTMLInputElement | null>(null);

watch(
  [() => props.someSelected, () => props.allSelected],
  () => {
    if (selectAllRef.value) {
      selectAllRef.value.indeterminate =
        props.someSelected && !props.allSelected;
    }
  },
  { flush: "post" },
);

const handleInput = (event: Event): void => {
  const target = event.target as HTMLInputElement | null;
  emit("update:search-query", target?.value ?? props.searchQuery);
};

const clearSearch = () => {
  emit("update:search-query", "");
};
</script>
