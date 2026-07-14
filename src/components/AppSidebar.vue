<template>
  <div class="flex h-full flex-col gap-6">
    <div class="flex items-start justify-between gap-3">
      <div ref="accountMenuRoot" class="relative min-w-0 flex-1">
        <button
          type="button"
          class="flex w-full min-w-0 items-center gap-2 rounded-2xl p-1 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
          :aria-label="accountLabel"
          @click="handleAccountClick"
        >
          <img
            :src="amberLogo"
            alt="星火应用商店"
            class="h-11 w-11 shrink-0 rounded-2xl bg-white/70 p-2 shadow-sm ring-1 ring-slate-900/5 dark:bg-slate-800"
          />
          <div data-testid="account-text" class="flex min-w-0 flex-col">
            <span
              class="truncate text-base font-semibold text-slate-900 dark:text-white"
              >{{ accountLabel }}</span
            >
            <span
              class="truncate text-[10px] uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500"
              >社区版</span
            >
          </div>
        </button>
        <AccountQuickMenu
          v-if="currentUser && showAccountMenu"
          @open-user-management="emitAccountAction('open-user-management')"
          @open-favorites="emitAccountAction('open-favorites')"
          @open-forum="emitAccountAction('open-forum')"
          @edit-profile="emitAccountAction('edit-profile')"
          @logout="emitAccountAction('logout')"
        />
      </div>
      <div class="flex items-center gap-1">
        <ThemeToggle :theme-mode="themeMode" @toggle="toggleTheme" />
        <button
          type="button"
          class="inline-flex h-10 w-10 items-center justify-center rounded-2xl text-slate-400 hover:bg-slate-100 lg:hidden dark:hover:bg-slate-800"
          @click="$emit('close')"
          title="关闭侧边栏"
        >
          <i class="fas fa-times"></i>
        </button>
      </div>
    </div>

    <div class="flex-1 space-y-1 overflow-y-auto scrollbar-muted px-1 py-1">
      <button
        type="button"
        class="sidebar-tab"
        :class="{ 'sidebar-tab-active': activeTab === 'home' }"
        @click="selectTab('home')"
      >
        <span class="sidebar-tab-icon"><i class="fas fa-star"></i></span>
        <span class="sidebar-tab-label">首页推荐</span>
      </button>

      <button
        type="button"
        class="sidebar-tab"
        :class="{ 'sidebar-tab-active': activeTab === 'all' }"
        @click="selectTab('all')"
      >
        <span class="sidebar-tab-icon"><i class="fas fa-th-large"></i></span>
        <span class="sidebar-tab-label">全部应用</span>
        <span
          class="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800/70 dark:text-slate-300"
          >{{ categoryCounts.all || 0 }}</span
        >
      </button>

      <div
        v-if="sidebarEntries.length > 0"
        class="my-3 border-t border-slate-100 dark:border-slate-800"
      ></div>

      <button
        v-for="entry in sidebarEntries"
        :key="entry.id"
        type="button"
        class="sidebar-tab"
        :class="{ 'sidebar-tab-active': activeTab === entry.id }"
        @click="selectTab(entry.id)"
      >
        <span class="sidebar-tab-icon">
          <i v-if="entry.icon" :class="entry.icon"></i>
          <i v-else class="fas fa-folder"></i>
        </span>
        <span class="sidebar-tab-label">{{ entry.name }}</span>
        <span
          v-if="entryCounts[entry.id]"
          class="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:bg-slate-800/70 dark:text-slate-300"
          >{{ entryCounts[entry.id] }}</span
        >
      </button>
    </div>

    <div class="border-t border-slate-200 pt-4 dark:border-slate-800">
      <button
        v-if="canManageApps"
        type="button"
        class="sidebar-tab"
        @click="emitSidebarAction('list')"
      >
        <span class="sidebar-tab-icon"><i class="fas fa-download"></i></span>
        <span class="sidebar-tab-label">应用管理</span>
      </button>
      <button
        v-if="canOpenUpdateCenter"
        type="button"
        class="sidebar-tab"
        @click="emitSidebarAction('update')"
      >
        <span class="sidebar-tab-icon"><i class="fas fa-sync-alt"></i></span>
        <span class="sidebar-tab-label">软件更新</span>
      </button>
      <button
        type="button"
        class="sidebar-tab"
        @click="emitSidebarAction('submit')"
      >
        <span class="sidebar-tab-icon"><i class="fas fa-upload"></i></span>
        <span class="sidebar-tab-label">投稿应用</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import AccountQuickMenu from "./AccountQuickMenu.vue";
import ThemeToggle from "./ThemeToggle.vue";
import amberLogo from "../assets/imgs/spark-store.svg";
import type { SidebarEntry, SparkUser } from "../global/typedefinition";

const props = defineProps<{
  activeTab: string;
  categoryCounts: Record<string, number>;
  themeMode: "light" | "dark" | "auto";
  sparkAvailable: boolean;
  apmAvailable: boolean;
  storeFilter: "spark" | "apm" | "both";
  sidebarEntries: SidebarEntry[];
  entryCounts: Record<string, number>;
  currentUser: SparkUser | null;
}>();

const emit = defineEmits<{
  (e: "toggle-theme"): void;
  (e: "select-tab", tab: string): void;
  (e: "close"): void;
  (e: "list"): void;
  (e: "update"): void;
  (e: "submit"): void;
  (e: "request-login"): void;
  (e: "open-user-management"): void;
  (e: "open-favorites"): void;
  (e: "open-forum"): void;
  (e: "edit-profile"): void;
  (e: "logout"): void;
}>();

const showAccountMenu = ref(false);
const accountMenuRoot = ref<HTMLElement | null>(null);

const accountLabel = computed(() => "星火应用商店");

const handleAccountClick = () => {
  // 登录功能暂时关闭
};

const handleDocumentPointerDown = (event: MouseEvent) => {
  if (!showAccountMenu.value) return;
  const target = event.target;
  if (target instanceof Node && accountMenuRoot.value?.contains(target)) return;
  showAccountMenu.value = false;
};

onMounted(() => {
  document.addEventListener("mousedown", handleDocumentPointerDown);
});

onUnmounted(() => {
  document.removeEventListener("mousedown", handleDocumentPointerDown);
});

const emitAccountAction = (
  action:
    | "open-user-management"
    | "open-favorites"
    | "open-forum"
    | "edit-profile"
    | "logout",
) => {
  showAccountMenu.value = false;
  if (action === "open-user-management") emit("open-user-management");
  else if (action === "open-favorites") emit("open-favorites");
  else if (action === "open-forum") emit("open-forum");
  else if (action === "edit-profile") emit("edit-profile");
  else emit("logout");
};

const toggleTheme = () => {
  emit("toggle-theme");
};

const canManageApps = computed(() => {
  return (
    (props.storeFilter !== "apm" && props.sparkAvailable) ||
    (props.storeFilter !== "spark" && props.apmAvailable)
  );
});

const canOpenUpdateCenter = canManageApps;

const selectTab = (tab: string) => {
  showAccountMenu.value = false;
  emit("select-tab", tab);
};

const emitSidebarAction = (action: "list" | "update" | "submit") => {
  showAccountMenu.value = false;
  if (action === "list") emit("list");
  else if (action === "update") emit("update");
  else emit("submit");
};
</script>

<style scoped>
.sidebar-tab {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 0.75rem;
  border: 1px solid transparent;
  border-radius: 0.75rem;
  padding: 0.625rem 0.875rem;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 500;
  color: #64748b;
  transition: all 0.15s ease;
  background: transparent;
  cursor: pointer;
}

.sidebar-tab:hover {
  background: rgba(0, 113, 227, 0.06);
  color: #0071e3;
}

.dark .sidebar-tab:hover {
  background: rgba(64, 156, 255, 0.1);
  color: #409cff;
}

.sidebar-tab-active {
  background: rgba(0, 113, 227, 0.1);
  color: #0066cc;
  border-color: rgba(0, 113, 227, 0.2);
}

.dark .sidebar-tab-active {
  background: rgba(64, 156, 255, 0.15);
  color: #409cff;
  border-color: rgba(64, 156, 255, 0.25);
}

.sidebar-tab-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  font-size: 0.875rem;
  flex-shrink: 0;
}

.sidebar-tab-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
