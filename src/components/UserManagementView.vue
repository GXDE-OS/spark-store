<template>
  <section
    class="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
  >
    <div
      v-if="user.coverUrl"
      data-testid="profile-cover"
      class="h-32 rounded-2xl bg-cover bg-center sm:h-40"
      :style="coverStyle"
    ></div>
    <div
      class="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <div class="flex min-w-0 items-center gap-4">
        <img
          v-if="user.avatarUrl"
          :src="user.avatarUrl"
          :alt="user.displayName"
          class="h-16 w-16 rounded-2xl border border-slate-200 object-cover dark:border-slate-700"
        />
        <div
          v-else
          class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
        >
          {{ userInitial }}
        </div>
        <div class="min-w-0">
          <h1 class="text-2xl font-semibold text-slate-900 dark:text-white">
            用户管理
          </h1>
          <p
            class="mt-1 truncate text-lg font-medium text-slate-800 dark:text-slate-100"
          >
            {{ user.displayName }}
          </p>
          <p class="truncate text-sm text-slate-500 dark:text-slate-400">
            @{{ user.username }}
          </p>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ user.forumLevel }}
          </p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        <button
          type="button"
          class="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
          @click="emit('open-forum')"
        >
          论坛首页
        </button>
        <button
          type="button"
          class="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
          @click="emit('edit-profile')"
        >
          修改论坛资料
        </button>
      </div>
    </div>

    <div
      v-if="visibleForumGroups.length > 0"
      class="flex flex-wrap gap-2 text-sm text-slate-600 dark:text-slate-300"
    >
      <span
        v-for="group in visibleForumGroups"
        :key="group"
        class="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800"
      >
        {{ group }}
      </span>
    </div>

    <div
      class="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between"
    >
      <label
        class="flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        <input
          type="checkbox"
          class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
          aria-label="自动同步已安装应用"
          :checked="syncEnabled"
          @change="handleSyncToggle"
        />
        自动同步已安装应用
      </label>
      <button
        type="button"
        class="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
        :disabled="syncing"
        @click="emit('sync-now')"
      >
        {{ syncing ? "同步中..." : "立即同步" }}
      </button>
    </div>

    <p v-if="syncMessage" class="text-sm text-sky-600 dark:text-sky-300">
      {{ syncMessage }}
    </p>

    <section class="space-y-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold text-slate-900 dark:text-white">
            下载历史
          </h2>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            最近通过当前账号记录的应用安装历史。
          </p>
        </div>
        <button
          type="button"
          class="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:border-sky-500 dark:hover:text-sky-300"
          :disabled="loading"
          @click="emit('refresh-downloads')"
        >
          刷新
        </button>
      </div>

      <p v-if="loading" class="text-sm text-slate-500 dark:text-slate-400">
        正在加载下载历史...
      </p>
      <p v-else-if="error" class="text-sm text-red-600 dark:text-red-400">
        {{ error }}
      </p>
      <p
        v-else-if="downloadedApps.length === 0"
        class="text-sm text-slate-500 dark:text-slate-400"
      >
        暂无下载记录。
      </p>
      <ul v-else class="divide-y divide-slate-200 dark:divide-slate-800">
        <li
          v-for="app in downloadedApps"
          :key="app.id"
          class="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p class="font-medium text-slate-900 dark:text-white">
              {{ app.name }}
            </p>
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {{ app.pkgname }} · {{ app.category }}
            </p>
          </div>
          <p class="text-sm text-slate-500 dark:text-slate-400">
            {{ app.selectedOrigin.toUpperCase() }} · {{ app.version }} ·
            {{ app.packageArch }}
          </p>
        </li>
      </ul>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";

import type { DownloadedAppRecord, SparkUser } from "@/global/typedefinition";

const props = defineProps<{
  user: SparkUser;
  downloadedApps: DownloadedAppRecord[];
  syncEnabled: boolean;
  loading: boolean;
  error: string;
  syncing?: boolean;
  syncMessage?: string;
}>();

const emit = defineEmits<{
  "open-forum": [];
  "edit-profile": [];
  "toggle-sync": [enabled: boolean];
  "sync-now": [];
  "refresh-downloads": [];
}>();

const userInitial = computed(() =>
  (props.user.displayName || props.user.username || "?").slice(0, 1),
);

const coverStyle = computed(() => ({
  backgroundImage: props.user.coverUrl ? `url("${props.user.coverUrl}")` : "",
}));

const visibleForumGroups = computed(() =>
  props.user.forumGroups.filter((group) => group !== props.user.forumLevel),
);

const handleSyncToggle = (event: Event): void => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  emit("toggle-sync", target.checked);
};
</script>
