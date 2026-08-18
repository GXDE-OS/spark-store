<template>
  <!--
    首页视图：仅渲染"区域1 精选（links）"。
    历史版本曾渲染"区域2 板块（homelist.json）"作为第二个 section，
    若回滚/合并导致该 section 复活，板块应用会与侧边栏入口"装机必备/社区精品/APM 扩展"内容重复展示（双来源同数据）。
    现行设计：板块已迁移至侧边栏入口（App.vue `loadHomeListEntries`），首页不再渲染板块，参见 commit 438b9baa。
  -->
  <div class="flex h-full min-h-0 flex-col gap-2 overflow-hidden">
    <!-- 初始加载状态 - 只有在完全没有数据时显示 -->
    <div
      v-if="loading && links.length === 0"
      class="flex flex-1 flex-col items-center justify-center text-slate-500 dark:text-slate-400"
    >
      <i class="fas fa-spinner fa-spin text-2xl mb-3"></i>
      <span class="text-sm">正在加载首页内容…</span>
    </div>
    <div
      v-else-if="error"
      class="rounded-2xl border border-rose-200/70 bg-rose-50/60 px-6 py-4 text-center text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-300"
    >
      {{ error }}
    </div>
    <!-- 无数据时显示欢迎信息 -->
    <div
      v-else-if="links.length === 0"
      class="flex flex-1 flex-col items-center justify-center text-center"
    >
      <img
        v-if="storeFilter === 'apm'"
        src="../assets/imgs/amber-pm-logo.png"
        alt="Amber PM"
        class="h-32 w-32 mb-6 opacity-90 object-contain"
      />
      <img
        v-else
        src="../assets/imgs/spark-store.svg"
        alt="星火应用商店"
        class="h-32 w-32 mb-6 opacity-90"
      />
      <h1 class="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
        {{
          storeFilter === "apm"
            ? "欢迎来到星火应用商店 (Amber PM)"
            : "欢迎来到星火应用商店"
        }}
      </h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{
          storeFilter === "apm"
            ? "探索丰富的应用，发现更多精彩内容"
            : "探索丰富的应用，发现更多精彩内容"
        }}
      </p>
    </div>
    <!-- 有数据就立即展示，图片逐步加载 -->
    <template v-else>
      <!-- ============ 区域1 · 精选（两行网格 4×2，静态不滚动） ============ -->
      <section class="shrink-0">
        <div class="mb-4">
          <h1 class="text-sm font-bold text-slate-800 dark:text-slate-200">
            {{
              storeFilter === "apm" ? "星火应用商店 (Amber PM)" : "星火应用商店"
            }}
          </h1>
          <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            探索丰富的应用，发现更多精彩内容
          </p>
        </div>
        <div
          v-if="links.length > 0"
          class="grid grid-cols-2 gap-4 sm:grid-cols-4"
        >
          <a
            v-for="link in links"
            :key="link.url + link.name"
            :href="link.type === '_blank' ? undefined : link.url"
            @click.prevent="onLinkClick(link)"
            class="group block overflow-hidden rounded-lg transition-transform duration-300 hover:scale-[1.02]"
            :title="link.more as string"
          >
            <div
              class="relative w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800"
            >
              <img
                :src="computedImgUrl(link)"
                class="block w-full transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
                @load="onImageLoad(link.url + link.name)"
                @error="onImageError(link.url + link.name)"
                :class="{
                  'aspect-[850/260] object-cover':
                    !imageLoaded[link.url + link.name],
                  'h-auto': imageLoaded[link.url + link.name],
                  'opacity-0': !imageLoaded[link.url + link.name],
                  'opacity-100 transition-opacity duration-300':
                    imageLoaded[link.url + link.name],
                }"
              />
              <div
                v-if="!imageLoaded[link.url + link.name]"
                class="absolute inset-0 flex items-center justify-center"
              >
                <div
                  class="h-10 w-10 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"
                ></div>
              </div>
            </div>
            <div class="mt-1.5 px-1">
              <div
                class="text-sm font-semibold text-slate-900 dark:text-white group-hover:text-brand dark:group-hover:text-brand transition-colors"
              >
                {{ link.name }}
              </div>
              <div
                class="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1"
              >
                {{ link.more }}
              </div>
            </div>
          </a>
        </div>
        <!-- 致谢说明（F2.3 复用）：置于区域1 其他内容下方，当前按需求隐藏（代码保留） -->
        <ThanksCard v-if="false" class="mt-4" />
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { reactive } from "vue";
import { APM_STORE_BASE_URL } from "../global/storeConfig";
import type { HomeLink, App } from "../global/typedefinition";
import ThanksCard from "./ThanksCard.vue";

withDefaults(
  defineProps<{
    links: HomeLink[];
    loading: boolean;
    error: string;
    storeFilter?: "spark" | "apm" | "both";
  }>(),
  {
    storeFilter: "both",
  },
);

const emit = defineEmits<{
  (e: "open-detail", app: App): void;
}>();

// 图片加载状态跟踪
const imageLoaded = reactive<Record<string, boolean>>({});

const onImageLoad = (key: string) => {
  imageLoaded[key] = true;
};

const onImageError = (key: string) => {
  imageLoaded[key] = true; // 即使加载失败也标记为完成，隐藏占位符
};

const computedImgUrl = (link: HomeLink) => {
  if (!link.imgUrl) return "";
  const arch = window.apm_store.arch || "amd64";
  const finalArch = link.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
  return `${APM_STORE_BASE_URL}/${finalArch}${link.imgUrl}`;
};

const onLinkClick = (link: HomeLink) => {
  if (link.type === "_blank") {
    window.open(link.url, "_blank");
  } else {
    // open in same page: navigate to url
    window.location.href = link.url;
  }
};

// 下载量格式化：>= 1万 显示为 "x.x万"
// (download count now formatted inside AppCard via its downloadCount prop)
</script>

<style scoped>
/* Link 卡片网格 - 固定最小宽度 180px */
.auto-fit-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

/* 小屏幕 - 最小宽度减小 */
@media (max-width: 640px) {
  .auto-fit-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 12px;
  }
}
</style>
