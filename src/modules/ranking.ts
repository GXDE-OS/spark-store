/**
 * 排行榜与荣耀榜聚合工具
 * - 下载排行：由 App.vue 预计算好的 apmRanking / sparkRanking 直接传入视图，本模块不重复拉取。
 * - 更新排行 / 贡献荣耀榜 / 更新荣耀榜：基于已加载的 `apps` 实时聚合，无额外网络请求。
 */
import type { App } from "../global/typedefinition";

/** 榜单统一条数（需求确认：10 条） */
export const TOP_N = 10;

/** 更新荣耀榜取「最近更新」应用的窗口大小（用于聚合这部分贡献者） */
export const RECENT_UPDATE_WINDOW = 30;

export type AppOrigin = "spark" | "apm";

export interface ContributorRank {
  name: string;
  count: number;
}

/**
 * 解析 contributor 字段。
 * 原始格式形如 `name<email>`，可能存在多个贡献者以 `;` / `；` 分隔。
 * 聚合与展示统一去除 `<...>` 取显示名。
 */
export function parseContributors(raw: string | undefined): string[] {
  if (!raw) return [];
  const names: string[] = [];
  for (const part of raw.split(/[;；]/)) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const name = trimmed.replace(/<[^>]*>/g, "").trim();
    if (name) names.push(name);
  }
  return names;
}

/** 对已过滤来源的应用列表，按 contributor 出现次数计数 */
function countContributors(apps: App[]): Map<string, number> {
  const counter = new Map<string, number>();
  for (const app of apps) {
    for (const name of parseContributors(app.contributor)) {
      counter.set(name, (counter.get(name) || 0) + 1);
    }
  }
  return counter;
}

function toRanks(counter: Map<string, number>, topN: number): ContributorRank[] {
  return [...counter.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, topN);
}

/** 贡献荣耀榜：按来源统计每个贡献者的上榜应用数，取 Top N */
export function aggregateContributors(
  apps: App[],
  origin: AppOrigin,
  topN: number = TOP_N,
): ContributorRank[] {
  const filtered = apps.filter((a) => a.origin === origin);
  return toRanks(countContributors(filtered), topN);
}

/** 应用更新排行：按 `update` 字段倒序，取某来源的 Top N */
export function topByUpdate(
  apps: App[],
  origin: AppOrigin,
  topN: number = TOP_N,
): App[] {
  return apps
    .filter((a) => a.origin === origin && a.update)
    .sort((a, b) => (b.update || "").localeCompare(a.update || ""))
    .slice(0, topN);
}

/** 更新荣耀榜：取某来源「最近更新」窗口内的应用，聚合其贡献者，取 Top N */
export function topUpdatedContributors(
  apps: App[],
  origin: AppOrigin,
  recentN: number = RECENT_UPDATE_WINDOW,
  topN: number = TOP_N,
): ContributorRank[] {
  const recent = topByUpdate(apps, origin, recentN).filter(
    (a) => a.origin === origin,
  );
  return toRanks(countContributors(recent), topN);
}
