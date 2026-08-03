<template>
  <div class="flex h-full min-h-0 flex-col gap-3">
    <!-- 两个榜单并排，每个榜单内容在容器内滚动 -->
    <div class="grid min-h-0 flex-1 gap-6 lg:grid-cols-2">
      <!-- 贡献荣耀榜 -->
      <section class="flex min-h-0 flex-col">
        <h2
          class="mb-2 shrink-0 text-sm font-bold text-slate-800 dark:text-slate-200"
        >
          贡献荣耀榜
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
              <RankingContributorRow
                v-for="(item, i) in contributeSpark"
                :key="item.name"
                :rank="i + 1"
                :name="item.name"
                :count="item.count"
                label="上榜应用"
              />
              <EmptyState
                v-if="contributeSpark.length === 0"
                :loading="appsLoading"
              />
            </div>
          </div>
          <div v-if="showApm" class="flex min-h-0 flex-col">
            <SourceLabel origin="apm" />
            <div
              class="scrollbar-muted min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1"
            >
              <RankingContributorRow
                v-for="(item, i) in contributeApm"
                :key="item.name"
                :rank="i + 1"
                :name="item.name"
                :count="item.count"
                label="上榜应用"
              />
              <EmptyState
                v-if="contributeApm.length === 0"
                :loading="appsLoading"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- 更新荣耀榜 -->
      <section class="flex min-h-0 flex-col">
        <h2
          class="mb-2 shrink-0 text-sm font-bold text-slate-800 dark:text-slate-200"
        >
          更新荣耀榜
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
              <RankingContributorRow
                v-for="(item, i) in updateContributeSpark"
                :key="item.name"
                :rank="i + 1"
                :name="item.name"
                :count="item.count"
                label="近期更新"
              />
              <EmptyState
                v-if="updateContributeSpark.length === 0"
                :loading="appsLoading"
              />
            </div>
          </div>
          <div v-if="showApm" class="flex min-h-0 flex-col">
            <SourceLabel origin="apm" />
            <div
              class="scrollbar-muted min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1"
            >
              <RankingContributorRow
                v-for="(item, i) in updateContributeApm"
                :key="item.name"
                :rank="i + 1"
                :name="item.name"
                :count="item.count"
                label="近期更新"
              />
              <EmptyState
                v-if="updateContributeApm.length === 0"
                :loading="appsLoading"
              />
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
import { aggregateContributors, topUpdatedContributors } from "../modules/ranking";
import SourceLabel from "./SourceLabel.vue";
import RankingContributorRow from "./RankingContributorRow.vue";
import EmptyState from "./RankingEmptyState.vue";

const props = defineProps<{
  apps: App[];
  storeFilter?: "spark" | "apm" | "both";
}>();

const TOP = 10;

const showSpark = computed(() => props.storeFilter !== "apm");
const showApm = computed(() => props.storeFilter !== "spark");
const gridCols = computed(() =>
  showSpark.value && showApm.value
    ? "grid-cols-1 sm:grid-cols-2"
    : "grid-cols-1",
);
const appsLoading = computed(() => props.apps.length === 0);

const contributeSpark = computed(() =>
  aggregateContributors(props.apps, "spark", TOP),
);
const contributeApm = computed(() =>
  aggregateContributors(props.apps, "apm", TOP),
);
const updateContributeSpark = computed(() =>
  topUpdatedContributors(props.apps, "spark"),
);
const updateContributeApm = computed(() =>
  topUpdatedContributors(props.apps, "apm"),
);
</script>
