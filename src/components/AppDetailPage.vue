<template>
  <section
    v-if="displayApp"
    class="mx-auto max-w-6xl rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:p-6"
  >
    <button
      type="button"
      class="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      aria-label="返回"
      @click="emit('back')"
    >
      <i class="fas fa-arrow-left"></i>
      <span>返回</span>
    </button>

    <div class="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
      <aside class="space-y-5">
        <div class="text-center">
          <div
            class="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-b from-slate-100 to-slate-200 shadow-lg dark:from-slate-800 dark:to-slate-700"
          >
            <img
              :src="iconPath"
              alt="icon"
              class="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
          <h1 class="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
            {{ displayApp.name }}
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ displayApp.pkgname }}
          </p>
          <p
            v-if="displayApp.version"
            class="mt-1 text-sm text-slate-500 dark:text-slate-400"
          >
            {{ displayApp.version }}
          </p>
        </div>

        <div
          class="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/70 px-4 py-3 dark:border-slate-800/60 dark:bg-slate-800/50"
        >
          <span class="text-sm text-slate-500 dark:text-slate-400">来源</span>
          <div
            v-if="app.isMerged"
            class="flex overflow-hidden rounded-lg border border-slate-200 shadow-sm dark:border-slate-700"
          >
            <button
              v-if="app.sparkApp"
              type="button"
              class="px-3 py-1 text-xs font-medium uppercase tracking-wider transition-colors"
              :class="
                viewingOrigin === 'spark'
                  ? 'bg-orange-500 text-white'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
              "
              @click="selectOrigin('spark')"
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
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600'
              "
              @click="selectOrigin('apm')"
            >
              APM
            </button>
          </div>
          <span
            v-else
            class="rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wider"
            :class="
              displayApp.origin === 'spark'
                ? 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                : 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
            "
          >
            {{ displayApp.origin === "spark" ? "Spark" : "APM" }}
          </span>
        </div>

        <div class="space-y-2">
          <button
            v-if="!isInstalled"
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-700 dark:hover:bg-slate-600"
            :disabled="isOtherVersionInstalled"
            @click="emit('install', displayApp)"
          >
            <i class="fas fa-download text-xs"></i>
            <span>{{ installButtonText }}</span>
          </button>
          <div v-else class="flex gap-2">
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              @click="emit('open-app', displayApp.pkgname, displayApp.origin)"
            >
              <i class="fas fa-external-link-alt text-xs"></i>
              <span>打开</span>
            </button>
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:border-rose-400 hover:bg-rose-50 hover:text-rose-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-rose-400"
              @click="emit('remove', displayApp)"
            >
              <i class="fas fa-trash text-xs"></i>
              <span>卸载</span>
            </button>
          </div>
          <button
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            @click="handleFavorite"
          >
            <i class="fas fa-star text-xs"></i>
            <span>{{ favoriteButtonText }}</span>
          </button>
          <button
            type="button"
            class="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            @click="copySpkLink"
          >
            <i
              class="fas text-xs"
              :class="spkCopied ? 'fa-check' : 'fa-share-alt'"
            ></i>
            <span>{{ spkCopied ? "已复制链接" : "SPK 分享" }}</span>
          </button>
        </div>

        <dl
          class="space-y-2 border-t border-slate-200/60 pt-3 text-xs dark:border-slate-800/60"
        >
          <div v-if="displayApp.category" class="flex justify-between gap-3">
            <dt class="text-slate-400">分类</dt>
            <dd class="truncate text-slate-700 dark:text-slate-300">
              {{ displayApp.category }}
            </dd>
          </div>
          <div v-if="displayApp.author" class="flex justify-between gap-3">
            <dt class="text-slate-400">作者</dt>
            <dd class="truncate text-slate-700 dark:text-slate-300">
              {{ displayApp.author }}
            </dd>
          </div>
          <div v-if="displayApp.size" class="flex justify-between gap-3">
            <dt class="text-slate-400">大小</dt>
            <dd class="text-slate-700 dark:text-slate-300">
              {{ displayApp.size }}
            </dd>
          </div>
          <div v-if="displayApp.update" class="flex justify-between gap-3">
            <dt class="text-slate-400">更新</dt>
            <dd class="text-slate-700 dark:text-slate-300">
              {{ displayApp.update }}
            </dd>
          </div>
        </dl>
      </aside>

      <div class="min-w-0 space-y-5">
        <div
          class="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-800/30"
        >
          <h2 class="mb-3 flex items-center gap-2 text-base font-semibold">
            <i class="fas fa-info-circle text-slate-400"></i>
            应用详情
          </h2>
          <div
            v-if="displayApp.more.trim() !== ''"
            class="space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300"
            v-html="detailHtml"
          ></div>
          <p v-else class="text-sm text-slate-400">暂无应用详情</p>
        </div>

        <div
          class="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-800/30"
        >
          <h2 class="mb-3 flex items-center gap-2 text-base font-semibold">
            <i class="fas fa-images text-slate-400"></i>
            应用截图
          </h2>
          <div v-if="screenshots.length" class="grid gap-3 sm:grid-cols-2">
            <img
              v-for="(screen, index) in screenshots"
              :key="screen"
              :src="screen"
              alt="screenshot"
              class="h-44 w-full cursor-pointer rounded-2xl border border-slate-200/60 object-cover shadow-sm transition hover:-translate-y-1 hover:shadow-lg dark:border-slate-800/60"
              loading="lazy"
              @click="emit('open-preview', index)"
              @error="hideImage"
            />
          </div>
          <p v-else class="text-sm text-slate-400">暂无应用截图</p>
        </div>

        <ReviewsPanel
          v-if="loggedIn && reviewAppKey && reviewTags"
          :app-key="reviewAppKey"
          :tags="reviewTags"
          :logged-in="loggedIn"
          :can-submit="isInstalled"
          @request-login="$emit('request-login', $event)"
          @show-user="emit('show-user', $event)"
        />
        <section
          v-else-if="!loggedIn && reviewAppKey && reviewTags"
          class="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-800/30"
        >
          <h2 class="mb-2 flex items-center gap-2 text-base font-semibold">
            <i class="fas fa-comments text-slate-400"></i>
            应用评价
          </h2>
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
          <h2 class="mb-2 flex items-center gap-2 text-base font-semibold">
            <i class="fas fa-comments text-slate-400"></i>
            应用评价
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            安装应用后可发表评论。
          </p>
        </section>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import ReviewsPanel from "@/components/ReviewsPanel.vue";
import {
  APM_STORE_BASE_URL,
  getHybridDefaultOrigin,
} from "@/global/storeConfig";
import {
  buildReviewAppKey,
  buildReviewTags,
  getDisplayApp,
} from "@/modules/appIdentity";
import type { App, AppReview, ReviewTags } from "@/global/typedefinition";

const props = defineProps<{
  app: App;
  screenshots: string[];
  sparkInstalled: boolean;
  apmInstalled: boolean;
  loggedIn: boolean;
  reviewAppKey: string;
  reviewTags: ReviewTags | null;
  favorited?: boolean;
  favoriteFolderName?: string;
}>();

const emit = defineEmits<{
  back: [];
  install: [app: App];
  remove: [app: App];
  favorite: [app: App];
  "request-login": [message: string];
  "open-preview": [index: number];
  "open-app": [pkgname: string, origin?: "spark" | "apm"];
  "check-install": [app: App];
  "select-origin": [origin: "spark" | "apm"];
  "show-user": [review: AppReview];
}>();

const viewingOrigin = ref<"spark" | "apm">(
  props.app.viewingOrigin ?? props.app.origin,
);

watch(
  () => props.app,
  (app) => {
    if (app.isMerged) {
      viewingOrigin.value =
        app.viewingOrigin ??
        (app.sparkApp ? getHybridDefaultOrigin(app.sparkApp) : "apm");
    } else {
      viewingOrigin.value = app.origin;
    }
  },
  { immediate: true },
);

const appWithSelectedOrigin = computed<App>(() => ({
  ...props.app,
  viewingOrigin: viewingOrigin.value,
}));

const displayApp = computed(() => getDisplayApp(appWithSelectedOrigin.value));

watch(
  () => displayApp.value,
  (app) => {
    if (app) emit("check-install", app);
  },
);

const isInstalled = computed(() =>
  viewingOrigin.value === "spark" ? props.sparkInstalled : props.apmInstalled,
);

const isOtherVersionInstalled = computed(() =>
  viewingOrigin.value === "spark" ? props.apmInstalled : props.sparkInstalled,
);

const installButtonText = computed(() => {
  if (isOtherVersionInstalled.value) {
    return viewingOrigin.value === "spark"
      ? "已安装 APM 版"
      : "已安装 Spark 版";
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

const detailHtml = computed(
  () => displayApp.value?.more.replace(/\n/g, "<br>") ?? "",
);

const reviewAppKey = computed(() => {
  if (!displayApp.value) return "";
  return buildReviewAppKey(
    displayApp.value,
    props.reviewTags?.clientArch ?? "amd64",
  );
});

const reviewTags = computed<ReviewTags | null>(() => {
  if (!displayApp.value || !props.reviewTags) return null;
  return buildReviewTags(displayApp.value, {
    clientArch: props.reviewTags.clientArch,
    distro: props.reviewTags.distro,
  });
});

const favoriteButtonText = computed(() => {
  if (!props.favorited) return "收藏";
  return props.favoriteFolderName
    ? `已收藏 · ${props.favoriteFolderName}`
    : "已收藏";
});

const selectOrigin = (origin: "spark" | "apm") => {
  viewingOrigin.value = origin;
  emit("select-origin", origin);
  if (displayApp.value) emit("check-install", displayApp.value);
};

const handleFavorite = () => {
  if (!displayApp.value) return;
  if (!props.loggedIn) {
    emit("request-login", "收藏应用需要登录星火账号。");
    return;
  }
  emit("favorite", displayApp.value);
};

const hideImage = (event: Event) => {
  (event.target as HTMLElement).style.display = "none";
};

const spkCopied = ref(false);
let spkCopiedTimer: ReturnType<typeof setTimeout> | null = null;

const copySpkLink = async () => {
  if (!displayApp.value?.pkgname) return;
  const spkLink = `spk://store/${displayApp.value.category || "unknown"}/${displayApp.value.pkgname}`;
  try {
    await navigator.clipboard.writeText(spkLink);
    spkCopied.value = true;
    if (spkCopiedTimer) clearTimeout(spkCopiedTimer);
    spkCopiedTimer = setTimeout(() => {
      spkCopied.value = false;
    }, 2000);
  } catch {
    prompt("请手动复制 SPK 分享链接：", spkLink);
  }
};
</script>
