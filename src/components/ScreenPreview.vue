<template>
  <Transition
    enter-active-class="duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/80 px-4 py-10"
      @click.self="closePreview"
    >
      <div class="relative w-full max-w-5xl">
        <img
          :src="currentScreenshot"
          alt="应用截图预览"
          class="max-h-[80vh] w-full rounded-3xl border border-slate-200/40 bg-black/40 object-contain shadow-2xl dark:border-slate-700"
        />
        <!-- 左右侧按钮，分别放置在图片两侧，垂直居中 -->
        <div class="absolute left-4 top-1/2 transform -translate-y-1/2">
          <button
            type="button"
            class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-lg transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            @click="prevScreen"
            :disabled="currentScreenIndex === 0"
            aria-label="上一张"
          >
            <i class="fas fa-chevron-left"></i>
          </button>
        </div>

        <div class="absolute right-4 top-1/2 transform -translate-y-1/2">
          <button
            type="button"
            class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-lg transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
            @click="nextScreen"
            :disabled="currentScreenIndex === screenshots.length - 1"
            aria-label="下一张"
          >
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>

        <!-- 仍保留右上关闭按钮 -->
        <div class="absolute top-4 right-4">
          <button
            type="button"
            class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-slate-700 shadow-lg transition hover:bg-white"
            @click="closePreview"
            aria-label="关闭"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div
          class="absolute inset-x-0 bottom-6 flex items-center justify-center"
        >
          <span
            class="rounded-full bg-black/60 px-4 py-1 text-sm font-medium text-white"
            >{{ previewCounterText }}</span
          >
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  show: boolean;
  screenshots: string[];
  currentScreenIndex: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "prev"): void;
  (e: "next"): void;
}>();

const currentScreenshot = computed(() => {
  return props.screenshots[props.currentScreenIndex] || "";
});

const previewCounterText = computed(() => {
  return `${props.currentScreenIndex + 1} / ${props.screenshots.length}`;
});

const closePreview = () => {
  emit("close");
};

const prevScreen = () => {
  emit("prev");
};

const nextScreen = () => {
  emit("next");
};
</script>
