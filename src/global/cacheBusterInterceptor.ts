import type { InternalAxiosRequestConfig } from "axios";

/**
 * 缓存穿透拦截器工厂：为所有 .json GET 请求追加 ?_t=${timestamp} 版本戳，
 * 穿透 CDN/浏览器缓存，确保新应用上架后能立即被搜到（解决"上架后搜不到"）。
 *
 * 为避免同一次会话内每次请求都生成新戳导致缓存完全失效（频繁重复请求、浪费带宽），
 * 引入 TTL：在 ttlMs 窗口内复用同一时间戳；超过窗口才刷新。
 * 默认 5 分钟，兼顾"及时感知新数据"与"不过度击穿缓存"。
 *
 * 注意：这是有意为之的缓存击穿策略（非缺陷），用于解决商店目录强缓存导致的更新延迟。
 */
export function createCacheBusterInterceptor(ttlMs = 5 * 60 * 1000) {
  let cachedTimestamp: number | null = null;

  return (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    if (
      config.method?.toLowerCase() === "get" &&
      typeof config.url === "string"
    ) {
      const reqPath = config.url.split("?")[0];
      if (reqPath.endsWith(".json")) {
        const now = Date.now();
        if (cachedTimestamp === null || now - cachedTimestamp > ttlMs) {
          cachedTimestamp = now;
        }
        const sep = config.url.includes("?") ? "&" : "?";
        config.url = `${config.url}${sep}_t=${cachedTimestamp}`;
      }
    }
    return config;
  };
}
