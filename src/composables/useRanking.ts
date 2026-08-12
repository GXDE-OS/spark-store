/**
 * useRanking —— 首页区域（links + 推荐列表入口）与下载排行榜数据。
 *
 * 从原 App.vue 原样搬移（loadHome / loadRanking / fetchDownloadCount / 缓存逻辑 /
 * publishRanking），逻辑零改动。
 *
 * 共享状态（apps / homeLinks / apmRanking / sparkRanking / rankingLoading /
 * homeLoading / homeError / storeFilter）来自 useAppState 单例。
 */
import type { App, HomeLink } from "../global/typedefinition";
import {
  apps,
  homeLinks,
  homeLoading,
  homeError,
  apmRanking,
  sparkRanking,
  rankingLoading,
  storeFilter,
} from "./useAppState";
import { rootAbortController } from "./useHttp";
import { APM_STORE_BASE_URL } from "../global/storeConfig";

const DOWNLOAD_COUNT_CACHE_KEY = "spark-store:download-counts:v1";
const DOWNLOAD_COUNT_CACHE_TTL_MS = 60 * 60 * 1000; // 1 小时

interface CachedCount {
  count: number;
  ts: number;
}

const downloadCountCache = new Map<string, CachedCount>();

const cacheKey = (app: App) => `${app.origin}:${app.category}:${app.pkgname}`;

const loadCacheFromStorage = () => {
  try {
    const raw = localStorage.getItem(DOWNLOAD_COUNT_CACHE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as Record<string, CachedCount>;
    const now = Date.now();
    for (const [k, v] of Object.entries(data)) {
      if (now - v.ts < DOWNLOAD_COUNT_CACHE_TTL_MS) {
        downloadCountCache.set(k, v);
      }
    }
  } catch {
    // ignore corrupted cache
  }
};

const saveCacheToStorage = () => {
  try {
    const obj: Record<string, CachedCount> = {};
    downloadCountCache.forEach((v, k) => {
      obj[k] = v;
    });
    localStorage.setItem(DOWNLOAD_COUNT_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // ignore quota errors
  }
};

const fetchDownloadCount = async (app: App): Promise<number> => {
  const key = cacheKey(app);
  const cached = downloadCountCache.get(key);
  if (cached) return cached.count;
  const arch = window.apm_store.arch || "amd64";
  const finalArch = app.origin === "spark" ? `${arch}-store` : `${arch}-apm`;
  try {
    const resp = await fetch(
      `${APM_STORE_BASE_URL}/${finalArch}/${app.category}/${app.pkgname}/download-times.txt`,
      { signal: rootAbortController.signal },
    );
    if (!resp.ok) return 0;
    const text = (await resp.text()).trim();
    const n = parseInt(text, 10);
    const count = Number.isFinite(n) ? n : 0;
    downloadCountCache.set(key, { count, ts: Date.now() });
    return count;
  } catch {
    return 0;
  }
};

const publishRanking = (results: App[]) => {
  apmRanking.value = results
    .filter((a) => a.origin === "apm")
    .sort((x, y) => (y.downloadCount || 0) - (x.downloadCount || 0))
    .slice(0, 10);
  sparkRanking.value = results
    .filter((a) => a.origin === "spark")
    .sort((x, y) => (y.downloadCount || 0) - (x.downloadCount || 0))
    .slice(0, 10);
};

let rankingGeneration = 0;

const loadRanking = async () => {
  if (apps.value.length === 0) return;
  const gen = ++rankingGeneration;
  rankingLoading.value = true;
  const all = apps.value.slice();
  const CONCURRENCY = 15;
  const results: App[] = [];
  for (let i = 0; i < all.length; i += CONCURRENCY) {
    if (gen !== rankingGeneration) {
      saveCacheToStorage();
      return;
    }
    const batch = all.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(async (app) => ({
        ...app,
        downloadCount: await fetchDownloadCount(app),
      })),
    );
    results.push(...settled);
    // 边拉边发：每批完成后立即发布增量排名
    if (gen === rankingGeneration) publishRanking(results);
  }
  if (gen !== rankingGeneration) {
    saveCacheToStorage();
    return;
  }
  rankingLoading.value = false;
  saveCacheToStorage();
};

// 启动时即加载本地缓存（无需等待 apps），二次启动首屏即可见缓存排行
loadCacheFromStorage();

// 排行榜在 loadApps 全量完成后（onMounted）触发一次，确保 spark/apm 应用均已就绪

const loadHome = async () => {
  homeLoading.value = true;
  homeError.value = "";
  homeLinks.value = [];
  try {
    const arch = window.apm_store.arch || "amd64";
    const modes: Array<"spark" | "apm"> =
      storeFilter.value === "both" ? ["spark", "apm"] : [storeFilter.value];

    // 按名称去重，spark 优先：同名链接 spark 覆盖 apm
    const seenNames = new Set<string>();

    // 并行请求各来源的 homelinks.json，缩短首页加载耗时
    const modeResults = await Promise.all(
      modes.map(async (mode) => {
        const finalArch = mode === "spark" ? `${arch}-store` : `${arch}-apm`;
        const base = `${APM_STORE_BASE_URL}/${finalArch}/home`;
        try {
          const res = await fetch(`${base}/homelinks.json`);
          if (res.ok) return { mode, raw: (await res.json()) as unknown };
        } catch (e) {
          console.warn(`Failed to load ${mode} homelinks.json`, e);
        }
        return { mode, raw: undefined };
      }),
    );

    for (const { mode, raw } of modeResults) {
      if (!raw) continue;
      // 校验 links 为数组，且每项均为对象（避免后端返回异常结构导致运行时错误）
      const links = Array.isArray(raw)
        ? (raw.filter((x) => x && typeof x === "object") as Record<
            string,
            unknown
          >[])
        : [];
      for (const l of links) {
        // 远程数据不可信，使用 typeof 运行时守卫替代 `as string` 断言，
        // 避免非字符串字段（如数字/对象）被注入状态导致下游显示异常。
        const name =
          typeof l.Name === "string"
            ? l.Name
            : typeof l.name === "string"
              ? l.name
              : "";
        if (!name) continue; // 跳过空名称，避免空字符串污染 seenNames 与去重逻辑
        if (seenNames.has(name)) continue; // 已由更高优先级来源（spark）占据
        // 仅校验 url 必需；远程 homelinks.json 不含 icon 字段（图片由 imgUrl 提供），
        // 故 icon 不作为硬性校验，缺省为空串以兼容 HomeLink 类型。
        const url =
          typeof l.Url === "string"
            ? l.Url
            : typeof l.url === "string"
              ? l.url
              : "";
        if (!url) continue;
        const icon =
          typeof l.Icon === "string"
            ? l.Icon
            : typeof l.icon === "string"
              ? l.icon
              : "";
        seenNames.add(name);
        // 显式提取已知字段构造，避免通过展开运算符 { ...l } 把远程不可信数据中的未知属性注入响应式状态
        const safeLink: HomeLink = {
          name,
          url,
          icon,
          more: typeof l.more === "string" ? l.more : undefined,
          imgUrl: typeof l.imgUrl === "string" ? l.imgUrl : undefined,
          type: typeof l.type === "string" ? l.type : undefined,
          origin: mode,
        };
        homeLinks.value.push(safeLink);
      }
    }
  } catch (error: unknown) {
    homeError.value = (error as Error)?.message || "加载首页失败";
  } finally {
    homeLoading.value = false;
  }
};

export { loadHome, loadRanking };
