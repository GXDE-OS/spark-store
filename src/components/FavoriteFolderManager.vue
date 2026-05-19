<template>
  <section
    class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
  >
    <div
      class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
          我的收藏
        </h1>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          管理收藏夹中的应用，已下架或不可用项目会保留显示。
        </p>
      </div>
      <button
        type="button"
        class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        @click="emit('create-folder')"
      >
        新建收藏夹
      </button>
    </div>

    <div class="mt-5 flex flex-wrap gap-2">
      <button
        v-for="folder in folders"
        :key="folder.id"
        type="button"
        class="rounded-full px-4 py-2 text-sm font-medium transition"
        :class="
          folder.id === activeFolderId
            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
        "
        @click="emit('select-folder', folder.id)"
      >
        {{ folder.name }} ({{ folder.itemCount }})
      </button>
    </div>

    <div v-if="loading" class="mt-6 text-sm text-slate-500">加载中...</div>
    <div v-else-if="error" class="mt-6 text-sm text-rose-500">{{ error }}</div>
    <div v-else class="mt-6 space-y-3">
      <div
        v-if="items.length === 0"
        class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400"
      >
        当前收藏夹暂无应用。
      </div>
      <label
        v-for="resolved in items"
        :key="resolved.item.id"
        class="flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60"
      >
        <input
          v-model="selectedIds"
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300"
          :value="resolved.item.id"
          :aria-label="`选择 ${resolved.item.name || resolved.item.pkgname}`"
        />
        <img
          v-if="resolved.item.iconUrl"
          :src="resolved.item.iconUrl"
          alt=""
          class="h-10 w-10 rounded-xl object-cover"
        />
        <div
          v-else
          class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500 dark:bg-slate-800"
        >
          {{ (resolved.item.name || resolved.item.pkgname).slice(0, 1) }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-slate-900 dark:text-white">
            {{ resolved.item.name || resolved.item.pkgname }}
          </p>
          <p class="truncate text-xs text-slate-500 dark:text-slate-400">
            {{ resolved.item.pkgname }} · {{ resolved.item.category }}
          </p>
        </div>
        <span
          class="rounded-full px-3 py-1 text-xs font-medium"
          :class="statusClass(resolved.status)"
        >
          {{ resolved.reason }}
        </span>
      </label>
    </div>

    <div class="mt-6 flex flex-wrap gap-3">
      <button
        type="button"
        class="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        @click="selectInstallable"
      >
        选择可安装
      </button>
      <button
        type="button"
        class="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
        :disabled="selectedInstallableItems.length === 0"
        @click="emit('install-selected', selectedInstallableItems)"
      >
        加入安装队列
      </button>
      <button
        type="button"
        class="rounded-xl border border-rose-300 px-4 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-40 dark:border-rose-900/70 dark:hover:bg-rose-950/30"
        :disabled="selectedIds.length === 0"
        @click="emit('remove-selected', [...selectedIds])"
      >
        移除选中
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type {
  FavoriteAvailabilityStatus,
  FavoriteFolder,
  ResolvedFavoriteItem,
} from "@/global/typedefinition";

const props = defineProps<{
  folders: FavoriteFolder[];
  activeFolderId: number | null;
  items: ResolvedFavoriteItem[];
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  "select-folder": [folderId: number];
  "create-folder": [];
  "remove-selected": [itemIds: number[]];
  "install-selected": [items: ResolvedFavoriteItem[]];
}>();

const selectedIds = ref<number[]>([]);

const selectedInstallableItems = computed(() =>
  props.items.filter(
    (item) =>
      selectedIds.value.includes(item.item.id) && item.status === "installable",
  ),
);

watch(
  () => props.items,
  () => {
    const visibleIds = new Set(props.items.map((item) => item.item.id));
    selectedIds.value = selectedIds.value.filter((id) => visibleIds.has(id));
  },
);

const selectInstallable = () => {
  selectedIds.value = props.items
    .filter((item) => item.status === "installable")
    .map((item) => item.item.id);
};

const statusClass = (status: FavoriteAvailabilityStatus): string => {
  if (status === "installable") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  }
  if (status === "installed") {
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  }
  return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
};
</script>
