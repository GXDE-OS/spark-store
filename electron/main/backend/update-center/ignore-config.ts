import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { UpdateCenterItem } from "./types";

export const LEGACY_IGNORE_CONFIG_PATH = "/etc/spark-store/ignored_apps.conf";

const LEGACY_IGNORE_SEPARATOR = "|";

export const createIgnoreKey = (pkgname: string, version: string): string =>
  `${pkgname}${LEGACY_IGNORE_SEPARATOR}${version}`;

export const parseIgnoredEntries = (content: string): Set<string> => {
  const ignoredEntries = new Set<string>();

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const parts = trimmed.split(LEGACY_IGNORE_SEPARATOR);
    if (parts.length !== 2) {
      continue;
    }

    const [pkgname, version] = parts;
    if (!pkgname || !version) {
      continue;
    }

    ignoredEntries.add(createIgnoreKey(pkgname, version));
  }

  return ignoredEntries;
};

export const loadIgnoredEntries = async (
  filePath: string,
): Promise<Set<string>> => {
  try {
    const content = await readFile(filePath, "utf8");
    return parseIgnoredEntries(content);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return new Set<string>();
    }

    throw error;
  }
};

export const saveIgnoredEntries = async (
  filePath: string,
  ignoredEntries: ReadonlySet<string>,
): Promise<void> => {
  const sortedEntries = Array.from(ignoredEntries).sort();
  const content =
    sortedEntries.length > 0 ? `${sortedEntries.join("\n")}\n` : "";

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf8");
};

export const applyIgnoredEntries = (
  items: UpdateCenterItem[],
  ignoredEntries: ReadonlySet<string>,
): UpdateCenterItem[] =>
  items.map((item) => ({
    ...item,
    ignored: ignoredEntries.has(
      createIgnoreKey(item.pkgname, item.nextVersion),
    ),
  }));
