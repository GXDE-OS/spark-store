/**
 * useHttp —— 全局 HTTP 工具（axios 实例 + 带重试请求 + 超时包装）。
 *
 * 从原 App.vue 原样搬移，逻辑零改动，仅改为导出供各 composable 复用。
 * 含缓存穿透拦截器（createCacheBusterInterceptor），与之前的审计加固一致。
 */
import axios, { AxiosError } from "axios";
import { APM_STORE_BASE_URL } from "../global/storeConfig";
import { createCacheBusterInterceptor } from "../global/cacheBusterInterceptor";

// Axios 全局配置
export const axiosInstance = axios.create({
  baseURL: APM_STORE_BASE_URL,
  timeout: 5000, // 增加到 5 秒，避免网络波动导致的超时
});

// C2：数据 JSON（applist / categories / sidebar-config 等）追加 ?_t 版本戳，
// 穿透 CDN 边缘缓存，确保返回最新列表。复用共享缓存穿透拦截器（带 TTL 复用戳，
// 避免同会话频繁击穿缓存）。与主进程 onBeforeSendHeaders 注入的 no-cache 互为兜底。
// 这是有意的缓存击穿策略（非缺陷），用于解决商店目录强缓存导致的更新延迟。
axiosInstance.interceptors.request.use(createCacheBusterInterceptor());

// 5xx / 网络错误 / 超时重试；4xx（如 404）快速失败
const RETRYABLE_STATUS = new Set([502, 503, 504]);

export const fetchWithRetry = async <T>(
  path: string,
  signal?: AbortSignal,
  retries = 2,
  retryDelayMs = 500,
): Promise<T | null> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await axiosInstance.get<T>(path, { signal });
      return resp.data;
    } catch (err) {
      const ae = err as AxiosError;
      const status = ae.response?.status;
      // 4xx（含 404）快速失败，不重试
      if (status && status < 500 && status !== 429) {
        return null;
      }
      // 仅对网络错误 / 5xx / 429 重试
      const retryable =
        !status || RETRYABLE_STATUS.has(status) || status === 429;
      if (!retryable || attempt === retries) {
        return null;
      }
      await new Promise((r) => setTimeout(r, retryDelayMs));
    }
  }
  return null;
};

// 全局请求取消控制器（目录加载期间可整体取消）
export const rootAbortController = new AbortController();

// 给 Promise 包一层超时，超时即 reject。finally 中清理定时器，避免泄漏。
export const withTimeout = async <T>(
  promise: Promise<T>,
  ms: number,
  label = "operation",
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} 超时 (${ms}ms)`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};
