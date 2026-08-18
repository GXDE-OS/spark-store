<template>
  <div
    @click="openDetail"
    class="group relative flex cursor-pointer transition hover:border-brand/50"
    :class="
      compact
        ? 'gap-2 rounded-lg border border-slate-200/70 bg-white/90 p-2 shadow-none hover:shadow-sm dark:border-slate-800/60 dark:bg-slate-900/60'
        : 'gap-3 rounded-xl border border-slate-200/70 bg-white/90 p-4 shadow-sm hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800/60 dark:bg-slate-900/60'
    "
  >
    <!-- 排名徽标（排行榜/荣耀榜使用；前 3 名金/银/铜） -->
    <div
      v-if="rank"
      class="pointer-events-none absolute -left-1.5 -top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold shadow-md ring-2 ring-white transition-transform duration-200 group-hover:scale-110 dark:ring-slate-900"
      :class="rankClass"
    >
      {{ rank }}
    </div>
    <div
      class="flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-b from-slate-100 to-slate-200 shadow-inner dark:from-slate-800 dark:to-slate-700"
      :class="compact ? 'h-9 w-9 rounded-md' : 'h-14 w-14 rounded-xl'"
    >
      <img
        ref="iconImg"
        :src="loadedIcon"
        alt="icon"
        class="h-full w-full object-cover transition-opacity duration-300"
        :class="isLoaded ? 'opacity-100' : 'opacity-0'"
      />
    </div>
    <div class="flex flex-1 flex-col gap-1 overflow-hidden">
      <div class="flex items-center gap-2">
        <div
          class="truncate font-semibold text-slate-900 dark:text-white"
          :class="compact ? 'text-xs' : 'text-base'"
        >
          {{ app.name || "" }}
        </div>
        <div class="flex shrink-0 gap-1">
          <span
            v-if="showMergedBadge"
            class="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
          >
            SPARK/APM
          </span>
          <template v-else>
            <span
              v-if="showSparkBadge"
              class="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
            >
              Spark
            </span>
            <span
              v-if="showApmBadge"
              class="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
            >
              APM
            </span>
          </template>
        </div>
        <span
          v-if="downloadCount"
          class="ml-auto shrink-0 text-[10px] text-slate-400 dark:text-slate-500"
          >{{ formatDownloads(downloadCount) }}</span
        >
      </div>
      <div
        class="leading-tight text-slate-500 dark:text-slate-400"
        :class="compact ? 'text-xs' : 'text-sm'"
      >
        {{ app.pkgname || "" }} · {{ app.version || "" }}
      </div>
      <div
        class="truncate leading-tight text-slate-500 dark:text-slate-400"
        :class="compact ? 'text-[11px]' : 'text-xs'"
      >
        {{ description || "\u00A0" }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from "vue";
import { APM_STORE_BASE_URL } from "../global/storeConfig";
import type { App } from "../global/typedefinition";

const props = defineProps<{
  app: App;
  // 是否显示来源标识（仅在混合模式下显示）
  showOrigin?: boolean;
  // 紧凑模式（用于首页精选板块等空间受限区域）
  compact?: boolean;
  // 下载量（用于下载排行；>=0 时在标题行右侧显示）
  downloadCount?: number;
  // 排名（用于排行榜/荣耀榜，左上角显示徽标）
  rank?: number;
}>();

const emit = defineEmits<{
  (e: "open-detail", app: App): void;
}>();

const iconImg = ref<HTMLImageElement | null>(null);
const isLoaded = ref(false);
const loadedIcon = ref(
  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E',
);

// 是否显示合并标识（两个来源都有）
const showMergedBadge = computed(() => {
  // 只有在 showOrigin 为 true 且 isMerged 为 true 时才显示合并标识
  return props.showOrigin === true && props.app.isMerged === true;
});

// 是否显示 Spark 标识
const showSparkBadge = computed(() => {
  // 只有在 showOrigin 为 true 且不是合并状态时才显示单独标识
  if (props.showOrigin !== true || props.app.isMerged === true) return false;
  // 根据 app 的 origin 判断
  return props.app.origin === "spark";
});

// 是否显示 APM 标识
const showApmBadge = computed(() => {
  // 只有在 showOrigin 为 true 且不是合并状态时才显示单独标识
  if (props.showOrigin !== true || props.app.isMerged === true) return false;
  // 根据 app 的 origin 判断
  return props.app.origin === "apm";
});

const iconPath = computed(() => {
  const arch = window.apm_store.arch || "amd64";
  const finalArch =
    props.app.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
  return `${APM_STORE_BASE_URL}/${finalArch}/${props.app.category}/${props.app.pkgname}/icon.png`;
});

const description = computed(() => {
  const more = props.app.more || "";
  return more.substring(0, 80) + (more.length > 80 ? "..." : "");
});

// 下载量格式化：>=1万 显示 "x.x万"
const formatDownloads = (n?: number): string => {
  if (!n || n <= 0) return "0";
  if (n >= 10000) {
    const wan = n / 10000;
    return `${wan.toFixed(1).replace(/\.0$/, "")}万`;
  }
  return n.toLocaleString();
};

// 排名徽标配色（前 3 名金/银/铜，其余灰色）
const rankClass = computed(() => {
  if (props.rank === 1) return "bg-amber-400 text-white shadow-amber-400/40";
  if (props.rank === 2)
    return "bg-slate-300 text-slate-700 shadow-slate-400/40";
  if (props.rank === 3) return "bg-amber-600 text-white shadow-amber-600/40";
  return "bg-slate-500/90 text-white shadow-slate-500/30";
});

const openDetail = () => {
  emit("open-detail", props.app);
};

let observer: IntersectionObserver | null = null;

onMounted(() => {
  // 创建 Intersection Observer
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !isLoaded.value) {
          // 图片进入视口，开始加载
          const img = new Image();
          img.onload = () => {
            loadedIcon.value = iconPath.value;
            isLoaded.value = true;
            if (observer) observer.unobserve(entry.target);
          };
          img.onerror = () => {
            // 加载失败时使用默认图标
            loadedIcon.value =
              'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23e0e0e0" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="14"%3ENo Icon%3C/text%3E%3C/svg%3E';
            isLoaded.value = true;
            if (observer) observer.unobserve(entry.target);
          };
          img.src = iconPath.value;
        }
      });
    },
    {
      rootMargin: "50px", // 提前50px开始加载
      threshold: 0.01,
    },
  );

  // 观察图标元素
  if (iconImg.value) {
    observer.observe(iconImg.value);
  }
});

// 当 app 变更时重置懒加载状态并重新观察
watch(iconPath, () => {
  loadedIcon.value =
    'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23f0f0f0" width="100" height="100"/%3E%3C/svg%3E';
  isLoaded.value = false;
  if (observer && iconImg.value) {
    observer.unobserve(iconImg.value);
    observer.observe(iconImg.value);
  }
});

onBeforeUnmount(() => {
  // 清理 observer
  if (observer && iconImg.value) {
    observer.unobserve(iconImg.value);
  }
});
</script>
