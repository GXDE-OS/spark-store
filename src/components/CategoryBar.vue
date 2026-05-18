<template>
  <div class="category-bar-wrapper">
    <div class="category-bar">
      <button
        type="button"
        class="category-pill"
        :class="{ 'category-pill-active': selectedCategory === 'all' }"
        @click="selectCategory('all')"
      >
        <span>全部</span>
        <span v-if="totalCount > 0" class="category-pill-count">{{ totalCount }}</span>
      </button>
      <button
        v-for="(category, key) in categories"
        :key="key"
        type="button"
        class="category-pill"
        :class="{ 'category-pill-active': selectedCategory === key }"
        @click="selectCategory(key)"
      >
        <span>{{ category.zh }}</span>
        <span v-if="categoryCounts[key]" class="category-pill-count">{{ categoryCounts[key] }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  categories: Record<string, any>;
  selectedCategory: string;
  categoryCounts: Record<string, number>;
}>();

const emit = defineEmits<{
  (e: "select-category", category: string): void;
}>();

const totalCount = computed(() => {
  let total = 0;
  Object.values(props.categoryCounts).forEach((v) => {
    if (typeof v === "number") total += v;
  });
  return total;
});

const selectCategory = (category: string) => {
  emit("select-category", category);
};
</script>

<style scoped>
.category-bar-wrapper {
  border-bottom: 1px solid rgba(226, 232, 240, 0.6);
  padding: 0 1rem;
}

.dark .category-bar-wrapper {
  border-color: rgba(30, 41, 59, 0.7);
}

.category-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  padding: 0.75rem 0;
}

.category-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  white-space: nowrap;
  padding: 0.375rem 0.875rem;
  border-radius: 9999px;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #64748b;
  background: #f1f5f9;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.category-pill:hover {
  background: #e2e8f0;
  color: #334155;
}

.dark .category-pill {
  background: #1e293b;
  color: #94a3b8;
}

.dark .category-pill:hover {
  background: #334155;
  color: #cbd5e1;
}

.category-pill-active {
  background: #0071e3;
  color: #fff;
}

.category-pill-active:hover {
  background: #0066cc;
  color: #fff;
}

.dark .category-pill-active {
  background: #409cff;
  color: #fff;
}

.dark .category-pill-active:hover {
  background: #0071e3;
  color: #fff;
}

.category-pill-count {
  font-size: 0.6875rem;
  font-weight: 600;
  opacity: 0.75;
}
</style>
