import { mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import type { UpdateCenterItem } from "../../../../electron/main/backend/update-center/types";
import {
  IGNORE_CONFIG_PATH,
  applyIgnoredEntries,
  createIgnoreKey,
  loadIgnoredEntries,
  parseIgnoredEntries,
  saveIgnoredEntries,
} from "../../../../electron/main/backend/update-center/ignore-config";

describe("update-center ignore config", () => {
  it("round-trips the package|version format at the user config path", async () => {
    expect(IGNORE_CONFIG_PATH).toBe(
      join(homedir(), ".config", "spark-store", "ignored_apps.conf"),
    );

    const entries = new Set([
      createIgnoreKey("spark-clock", "2.0.0"),
      createIgnoreKey("spark-browser", "1.5.0"),
    ]);
    const tempDir = await mkdtemp(join(tmpdir(), "spark-ignore-config-"));
    const filePath = join(tempDir, "ignored_apps.conf");

    try {
      await saveIgnoredEntries(filePath, entries);

      expect(await readFile(filePath, "utf8")).toBe(
        "spark-browser|1.5.0\nspark-clock|2.0.0\n",
      );
      expect(
        parseIgnoredEntries("spark-browser|1.5.0\nspark-clock|2.0.0\n"),
      ).toEqual(new Set(["spark-browser|1.5.0", "spark-clock|2.0.0"]));
      await expect(loadIgnoredEntries(filePath)).resolves.toEqual(entries);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("ignores malformed lines and accepts CRLF legacy entries", () => {
    expect(
      parseIgnoredEntries(
        [
          "spark-browser|1.5.0\r",
          "spark-clock|2.0.0|extra",
          "missing-version|",
          "|missing-package",
          "spark-player|3.0.0",
          "",
        ].join("\n"),
      ),
    ).toEqual(new Set(["spark-browser|1.5.0", "spark-player|3.0.0"]));
  });

  it("marks only exact package/version matches as ignored", () => {
    const items: UpdateCenterItem[] = [
      {
        pkgname: "spark-clock",
        source: "aptss",
        currentVersion: "1.0.0",
        nextVersion: "2.0.0",
      },
      {
        pkgname: "spark-clock",
        source: "apm",
        currentVersion: "1.1.0",
        nextVersion: "2.1.0",
      },
      {
        pkgname: "spark-browser",
        source: "apm",
        currentVersion: "4.0.0",
        nextVersion: "5.0.0",
      },
    ];

    expect(
      applyIgnoredEntries(
        items,
        new Set([createIgnoreKey("spark-clock", "2.0.0")]),
      ),
    ).toEqual([
      {
        pkgname: "spark-clock",
        source: "aptss",
        currentVersion: "1.0.0",
        nextVersion: "2.0.0",
        ignored: true,
      },
      {
        pkgname: "spark-clock",
        source: "apm",
        currentVersion: "1.1.0",
        nextVersion: "2.1.0",
        ignored: false,
      },
      {
        pkgname: "spark-browser",
        source: "apm",
        currentVersion: "4.0.0",
        nextVersion: "5.0.0",
        ignored: false,
      },
    ]);
  });

  it("missing file returns an empty set", async () => {
    const tempDir = await mkdtemp(
      join(tmpdir(), "spark-ignore-config-missing-"),
    );
    const filePath = join(tempDir, "missing.conf");

    try {
      await expect(loadIgnoredEntries(filePath)).resolves.toEqual(new Set());
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
