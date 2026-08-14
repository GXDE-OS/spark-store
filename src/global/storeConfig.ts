import { ref } from "vue";
import axios from "axios";
import type { App, StoreMode } from "./typedefinition";
import { createCacheBusterInterceptor } from "./cacheBusterInterceptor";

export const APM_STORE_BASE_URL: string =
  import.meta.env.VITE_APM_STORE_BASE_URL || "";

// 加载优先级配置专用客户端：与渲染进程其余请求共用同一套 HTTP 客户端，
// 避免 Electron 渲染进程中全局 fetch 失败导致配置始终为空、auto 模式全部回退 APM。
const priorityConfigAxios = axios.create({
  baseURL: APM_STORE_BASE_URL,
  timeout: 10000,
});

// C2：priority-config.json 走独立 axios 实例（不经过 axiosInstance），
// 复用共享缓存穿透拦截器（带 TTL 复用戳，避免同会话频繁击穿缓存）。
// 与 C1（axiosInstance 的拦截器）为同一工厂生成，确保穿透策略与 TTL 行为一致。
priorityConfigAxios.interceptors.request.use(createCacheBusterInterceptor());

export const APM_STORE_STATS_BASE_URL: string =
  import.meta.env.VITE_APM_STORE_STATS_BASE_URL || "";

export const DEFAULT_SPARK_BACKEND_BASE_URL = "http://127.0.0.1:8000";

export const SPARK_BACKEND_BASE_URL: string =
  import.meta.env.VITE_SPARK_BACKEND_BASE_URL || DEFAULT_SPARK_BACKEND_BASE_URL;

export const SPARK_ACCOUNT_CENTER_URL: string =
  import.meta.env.VITE_SPARK_ACCOUNT_CENTER_URL ||
  "https://account.spark-app.store/account";

export const FLARUM_BASE_URL = "https://bbs.spark-app.store";
export const FLARUM_REGISTER_URL = `${FLARUM_BASE_URL}/register`;
export const FLARUM_PROFILE_URL = `${FLARUM_BASE_URL}/u`;
export const FLARUM_SETTINGS_URL = `${FLARUM_BASE_URL}/settings`;

// 下面的变量用于存储当前应用的信息，其实用在多个组件中
export const currentApp = ref<App | null>(null);
export const currentAppSparkInstalled = ref(false);
export const currentAppApmInstalled = ref(false);
export const showApmInstallDialog = ref(false);

export const currentStoreMode = ref<StoreMode>("hybrid");

// 混合模式下默认优先安装的来源（当没有服务器配置或配置获取失败时使用）。
// 设计意图：社区版当前主推 APM 来源（星火 APM 为新架构、deb 为传统来源），
// 故默认优先级设为 "apm"。非临时回归，属既定产品方向；如后续调整需产品确认。
// TODO: 产品确认默认 APM 优先是否长期保持。
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

/**
 * 从服务器加载优先级配置
 * 配置文件路径: ${arch}-store/priority-config.json (放在 spark 下)
 * @param arch 架构，如 "amd64"
 */
export async function loadPriorityConfig(arch: string): Promise<void> {
  try {
    const configPath = `/${arch}-store/priority-config.json`;
    console.log(
      `[PriorityConfig] 开始加载优先级配置: ${APM_STORE_BASE_URL}${configPath}`,
    );
    const response = await priorityConfigAxios.get(configPath);
    const config = response.data;
    // 顶层结构校验：畸形数据（非对象/为数组/null）直接走失败回退，避免访问属性抛错
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new Error("Invalid priority-config format: expected object");
    }
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
    // 仅打印规则计数而非完整配置，避免潜在敏感信息泄露（诊断用）
    const ruleCount = (r: {
      pkgnames: string[];
      categories: string[];
      tags: string[];
    }) => r.pkgnames.length + r.categories.length + r.tags.length;
    console.log(
      `[PriorityConfig] 已从服务器加载优先级配置: spark ${ruleCount(
        dynamicPriorityConfig.sparkPriority,
      )} 条, apm ${ruleCount(dynamicPriorityConfig.apmPriority)} 条`,
    );
  } catch (error) {
    // 获取失败（含 404：服务器无配置文件），默认优先 APM。
    // 注：此处为配置缺失/加载失败，dynamicPriorityConfig 重置为空规则，
    // 由 getHybridDefaultOrigin 回退 HYBRID_DEFAULT_PRIORITY（默认 APM）。
    console.warn(
      `[PriorityConfig] 加载配置失败（${APM_STORE_BASE_URL}/${arch}-store/priority-config.json），使用默认 APM 优先:`,
      error,
    );
    resetPriorityConfig();
  }
}

/**
 * 重置优先级配置为默认值（配置缺失/加载失败时调用）
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
}

/**
 * 按优先级配置规则判断单个应用标识是否命中「优先来源」。
 * 命中则返回 "apm" / "spark"，未命中返回 null。
 * 规则优先级（从高到低）：apmPriority.pkgnames > sparkPriority.pkgnames >
 * apmPriority.categories > sparkPriority.categories > apmPriority.tags > sparkPriority.tags
 */
function matchPriority(app: App): "apm" | "spark" | null {
  const { sparkPriority, apmPriority } = dynamicPriorityConfig;

  if (apmPriority.pkgnames.includes(app.pkgname)) return "apm";
  if (sparkPriority.pkgnames.includes(app.pkgname)) return "spark";
  if (apmPriority.categories.includes(app.category)) return "apm";
  if (sparkPriority.categories.includes(app.category)) return "spark";

  if (app.tags && apmPriority.tags.length > 0) {
    const appTags = app.tags.split(";").map((t) => t.trim().toLowerCase());
    for (const ruleTag of apmPriority.tags) {
      if (appTags.includes(ruleTag.toLowerCase())) return "apm";
    }
  }
  if (app.tags && sparkPriority.tags.length > 0) {
    const appTags = app.tags.split(";").map((t) => t.trim().toLowerCase());
    for (const ruleTag of sparkPriority.tags) {
      if (appTags.includes(ruleTag.toLowerCase())) return "spark";
    }
  }
  return null;
}

/**
 * 获取混合模式下应用的默认优先来源（即「应用配置优先级」）。
 * 对合并应用，依次用顶层标识、sparkApp、apmApp 去匹配优先级配置，
 * 任一来源命中即生效（避免顶层 pkgname 取自某一子版而漏掉另一子版的规则）。
 * 若两子版方向相反命中，遵从 apmPriority「例外优先」语义让 apm 胜出。
 * 均不命中时回退到 HYBRID_DEFAULT_PRIORITY（默认优先 APM）。
 * @param app 应用信息
 * @returns "apm" 或 "spark"
 */
export function getHybridDefaultOrigin(app: App): "apm" | "spark" {
  const result = matchPriority(app);
  if (result) return result;

  // 合并应用：两个子版分别匹配，任一命中即采用。
  // 若子版自身 category 为空（如部分入口构造的 fallback 应用），
  // 回退使用顶层 app.category 参与分类规则匹配，避免漏匹配。
  if (app.isMerged) {
    const fallbackCategory = app.category;
    // 构造 category 回退顶层的候选项，避免子版 category 为空时分类规则漏匹配
    const toCandidate = (sub: App): App =>
      sub.category ? sub : { ...sub, category: fallbackCategory };
    const sparkHit = app.sparkApp
      ? matchPriority(toCandidate(app.sparkApp))
      : null;
    const apmHit = app.apmApp ? matchPriority(toCandidate(app.apmApp)) : null;

    // apmPriority 是「例外优先于 sparkPriority」：当两子版方向相反命中
    //（sparkApp 命中 spark 且 apmApp 命中 apm）时，按配置语义让 apm 胜出。
    if (sparkHit === "spark" && apmHit === "apm") return "apm";
    if (sparkHit) return sparkHit;
    if (apmHit) return apmHit;
  }

  // 默认行为：与 HYBRID_DEFAULT_PRIORITY 保持一致（默认优先 APM）
  return HYBRID_DEFAULT_PRIORITY;
}
