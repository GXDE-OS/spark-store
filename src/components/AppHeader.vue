<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
      <button
        type="button"
        class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/80 text-slate-500 shadow-sm backdrop-blur transition hover:bg-slate-50 lg:hidden dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800"
        @click="$emit('toggle-sidebar')"
        title="切换侧边栏"
      >
        <i class="fas fa-bars"></i>
      </button>
      <div class="flex w-full flex-1 items-center gap-3">
        <div class="relative flex-1">
          <label for="searchBox" class="sr-only">搜索应用</label>
          <i
            class="fas fa-search pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          ></i>
          <input
            id="searchBox"
            v-model="localSearchQuery"
            class="w-full rounded-2xl border border-slate-200/70 bg-white/80 py-3 pl-12 pr-20 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand/50 focus:ring-4 focus:ring-brand/10 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-200"
            placeholder="搜索应用名 / 包名 / 标签"
            @focus="handleSearchFocus"
            @input="handleInput"
          />
          <button
            v-if="localSearchQuery"
            type="button"
            class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
            @click="clearSearch"
            title="清除搜索"
          >
            <i class="fas fa-times-circle"></i>
          </button>
        </div>
        <button
          type="button"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/80 text-slate-500 shadow-sm backdrop-blur transition hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800"
          @click="$emit('open-install-settings')"
          title="安装设置"
        >
          <i class="fas fa-cog"></i>
        </button>
        <button
          type="button"
          class="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/80 text-slate-500 shadow-sm backdrop-blur transition hover:bg-slate-50 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:bg-slate-800"
          @click="$emit('open-about')"
          title="关于"
        >
          <i class="fas fa-info-circle"></i>
        </button>
      </div>
    </div>
    <div
      v-if="activeCategory !== 'home'"
      class="text-sm text-slate-500 dark:text-slate-400"
      id="currentCount"
    >
      <!-- 共 {{ appsCount }} 个应用 -->
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{
  searchQuery: string;
  activeCategory: string;
  appsCount: number;
}>();
const emit = defineEmits<{
  (e: "update-search", query: string): void;
  (e: "search-focus"): void;
  (e: "open-install-settings"): void;
  (e: "open-about"): void;
  (e: "toggle-sidebar"): void;
}>();

const localSearchQuery = ref(props.searchQuery || "");

const handleSearchFocus = () => {
  emit("search-focus");
};

const handleInput = () => {
  emit("update-search", localSearchQuery.value);
};

const clearSearch = () => {
  localSearchQuery.value = "";
  emit("update-search", "");
};

watch(
  () => props.searchQuery,
  (newVal) => {
    localSearchQuery.value = newVal || "";
  },
);
</script>
