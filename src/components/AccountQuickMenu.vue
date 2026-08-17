<template>
  <div
    class="absolute left-0 right-0 top-full z-20 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl dark:border-slate-700 dark:bg-slate-900"
  >
    <button
      type="button"
      class="quick-menu-item"
      @click="emit('open-user-management')"
    >
      <i class="fas fa-user-cog"></i>
      <span class="min-w-0 truncate">用户管理</span>
    </button>
    <button
      type="button"
      class="quick-menu-item"
      @click="emit('open-favorites')"
    >
      <i class="fas fa-heart"></i>
      <span class="min-w-0 truncate">我的收藏</span>
    </button>
    <button type="button" class="quick-menu-item" @click="emit('open-forum')">
      <i class="fas fa-comments"></i>
      <span class="min-w-0 truncate">论坛首页</span>
    </button>
    <button type="button" class="quick-menu-item" @click="emit('edit-profile')">
      <i class="fas fa-id-card"></i>
      <span class="min-w-0 truncate">修改论坛资料</span>
    </button>
    <button
      type="button"
      class="quick-menu-item text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
      @click="emit('logout')"
    >
      <i class="fas fa-sign-out-alt"></i>
      <span class="min-w-0 truncate">退出登录</span>
    </button>
  </div>
</template>

<script setup lang="ts">
const emit = defineEmits<{
  "open-user-management": [];
  "open-favorites": [];
  "open-forum": [];
  "edit-profile": [];
  logout: [];
}>();
</script>

<style scoped>
.quick-menu-item {
  display: flex;
  width: 100%;
  align-items: center;
  gap: 12px;
  min-width: 0;
  border-radius: 12px;
  padding: 10px 12px;
  text-align: left;
  font-size: 0.875rem;
  font-weight: 500;
  color: #475569;
  transition: all 0.15s ease;
}

.quick-menu-item i {
  flex-shrink: 0;
}

.quick-menu-item:hover {
  background: rgba(0, 113, 227, 0.06);
  color: #0071e3;
}

.dark .quick-menu-item {
  color: #cbd5e1;
}

.dark .quick-menu-item:hover {
  background: rgba(64, 156, 255, 0.1);
  color: #409cff;
}
</style>
