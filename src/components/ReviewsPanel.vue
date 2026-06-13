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

    <p
      v-else-if="!canSubmit"
      class="mb-4 text-sm text-slate-500 dark:text-slate-400"
    >
      安装应用后可发表评论。
    </p>

    <form v-else class="mb-4 space-y-3" @submit.prevent="submit">
      <div class="block text-sm font-medium text-slate-600 dark:text-slate-300">
        评分
        <div
          role="slider"
          aria-label="评分"
          :aria-valuemin="1"
          :aria-valuemax="5"
          :aria-valuenow="rating"
          tabindex="0"
          class="mt-2 inline-flex touch-none select-none items-center gap-1 text-2xl text-amber-400 outline-none transition focus:ring-2 focus:ring-amber-300"
          @pointerdown="startRatingSlide"
          @pointermove="moveRatingSlide"
          @pointerup="stopRatingSlide"
          @pointercancel="stopRatingSlide"
          @keydown="handleRatingKeydown"
        >
          <span
            v-for="value in ratingOptions"
            :key="value"
            class="leading-none"
            aria-hidden="true"
          >
            {{ value <= rating ? "★" : "☆" }}
          </span>
        </div>
      </div>
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

    <p v-if="actionMessage" class="mb-3 text-sm text-blue-500">
      {{ actionMessage }}
    </p>

    <div
      v-if="reviews.length"
      class="mb-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300"
    >
      <label class="block">
        按架构筛选
        <select
          v-model="selectedPackageArch"
          class="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">全部架构</option>
          <option v-for="arch in packageArchOptions" :key="arch" :value="arch">
            {{ arch }}
          </option>
        </select>
      </label>
      <label class="block">
        按发行版筛选
        <select
          v-model="selectedDistro"
          class="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">全部发行版</option>
          <option v-for="distro in distroOptions" :key="distro" :value="distro">
            {{ distro }}
          </option>
        </select>
      </label>
    </div>

    <p v-if="loading" class="text-sm text-slate-400">正在加载评价...</p>
    <p v-else-if="error" class="text-sm text-rose-500">{{ error }}</p>
    <div v-else-if="filteredReviews.length" class="space-y-3">
      <article
        v-for="review in filteredReviews"
        :key="review.id"
        class="rounded-xl bg-white p-3 text-sm dark:bg-slate-900/60"
      >
        <div class="flex gap-3">
          <button
            type="button"
            class="h-9 w-9 flex-shrink-0 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-400"
            :aria-label="`查看${reviewerName(review)}的资料`"
            @click="showReviewer(review)"
          >
            <img
              v-if="review.userAvatarUrl"
              :src="review.userAvatarUrl"
              :alt="`${reviewerName(review)} 的头像`"
              class="h-9 w-9 rounded-full bg-slate-100 object-cover dark:bg-slate-800"
              loading="lazy"
              referrerpolicy="no-referrer"
              @error="hideAvatar"
            />
            <span
              v-else
              class="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
              aria-hidden="true"
            >
              {{ reviewerName(review).slice(0, 1) }}
            </span>
          </button>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-3">
              <button
                type="button"
                class="min-w-0 truncate text-left font-semibold text-slate-700 hover:text-blue-600 dark:text-slate-200 dark:hover:text-blue-300"
                @click="showReviewer(review)"
              >
                {{ reviewerName(review) }}
              </button>
              <span class="flex-shrink-0 text-xs text-slate-400"
                >{{ review.rating }} 星</span
              >
            </div>
            <p
              class="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300"
            >
              {{ review.content || "暂无评论内容" }}
            </p>
            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                class="rounded-full bg-slate-100 px-3 py-1 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                @click="toggleReviewLike(review)"
              >
                点赞{{ review.likeCount ? ` ${review.likeCount}` : "" }}
              </button>
              <button
                type="button"
                class="rounded-full bg-slate-100 px-3 py-1 text-slate-500 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                @click="startReply(review.id)"
              >
                回复
              </button>
              <button
                v-if="canDeleteReview(review)"
                type="button"
                class="rounded-full bg-rose-50 px-3 py-1 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300"
                @click="removeReview(review)"
              >
                删除
              </button>
            </div>
            <form
              v-if="
                replyTarget?.reviewId === review.id &&
                replyTarget.parentId === undefined
              "
              class="mt-3 space-y-2"
              @submit.prevent="submitReply"
            >
              <textarea
                v-model="replyContent"
                rows="2"
                class="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="写下你的回复"
              ></textarea>
              <div class="flex gap-2">
                <button
                  type="submit"
                  class="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                  :disabled="replySubmitting"
                >
                  发送回复
                </button>
                <button
                  type="button"
                  class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                  @click="cancelReply"
                >
                  取消
                </button>
              </div>
            </form>
            <div
              v-if="review.replies?.length"
              class="mt-3 space-y-2 border-l border-slate-200 pl-3 dark:border-slate-700"
            >
              <div
                v-for="reply in flattenReplies(review.replies)"
                :key="reply.id"
                class="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60"
                :style="{ marginLeft: `${reply.depth * 12}px` }"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium text-slate-700 dark:text-slate-200">
                    {{ reply.userDisplayName || "星火用户" }}
                  </span>
                  <span v-if="reply.isDeleted" class="text-xs text-slate-400"
                    >已删除</span
                  >
                </div>
                <p
                  class="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-300"
                >
                  {{ reply.content || "该回复已删除" }}
                </p>
                <div class="mt-2 flex flex-wrap gap-2 text-xs">
                  <button
                    type="button"
                    class="rounded-full bg-white px-3 py-1 text-slate-500 transition hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                    @click="toggleReplyLike(review.id, reply)"
                  >
                    点赞{{ reply.likeCount ? ` ${reply.likeCount}` : "" }}
                  </button>
                  <button
                    type="button"
                    class="rounded-full bg-white px-3 py-1 text-slate-500 transition hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
                    @click="startReply(review.id, reply.id)"
                  >
                    回复
                  </button>
                  <button
                    v-if="reply.canDelete"
                    type="button"
                    class="rounded-full bg-rose-50 px-3 py-1 text-rose-500 dark:bg-rose-500/10 dark:text-rose-300"
                    @click="removeReply(review.id, reply)"
                  >
                    删除
                  </button>
                </div>
                <form
                  v-if="
                    replyTarget?.reviewId === review.id &&
                    replyTarget.parentId === reply.id
                  "
                  class="mt-2 space-y-2"
                  @submit.prevent="submitReply"
                >
                  <textarea
                    v-model="replyContent"
                    rows="2"
                    class="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"
                    placeholder="写下你的回复"
                  ></textarea>
                  <div class="flex gap-2">
                    <button
                      type="submit"
                      class="rounded-full bg-blue-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-50"
                      :disabled="replySubmitting"
                    >
                      发送回复
                    </button>
                    <button
                      type="button"
                      class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                      @click="cancelReply"
                    >
                      取消
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
    <p v-else class="text-sm text-slate-400">
      {{ reviews.length ? "没有符合筛选条件的评价" : "暂无评价" }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";

import {
  createReviewReply,
  deleteReview,
  deleteReviewReply,
  fetchRatingSummary,
  fetchReviews,
  likeReview,
  likeReviewReply,
  submitReview,
} from "@/modules/backendApi";
import type {
  AppReview,
  AppReviewReply,
  RatingSummary,
  ReviewTags,
} from "@/global/typedefinition";

const props = withDefaults(
  defineProps<{
    appKey: string;
    tags: ReviewTags;
    loggedIn: boolean;
    canSubmit?: boolean;
    currentUserId?: number;
    currentUserIsAdmin?: boolean;
  }>(),
  { canSubmit: true, currentUserId: undefined, currentUserIsAdmin: false },
);

const emit = defineEmits<{
  "request-login": [message: string];
  "show-user": [review: AppReview];
}>();

const ratingOptions = [1, 2, 3, 4, 5];
const rating = ref(5);
const ratingSliding = ref(false);
const content = ref("");
const reviews = ref<AppReview[]>([]);
const summary = ref<RatingSummary | null>(null);
const loading = ref(false);
const submitting = ref(false);
const error = ref("");
const actionMessage = ref("");
const loadGeneration = ref(0);
const selectedPackageArch = ref("");
const selectedDistro = ref("");
const replyContent = ref("");
const replySubmitting = ref(false);
const replyTarget = ref<{ reviewId: number; parentId?: number } | null>(null);

interface FlatReply extends AppReviewReply {
  depth: number;
}

const ratingText = computed(() => {
  if (!summary.value || summary.value.reviewCount === 0) return "暂无评分";
  return `${summary.value.averageRating.toFixed(1)} / 5 (${summary.value.reviewCount})`;
});

const canSubmit = computed(() => props.canSubmit);

const packageArchOptions = computed(() =>
  [
    ...new Set(
      reviews.value.map((review) => review.packageArch).filter(Boolean),
    ),
  ].sort(),
);

const distroOptions = computed(() =>
  [
    ...new Set(reviews.value.map((review) => review.distro).filter(Boolean)),
  ].sort(),
);

const filteredReviews = computed(() =>
  reviews.value.filter(
    (review) =>
      (!selectedPackageArch.value ||
        review.packageArch === selectedPackageArch.value) &&
      (!selectedDistro.value || review.distro === selectedDistro.value),
  ),
);

const toReviewErrorMessage = (
  caught: unknown,
  fallback = "发表评论失败",
): string => {
  const message = caught instanceof Error ? caught.message : "";
  if (message === "Network Error") {
    return "无法连接星火账号服务，请稍后重试。";
  }
  if (message.includes("401")) {
    return "登录状态已失效，请重新登录星火账号。";
  }
  return message || fallback;
};

const clampRating = (value: number): number => Math.min(5, Math.max(1, value));

const updateRatingFromPointer = (event: PointerEvent): void => {
  const target = event.currentTarget;
  if (!(target instanceof HTMLElement)) return;
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0) return;
  const eventWithClientX = event as PointerEvent & { clientX: number };
  const ratio = (eventWithClientX.clientX - rect.left) / rect.width;
  rating.value = clampRating(Math.ceil(ratio * 5));
};

const startRatingSlide = (event: PointerEvent): void => {
  ratingSliding.value = true;
  const target = event.currentTarget;
  if (target instanceof HTMLElement && "setPointerCapture" in target) {
    target.setPointerCapture(event.pointerId);
  }
  updateRatingFromPointer(event);
};

const moveRatingSlide = (event: PointerEvent): void => {
  updateRatingFromPointer(event);
};

const stopRatingSlide = (event: PointerEvent): void => {
  ratingSliding.value = false;
  const target = event.currentTarget;
  if (
    target instanceof HTMLElement &&
    "hasPointerCapture" in target &&
    target.hasPointerCapture(event.pointerId)
  ) {
    target.releasePointerCapture(event.pointerId);
  }
};

const handleRatingKeydown = (event: KeyboardEvent): void => {
  if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    event.preventDefault();
    rating.value = clampRating(rating.value - 1);
  }
  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    event.preventDefault();
    rating.value = clampRating(rating.value + 1);
  }
};

const hideAvatar = (event: Event) => {
  (event.target as HTMLElement).style.display = "none";
};

const reviewerName = (review: AppReview): string =>
  review.userDisplayName || "星火用户";

const showReviewer = (review: AppReview) => {
  actionMessage.value = `正在查看 ${reviewerName(review)} 的资料`;
  emit("show-user", review);
};

const canDeleteReview = (review: AppReview): boolean =>
  review.canDelete === true;

const flattenReplies = (items: AppReviewReply[] = [], depth = 0): FlatReply[] =>
  items.flatMap((reply) => [
    { ...reply, depth },
    ...flattenReplies(reply.replies, depth + 1),
  ]);

const startReply = (reviewId: number, parentId?: number) => {
  replyTarget.value = { reviewId, parentId };
  replyContent.value = "";
  actionMessage.value = "";
};

const cancelReply = () => {
  replyTarget.value = null;
  replyContent.value = "";
};

const toReviewActionErrorMessage = (
  caught: unknown,
  fallback = "操作失败，请稍后重试。",
): string => {
  return toReviewErrorMessage(caught, fallback);
};

const resetFilters = () => {
  selectedPackageArch.value = "";
  selectedDistro.value = "";
};

const resetStaleFilters = () => {
  if (
    selectedPackageArch.value &&
    !packageArchOptions.value.includes(selectedPackageArch.value)
  ) {
    selectedPackageArch.value = "";
  }
  if (
    selectedDistro.value &&
    !distroOptions.value.includes(selectedDistro.value)
  ) {
    selectedDistro.value = "";
  }
};

const clearReviewState = () => {
  loadGeneration.value += 1;
  reviews.value = [];
  summary.value = null;
  loading.value = false;
  error.value = "";
  actionMessage.value = "";
};

const loadReviews = async () => {
  if (!props.loggedIn || !props.appKey) {
    clearReviewState();
    return;
  }
  const generation = loadGeneration.value + 1;
  loadGeneration.value = generation;
  const appKey = props.appKey;
  loading.value = true;
  error.value = "";
  try {
    const [nextSummary, nextReviews] = await Promise.all([
      fetchRatingSummary(appKey),
      fetchReviews(appKey),
    ]);
    if (generation !== loadGeneration.value || appKey !== props.appKey) return;
    summary.value = nextSummary;
    reviews.value = nextReviews;
    resetStaleFilters();
  } catch (caught: unknown) {
    if (generation !== loadGeneration.value || appKey !== props.appKey) return;
    error.value = toReviewErrorMessage(caught, "加载评价失败");
  } finally {
    if (generation === loadGeneration.value && appKey === props.appKey) {
      loading.value = false;
    }
  }
};

const submit = async () => {
  if (!canSubmit.value) return;
  const appKey = props.appKey;
  const tags = props.tags;
  submitting.value = true;
  error.value = "";
  try {
    await submitReview(appKey, {
      rating: rating.value,
      content: content.value.trim(),
      tags,
    });
    if (appKey !== props.appKey) return;
    content.value = "";
    await loadReviews();
  } catch (caught: unknown) {
    if (appKey !== props.appKey) return;
    error.value = toReviewErrorMessage(caught);
  } finally {
    if (appKey === props.appKey) {
      submitting.value = false;
    }
  }
};

const toggleReviewLike = async (review: AppReview) => {
  try {
    await likeReview(props.appKey, review.id);
    await loadReviews();
  } catch (caught: unknown) {
    actionMessage.value = toReviewActionErrorMessage(
      caught,
      "请登录星火账号后再点赞。",
    );
  }
};

const toggleReplyLike = async (reviewId: number, reply: AppReviewReply) => {
  try {
    await likeReviewReply(props.appKey, reviewId, reply.id);
    await loadReviews();
  } catch (caught: unknown) {
    actionMessage.value = toReviewActionErrorMessage(
      caught,
      "请登录星火账号后再点赞。",
    );
  }
};

const submitReply = async () => {
  const target = replyTarget.value;
  const trimmed = replyContent.value.trim();
  if (!target || trimmed === "") return;
  replySubmitting.value = true;
  try {
    await createReviewReply(props.appKey, target.reviewId, {
      content: trimmed,
      ...(target.parentId === undefined ? {} : { parentId: target.parentId }),
    });
    cancelReply();
    await loadReviews();
  } catch (caught: unknown) {
    actionMessage.value = toReviewActionErrorMessage(
      caught,
      "请登录星火账号后再回复。",
    );
  } finally {
    replySubmitting.value = false;
  }
};

const removeReview = async (review: AppReview) => {
  if (!canDeleteReview(review)) return;
  try {
    await deleteReview(props.appKey, review.id);
    await loadReviews();
  } catch (caught: unknown) {
    actionMessage.value = toReviewActionErrorMessage(
      caught,
      "没有权限删除该内容。请刷新后重试。",
    );
  }
};

const removeReply = async (reviewId: number, reply: AppReviewReply) => {
  if (!reply.canDelete) return;
  try {
    await deleteReviewReply(props.appKey, reviewId, reply.id);
    await loadReviews();
  } catch (caught: unknown) {
    actionMessage.value = toReviewActionErrorMessage(
      caught,
      "没有权限删除该内容。请刷新后重试。",
    );
  }
};

onMounted(loadReviews);
watch(
  () => props.appKey,
  () => {
    resetFilters();
    void loadReviews();
  },
);
watch(() => props.loggedIn, loadReviews);
</script>
