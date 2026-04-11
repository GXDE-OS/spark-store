import type { App } from "@/global/typedefinition";

const normalizeSearchValue = (value: string | undefined): string =>
  (value ?? "").toLowerCase().trim();

const getTieredMatchScore = (
  value: string | undefined,
  query: string,
  exactScore: number,
  prefixScore: number,
  includesScore: number,
): number => {
  const normalizedValue = normalizeSearchValue(value);

  if (!normalizedValue || !query) return 0;
  if (normalizedValue === query) return exactScore;
  if (normalizedValue.startsWith(query)) return prefixScore;
  if (normalizedValue.includes(query)) return includesScore;
  return 0;
};

export const getSearchMatchScore = (app: App, query: string): number => {
  const normalizedQuery = normalizeSearchValue(query);

  if (!normalizedQuery) return 0;

  return Math.max(
    getTieredMatchScore(app.name, normalizedQuery, 400, 300, 200),
    getTieredMatchScore(app.pkgname, normalizedQuery, 190, 180, 170),
    getTieredMatchScore(app.tags, normalizedQuery, 160, 150, 140),
    getTieredMatchScore(app.more, normalizedQuery, 130, 120, 110),
  );
};

export const matchesSearch = (app: App, query: string): boolean =>
  getSearchMatchScore(app, query) > 0;

export const rankAppsBySearch = (apps: App[], query: string): App[] =>
  apps
    .map((app, index) => ({
      app,
      index,
      score: getSearchMatchScore(app, query),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.app);

export const countSearchMatchesByCategory = (
  apps: App[],
  query: string,
): Record<string, number> => {
  const counts: Record<string, number> = { all: 0 };

  apps.forEach((app) => {
    if (!matchesSearch(app, query)) {
      return;
    }

    counts.all++;
    if (!counts[app.category]) counts[app.category] = 0;
    counts[app.category]++;
  });

  return counts;
};
