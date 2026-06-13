<template>
  <Transition
    enter-active-class="duration-200 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/70 px-4 py-10"
      @click.self="emit('close')"
    >
      <div
        class="flex w-full max-w-3xl max-h-[85vh] flex-col rounded-3xl border border-white/10 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          class="flex items-start justify-between border-b border-slate-200/70 p-6 dark:border-slate-800/70"
        >
          <div>
            <p class="text-2xl font-semibold text-slate-900 dark:text-white">
              从账号恢复
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              选择云端已同步的应用加入安装队列
            </p>
          </div>
          <button
            type="button"
            class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="关闭"
            @click="emit('close')"
          >
            <i class="fas fa-xmark"></i>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6">
          <div
            v-if="loading"
            class="rounded-2xl border border-dashed border-slate-200/80 px-4 py-10 text-center text-slate-500 dark:border-slate-800/80 dark:text-slate-400"
          >
            正在读取云端应用列表…
          </div>
          <div
            v-else-if="error"
            class="rounded-2xl border border-rose-200/70 bg-rose-50/60 px-4 py-6 text-center text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10"
          >
            {{ error }}
          </div>
          <div
            v-else-if="items.length === 0"
            class="rounded-2xl border border-slate-200/70 px-4 py-10 text-center text-slate-500 dark:border-slate-800/70 dark:text-slate-400"
          >
            云端暂无已同步应用
          </div>
          <div v-else class="space-y-3">
            <label
              v-for="item in items"
              :key="cloudItemKey(item)"
              class="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70"
              :class="isInstalled(item) ? 'opacity-60' : 'cursor-pointer'"
            >
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                :aria-label="item.appName || item.pkgname"
                :checked="selectedKeys.has(cloudItemKey(item))"
                :disabled="isInstalled(item)"
                @change="toggleSelection(item)"
              />
              <img
                v-if="item.iconUrl"
                :src="item.iconUrl"
                class="h-10 w-10 rounded-xl object-contain"
                alt=""
              />
              <div
                v-else
                class="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 dark:bg-slate-800"
              >
                <i class="fas fa-cube"></i>
              </div>
              <div class="min-w-0 flex-1">
                <p class="font-semibold text-slate-900 dark:text-white">
                  {{ item.appName || item.pkgname }}
                </p>
                <p class="truncate text-xs text-slate-500 dark:text-slate-400">
                  {{ item.origin }} · {{ item.category }} · {{ item.pkgname }} ·
                  {{ item.version }} · {{ item.packageArch }}
                </p>
              </div>
              <span
                v-if="isInstalled(item)"
                class="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
              >
                已安装
              </span>
            </label>
          </div>
        </div>

        <div
          class="flex items-center justify-end gap-3 border-t border-slate-200/70 p-6 dark:border-slate-800/70"
        >
          <button
            type="button"
            class="rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            @click="emit('close')"
          >
            取消
          </button>
          <button
            type="button"
            class="rounded-2xl bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:opacity-40"
            :disabled="selectedItems.length === 0"
            @click="emit('install-selected', selectedItems)"
          >
            加入安装队列
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import type { SyncedAppListItem } from "@/global/typedefinition";
import { cloudItemKey, cloudPackageKey } from "@/modules/appListSync";

const props = defineProps<{
  show: boolean;
  loading: boolean;
  error: string;
  items: SyncedAppListItem[];
  installedKeys: Set<string>;
  installedPackageKeys?: Set<string>;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "install-selected", items: SyncedAppListItem[]): void;
}>();

const selectedKeys = ref<Set<string>>(new Set());

const isInstalled = (item: SyncedAppListItem): boolean =>
  props.installedKeys.has(cloudItemKey(item)) ||
  Boolean(props.installedPackageKeys?.has(cloudPackageKey(item)));

const selectedItems = computed(() =>
  props.items.filter(
    (item) => selectedKeys.value.has(cloudItemKey(item)) && !isInstalled(item),
  ),
);

const pruneSelectedKeys = (): void => {
  selectedKeys.value = new Set(
    [...selectedKeys.value].filter((key) => {
      const item = props.items.find(
        (candidate) => cloudItemKey(candidate) === key,
      );
      return item ? !isInstalled(item) : !props.installedKeys.has(key);
    }),
  );
};

const toggleSelection = (item: SyncedAppListItem): void => {
  if (isInstalled(item)) return;
  const key = cloudItemKey(item);
  const next = new Set(selectedKeys.value);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  selectedKeys.value = next;
};

watch(
  () => [props.show, props.items] as const,
  () => {
    selectedKeys.value = new Set();
  },
  { deep: true },
);

watch(
  () => [props.installedKeys, props.installedPackageKeys] as const,
  () => {
    pruneSelectedKeys();
  },
  { deep: true },
);
</script>
