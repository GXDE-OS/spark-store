<template>
  <header
    class="window-titlebar sticky top-0 z-20 flex h-10 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white px-3 text-slate-700 dark:border-slate-800/70 dark:bg-slate-950 dark:text-slate-200"
  >
    <div class="flex min-w-0 items-center gap-2">
      <img
        src="../assets/imgs/spark-store.svg"
        class="h-5 w-5 flex-shrink-0"
        alt="星火应用商店"
      />
      <span class="truncate text-sm font-semibold">星火应用商店</span>
    </div>

    <div class="window-titlebar-controls flex items-center gap-1">
      <button
        type="button"
        class="rounded-md px-3 py-1 text-sm transition hover:bg-slate-200/80 dark:hover:bg-slate-800"
        aria-label="最小化"
        title="最小化"
        @click="minimize"
      >
        −
      </button>
      <button
        type="button"
        class="rounded-md px-3 py-1 text-sm transition hover:bg-slate-200/80 dark:hover:bg-slate-800"
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

.window-titlebar-controls,
.window-titlebar-controls button {
  -webkit-app-region: no-drag;
}
</style>
