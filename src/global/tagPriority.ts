// 标签优先显示策略
//
// 用于在「应用详情页」决定进入时默认展示的来源（Spark / APM）标签。
// 该配置为纯前端显示偏好（选中的标签即安装时对应的来源），不涉及后端安装脚本，
// 因此使用 localStorage 持久化并通过共享 ref 在设置页与详情页之间共享。
//
// 策略取值：
//   - "auto"  : 自动选择 —— 按应用配置的优先级（getHybridDefaultOrigin）自动选中
//   - "spark" : Spark 优先 —— 默认选中 Spark 标签；若无 Spark 标签则回退优先级策略
//   - "apm"   : APM 优先  —— 默认选中 APM 标签；若无 APM 标签则回退优先级策略
// 注：当应用仅有一个来源标签时，无论策略如何都默认展示该标签。

import { ref } from "vue";

export type TagPriorityStrategy = "auto" | "spark" | "apm";

const STORAGE_KEY = "spark-store-tag-priority-strategy";

const VALID_STRATEGIES: TagPriorityStrategy[] = ["auto", "spark", "apm"];

// 共享响应式引用：设置页写入、详情页读取，保证跨组件同步
const strategy = ref<TagPriorityStrategy>("auto");

// 导出共享 ref，供详情页以响应式方式 watch（设置变化实时生效）
export const tagPriorityStrategyRef = strategy;

let loaded = false;

const readFromStorage = (): TagPriorityStrategy => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && (VALID_STRATEGIES as string[]).includes(stored)) {
      return stored as TagPriorityStrategy;
    }
  } catch {
    // localStorage 不可用时静默降级为默认值
  }
  return "auto";
};

// 首次从持久化读取（仅执行一次），可在应用启动时调用
export const initTagPriorityStrategy = (): void => {
  if (loaded) return;
  strategy.value = readFromStorage();
  loaded = true;
};

// 同步获取当前策略（确保已加载过持久化值）
export const getTagPriorityStrategy = (): TagPriorityStrategy => {
  if (!loaded) {
    strategy.value = readFromStorage();
    loaded = true;
  }
  return strategy.value;
};

// 设置并持久化策略
export const setTagPriorityStrategy = (value: TagPriorityStrategy): void => {
  if (!(VALID_STRATEGIES as string[]).includes(value)) return;
  strategy.value = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // localStorage 不可用时仅更新内存态，忽略写入失败
  }
};
