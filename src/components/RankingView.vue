<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <!-- 两个榜单并排，每个榜单内容在容器内滚动 -->
    <div class="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
      <!-- 应用下载排行 -->
      <section class="flex min-h-0 flex-col">
        <h2
          class="mb-2 shrink-0 text-sm font-bold text-slate-800 dark:text-slate-200"
        >
          应用下载排行
        </h2>
        <div
          class="grid grid-rows-1 min-h-0 flex-1 gap-4"
          :class="gridCols"
        >
          <div v-if="showSpark" class="flex min-h-0 flex-col">
            <SourceLabel origin="spark" />
            <div
              class="scrollbar-muted min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1"
            >
              <RankingAppRow
                v-for="(app, i) in downloadSpark"
                :key="app.pkgname"
                :app="app"
                :rank="i + 1"
                show-download
                :download-count="app.downloadCount"
                @open-detail="onOpen"
              />
              <EmptyState
                v-if="downloadSpark.length === 0"
                :loading="rankingLoading"
                loading-text="加载排行中…"
              />
            </div>
          </div>
          <div v-if="showApm" class="flex min-h-0 flex-col">
            <SourceLabel origin="apm" />
            <div
              class="scrollbar-muted min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1"
            >
              <RankingAppRow
                v-for="(app, i) in downloadApm"
                :key="app.pkgname"
                :app="app"
                :rank="i + 1"
                show-download
                :download-count="app.downloadCount"
                @open-detail="onOpen"
              />
              <EmptyState
                v-if="downloadApm.length === 0"
                :loading="rankingLoading"
                loading-text="加载排行中…"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- 应用更新排行 -->
      <section class="flex min-h-0 flex-col">
        <h2
          class="mb-2 shrink-0 text-sm font-bold text-slate-800 dark:text-slate-200"
        >
          应用更新排行
        </h2>
        <div
          class="grid grid-rows-1 min-h-0 flex-1 gap-4"
          :class="gridCols"
        >
          <div v-if="showSpark" class="flex min-h-0 flex-col">
            <SourceLabel origin="spark" />
            <div
              class="scrollbar-muted min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1"
            >
              <RankingAppRow
                v-for="(app, i) in updateSpark"
                :key="app.pkgname"
                :app="app"
                :rank="i + 1"
                :update-time="app.update"
                @open-detail="onOpen"
              />
              <EmptyState v-if="updateSpark.length === 0" :loading="appsLoading" />
            </div>
          </div>
          <div v-if="showApm" class="flex min-h-0 flex-col">
            <SourceLabel origin="apm" />
            <div
              class="scrollbar-muted min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1"
            >
              <RankingAppRow
                v-for="(app, i) in updateApm"
                :key="app.pkgname"
                :app="app"
                :rank="i + 1"
                :update-time="app.update"
                @open-detail="onOpen"
              />
              <EmptyState v-if="updateApm.length === 0" :loading="appsLoading" />
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { App } from "../global/typedefinition";
import { topByUpdate } from "../modules/ranking";
import RankingAppRow from "./RankingAppRow.vue";
import SourceLabel from "./SourceLabel.vue";
import EmptyState from "./RankingEmptyState.vue";

const props = defineProps<{
  apps: App[];
  apmRanking: App[];
  sparkRanking: App[];
  rankingLoading: boolean;
  storeFilter?: "spark" | "apm" | "both";
}>();

const emit = defineEmits<{ (e: "open-detail", app: App): void }>();

const TOP = 10;

const showSpark = computed(() => props.storeFilter !== "apm");
const showApm = computed(() => props.storeFilter !== "spark");
const gridCols = computed(() =>
  showSpark.value && showApm.value
    ? "grid-cols-1 sm:grid-cols-2"
    : "grid-cols-1",
);
const appsLoading = computed(() => props.apps.length === 0);

const downloadSpark = computed(() => props.sparkRanking.slice(0, TOP));
const downloadApm = computed(() => props.apmRanking.slice(0, TOP));
const updateSpark = computed(() => topByUpdate(props.apps, "spark", TOP));
const updateApm = computed(() => topByUpdate(props.apps, "apm", TOP));

const onOpen = (app: App) => emit("open-detail", app);
</script>
