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
        class="flex w-full max-w-4xl max-h-[85vh] flex-col rounded-3xl border border-white/10 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          class="flex items-start justify-between border-b border-slate-200/70 p-6 dark:border-slate-800/70"
        >
          <div>
            <p class="text-2xl font-semibold text-slate-900 dark:text-white">
              已安装应用
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              管理本机安装的应用程序
            </p>
          </div>
          <div class="flex items-center gap-3">
            <div
              v-if="showOriginSwitcher"
              class="flex items-center rounded-2xl border border-slate-200/70 p-1 dark:border-slate-800/70"
            >
              <button
                v-if="apmEnabled"
                type="button"
                class="rounded-xl px-4 py-1.5 text-sm font-semibold transition"
                :class="
                  activeOrigin === 'apm'
                    ? 'bg-brand/10 text-brand dark:bg-brand/15'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                "
                :disabled="!apmAvailable"
                @click="$emit('switch-origin', 'apm')"
              >
                APM 软件
              </button>
              <button
                v-if="sparkEnabled"
                type="button"
                class="rounded-xl px-4 py-1.5 text-sm font-semibold transition"
                :class="
                  activeOrigin === 'spark'
                    ? 'bg-brand/10 text-brand dark:bg-brand/15'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                "
                @click="$emit('switch-origin', 'spark')"
              >
                Spark 软件
              </button>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-2xl border border-slate-200/70 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200"
              :disabled="loading"
              @click="$emit('refresh')"
            >
              <i class="fas fa-sync-alt"></i>
              刷新
            </button>
            <button
              type="button"
              class="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200/70 text-slate-500 transition hover:text-slate-900 dark:border-slate-700"
              @click="$emit('close')"
              aria-label="关闭"
            >
              <i class="fas fa-xmark"></i>
            </button>
          </div>
        </div>

        <div
          class="flex-1 overflow-y-auto overscroll-contain scrollbar-nowidth scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 p-6 space-y-4"
        >
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
            v-else-if="apps.length === 0"
            class="rounded-2xl border border-slate-200/70 px-4 py-10 text-center text-slate-500 dark:border-slate-800/70 dark:text-slate-400"
          >
            暂无已安装应用
          </div>
          <div v-else class="space-y-3">
            <div
              v-for="app in apps"
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
                  @click="$emit('open-app', app)"
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
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { App } from "../global/typedefinition";
import { APM_STORE_BASE_URL } from "../global/storeConfig";

const iconErrors = reactive<Record<string, boolean>>({});

const getIconUrl = (app: App) => {
  if (app.icons && app.icons.startsWith("/")) return `file://${app.icons}`;
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
  activeOrigin: "apm" | "spark";
  storeFilter: "spark" | "apm" | "both";
  sparkAvailable: boolean;
  apmAvailable: boolean;
}>();

defineEmits<{
  (e: "close"): void;
  (e: "refresh"): void;
  (e: "uninstall", app: App): void;
  (e: "switch-origin", origin: "apm" | "spark"): void;
  (e: "open-app", app: App): void;
  (e: "open-detail", app: App): void;
}>();

const onOverlayWheel = (e: WheelEvent) => {
  const target = e.target as HTMLElement;
  if (target.closest(".overflow-y-auto, .overflow-auto")) return;
  e.preventDefault();
};

const sparkEnabled = computed(() => {
  return props.storeFilter !== "apm" && props.sparkAvailable;
});

const apmEnabled = computed(() => {
  return props.storeFilter !== "spark" && props.apmAvailable;
});

const showOriginSwitcher = computed(() => {
  return sparkEnabled.value && apmEnabled.value;
});
</script>
