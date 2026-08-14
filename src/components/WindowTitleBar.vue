<template>
  <header
    class="window-titlebar sticky top-0 z-20 flex h-12 shrink-0 items-center gap-3 border-b border-slate-200/70 bg-slate-50 px-4 text-slate-700 dark:border-slate-800/70 dark:bg-slate-950 dark:text-slate-200"
  >
    <!-- 左：移动端侧栏切换 + logo + 应用名 -->
    <div class="window-titlebar-left flex min-w-0 items-center gap-2">
      <button
        type="button"
        class="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/80 lg:hidden dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="切换侧边栏"
        title="切换侧边栏"
        @click="$emit('toggle-sidebar')"
      >
        <i class="fas fa-bars text-base"></i>
      </button>
      <img
        src="../assets/imgs/spark-store.svg"
        class="h-8 w-8 flex-shrink-0"
        alt="星火应用商店"
      />
      <span class="truncate text-base font-semibold">星火应用商店</span>
      <span
        class="rounded-full border border-orange-400 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-600 dark:border-amber-400/70 dark:bg-amber-400/10 dark:text-amber-300 dark:shadow-[0_0_8px_rgba(251,191,36,0.4)]"
        >社区版</span
      >
    </div>

    <!-- 中：搜索框（取代原 AppHeader 里的搜索） -->
    <div class="window-titlebar-center min-w-0 flex-1">
      <div class="relative mx-auto w-full max-w-xl">
        <i
          class="fas fa-search pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400"
        ></i>
        <input
          id="searchBox"
          :value="searchQuery"
          class="w-full rounded-full border border-slate-200/70 bg-white/70 py-2 pl-9 pr-9 text-sm text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand/50 focus:ring-2 focus:ring-brand/10 dark:border-slate-800/70 dark:bg-slate-900/60 dark:text-slate-200"
          placeholder="搜索应用名 / 包名 / 标签 / 粘贴 SPK 分享链接"
          @focus="handleFocus"
          @input="handleInput"
        />
        <button
          v-if="searchQuery"
          type="button"
          class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
          title="清除搜索"
          @click="clearSearch"
        >
          <i class="fas fa-times-circle text-sm"></i>
        </button>
      </div>
    </div>

    <!-- 右：主题 + 设置 + 关于 + 分隔符 + 窗口控制 -->
    <div class="window-titlebar-controls flex shrink-0 items-center gap-1">
      <ThemeToggle :theme-mode="themeMode" @toggle="$emit('toggle-theme')" />
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/80 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="安装设置"
        title="安装设置"
        @click="$emit('open-install-settings')"
      >
        <i class="fas fa-cog text-base"></i>
      </button>
      <button
        type="button"
        class="inline-flex h-9 w-9 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/80 dark:text-slate-400 dark:hover:bg-slate-800"
        aria-label="关于"
        title="关于"
        @click="$emit('open-about')"
      >
        <i class="fas fa-info-circle text-base"></i>
      </button>
      <div class="mx-1 h-6 w-px bg-slate-300/70 dark:bg-slate-700/70"></div>
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-base transition hover:bg-slate-200/80 dark:hover:bg-slate-800"
        aria-label="最小化"
        title="最小化"
        @click="minimize"
      >
        −
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1.5 text-base transition hover:bg-slate-200/80 dark:hover:bg-slate-800"
        aria-label="最大化或还原"
        title="最大化或还原"
        @click="toggleMaximize"
      >
        □
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1 text-sm transition hover:bg-red-500 hover:text-white"
        aria-label="关闭"
        title="关闭"
        @click="close"
      >
        ×
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import ThemeToggle from "./ThemeToggle.vue";

defineProps<{
  searchQuery: string;
  themeMode: "light" | "dark" | "auto";
}>();

const emit = defineEmits<{
  (e: "update:searchQuery", value: string): void;
  (e: "search-focus"): void;
  (e: "spk-link", pkgname: string): void;
  (e: "open-install-settings"): void;
  (e: "open-about"): void;
  (e: "toggle-theme"): void;
  (e: "toggle-sidebar"): void;
}>();

const handleFocus = () => {
  emit("search-focus");
};

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement | null;
  if (!target) return;
  const value = target.value.trim();
  // 检测 SPK 分享链接: spk://search/{pkgname} 或 spk://store/{category}/{pkgname}
  const spkMatch =
    value.match(/^spk:\/\/search\/(.+)$/i) ||
    value.match(/^spk:\/\/store\/[^/]+\/(.+)$/i);
  if (spkMatch) {
    const pkgname = spkMatch[1].trim();
    if (pkgname) {
      target.value = "";
      emit("update:searchQuery", "");
      emit("spk-link", pkgname);
      return;
    }
  }
  emit("update:searchQuery", target.value);
};

const clearSearch = () => {
  emit("update:searchQuery", "");
};

const minimize = () => {
  window.windowControls.minimize();
};

const toggleMaximize = () => {
  window.windowControls.toggleMaximize();
};

const close = () => {
  window.windowControls.close();
};
</script>

<style scoped>
.window-titlebar {
  -webkit-app-region: drag;
}

/* 所有可交互元素（输入框、按钮）禁用窗口拖动 */
.window-titlebar input,
.window-titlebar button {
  -webkit-app-region: no-drag;
}
</style>
