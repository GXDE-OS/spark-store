import { describe, expect, it } from "vitest";

import { loadUpdateCenterItems } from "../../../../electron/main/backend/update-center";

interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

const APTSS_LIST_UPGRADABLE_KEY =
  "bash -lc env LANGUAGE=en_US /usr/bin/apt -c /opt/durapps/spark-store/bin/apt-fast-conf/aptss-apt.conf list --upgradable -o Dir::Etc::sourcelist=/opt/durapps/spark-store/bin/apt-fast-conf/sources.list.d/aptss.list -o Dir::Etc::sourceparts=/dev/null -o APT::Get::List-Cleanup=0";

const DPKG_QUERY_INSTALLED_KEY =
  "dpkg-query -W -f=${Package}\t${db:Status-Want} ${db:Status-Status} ${db:Status-Eflag}\n";

const APM_PRINT_URIS_KEY =
  "bash -lc amber-pm-debug /usr/bin/apt -c /opt/durapps/spark-store/bin/apt-fast-conf/aptss-apt.conf download spark-weather --print-uris";

describe("update-center load items", () => {
  it("enriches apm and migration items with download metadata needed by the runner", async () => {
    const commandResults = new Map<string, CommandResult>([
      [
        APTSS_LIST_UPGRADABLE_KEY,
        {
          code: 0,
          stdout: "spark-weather/stable 2.0.0 amd64 [upgradable from: 1.0.0]",
          stderr: "",
        },
      ],
      [
        "apm list --upgradable",
        {
          code: 0,
          stdout: "spark-weather/main 3.0.0 amd64 [upgradable from: 1.5.0]",
          stderr: "",
        },
      ],
      [
        DPKG_QUERY_INSTALLED_KEY,
        {
          code: 0,
          stdout: "spark-weather\tinstall ok installed\n",
          stderr: "",
        },
      ],
      [
        "apm list --installed",
        {
          code: 0,
          stdout: "",
          stderr: "",
        },
      ],
      [
        APM_PRINT_URIS_KEY,
        {
          code: 0,
          stdout:
            "'https://example.invalid/spark-weather_3.0.0_amd64.deb' spark-weather_3.0.0_amd64.deb 123456 SHA512:deadbeef",
          stderr: "",
        },
      ],
    ]);

    const result = await loadUpdateCenterItems(async (command, args) => {
      const key = `${command} ${args.join(" ")}`;
      const match = commandResults.get(key);
      if (!match) {
        throw new Error(`Missing mock for ${key}`);
      }

      return match;
    });

    expect(result.warnings).toEqual([]);
    expect(result.items).toContainEqual({
      pkgname: "spark-weather",
      source: "apm",
      currentVersion: "1.5.0",
      nextVersion: "3.0.0",
      downloadUrl: "https://example.invalid/spark-weather_3.0.0_amd64.deb",
      fileName: "spark-weather_3.0.0_amd64.deb",
      size: 123456,
      sha512: "deadbeef",
      isMigration: true,
      migrationSource: "aptss",
      migrationTarget: "apm",
      aptssVersion: "2.0.0",
    });
  });

  it("degrades to aptss-only results when apm commands fail", async () => {
    const result = await loadUpdateCenterItems(async (command, args) => {
      const key = `${command} ${args.join(" ")}`;

      if (key === APTSS_LIST_UPGRADABLE_KEY) {
        return {
          code: 0,
          stdout: "spark-notes/stable 2.0.0 amd64 [upgradable from: 1.0.0]",
          stderr: "",
        };
      }

      if (key === DPKG_QUERY_INSTALLED_KEY) {
        return {
          code: 0,
          stdout: "spark-notes\tinstall ok installed\n",
          stderr: "",
        };
      }

      if (key === "apm list --upgradable" || key === "apm list --installed") {
        return {
          code: 127,
          stdout: "",
          stderr: "apm: command not found",
        };
      }

      throw new Error(`Unexpected command ${key}`);
    });

    expect(result.items).toEqual([
      {
        pkgname: "spark-notes",
        source: "aptss",
        currentVersion: "1.0.0",
        nextVersion: "2.0.0",
      },
    ]);
    expect(result.warnings).toEqual([
      "apm upgradable query failed: apm: command not found",
      "apm installed query failed: apm: command not found",
    ]);
  });
});
