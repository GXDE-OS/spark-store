<template>
  <Transition
    enter-active-class="duration-200 ease-out"
    enter-from-class="opacity-0 scale-95"
    enter-to-class="opacity-100 scale-100"
    leave-active-class="duration-150 ease-in"
    leave-from-class="opacity-100 scale-100"
    leave-to-class="opacity-0 scale-95"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-slate-900/70 p-4"
      @click.self="closeModal"
    >
      <div
        class="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-white/95 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <!-- 标题栏 -->
        <div
          class="flex items-center justify-between border-b border-slate-200/60 px-6 py-4 dark:border-slate-800/60"
        >
          <h2
            class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"
          >
            <i class="fas fa-cog text-brand"></i>
            安装设置
          </h2>
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            @click="closeModal"
            aria-label="关闭"
          >
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- 设置内容 -->
        <div class="p-6 space-y-4">
          <!-- 更新检测开关 -->
          <div
            class="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/50 px-4 py-4 dark:border-slate-800/60 dark:bg-slate-800/50"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
              >
                <i class="fas fa-bell"></i>
              </div>
              <div>
                <p
                  class="text-sm font-medium text-slate-800 dark:text-slate-200"
                >
                  更新检测通知
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  系统启动后自动检测更新并通知
                </p>
              </div>
            </div>
            <button
              type="button"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              :class="
                settings.enableUpdateCheck
                  ? 'bg-brand'
                  : 'bg-slate-300 dark:bg-slate-600'
              "
              @click="toggleUpdateCheck"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                :class="
                  settings.enableUpdateCheck ? 'translate-x-6' : 'translate-x-1'
                "
              />
            </button>
          </div>

          <!-- 自动创建桌面启动器开关 -->
          <div
            class="flex items-center justify-between rounded-2xl border border-slate-200/60 bg-slate-50/50 px-4 py-4 dark:border-slate-800/60 dark:bg-slate-800/50"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              >
                <i class="fas fa-desktop"></i>
              </div>
              <div>
                <p
                  class="text-sm font-medium text-slate-800 dark:text-slate-200"
                >
                  自动创建桌面启动器
                </p>
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  安装应用时自动创建桌面图标
                </p>
              </div>
            </div>
            <button
              type="button"
              class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              :class="
                settings.enableCreateDesktop
                  ? 'bg-brand'
                  : 'bg-slate-300 dark:bg-slate-600'
              "
              @click="toggleCreateDesktop"
            >
              <span
                class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                :class="
                  settings.enableCreateDesktop
                    ? 'translate-x-6'
                    : 'translate-x-1'
                "
              />
            </button>
          </div>
        </div>

        <!-- 底部提示 -->
        <div
          class="border-t border-slate-200/60 bg-slate-50/50 px-6 py-3 dark:border-slate-800/60 dark:bg-slate-800/30"
        >
          <p class="text-xs text-slate-500 dark:text-slate-400 text-center">
            设置会自动保存
          </p>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from "vue";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

interface Settings {
  enableUpdateCheck: boolean;
  enableCreateDesktop: boolean;
}

const settings = ref<Settings>({
  enableUpdateCheck: true,
  enableCreateDesktop: true,
});

// 配置文件路径
const UPDATE_CHECK_CONFIG = "ssshell-config-do-not-show-upgrade-notify";
const CREATE_DESKTOP_CONFIG = "ssshell-config-do-not-create-desktop";

// 加载设置
const loadSettings = async () => {
  try {
    const result = await window.ipcRenderer.invoke("get-install-settings");
    if (result.success) {
      settings.value = {
        enableUpdateCheck: !result.data[UPDATE_CHECK_CONFIG],
        enableCreateDesktop: !result.data[CREATE_DESKTOP_CONFIG],
      };
    }
  } catch (error) {
    console.error("加载设置失败:", error);
  }
};

// 保存设置
const saveSettings = async () => {
  try {
    await window.ipcRenderer.invoke("set-install-settings", {
      [UPDATE_CHECK_CONFIG]: !settings.value.enableUpdateCheck,
      [CREATE_DESKTOP_CONFIG]: !settings.value.enableCreateDesktop,
    });
  } catch (error) {
    console.error("保存设置失败:", error);
  }
};

// 切换更新检测
const toggleUpdateCheck = () => {
  settings.value.enableUpdateCheck = !settings.value.enableUpdateCheck;
  saveSettings();
};

// 切换自动创建桌面启动器
const toggleCreateDesktop = () => {
  settings.value.enableCreateDesktop = !settings.value.enableCreateDesktop;
  saveSettings();
};

// 关闭模态框
const closeModal = () => {
  emit("close");
};

// 监听显示状态
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      loadSettings();
    }
  },
);

onMounted(() => {
  if (props.show) {
    loadSettings();
  }
});
</script>
