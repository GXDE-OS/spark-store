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
      v-bind="attrs"
      class="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-slate-900/70 p-4"
      @click.self="closeModal"
      @wheel="onOverlayWheel"
    >
      <div
        class="modal-panel relative w-full max-w-5xl max-h-[85vh] overflow-y-auto overscroll-contain scrollbar-nowidth rounded-3xl border border-white/10 bg-white/95 px-6 pb-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <!-- 返回按钮 - sticky定位在模态框内部左上角，滚动时始终可见 -->
        <button
          type="button"
          class="sticky top-2 left-0 z-10 inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow-lg backdrop-blur-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 mt-4"
          @click="closeModal"
          aria-label="返回"
        >
          <i class="fas fa-arrow-left"></i>
          <span>返回</span>
        </button>

        <!-- 主布局：左侧信息 + 右侧内容 -->
        <div class="flex flex-col lg:flex-row gap-6">
          <!-- 左侧：图标、版本、来源、按钮、元信息 -->
          <div class="w-full lg:w-72 flex-shrink-0 space-y-5">
            <!-- 应用图标和名称 -->
            <div class="text-center">
              <div
                class="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-slate-100 to-slate-200 shadow-lg dark:from-slate-800 dark:to-slate-700"
              >
                <img
                  v-if="app"
                  :src="iconPath"
                  alt="icon"
                  class="h-full w-full object-cover transition-opacity duration-300"
                  :class="isIconLoaded ? 'opacity-100' : 'opacity-0'"
                  loading="lazy"
                  @load="isIconLoaded = true"
                />
              </div>
              <h2 class="mt-4 text-xl font-bold text-slate-900 dark:text-white">
                {{ displayApp?.name || "" }}
              </h2>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {{ displayApp?.pkgname || "" }}
              </p>
              <div
                v-if="displayApp?.version || downloadCount"
                class="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400"
              >
                <span v-if="displayApp?.version">{{ displayApp.version }}</span>
                <span
                  v-if="displayApp?.version && downloadCount"
                  class="text-slate-300 dark:text-slate-600"
                  >·</span
                >
                <span v-if="downloadCount" class="flex items-center gap-1">
                  <svg
                    class="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  {{ downloadCount }}
                </span>
              </div>
            </div>

            <!-- 应用来源切换 -->
            <div
              class="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/50 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-800/50"
            >
              <span class="text-sm text-slate-500 dark:text-slate-400"
                >来源</span
              >
              <div
                v-if="app?.isMerged"
                class="flex gap-1 overflow-hidden rounded-lg shadow-sm border border-slate-200 dark:border-slate-700"
              >
                <button
                  v-if="app.sparkApp"
                  type="button"
                  class="px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors"
                  :class="
                    viewingOrigin === 'spark'
                      ? 'bg-orange-500 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  "
                  @click="viewingOrigin = 'spark'"
                >
                  Spark
                </button>
                <button
                  v-if="app.apmApp"
                  type="button"
                  class="px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors"
                  :class="
                    viewingOrigin === 'apm'
                      ? 'bg-blue-500 text-white'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  "
                  @click="viewingOrigin = 'apm'"
                >
                  APM
                </button>
              </div>
              <span
                v-else-if="displayApp"
                :class="[
                  'rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wider',
                  displayApp.origin === 'spark'
                    ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                    : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
                ]"
              >
                {{ displayApp.origin === "spark" ? "Spark" : "APM" }}
              </span>
            </div>

            <!-- 功能按钮 -->
            <div class="space-y-2">
              <button
                v-if="!isinstalled"
                type="button"
                class="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-sm disabled:opacity-40 transition"
                :class="
                  installFeedback
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-800 hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600'
                "
                @click="handleInstall"
                :disabled="installFeedback || isOtherVersionInstalled"
              >
                <i
                  class="fas text-xs"
                  :class="installFeedback ? 'fa-check' : 'fa-download'"
                ></i>
                <span>{{ installBtnText }}</span>
              </button>
              <template v-else>
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                    @click="
                      emit(
                        'open-app',
                        displayApp?.pkgname || '',
                        displayApp?.origin,
                      )
                    "
                  >
                    <i class="fas fa-external-link-alt text-xs"></i>
                    <span>打开</span>
                  </button>
                  <button
                    type="button"
                    class="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-rose-400 hover:text-rose-500 hover:bg-rose-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-rose-500 dark:hover:text-rose-400 dark:hover:bg-slate-700"
                    @click="handleRemove"
                  >
                    <i class="fas fa-trash text-xs"></i>
                    <span>卸载</span>
                  </button>
                </div>
              </template>
              <button
                type="button"
                class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                @click="handleFavorite"
              >
                <i class="fas fa-star text-xs"></i>
                <span>收藏</span>
              </button>
            </div>

            <!-- 其他元信息 -->
            <div
              class="space-y-2 pt-2 border-t border-slate-200/60 dark:border-slate-800/60"
              @click="showAllMetaData"
            >
              <div
                v-if="displayApp?.category"
                class="flex items-center justify-between px-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -mx-1 transition-colors"
              >
                <span class="text-xs text-slate-400">分类</span>
                <span
                  class="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]"
                  >{{ displayApp.category }}</span
                >
              </div>
              <div
                v-if="displayApp?.author"
                class="flex items-center justify-between px-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -mx-1 transition-colors"
              >
                <span class="text-xs text-slate-400">作者</span>
                <span
                  class="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]"
                  >{{ displayApp.author }}</span
                >
              </div>
              <div
                v-if="displayApp?.contributor"
                class="flex items-center justify-between px-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -mx-1 transition-colors"
              >
                <span class="text-xs text-slate-400">贡献者</span>
                <span
                  class="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]"
                  >{{ displayApp.contributor }}</span
                >
              </div>
              <div
                v-if="displayApp?.size"
                class="flex items-center justify-between px-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -mx-1 transition-colors"
              >
                <span class="text-xs text-slate-400">大小</span>
                <span
                  class="text-xs font-medium text-slate-700 dark:text-slate-300"
                  >{{ displayApp.size }}</span
                >
              </div>
              <div
                v-if="displayApp?.update"
                class="flex items-center justify-between px-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -mx-1 transition-colors"
              >
                <span class="text-xs text-slate-400">更新</span>
                <span
                  class="text-xs font-medium text-slate-700 dark:text-slate-300"
                  >{{ displayApp.update }}</span
                >
              </div>
              <div
                v-if="displayApp?.website"
                class="flex items-center justify-between px-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -mx-1 transition-colors"
                @click.stop="openWebsite(displayApp.website)"
              >
                <span class="text-xs text-slate-400">网站</span>
                <span
                  class="text-xs font-medium text-brand truncate max-w-[140px]"
                  >{{ displayApp.website }}</span
                >
              </div>
              <div
                v-if="displayApp?.tags"
                class="flex items-center justify-between px-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 rounded px-1 -mx-1 transition-colors"
              >
                <span class="text-xs text-slate-400">标签</span>
                <span
                  class="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[140px]"
                  >{{ displayApp.tags }}</span
                >
              </div>
            </div>
          </div>

          <!-- 右侧：应用详情（上）+ 截图（下） -->
          <div class="flex-1 min-w-0 space-y-5">
            <!-- 应用详情 -->
            <div
              v-if="displayApp?.more && displayApp.more.trim() !== ''"
              class="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-800/30"
            >
              <h3
                class="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2"
              >
                <i class="fas fa-info-circle text-slate-400"></i>
                应用详情
              </h3>
              <div
                class="max-h-48 overflow-y-auto overscroll-contain text-sm leading-relaxed text-slate-600 dark:text-slate-300 space-y-2"
                v-html="displayApp.more.replace(/\n/g, '<br>')"
              ></div>
            </div>
            <div
              v-else
              class="rounded-2xl border border-slate-200/60 bg-slate-50/30 p-8 text-center dark:border-slate-800/60 dark:bg-slate-800/20"
            >
              <p class="text-sm text-slate-400">暂无应用详情</p>
            </div>

            <!-- 截图展示 -->
            <div v-if="screenshots.length">
              <h3
                class="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2"
              >
                <i class="fas fa-images text-slate-400"></i>
                应用截图
              </h3>
              <div class="grid gap-3 sm:grid-cols-2">
                <img
                  v-for="(screen, index) in screenshots"
                  :key="index"
                  :src="screen"
                  alt="screenshot"
                  class="h-44 w-full cursor-pointer rounded-2xl border border-slate-200/60 object-cover shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800/60"
                  loading="lazy"
                  @click="openPreview(index)"
                  @error="hideImage"
                />
              </div>
            </div>
            <div
              v-else
              class="rounded-2xl border border-slate-200/60 bg-slate-50/30 p-8 text-center dark:border-slate-800/60 dark:bg-slate-800/20"
            >
              <p class="text-sm text-slate-400">暂无应用截图</p>
            </div>

            <ReviewsPanel
              v-if="loggedIn && activeReviewAppKey && activeReviewTags"
              :app-key="activeReviewAppKey"
              :tags="activeReviewTags"
              :logged-in="loggedIn"
              :can-submit="isinstalled"
              @request-login="$emit('request-login', $event)"
            />
            <section
              v-else-if="!loggedIn && reviewAppKey && reviewTags"
              class="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-800/30"
            >
              <h3
                class="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2"
              >
                <i class="fas fa-comments text-slate-400"></i>
                应用评价
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                登录星火账号后可查看评价并发表评论。
              </p>
              <button
                type="button"
                class="mt-4 inline-flex items-center rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                @click="emit('request-login', '登录后查看和发表评论。')"
              >
                登录后查看评价
              </button>
            </section>
            <section
              v-else-if="reviewAppKey && reviewTags"
              class="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-800/30"
            >
              <h3
                class="text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2"
              >
                <i class="fas fa-comments text-slate-400"></i>
                应用评价
              </h3>
              <p class="text-sm text-slate-500 dark:text-slate-400">
                安装应用后可发表评论。
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- 元数据详情弹窗 -->
  <Transition
    enter-active-class="duration-200 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="showMetaModal"
      class="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-slate-900/60 p-4"
      @click.self="closeMetaModal"
    >
      <div
        class="relative w-full max-w-md rounded-2xl border border-white/10 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
      >
        <button
          type="button"
          class="absolute top-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          @click="closeMetaModal"
          aria-label="关闭"
        >
          <i class="fas fa-xmark"></i>
        </button>
        <h3
          class="text-lg font-semibold text-slate-900 dark:text-white mb-4 pr-8"
        >
          应用信息
        </h3>
        <div
          class="max-h-80 overflow-y-auto overscroll-contain rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50 space-y-3"
        >
          <div v-if="displayApp?.name" class="flex justify-between">
            <span class="text-sm text-slate-500">应用名称</span>
            <span
              class="text-sm font-medium text-slate-800 dark:text-slate-200 text-right max-w-[60%] break-all"
              >{{ displayApp.name }}</span
            >
          </div>
          <div v-if="displayApp?.pkgname" class="flex justify-between">
            <span class="text-sm text-slate-500">包名</span>
            <span
              class="text-sm font-medium text-slate-800 dark:text-slate-200 text-right max-w-[60%] break-all"
              >{{ displayApp.pkgname }}</span
            >
          </div>
          <div v-if="displayApp?.version" class="flex justify-between">
            <span class="text-sm text-slate-500">版本</span>
            <span
              class="text-sm font-medium text-slate-800 dark:text-slate-200"
              >{{ displayApp.version }}</span
            >
          </div>
          <div v-if="displayApp?.category" class="flex justify-between">
            <span class="text-sm text-slate-500">分类</span>
            <span
              class="text-sm font-medium text-slate-800 dark:text-slate-200"
              >{{ displayApp.category }}</span
            >
          </div>
          <div v-if="displayApp?.author" class="flex justify-between">
            <span class="text-sm text-slate-500">作者</span>
            <span
              class="text-sm font-medium text-slate-800 dark:text-slate-200 text-right max-w-[60%] break-all"
              >{{ displayApp.author }}</span
            >
          </div>
          <div v-if="displayApp?.contributor" class="flex justify-between">
            <span class="text-sm text-slate-500">贡献者</span>
            <span
              class="text-sm font-medium text-slate-800 dark:text-slate-200 text-right max-w-[60%] break-all"
              >{{ displayApp.contributor }}</span
            >
          </div>
          <div v-if="displayApp?.size" class="flex justify-between">
            <span class="text-sm text-slate-500">大小</span>
            <span
              class="text-sm font-medium text-slate-800 dark:text-slate-200"
              >{{ displayApp.size }}</span
            >
          </div>
          <div v-if="displayApp?.update" class="flex justify-between">
            <span class="text-sm text-slate-500">更新时间</span>
            <span
              class="text-sm font-medium text-slate-800 dark:text-slate-200"
              >{{ displayApp.update }}</span
            >
          </div>
          <div v-if="displayApp?.website" class="flex justify-between">
            <span class="text-sm text-slate-500">网站</span>
            <a
              :href="displayApp.website"
              target="_blank"
              class="text-sm font-medium text-brand hover:underline text-right max-w-[60%] break-all"
              >{{ displayApp.website }}</a
            >
          </div>
          <div v-if="displayApp?.tags" class="flex justify-between">
            <span class="text-sm text-slate-500">标签</span>
            <span
              class="text-sm font-medium text-slate-800 dark:text-slate-200 text-right max-w-[60%] break-all"
              >{{ displayApp.tags }}</span
            >
          </div>
          <div v-if="displayApp?.origin" class="flex justify-between">
            <span class="text-sm text-slate-500">来源</span>
            <span
              class="text-sm font-medium text-slate-800 dark:text-slate-200"
              >{{ displayApp.origin === "spark" ? "Spark" : "APM" }}</span
            >
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, useAttrs, ref, watch } from "vue";
import axios from "axios";
import ReviewsPanel from "@/components/ReviewsPanel.vue";
import { useInstallFeedback, downloads } from "../global/downloadStatus";
import {
  APM_STORE_BASE_URL,
  getHybridDefaultOrigin,
} from "../global/storeConfig";
import { buildReviewAppKey, buildReviewTags } from "../modules/appIdentity";
import type { App, ReviewTags } from "../global/typedefinition";

const attrs = useAttrs();

const props = defineProps<{
  show: boolean;
  app: App | null;
  screenshots: string[];
  sparkInstalled: boolean;
  apmInstalled: boolean;
  loggedIn: boolean;
  reviewAppKey: string;
  reviewTags: ReviewTags | null;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "install", app: App): void;
  (e: "remove", app: App): void;
  (e: "favorite", app: App): void;
  (e: "request-login", message: string): void;
  (e: "open-preview", index: number): void;
  (e: "open-app", pkgname: string, origin?: "spark" | "apm"): void;
  (e: "check-install", app: App): void;
}>();

const appPkgname = computed(() => props.app?.pkgname);

const isIconLoaded = ref(false);

const viewingOrigin = ref<"spark" | "apm">("spark");

// 元数据弹窗相关
const showMetaModal = ref(false);

const showAllMetaData = () => {
  showMetaModal.value = true;
};

const closeMetaModal = () => {
  showMetaModal.value = false;
};

const openWebsite = (url: string) => {
  if (url) {
    window.open(url, "_blank");
  }
};

watch(
  () => props.app,
  (newApp: App | null) => {
    isIconLoaded.value = false;
    if (newApp) {
      if (newApp.isMerged) {
        // 若父组件已根据安装状态设置了优先展示的版本，则使用
        // 否则根据优先级配置决定默认来源
        if (newApp.viewingOrigin) {
          viewingOrigin.value = newApp.viewingOrigin;
        } else if (newApp.sparkApp) {
          // 使用优先级配置决定默认来源
          viewingOrigin.value = getHybridDefaultOrigin(newApp.sparkApp);
        } else {
          viewingOrigin.value = "apm";
        }
      } else {
        viewingOrigin.value = newApp.origin;
      }
    }
  },
  { immediate: true },
);

const displayApp = computed(() => {
  if (!props.app) return null;
  if (!props.app.isMerged) return props.app;
  return viewingOrigin.value === "spark"
    ? props.app.sparkApp || props.app
    : props.app.apmApp || props.app;
});

watch(
  () => displayApp.value,
  (newApp) => {
    if (newApp) {
      emit("check-install", newApp);
    }
  },
  { immediate: false },
);

const activeDownload = computed(() => {
  return downloads.value.find((d) => d.pkgname === displayApp.value?.pkgname);
});

const isinstalled = computed(() => {
  return viewingOrigin.value === "spark"
    ? props.sparkInstalled
    : props.apmInstalled;
});

const isOtherVersionInstalled = computed(() => {
  return viewingOrigin.value === "spark"
    ? props.apmInstalled
    : props.sparkInstalled;
});

const { installFeedback } = useInstallFeedback(appPkgname);
const installBtnText = computed(() => {
  if (isinstalled.value) {
    return "已安装";
  }
  if (isOtherVersionInstalled.value) {
    return viewingOrigin.value === "spark"
      ? "已安装 APM 版"
      : "已安装 Spark 版";
  }
  if (installFeedback.value) {
    const status = activeDownload.value?.status;
    if (status === "downloading") {
      return `下载中 ${Math.floor((activeDownload.value?.progress || 0) * 100)}%`;
    }
    if (status === "installing") {
      return "安装中...";
    }
    return "已加入队列";
  }
  return "安装";
});
const iconPath = computed(() => {
  if (!displayApp.value) return "";
  const arch = window.apm_store.arch || "amd64";
  const finalArch =
    displayApp.value.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
  return `${APM_STORE_BASE_URL}/${finalArch}/${displayApp.value.category}/${displayApp.value.pkgname}/icon.png`;
});

const activeReviewAppKey = computed(() => {
  if (!displayApp.value) return "";
  return buildReviewAppKey(
    displayApp.value,
    props.reviewTags?.clientArch ?? "amd64",
  );
});

const activeReviewTags = computed<ReviewTags | null>(() => {
  if (!displayApp.value || !props.reviewTags) return null;
  return buildReviewTags(displayApp.value, {
    clientArch: props.reviewTags.clientArch,
    distro: props.reviewTags.distro,
  });
});

const downloadCount = ref<string>("");

// 监听 app 变化，获取新app的下载量
watch(
  () => displayApp.value,
  async (newApp) => {
    if (newApp) {
      downloadCount.value = "";
      try {
        const arch = window.apm_store.arch || "amd64";
        const finalArch =
          newApp.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
        const url = `${APM_STORE_BASE_URL}/${finalArch}/${newApp.category}/${newApp.pkgname}/download-times.txt`;
        const resp = await axios.get(url, { responseType: "text" });
        if (resp.status === 200) {
          downloadCount.value = String(resp.data).trim();
        } else {
          downloadCount.value = "N/A";
          throw new Error(`Unexpected response status: ${resp.status}`);
        }
      } catch (e) {
        console.error("Failed to fetch download count", e);
      }
    }
  },
  { immediate: true },
);

const closeModal = () => {
  emit("close");
};

const handleInstall = () => {
  if (displayApp.value) {
    emit("install", displayApp.value);
  }
};

const handleRemove = () => {
  if (displayApp.value) {
    emit("remove", displayApp.value);
  }
};

const handleFavorite = () => {
  if (!displayApp.value) return;
  if (!props.loggedIn) {
    emit("request-login", "收藏应用需要登录星火账号。");
    return;
  }
  emit("favorite", displayApp.value);
};

const openPreview = (index: number) => {
  emit("open-preview", index);
};

const hideImage = (e: Event) => {
  (e.target as HTMLElement).style.display = "none";
};

const onOverlayWheel = (e: WheelEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest(".overflow-y-auto, .overflow-auto")) return;
  e.preventDefault();
};
</script>
