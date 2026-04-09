import * as childProcess from "node:child_process";

import type {
  InstalledSourceState,
  UpdateCenterItem,
  UpdateSource,
} from "./types";

const UPGRADABLE_PATTERN =
  /^(\S+)\/\S+\s+([^\s]+)\s+\S+\s+\[(?:upgradable from|from):\s*([^\]]+)\]$/i;
const PRINT_URIS_PATTERN = /'([^']+)'\s+(\S+)\s+(\d+)\s+SHA512:([^\s]+)/;
const APM_INSTALLED_PATTERN = /^(\S+)\/\S+(?:,\S+)?\s+\S+\s+\S+\s+\[[^\]]+\]$/;

const splitVersion = (version: string) => {
  const epochMatch = version.match(/^(\d+):(.*)$/);
  const epoch = epochMatch ? Number(epochMatch[1]) : 0;
  const remainder = epochMatch ? epochMatch[2] : version;
  const hyphenIndex = remainder.lastIndexOf("-");

  return {
    epoch,
    upstream: hyphenIndex === -1 ? remainder : remainder.slice(0, hyphenIndex),
    revision: hyphenIndex === -1 ? "" : remainder.slice(hyphenIndex + 1),
  };
};

const getNonDigitOrder = (char: string | undefined): number => {
  if (char === "~") {
    return -1;
  }

  if (!char) {
    return 0;
  }

  if (/[A-Za-z]/.test(char)) {
    return char.charCodeAt(0);
  }

  return char.charCodeAt(0) + 256;
};

const compareNonDigitPart = (left: string, right: string): number => {
  let leftIndex = 0;
  let rightIndex = 0;

  while (true) {
    const leftChar = left[leftIndex];
    const rightChar = right[rightIndex];

    const leftIsDigit = leftChar !== undefined && /\d/.test(leftChar);
    const rightIsDigit = rightChar !== undefined && /\d/.test(rightChar);

    if (
      (leftChar === undefined || leftIsDigit) &&
      (rightChar === undefined || rightIsDigit)
    ) {
      return 0;
    }

    const leftOrder = getNonDigitOrder(leftIsDigit ? undefined : leftChar);
    const rightOrder = getNonDigitOrder(rightIsDigit ? undefined : rightChar);

    if (leftOrder !== rightOrder) {
      return leftOrder < rightOrder ? -1 : 1;
    }

    if (!leftIsDigit && leftChar !== undefined) {
      leftIndex += 1;
    }

    if (!rightIsDigit && rightChar !== undefined) {
      rightIndex += 1;
    }
  }
};

const compareDigitPart = (left: string, right: string): number => {
  const normalizedLeft = left.replace(/^0+/, "");
  const normalizedRight = right.replace(/^0+/, "");

  if (normalizedLeft.length !== normalizedRight.length) {
    return normalizedLeft.length < normalizedRight.length ? -1 : 1;
  }

  if (normalizedLeft === normalizedRight) {
    return 0;
  }

  return normalizedLeft < normalizedRight ? -1 : 1;
};

const compareVersionPart = (left: string, right: string): number => {
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length || rightIndex < right.length) {
    const nonDigitResult = compareNonDigitPart(
      left.slice(leftIndex),
      right.slice(rightIndex),
    );
    if (nonDigitResult !== 0) {
      return nonDigitResult;
    }

    while (leftIndex < left.length && !/\d/.test(left[leftIndex])) {
      leftIndex += 1;
    }

    while (rightIndex < right.length && !/\d/.test(right[rightIndex])) {
      rightIndex += 1;
    }

    let leftDigitsEnd = leftIndex;
    let rightDigitsEnd = rightIndex;

    while (leftDigitsEnd < left.length && /\d/.test(left[leftDigitsEnd])) {
      leftDigitsEnd += 1;
    }

    while (rightDigitsEnd < right.length && /\d/.test(right[rightDigitsEnd])) {
      rightDigitsEnd += 1;
    }

    const digitResult = compareDigitPart(
      left.slice(leftIndex, leftDigitsEnd),
      right.slice(rightIndex, rightDigitsEnd),
    );
    if (digitResult !== 0) {
      return digitResult;
    }

    leftIndex = leftDigitsEnd;
    rightIndex = rightDigitsEnd;
  }

  return 0;
};

const fallbackCompareVersions = (left: string, right: string): number => {
  const leftVersion = splitVersion(left);
  const rightVersion = splitVersion(right);

  if (leftVersion.epoch !== rightVersion.epoch) {
    return leftVersion.epoch < rightVersion.epoch ? -1 : 1;
  }

  const upstreamResult = compareVersionPart(
    leftVersion.upstream,
    rightVersion.upstream,
  );
  if (upstreamResult !== 0) {
    return upstreamResult;
  }

  return compareVersionPart(leftVersion.revision, rightVersion.revision);
};

const runDpkgVersionCheck = (
  left: string,
  operator: "gt" | "lt",
  right: string,
): boolean | null => {
  const result = childProcess.spawnSync("dpkg", [
    "--compare-versions",
    left,
    operator,
    right,
  ]);

  if (result.error || typeof result.status !== "number") {
    return null;
  }

  if (result.status === 0) {
    return true;
  }

  if (result.status === 1) {
    return false;
  }

  return null;
};

const parseUpgradableOutput = (
  output: string,
  source: UpdateSource,
): UpdateCenterItem[] => {
  const items: UpdateCenterItem[] = [];

  for (const line of output.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Listing")) {
      continue;
    }

    const match = trimmed.match(UPGRADABLE_PATTERN);
    if (!match) {
      continue;
    }

    const [, pkgname, nextVersion, currentVersion] = match;
    if (!pkgname || nextVersion === currentVersion) {
      continue;
    }

    items.push({
      pkgname,
      source,
      currentVersion,
      nextVersion,
    });
  }

  return items;
};

const getInstalledState = (
  installedSources: Map<string, InstalledSourceState>,
  pkgname: string,
): InstalledSourceState => {
  const existing = installedSources.get(pkgname);
  if (existing) {
    return existing;
  }

  const state: InstalledSourceState = { aptss: false, apm: false };
  installedSources.set(pkgname, state);
  return state;
};

const compareVersions = (left: string, right: string): number => {
  const greaterThan = runDpkgVersionCheck(left, "gt", right);
  if (greaterThan === true) {
    return 1;
  }

  const lessThan = runDpkgVersionCheck(left, "lt", right);
  if (lessThan === true) {
    return -1;
  }

  if (greaterThan === false && lessThan === false) {
    return 0;
  }

  // Fall back to a numeric-aware string comparison when dpkg is unavailable
  // or returns an unusable result, rather than silently treating versions as equal.
  return fallbackCompareVersions(left, right);
};

export const parseAptssUpgradableOutput = (
  output: string,
): UpdateCenterItem[] => parseUpgradableOutput(output, "aptss");

export const parseApmUpgradableOutput = (output: string): UpdateCenterItem[] =>
  parseUpgradableOutput(output, "apm");

export const parsePrintUrisOutput = (
  output: string,
): Pick<
  UpdateCenterItem,
  "downloadUrl" | "fileName" | "size" | "sha512"
> | null => {
  const match = output.trim().match(PRINT_URIS_PATTERN);
  if (!match) {
    return null;
  }

  const [, downloadUrl, fileName, size, sha512] = match;
  return {
    downloadUrl,
    fileName,
    size: Number(size),
    sha512,
  };
};

export const buildInstalledSourceMap = (
  dpkgQueryOutput: string,
  apmInstalledOutput: string,
): Map<string, InstalledSourceState> => {
  const installedSources = new Map<string, InstalledSourceState>();

  for (const line of dpkgQueryOutput.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const [pkgname, status] = trimmed.split("\t");
    if (!pkgname || status !== "install ok installed") {
      continue;
    }

    getInstalledState(installedSources, pkgname).aptss = true;
  }

  for (const line of apmInstalledOutput.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("Listing")) {
      continue;
    }

    if (!APM_INSTALLED_PATTERN.test(trimmed)) {
      continue;
    }

    const pkgname = trimmed.split("/")[0];
    if (!pkgname) {
      continue;
    }

    getInstalledState(installedSources, pkgname).apm = true;
  }

  return installedSources;
};

export const mergeUpdateSources = (
  aptssItems: UpdateCenterItem[],
  apmItems: UpdateCenterItem[],
  installedSources: Map<string, InstalledSourceState>,
): UpdateCenterItem[] => {
  const aptssMap = new Map(aptssItems.map((item) => [item.pkgname, item]));
  const apmMap = new Map(apmItems.map((item) => [item.pkgname, item]));
  const merged: UpdateCenterItem[] = [];

  for (const item of aptssItems) {
    if (!apmMap.has(item.pkgname)) {
      merged.push(item);
    }
  }

  for (const item of apmItems) {
    if (!aptssMap.has(item.pkgname)) {
      merged.push(item);
    }
  }

  for (const aptssItem of aptssItems) {
    const apmItem = apmMap.get(aptssItem.pkgname);
    if (!apmItem) {
      continue;
    }

    const installedState = installedSources.get(aptssItem.pkgname);
    const isMigration =
      installedState?.aptss === true &&
      installedState.apm === false &&
      compareVersions(apmItem.nextVersion, aptssItem.nextVersion) > 0;

    if (isMigration) {
      merged.push({
        ...apmItem,
        isMigration: true,
        migrationSource: "aptss",
        migrationTarget: "apm",
        aptssVersion: aptssItem.nextVersion,
      });
      merged.push(aptssItem);
      continue;
    }

    merged.push(aptssItem, apmItem);
  }

  return merged;
};
