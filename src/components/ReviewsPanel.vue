<template>
  <section
    class="rounded-2xl border border-slate-200/60 bg-slate-50/50 p-5 dark:border-slate-800/60 dark:bg-slate-800/30"
  >
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="flex items-center gap-2 text-base font-semibold">
        <i class="fas fa-comments text-slate-400"></i>
        应用评价
      </h2>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        {{ ratingText }}
      </p>
    </div>

    <dl class="mb-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
      <div
        class="flex justify-between gap-3 rounded-xl bg-white px-3 py-2 dark:bg-slate-900/60"
      >
        <dt>版本</dt>
        <dd class="font-medium text-slate-700 dark:text-slate-300">
          {{ tags.version }}
        </dd>
      </div>
      <div
        class="flex justify-between gap-3 rounded-xl bg-white px-3 py-2 dark:bg-slate-900/60"
      >
        <dt>发行版</dt>
        <dd class="font-medium text-slate-700 dark:text-slate-300">
          {{ tags.distro }}
        </dd>
      </div>
      <div
        class="flex justify-between gap-3 rounded-xl bg-white px-3 py-2 dark:bg-slate-900/60"
      >
        <dt>架构</dt>
        <dd class="font-medium text-slate-700 dark:text-slate-300">
          {{ tags.packageArch }}
        </dd>
      </div>
      <div
        class="flex justify-between gap-3 rounded-xl bg-white px-3 py-2 dark:bg-slate-900/60"
      >
        <dt>来源</dt>
        <dd class="font-medium uppercase text-slate-700 dark:text-slate-300">
          {{ tags.origin }}
        </dd>
      </div>
    </dl>

    <button
      v-if="!loggedIn"
      type="button"
      class="mb-4 inline-flex items-center rounded-xl bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
      @click="emit('request-login', '登录后发表评论')"
    >
      登录后发表评论
    </button>

    <form v-else class="mb-4 space-y-3" @submit.prevent="submit">
      <label
        class="block text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        评分
        <select
          v-model.number="rating"
          class="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option v-for="value in ratingOptions" :key="value" :value="value">
            {{ value }} 星
          </option>
        </select>
      </label>
      <label
        class="block text-sm font-medium text-slate-600 dark:text-slate-300"
      >
        评论
        <textarea
          v-model="content"
          rows="3"
          class="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
          placeholder="分享你的使用体验"
        ></textarea>
      </label>
      <button
        type="submit"
        class="inline-flex items-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
        :disabled="submitting"
      >
        发表评论
      </button>
    </form>

    <p v-if="loading" class="text-sm text-slate-400">正在加载评价...</p>
    <p v-else-if="error" class="text-sm text-rose-500">{{ error }}</p>
    <div v-else-if="reviews.length" class="space-y-3">
      <article
        v-for="review in reviews"
        :key="review.id"
        class="rounded-xl bg-white p-3 text-sm dark:bg-slate-900/60"
      >
        <div class="flex items-center justify-between gap-3">
          <strong class="text-slate-700 dark:text-slate-200">
            {{ review.userDisplayName || "星火用户" }}
          </strong>
          <span class="text-xs text-slate-400">{{ review.rating }} 星</span>
        </div>
        <p class="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
          {{ review.content || "暂无评论内容" }}
        </p>
      </article>
    </div>
    <p v-else class="text-sm text-slate-400">暂无评价</p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import {
  fetchRatingSummary,
  fetchReviews,
  submitReview,
} from "@/modules/backendApi";
import type {
  AppReview,
  RatingSummary,
  ReviewTags,
} from "@/global/typedefinition";

const props = defineProps<{
  appKey: string;
  tags: ReviewTags;
  loggedIn: boolean;
}>();

const emit = defineEmits<{
  "request-login": [message: string];
}>();

const ratingOptions = [5, 4, 3, 2, 1];
const rating = ref(5);
const content = ref("");
const reviews = ref<AppReview[]>([]);
const summary = ref<RatingSummary | null>(null);
const loading = ref(false);
const submitting = ref(false);
const error = ref("");

const ratingText = computed(() => {
  if (!summary.value || summary.value.reviewCount === 0) return "暂无评分";
  return `${summary.value.averageRating.toFixed(1)} / 5 (${summary.value.reviewCount})`;
});

const loadReviews = async () => {
  if (!props.appKey) return;
  loading.value = true;
  error.value = "";
  try {
    const [nextSummary, nextReviews] = await Promise.all([
      fetchRatingSummary(props.appKey),
      fetchReviews(props.appKey),
    ]);
    summary.value = nextSummary;
    reviews.value = nextReviews;
  } catch (caught: unknown) {
    error.value = (caught as Error)?.message || "加载评价失败";
  } finally {
    loading.value = false;
  }
};

const submit = async () => {
  submitting.value = true;
  error.value = "";
  try {
    await submitReview(props.appKey, {
      rating: rating.value,
      content: content.value.trim(),
      tags: props.tags,
    });
    content.value = "";
    await loadReviews();
  } catch (caught: unknown) {
    error.value = (caught as Error)?.message || "发表评论失败";
  } finally {
    submitting.value = false;
  }
};

onMounted(loadReviews);
watch(() => props.appKey, loadReviews);
</script>
