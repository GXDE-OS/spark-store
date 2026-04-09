import { spawn } from "node:child_process";

import { BrowserWindow, ipcMain } from "electron";

import {
  buildInstalledSourceMap,
  mergeUpdateSources,
  parseApmUpgradableOutput,
  parseAptssUpgradableOutput,
  parsePrintUrisOutput,
} from "./query";
import {
  createUpdateCenterService,
  type UpdateCenterIgnorePayload,
  type UpdateCenterService,
} from "./service";
import type { UpdateCenterItem } from "./types";

export interface UpdateCenterCommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export type UpdateCenterCommandRunner = (
  command: string,
  args: string[],
) => Promise<UpdateCenterCommandResult>;

export interface UpdateCenterLoadItemsResult {
  items: UpdateCenterItem[];
  warnings: string[];
}

const APTSS_LIST_UPGRADABLE_COMMAND = {
  command: "bash",
  args: [
    "-lc",
    "env LANGUAGE=en_US /usr/bin/apt -c /opt/durapps/spark-store/bin/apt-fast-conf/aptss-apt.conf list --upgradable -o Dir::Etc::sourcelist=/opt/durapps/spark-store/bin/apt-fast-conf/sources.list.d/aptss.list -o Dir::Etc::sourceparts=/dev/null -o APT::Get::List-Cleanup=0",
  ],
};

const DPKG_QUERY_INSTALLED_COMMAND = {
  command: "dpkg-query",
  args: [
    "-W",
    "-f=${Package}\t${db:Status-Want} ${db:Status-Status} ${db:Status-Eflag}\n",
  ],
};

const runCommandCapture: UpdateCenterCommandRunner = async (
  command,
  args,
): Promise<UpdateCenterCommandResult> =>
  await new Promise((resolve) => {
    const child = spawn(command, args, {
      shell: false,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.stderr?.on("data", (data) => {
      stderr += data.toString();
    });
    child.on("error", (error) => {
      resolve({ code: -1, stdout, stderr: error.message });
    });
    child.on("close", (code) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });

const getCommandError = (
  label: string,
  result: UpdateCenterCommandResult,
): string | null => {
  if (result.code === 0) {
    return null;
  }

  return `${label} failed: ${result.stderr || result.stdout || `exit code ${result.code}`}`;
};

const loadApmItemMetadata = async (
  item: UpdateCenterItem,
  runCommand: UpdateCenterCommandRunner,
): Promise<
  | { item: UpdateCenterItem; warning?: undefined }
  | { item: null; warning: string }
> => {
  const metadataResult = await runCommand("apm", [
    "info",
    item.pkgname,
    "--print-uris",
  ]);
  const commandError = getCommandError(
    `apm metadata query for ${item.pkgname}`,
    metadataResult,
  );
  if (commandError) {
    return { item: null, warning: commandError };
  }

  const metadata = parsePrintUrisOutput(metadataResult.stdout);
  if (!metadata) {
    return {
      item: null,
      warning: `apm metadata query for ${item.pkgname} returned no package metadata`,
    };
  }

  return {
    item: {
      ...item,
      ...metadata,
    },
  };
};

const enrichApmItems = async (
  items: UpdateCenterItem[],
  runCommand: UpdateCenterCommandRunner,
): Promise<UpdateCenterLoadItemsResult> => {
  const results = await Promise.all(
    items.map((item) => loadApmItemMetadata(item, runCommand)),
  );

  return {
    items: results.flatMap((result) => (result.item ? [result.item] : [])),
    warnings: results.flatMap((result) =>
      result.warning ? [result.warning] : [],
    ),
  };
};

export const loadUpdateCenterItems = async (
  runCommand: UpdateCenterCommandRunner = runCommandCapture,
): Promise<UpdateCenterLoadItemsResult> => {
  const [aptssResult, apmResult, aptssInstalledResult, apmInstalledResult] =
    await Promise.all([
      runCommand(
        APTSS_LIST_UPGRADABLE_COMMAND.command,
        APTSS_LIST_UPGRADABLE_COMMAND.args,
      ),
      runCommand("apm", ["list", "--upgradable"]),
      runCommand(
        DPKG_QUERY_INSTALLED_COMMAND.command,
        DPKG_QUERY_INSTALLED_COMMAND.args,
      ),
      runCommand("apm", ["list", "--installed"]),
    ]);

  const warnings = [
    getCommandError("aptss upgradable query", aptssResult),
    getCommandError("apm upgradable query", apmResult),
    getCommandError("dpkg installed query", aptssInstalledResult),
    getCommandError("apm installed query", apmInstalledResult),
  ].filter((message): message is string => message !== null);

  const aptssItems =
    aptssResult.code === 0
      ? parseAptssUpgradableOutput(aptssResult.stdout)
      : [];
  const apmItems =
    apmResult.code === 0 ? parseApmUpgradableOutput(apmResult.stdout) : [];

  if (aptssResult.code !== 0 && apmResult.code !== 0) {
    throw new Error(warnings.join("; "));
  }

  const installedSources = buildInstalledSourceMap(
    aptssInstalledResult.code === 0 ? aptssInstalledResult.stdout : "",
    apmInstalledResult.code === 0 ? apmInstalledResult.stdout : "",
  );

  const enrichedApmItems = await enrichApmItems(apmItems, runCommand);

  return {
    items: mergeUpdateSources(
      aptssItems,
      enrichedApmItems.items,
      installedSources,
    ),
    warnings: [...warnings, ...enrichedApmItems.warnings],
  };
};

export const registerUpdateCenterIpc = (
  ipc: Pick<typeof ipcMain, "handle">,
  service: Pick<
    UpdateCenterService,
    | "open"
    | "refresh"
    | "ignore"
    | "unignore"
    | "start"
    | "cancel"
    | "getState"
    | "subscribe"
  >,
): void => {
  ipc.handle("update-center-open", () => service.open());
  ipc.handle("update-center-refresh", () => service.refresh());
  ipc.handle(
    "update-center-ignore",
    (_event, payload: UpdateCenterIgnorePayload) => service.ignore(payload),
  );
  ipc.handle(
    "update-center-unignore",
    (_event, payload: UpdateCenterIgnorePayload) => service.unignore(payload),
  );
  ipc.handle("update-center-start", (_event, taskKeys: string[]) =>
    service.start(taskKeys),
  );
  ipc.handle("update-center-cancel", (_event, taskKey: string) =>
    service.cancel(taskKey),
  );
  ipc.handle("update-center-get-state", () => service.getState());

  service.subscribe((snapshot) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send("update-center-state", snapshot);
    }
  });
};

let updateCenterService: UpdateCenterService | null = null;

export const initializeUpdateCenter = (): UpdateCenterService => {
  if (updateCenterService) {
    return updateCenterService;
  }

  const superUserCmdProvider = async (): Promise<string> => {
    const installManager = await import("../install-manager.js");
    return installManager.checkSuperUserCommand();
  };

  updateCenterService = createUpdateCenterService({
    loadItems: loadUpdateCenterItems,
    superUserCmdProvider,
  });
  registerUpdateCenterIpc(ipcMain, updateCenterService);

  return updateCenterService;
};

export { createUpdateCenterService } from "./service";
