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
      class="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/70 px-4 py-6 lg:py-10"
      @wheel="onOverlayWheel"
      @click="onOverlayClick"
    >
      <div
        class="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        @click.stop
      >
        <UpdateCenterToolbar
          :search-query="store.searchQuery.value"
          :selected-count="selectedCount"
          :all-selected="store.allSelected.value"
          :some-selected="store.someSelected.value"
          :loading="store.loading.value"
          @refresh="store.refresh"
          @start-selected="emit('request-start-selected')"
          @request-close="store.requestClose"
          @toggle-select-all="store.toggleSelectAll"
          @update:search-query="emit('update:search-query', $event)"
        />

        <div
          v-if="store.snapshot.value.warnings.length > 0"
          class="mx-6 mt-4 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <p
            v-for="warning in store.snapshot.value.warnings"
            :key="warning"
            class="leading-6"
          >
            {{ warning }}
          </p>
        </div>

        <div
          v-if="store.loading.value && store.filteredItems.value.length === 0"
          class="flex min-h-0 flex-1 items-center justify-center p-6"
        >
          <div class="flex flex-col items-center gap-3 text-slate-500 dark:text-slate-400">
            <i class="fas fa-circle-notch fa-spin text-3xl"></i>
            <p class="text-sm">正在检查更新…</p>
          </div>
        </div>
        <template v-else>
          <div
            v-if="store.loading.value && store.filteredItems.value.length > 0"
            class="border-b border-slate-200/70 px-6 py-2 text-center text-xs text-slate-400 dark:border-slate-800/70 dark:text-slate-500"
          >
            正在刷新更新列表…
          </div>
          <div class="flex min-h-0 flex-1">
            <UpdateCenterList
              :items="store.filteredItems.value"
              :tasks="store.snapshot.value.tasks"
              :selected-task-keys="store.selectedTaskKeys.value"
              @toggle-selection="emit('toggle-selection', $event)"
              @ignore-item="store.ignoreItem"
              @unignore-item="store.unignoreItem"
            />
          </div>
        </template>

        <UpdateCenterMigrationConfirm
          :show="store.showMigrationConfirm.value"
          @close="emit('dismiss-migration-confirm')"
          @confirm="emit('confirm-migration-start')"
        />
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { UpdateCenterStore } from "@/modules/updateCenter";

import UpdateCenterList from "./update-center/UpdateCenterList.vue";
import UpdateCenterMigrationConfirm from "./update-center/UpdateCenterMigrationConfirm.vue";
import UpdateCenterToolbar from "./update-center/UpdateCenterToolbar.vue";

const emit = defineEmits<{
  (e: "update:search-query", value: string): void;
  (e: "toggle-selection", taskKey: string): void;
  (e: "request-start-selected"): void;
  (e: "confirm-migration-start"): void;
  (e: "dismiss-migration-confirm"): void;
}>();

const props = defineProps<{
  show: boolean;
  store: UpdateCenterStore;
}>();

const selectedCount = computed(() => props.store.getSelectedItems().length);

const onOverlayWheel = (e: WheelEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest(".overflow-y-auto, .overflow-auto")) return;
  e.preventDefault();
};

const onOverlayClick = () => {
  props.store.requestClose();
};
</script>
