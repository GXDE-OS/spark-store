<template>
  <div
    class="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-muted border-r border-slate-200/70 p-6 dark:border-slate-800/70"
  >
    <div
      v-if="items.length === 0"
      class="rounded-2xl border border-dashed border-slate-200/80 px-4 py-10 text-center text-slate-500 dark:border-slate-800/80 dark:text-slate-400"
    >
      暂无可展示的更新任务
    </div>
    <div v-else class="space-y-3">
      <UpdateCenterItem
        v-for="item in items"
        :key="item.taskKey"
        :item="item"
        :task="taskMap.get(item.taskKey)"
        :selected="selectedTaskKeys.has(item.taskKey)"
        @toggle-selection="$emit('toggle-selection', item.taskKey)"
        @ignore-item="$emit('ignore-item', item.packageName, item.newVersion)"
        @unignore-item="
          $emit('unignore-item', item.packageName, item.newVersion)
        "
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type {
  UpdateCenterItem as UpdateCenterItemModel,
  UpdateCenterTaskState,
} from "@/global/typedefinition";

import UpdateCenterItem from "./UpdateCenterItem.vue";

const props = defineProps<{
  items: UpdateCenterItemModel[];
  tasks: UpdateCenterTaskState[];
  selectedTaskKeys: Set<string>;
}>();

defineEmits<{
  (e: "toggle-selection", taskKey: string): void;
  (e: "ignore-item", packageName: string, newVersion: string): void;
  (e: "unignore-item", packageName: string, newVersion: string): void;
}>();

const taskMap = computed(() => {
  return new Map(props.tasks.map((task) => [task.taskKey, task]));
});
</script>
