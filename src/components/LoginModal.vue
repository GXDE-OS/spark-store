<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <form
          class="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          @submit.prevent="submitLogin"
        >
          <div class="mb-6">
            <h2 class="text-2xl font-bold text-slate-900 dark:text-white">
              登录星火账号
            </h2>
          </div>

          <label class="mb-4 block">
            <span
              class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              论坛账号
            </span>
            <input
              v-model="identification"
              type="text"
              autocomplete="username"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>

          <label class="mb-4 block">
            <span
              class="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              论坛密码
            </span>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              class="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </label>

          <p v-if="error" class="mb-4 text-sm text-red-600 dark:text-red-400">
            {{ error }}
          </p>

          <div class="flex items-center justify-between gap-3">
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              @click="emit('register')"
            >
              注册账号
            </button>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                @click="emit('close')"
              >
                取消
              </button>
              <button
                type="submit"
                class="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-60"
                :disabled="loading"
              >
                {{ loading ? "登录中..." : "登录" }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from "vue";

import type { FlarumLoginPayload } from "@/global/typedefinition";

defineProps<{
  show: boolean;
  loading: boolean;
  error: string;
}>();

const emit = defineEmits<{
  close: [];
  login: [payload: FlarumLoginPayload];
  register: [];
}>();

const identification = ref("");
const password = ref("");

const submitLogin = () => {
  emit("login", {
    identification: identification.value.trim(),
    password: password.value.trim(),
  });
};
</script>
