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
        class="fixed inset-0 z-[85] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        @click.self="emit('close')"
      >
        <div
          class="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        >
          <h2 class="text-xl font-bold text-slate-900 dark:text-white">
            需要登录
          </h2>
          <p class="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {{ message }}
          </p>
          <div class="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              class="rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              @click="emit('register')"
            >
              注册账号
            </button>
            <button
              type="button"
              class="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white transition hover:bg-brand/90"
              @click="emit('login')"
            >
              登录
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean;
  message: string;
}>();

const emit = defineEmits<{
  close: [];
  login: [];
  register: [];
}>();
</script>
