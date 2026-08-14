<template>
  <div
    class="relative mb-6 overflow-hidden rounded-2xl border border-amber-200/60 bg-gradient-to-r from-amber-50 to-orange-50 p-5 shadow-sm dark:border-amber-500/20 dark:from-amber-500/10 dark:to-orange-500/10"
  >
    <div
      class="absolute -right-4 -top-4 text-7xl text-amber-200/50 dark:text-amber-400/10"
    >
      <i class="fas fa-heart"></i>
    </div>
    <div class="flex items-start gap-3">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow"
      >
        <i class="fas fa-hand-holding-heart"></i>
      </div>
      <div>
        <p
          class="text-sm font-bold text-amber-700 dark:text-amber-300"
        >
          {{ title }}
        </p>
        <p
          class="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
        >
          {{ message }}
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    title?: string;
    message?: string;
  }>(),
  {
    title: "致每一位星火贡献者",
    message:
      "星火应用商店的每一次更新、每一个应用，都离不开开发者的默默耕耘与热心用户的悉心维护。感谢所有为星火生态付出时间与精力的贡献者——是你们，让开源之光生生不息。🎉",
  },
);
</script>
