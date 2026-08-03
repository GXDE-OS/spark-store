<template>
  <div
    class="flex items-center justify-center gap-2 py-4 text-xs text-slate-400"
  >
    <i v-if="loading" class="fas fa-spinner fa-spin"></i>
    <span>{{ loading ? (loadingText || "加载中…") : "暂无数据" }}</span>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    loading?: boolean;
    loadingText?: string;
  }>(),
  { loading: false, loadingText: "加载中…" },
);
</script>
