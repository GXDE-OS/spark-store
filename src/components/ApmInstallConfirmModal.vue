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
      class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/70 p-4"
      @click.self="handleClose"
    >
      <div
        class="relative w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="mb-6 flex items-center gap-4">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/20 to-brand/10 shadow-inner dark:from-brand/20 dark:to-brand/10"
          >
            <i class="fas fa-box-open text-2xl text-brand"></i>
          </div>
          <div>
            <h3 class="text-xl font-bold text-slate-900 dark:text-white">
              需要安装 APM
            </h3>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              APM 是星火应用商店的软件包兼容工具，此应用使用星火 APM 提供支持。
            </p>
            <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
              是否前往商店安装
              <span class="font-semibold text-slate-700 dark:text-slate-200"
                >APM</span
              >
              ？
            </p>
          </div>
        </div>

        <div class="flex items-center justify-end gap-3">
          <button
            type="button"
            class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            @click="handleClose"
          >
            取消
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-dark px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand/30 transition hover:-translate-y-0.5"
            @click="handleConfirm"
          >
            <i class="fas fa-download"></i>
            前往安装
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "confirm"): void;
}>();

const handleClose = () => {
  emit("close");
};

const handleConfirm = () => {
  emit("confirm");
};
</script>
