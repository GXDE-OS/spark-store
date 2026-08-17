<template>
  <div
    class="mb-1 flex items-center gap-1 text-xs font-semibold"
    :class="
      origin === 'spark'
        ? 'text-orange-600 dark:text-orange-400'
        : 'text-blue-600 dark:text-blue-400'
    "
  >
    <span
      class="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
      :class="
        origin === 'spark'
          ? 'bg-orange-100 dark:bg-orange-900/30'
          : 'bg-blue-100 dark:bg-blue-900/30'
      "
      >{{ origin === "spark" ? "Spark" : "APM" }}</span
    >
  </div>
</template>

<script setup lang="ts">
defineProps<{ origin: "spark" | "apm" }>();
</script>
