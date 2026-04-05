import { ref } from "vue";
import type { App, StoreMode } from "./typedefinition";

export const APM_STORE_BASE_URL: string =
  import.meta.env.VITE_APM_STORE_BASE_URL || "";

export const APM_STORE_STATS_BASE_URL: string =
  import.meta.env.VITE_APM_STORE_STATS_BASE_URL || "";

// 下面的变量用于存储当前应用的信息，其实用在多个组件中
export const currentApp = ref<App | null>(null);
export const currentAppSparkInstalled = ref(false);
export const currentAppApmInstalled = ref(false);

export const currentStoreMode = ref<StoreMode>("hybrid");

// 混合模式下默认优先安装的来源（当没有服务器配置或配置获取失败时使用）
export const HYBRID_DEFAULT_PRIORITY: "apm" | "spark" = "apm";

// 优先级规则配置接口
export interface PriorityRules {
  // 优先使用 Spark 的规则（例外于默认 APM 优先）
  sparkPriority: {
    pkgnames: string[]; // 包名列表
    categories: string[]; // 分类列表
    tags: string[]; // 标签列表
  };
  // 优先使用 APM 的规则（例外于 sparkPriority，具有更高优先级）
  apmPriority: {
    pkgnames: string[]; // 包名列表（即使在 sparkPriority 分类中也优先 APM）
    categories: string[]; // 分类列表
    tags: string[]; // 标签列表
  };
}

// 动态获取的优先级配置（从服务器加载）
export let dynamicPriorityConfig: PriorityRules = {
  sparkPriority: {
    pkgnames: [],
    categories: [],
    tags: [],
  },
  apmPriority: {
    pkgnames: [],
    categories: [],
    tags: [],
  },
};

// 标记是否已从服务器加载配置
export let isPriorityConfigLoaded = false;

// 标记服务器上是否存在配置文件
// false = 没有配置文件，默认优先 Spark
// true = 有配置文件，按配置规则判断（配置为空则默认优先 APM）
export let hasPriorityConfigFile = false;

/**
 * 从服务器加载优先级配置
 * 配置文件路径: ${arch}-store/priority-config.json (放在 spark 下)
 * @param arch 架构，如 "amd64"
 */
export async function loadPriorityConfig(arch: string): Promise<void> {
  try {
    const configUrl = `${APM_STORE_BASE_URL}/${arch}-store/priority-config.json`;
    const response = await fetch(configUrl, {
      method: "GET",
      cache: "no-cache",
    });

    if (response.ok) {
      const config = await response.json();
      hasPriorityConfigFile = true;
      // 支持新旧两种配置格式
      if (config.sparkPriority || config.apmPriority) {
        // 新格式：双向配置
        dynamicPriorityConfig = {
          sparkPriority: {
            pkgnames: config.sparkPriority?.pkgnames || [],
            categories: config.sparkPriority?.categories || [],
            tags: config.sparkPriority?.tags || [],
          },
          apmPriority: {
            pkgnames: config.apmPriority?.pkgnames || [],
            categories: config.apmPriority?.categories || [],
            tags: config.apmPriority?.tags || [],
          },
        };
      } else {
        // 旧格式：只配置 sparkPriority（兼容旧配置）
        dynamicPriorityConfig = {
          sparkPriority: {
            pkgnames: config.pkgnames || [],
            categories: config.categories || [],
            tags: config.tags || [],
          },
          apmPriority: {
            pkgnames: [],
            categories: [],
            tags: [],
          },
        };
      }
      isPriorityConfigLoaded = true;
      console.log("[PriorityConfig] 已从服务器加载优先级配置:", dynamicPriorityConfig);
    } else {
      // 配置文件不存在，默认优先 Spark
      console.log("[PriorityConfig] 服务器无配置文件，使用默认 Spark 优先");
      hasPriorityConfigFile = false;
      resetPriorityConfig();
    }
  } catch (error) {
    // 获取失败，默认优先 Spark
    console.warn("[PriorityConfig] 加载配置失败，使用默认 Spark 优先:", error);
    hasPriorityConfigFile = false;
    resetPriorityConfig();
  }
}

/**
 * 重置优先级配置为默认值
 */
function resetPriorityConfig(): void {
  dynamicPriorityConfig = {
    sparkPriority: {
      pkgnames: [],
      categories: [],
      tags: [],
    },
    apmPriority: {
      pkgnames: [],
      categories: [],
      tags: [],
    },
  };
  isPriorityConfigLoaded = true;
}

/**
 * 检查配置是否为空（没有任何规则）
 */
function isConfigEmpty(): boolean {
  const { sparkPriority, apmPriority } = dynamicPriorityConfig;
  return (
    sparkPriority.pkgnames.length === 0 &&
    sparkPriority.categories.length === 0 &&
    sparkPriority.tags.length === 0 &&
    apmPriority.pkgnames.length === 0 &&
    apmPriority.categories.length === 0 &&
    apmPriority.tags.length === 0
  );
}

/**
 * 获取混合模式下应用的默认优先来源
 * 判断优先级（从高到低）：
 * 1. apmPriority.pkgnames - 强制优先 APM
 * 2. sparkPriority.pkgnames - 强制优先 Spark
 * 3. apmPriority.categories - 该分类优先 APM
 * 4. sparkPriority.categories - 该分类优先 Spark
 * 5. apmPriority.tags - 包含标签优先 APM
 * 6. sparkPriority.tags - 包含标签优先 Spark
 * 7. 默认行为：
 *    - 没有配置文件 → 优先 Spark
 *    - 有配置文件但规则为空 → 优先 APM
 * @param app 应用信息
 * @returns "apm" 或 "spark"
 */
export function getHybridDefaultOrigin(app: App): "apm" | "spark" {
  const { sparkPriority, apmPriority } = dynamicPriorityConfig;

  // 1. 检查 APM 优先的包名（最高优先级）
  if (apmPriority.pkgnames.includes(app.pkgname)) {
    return "apm";
  }

  // 2. 检查 Spark 优先的包名
  if (sparkPriority.pkgnames.includes(app.pkgname)) {
    return "spark";
  }

  // 3. 检查 APM 优先的分类
  if (apmPriority.categories.includes(app.category)) {
    return "apm";
  }

  // 4. 检查 Spark 优先的分类
  if (sparkPriority.categories.includes(app.category)) {
    return "spark";
  }

  // 5. 检查 APM 优先的标签
  if (app.tags && apmPriority.tags.length > 0) {
    const appTags = app.tags.split(";").map((t) => t.trim().toLowerCase());
    for (const ruleTag of apmPriority.tags) {
      if (appTags.includes(ruleTag.toLowerCase())) {
        return "apm";
      }
    }
  }

  // 6. 检查 Spark 优先的标签
  if (app.tags && sparkPriority.tags.length > 0) {
    const appTags = app.tags.split(";").map((t) => t.trim().toLowerCase());
    for (const ruleTag of sparkPriority.tags) {
      if (appTags.includes(ruleTag.toLowerCase())) {
        return "spark";
      }
    }
  }

  // 7. 默认行为
  if (!hasPriorityConfigFile) {
    // 没有配置文件 → 默认优先 Spark
    return "spark";
  } else {
    // 有配置文件但规则为空 → 默认优先 APM
    return "apm";
  }
}
