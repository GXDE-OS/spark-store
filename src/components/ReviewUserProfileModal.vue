<template>
  <div
    v-if="show && profile"
    ref="dialogRef"
    class="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    role="dialog"
    aria-modal="true"
    aria-label="用户资料"
    tabindex="-1"
    @click.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <section
      class="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900"
    >
      <div
        data-testid="review-user-cover"
        class="relative h-32 bg-gradient-to-br from-brand via-sky-500 to-violet-500"
        :style="coverStyle"
      >
        <button
          ref="closeButtonRef"
          type="button"
          class="absolute top-3 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/30 text-white transition hover:bg-black/45"
          aria-label="关闭"
          @click="emit('close')"
        >
          <i class="fas fa-xmark"></i>
        </button>
      </div>

      <div class="px-6 pb-6">
        <div class="-mt-10 flex items-end gap-4">
          <img
            v-if="profile.avatarUrl"
            :src="profile.avatarUrl"
            :alt="profile.displayName"
            class="h-20 w-20 rounded-3xl border-4 border-white bg-white object-cover shadow-lg dark:border-slate-900 dark:bg-slate-800"
          />
          <div
            v-else
            class="flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-white bg-slate-900 text-3xl font-semibold text-white shadow-lg dark:border-slate-900"
          >
            {{ initial }}
          </div>
          <div class="min-w-0 pb-1">
            <h2
              class="truncate text-2xl font-bold text-slate-900 dark:text-white"
            >
              {{ profile.displayName }}
            </h2>
            <p v-if="profile.username" class="text-sm text-slate-500">
              @{{ profile.username }}
            </p>
          </div>
        </div>

        <div
          v-if="profile.forumGroups?.length"
          class="mt-5 flex flex-wrap gap-2"
        >
          <span
            v-for="group in profile.forumGroups"
            :key="group"
            class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            {{ group }}
          </span>
        </div>

        <button
          v-if="forumUrl"
          type="button"
          class="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
          @click="emit('open-forum-profile', forumUrl)"
        >
          <i class="fas fa-up-right-from-square"></i>
          查看论坛资料
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { FLARUM_PROFILE_URL } from "@/global/storeConfig";
import type { ReviewUserProfile } from "@/global/typedefinition";

const props = defineProps<{
  show: boolean;
  profile: ReviewUserProfile | null;
}>();

const emit = defineEmits<{
  close: [];
  "open-forum-profile": [url: string];
}>();

const dialogRef = ref<HTMLElement | null>(null);
const closeButtonRef = ref<HTMLButtonElement | null>(null);

const initial = computed(() => (props.profile?.displayName || "?").slice(0, 1));
const safeCoverUrl = computed(() => {
  const raw = props.profile?.coverUrl;
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.toString()
      : "";
  } catch {
    return "";
  }
});
const coverStyle = computed(() => ({
  backgroundImage: safeCoverUrl.value
    ? `url(${JSON.stringify(safeCoverUrl.value)})`
    : "",
}));
const forumUrl = computed(() =>
  props.profile?.username
    ? `${FLARUM_PROFILE_URL}/${props.profile.username}`
    : "",
);

watch(
  () => props.show && props.profile !== null,
  async (visible) => {
    if (!visible) return;
    await nextTick();
    if (closeButtonRef.value) {
      closeButtonRef.value.focus();
    } else {
      dialogRef.value?.focus();
    }
  },
  { immediate: true },
);
</script>
