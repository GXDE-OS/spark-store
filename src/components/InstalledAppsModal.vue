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
      class="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/70 px-4 py-10"
      @click.self="$emit('close')"
      @wheel="onOverlayWheel"
    >
      <div
        class="flex w-full max-w-4xl max-h-[85vh] flex-col overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          class="flex items-start justify-between border-b border-slate-200/70 p-6 dark:border-slate-800/70"
        >
          <div class="flex flex-col gap-2">
            <p class="text-2xl font-semibold text-slate-900 dark:text-white">
              已安装应用
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              管理本机安装的应用程序
            </p>
            <div
              v-if="!loading && !error"
              class="mt-2 flex flex-wrap items-center gap-3"
            >
              <div
                class="inline-flex flex-wrap items-stretch overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-50/60 text-sm shadow-sm dark:border-slate-700/60 dark:bg-slate-800/40"
              >
              <!-- APM -->
              <div
                class="group flex cursor-pointer items-center gap-2.5 px-3.5 py-2 transition hover:bg-amber-50/80 dark:hover:bg-amber-500/10"
                :class="
                  filterOrigin === 'apm'
                    ? 'bg-amber-100 ring-2 ring-amber-400/50 dark:bg-amber-500/20'
                    : ''
                "
                title="仅显示 APM 应用"
                role="button"
                @click="filterOrigin = 'apm'"
              >
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm shadow-amber-500/30"
                >
                  <i class="fas fa-box-open text-[12px]"></i>
                </span>
                <div class="flex flex-col leading-tight">
                  <span
                    class="text-[15px] font-bold tabular-nums text-amber-700 dark:text-amber-300"
                    >{{ apmCount }}</span
                  >
                  <span
                    class="text-[10px] font-medium uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80"
                    >APM</span
                  >
                </div>
              </div>
              <!-- 分隔线 -->
              <span
                class="self-stretch w-px bg-slate-200/80 dark:bg-slate-700/80"
              ></span>
              <!-- Spark -->
              <div
                class="group flex cursor-pointer items-center gap-2.5 px-3.5 py-2 transition hover:bg-sky-50/80 dark:hover:bg-sky-500/10"
                :class="
                  filterOrigin === 'spark'
                    ? 'bg-sky-100 ring-2 ring-sky-400/50 dark:bg-sky-500/20'
                    : ''
                "
                title="仅显示 Spark 应用"
                role="button"
                @click="filterOrigin = 'spark'"
              >
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sm shadow-sky-500/30"
                >
                  <i class="fas fa-bolt text-[12px]"></i>
                </span>
                <div class="flex flex-col leading-tight">
                  <span
                    class="text-[15px] font-bold tabular-nums text-sky-700 dark:text-sky-300"
                    >{{ sparkCount }}</span
                  >
                  <span
                    class="text-[10px] font-medium uppercase tracking-wider text-sky-600/80 dark:text-sky-400/80"
                    >Spark</span
                  >
                </div>
              </div>
              <!-- 分隔线 -->
              <span
                class="self-stretch w-px bg-slate-200/80 dark:bg-slate-700/80"
              ></span>
              <!-- 总数 -->
              <div
                class="flex cursor-pointer items-center gap-2.5 px-3.5 py-2"
                :class="
                  filterOrigin === 'all'
                    ? 'bg-slate-100 ring-2 ring-slate-400/40 dark:bg-slate-700/40'
                    : ''
                "
                title="显示全部已安装应用"
                role="button"
                @click="filterOrigin = 'all'"
              >
                <span
                  class="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-sm dark:from-slate-400 dark:to-slate-600"
                >
                  <i class="fas fa-cubes text-[12px]"></i>
                </span>
                <div class="flex flex-col leading-tight">
                  <span
                    class="text-[15px] font-bold tabular-nums text-slate-900 dark:text-white"
                    >{{ totalCount }}</span
                  >
                  <span
                    class="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >总数</span
                  >
                </div>
              </div>
              </div>
              <!-- 搜索框 -->
              <div class="relative flex-1 min-w-[200px]">
                <i
                  class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
                ></i>
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="搜索已安装应用…"
                  class="w-full rounded-2xl border border-slate-200/70 bg-slate-50/60 py-2 pl-9 pr-9 text-sm text-slate-700 placeholder-slate-400 transition focus:border-brand/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-800/40 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:bg-slate-800"
                />
                <button
                  v-if="searchQuery"
                  type="button"
                  class="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200/60 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-white"
                  aria-label="清除搜索"
                  @click="searchQuery = ''"
                >
                  <i class="fas fa-xmark text-xs"></i>
                </button>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              :disabled="loading"
              @click="$emit('refresh')"
            >
              <i class="fas fa-sync-alt"></i>
              刷新
            </button>
            <button
              type="button"
              class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-500 transition hover:text-slate-900 dark:hover:text-white dark:border-slate-700 dark:hover:bg-slate-800"
              @click="$emit('close')"
              aria-label="关闭"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
        </div>

        <div
          class="flex-1 overflow-y-auto overscroll-contain p-6 space-y-4 mb-6"
        >
          <div
            v-if="syncMessage"
            class="rounded-2xl border border-brand/20 bg-brand/5 px-4 py-3 text-sm font-medium text-brand dark:bg-brand/10"
          >
            {{ syncMessage }}
          </div>
          <div
            v-if="loading"
            class="rounded-2xl border border-dashed border-slate-200/80 px-4 py-10 text-center text-slate-500 dark:border-slate-800/80 dark:text-slate-400"
          >
            正在读取已安装应用…
          </div>
          <div
            v-else-if="error"
            class="rounded-2xl border border-rose-200/70 bg-rose-50/60 px-4 py-6 text-center text-sm text-rose-600 dark:border-rose-500/40 dark:bg-rose-500/10"
          >
            {{ error }}
          </div>
          <div
            v-else-if="warning"
            class="rounded-2xl border border-amber-200/70 bg-amber-50/60 px-4 py-3 text-sm text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
          >
            <i class="fas fa-triangle-exclamation mr-1.5"></i>
            {{ warning }}
          </div>
          <div
            v-else-if="apps.length === 0"
            class="rounded-2xl border border-slate-200/70 px-4 py-10 text-center text-slate-500 dark:border-slate-800/70 dark:text-slate-400"
          >
            暂无已安装应用
          </div>
          <div
            v-else-if="filteredApps.length === 0"
            class="rounded-2xl border border-slate-200/70 px-4 py-10 text-center text-slate-500 dark:border-slate-800/70 dark:text-slate-400"
          >
            <i class="fas fa-search mr-1.5 text-slate-400"></i>
            <template v-if="searchQuery">
              未找到匹配“<span class="font-semibold text-slate-700 dark:text-slate-300">{{ searchQuery }}</span>”的已安装应用
            </template>
            <template v-else-if="filterOrigin === 'apm'">
              暂无已安装的 APM 应用
            </template>
            <template v-else-if="filterOrigin === 'spark'">
              暂无已安装的 Spark 应用
            </template>
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="app in filteredApps"
              :key="app.pkgname"
              class="flex flex-col gap-3 rounded-2xl border border-slate-200/70 bg-white/90 p-4 shadow-sm dark:border-slate-800/70 dark:bg-slate-900/70 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="flex items-center gap-3">
                <div
                  class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800"
                >
                  <img
                    v-show="!iconErrors[app.pkgname] && getIconUrl(app)"
                    :src="getIconUrl(app)"
                    class="h-8 w-8 object-contain"
                    alt=""
                    @error="iconErrors[app.pkgname] = true"
                  />
                  <i
                    v-show="iconErrors[app.pkgname] || !getIconUrl(app)"
                    class="fas fa-cube text-xl text-slate-400"
                  ></i>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <p
                      class="text-base font-semibold text-slate-900 dark:text-white"
                    >
                      {{ app.name }}
                    </p>
                    <span
                      v-for="o in (app.origins && app.origins.length
                        ? app.origins
                        : [app.origin ?? 'spark'])"
                      :key="o"
                      :data-testid="o === 'apm' ? 'origin-tag-apm' : 'origin-tag-spark'"
                      class="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                      :class="
                        o === 'apm'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                          : 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-400'
                      "
                      :title="o === 'apm' ? 'APM 软件' : 'Spark 软件'"
                    >
                      {{ o === "apm" ? "APM" : "Spark" }}
                    </span>
                    <span
                      v-if="app.isDependency"
                      class="rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:bg-rose-500/20 dark:text-rose-400"
                    >
                      依赖项
                    </span>
                  </div>
                  <div
                    class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
                  >
                    <span class="font-mono">{{ app.pkgname }}</span>
                    <span>·</span>
                    <span>{{ app.version }}</span>
                    <span>·</span>
                    <span>{{ app.arch }}</span>
                  </div>
                </div>
              </div>
              <div
                class="flex flex-wrap items-center justify-end gap-2 sm:min-w-[22rem]"
              >
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-slate-300/70 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  @click="onOpenClick(app)"
                >
                  <i class="fas fa-play"></i>
                  打开
                </button>
                <button
                  v-if="canOpenDetail(app)"
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-brand/30 px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10"
                  @click="$emit('open-detail', app)"
                >
                  <i class="fas fa-circle-info"></i>
                  查看详情
                </button>
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-2xl border border-rose-300/60 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                  :disabled="app.currentStatus === 'not-installed'"
                  @click="$emit('uninstall', app)"
                >
                  <i class="fas fa-trash"></i>
                  卸载
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 双来源安装：打开时选择 APM 还是 Spark -->
      <Transition
        enter-active-class="duration-200 ease-out"
        enter-from-class="opacity-0 scale-95"
        enter-to-class="opacity-100 scale-100"
        leave-active-class="duration-150 ease-in"
        leave-from-class="opacity-100 scale-100"
        leave-to-class="opacity-0 scale-95"
      >
        <div
          v-if="openChoiceApp"
          class="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/70 p-4"
          @click.self="openChoiceApp = null"
        >
          <div
            class="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-white/95 p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
          >
            <div class="mb-5 flex items-start gap-3">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-indigo-50 shadow-inner dark:from-sky-900/30 dark:to-indigo-800/20"
              >
                <i
                  class="fas fa-external-link-alt text-xl text-sky-500"
                ></i>
              </div>
              <div>
                <h3
                  class="text-lg font-bold text-slate-900 dark:text-white"
                >
                  打开应用
                </h3>
                <p
                  class="mt-1 text-sm text-slate-500 dark:text-slate-400"
                >
                  该应用同时通过 APM 与 Spark 安装，请选择要打开的来源：
                </p>
              </div>
            </div>
            <div class="flex gap-3">
              <button
                type="button"
                class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-300/70 px-4 py-2.5 text-sm font-semibold text-amber-700 transition hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10"
                @click="confirmOpen('apm')"
              >
                <i class="fas fa-box-open"></i>
                打开 APM 版
              </button>
              <button
                type="button"
                class="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-sky-300/70 px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-50 dark:border-sky-500/40 dark:text-sky-300 dark:hover:bg-sky-500/10"
                @click="confirmOpen('spark')"
              >
                <i class="fas fa-bolt"></i>
                打开 Spark 版
              </button>
            </div>
            <div class="mt-4 flex justify-end">
              <button
                type="button"
                class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                @click="openChoiceApp = null"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { App } from "../global/typedefinition";
import { APM_STORE_BASE_URL } from "../global/storeConfig";

const iconErrors = reactive<Record<string, boolean>>({});

// 仅允许从这些常见图标目录读取本地图标，避免通过 app.icons 读取任意本地文件
const ALLOWED_LOCAL_ICON_PREFIXES = [
  "/usr/share/",
  "/usr/lib/",
  "/usr/local/share/",
  "/opt/",
  "/var/lib/apm/",
  "/var/lib/",
];

const getIconUrl = (app: App) => {
  // 本地图标：仅允许以白名单目录开头、且不含路径遍历("..")的绝对路径
  if (
    app.icons &&
    app.icons.startsWith("/") &&
    !app.icons.includes("..") &&
    ALLOWED_LOCAL_ICON_PREFIXES.some((prefix) => app.icons!.startsWith(prefix))
  ) {
    return `file://${app.icons}`;
  }
  if (!app.category || app.category === "unknown") return "";
  const arch = window.apm_store.arch || "amd64";
  const finalArch = app.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
  return `${APM_STORE_BASE_URL}/${finalArch}/${app.category}/${app.pkgname}/icon.png`;
};

const canOpenDetail = (app: App) => {
  return (
    app.category !== "unknown" ||
    Boolean(app.more) ||
    Boolean(app.website) ||
    Boolean(app.author) ||
    (app.img_urls?.length ?? 0) > 0
  );
};

const props = defineProps<{
  show: boolean;
  apps: App[];
  loading: boolean;
  error: string;
  warning: string;
  loggedIn: boolean;
  syncing: boolean;
  syncMessage: string;
}>();

// 判断某应用是否以指定来源安装：优先看 origins 集合，回退到单 origin 字段
const hasOrigin = (app: App, origin: "spark" | "apm"): boolean =>
  app.origins?.includes(origin) ?? app.origin === origin;

// APM / Spark 分别统计实际安装的包数量（同一 pkgname 同时装两种来源时各计一次）
const apmCount = computed(() =>
  props.apps.filter((a) => hasOrigin(a, "apm")).length,
);
const sparkCount = computed(() =>
  props.apps.filter((a) => hasOrigin(a, "spark")).length,
);
// 总数 = APM 包数 + Spark 包数（不同来源视为不同包，单独计数）
const totalCount = computed(() => apmCount.value + sparkCount.value);

// 来源筛选：默认全部；点击统计徽章可在 all/apm/spark 间切换
const filterOrigin = ref<"all" | "apm" | "spark">("all");

// 搜索关键词（按名称/包名不区分大小写过滤已安装应用）
const searchQuery = ref("");
const filteredApps = computed(() => {
  // 1. 先按搜索关键词过滤
  const q = searchQuery.value.trim().toLowerCase();
  let list = props.apps;
  if (q) {
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.pkgname.toLowerCase().includes(q),
    );
  }

  // 2. 再按来源筛选（默认 all = 不过滤）
  if (filterOrigin.value === "apm") {
    list = list.filter((a) => hasOrigin(a, "apm"));
  } else if (filterOrigin.value === "spark") {
    list = list.filter((a) => hasOrigin(a, "spark"));
  }

  // 3. 排序：APM 应用始终排在前面（默认全部视图也遵守此规则）
  // 返回新数组，避免修改原始 props.apps
  return [...list].sort((a, b) => {
    const aApm = hasOrigin(a, "apm") ? 0 : 1;
    const bApm = hasOrigin(b, "apm") ? 0 : 1;
    if (aApm !== bApm) return aApm - bApm;
    // 同类内保持原有的字母序，体验更一致
    return a.pkgname.localeCompare(b.pkgname);
  });
});

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const emit = defineEmits<{
  (e: "close"): void;
  (e: "refresh"): void;
  (e: "uninstall", app: App): void;
  (e: "open-app", app: App): void;
  (e: "open-detail", app: App): void;
  (e: "sync-to-account"): void;
  (e: "restore-from-account"): void;
  (e: "request-login"): void;
}>();

// 双来源安装时，"打开"需先让用户选择打开 APM 还是 Spark 版
const openChoiceApp = ref<App | null>(null);
const openOrigins = (app: App): Array<"spark" | "apm"> =>
  app.origins && app.origins.length > 0 ? app.origins : [app.origin ?? "spark"];

const onOpenClick = (app: App) => {
  const origins = openOrigins(app);
  if (origins.length > 1) {
    openChoiceApp.value = app;
  } else {
    // 单来源直接打开（携带正确 origin 供 launch-app 分支）
    emit("open-app", { ...app, origin: origins[0] });
  }
};

const confirmOpen = (origin: "spark" | "apm") => {
  if (openChoiceApp.value) {
    emit("open-app", { ...openChoiceApp.value, origin });
  }
  openChoiceApp.value = null;
};

// 云端同步功能暂时关闭
// const handleSyncClick = () => {
//   if (props.loggedIn) {
//     emit("sync-to-account");
//     return;
//   }

//   emit("request-login");
// };

// const handleRestoreClick = () => {
//   if (props.loggedIn) {
//     emit("restore-from-account");
//     return;
//   }

//   emit("request-login");
// };

const onOverlayWheel = (e: WheelEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest(".overflow-y-auto, .overflow-auto")) return;
  e.preventDefault();
};
</script>
