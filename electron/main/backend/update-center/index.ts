import { spawn } from "node:child_process";

import { BrowserWindow, ipcMain } from "electron";

import {
  buildInstalledSourceMap,
  mergeUpdateSources,
  parseApmUpgradableOutput,
  parseAptssUpgradableOutput,
  parsePrintUrisOutput,
} from "./query";
import { resolveUpdateItemIcons } from "./icons";
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

interface RemoteAppMetadata {
  category: string;
  name?: string;
}

type StoreAppMetadataMap = Map<string, RemoteAppMetadata>;

interface RemoteCategoryAppEntry {
  Name?: string;
  Pkgname?: string;
}

const REMOTE_STORE_BASE_URL = "https://erotica.spark-app.store";
const categoryCache = new Map<string, Promise<StoreAppMetadataMap>>();

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

const getApmPrintUrisCommand = (pkgname: string) => ({
  command: "bash",
  args: [
    "-lc",
    `amber-pm-debug /usr/bin/apt -c /opt/durapps/spark-store/bin/apt-fast-conf/aptss-apt.conf download ${pkgname} --print-uris`,
  ],
});

const getAptssPrintUrisCommand = (pkgname: string) => ({
  command: "bash",
  args: [
    "-lc",
    `/usr/bin/apt download ${pkgname} --print-uris -c /opt/durapps/spark-store/bin/apt-fast-conf/aptss-apt.conf -o Dir::Etc::sourcelist=/opt/durapps/spark-store/bin/apt-fast-conf/sources.list.d/aptss.list -o Dir::Etc::sourceparts=/dev/null`,
  ],
});

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
  const printUrisCommand = getApmPrintUrisCommand(item.pkgname);
  const metadataResult = await runCommand(
    printUrisCommand.command,
    printUrisCommand.args,
  );
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

const loadAptssItemMetadata = async (
  item: UpdateCenterItem,
  runCommand: UpdateCenterCommandRunner,
): Promise<
  | { item: UpdateCenterItem; warning?: undefined }
  | { item: null; warning: string }
> => {
  console.log(`[DEBUG] Loading APTSS metadata for ${item.pkgname}`);
  const printUrisCommand = getAptssPrintUrisCommand(item.pkgname);
  console.log(
    `[DEBUG] APTSS command: ${printUrisCommand.command} ${printUrisCommand.args.join(" ")}`,
  );

  const metadataResult = await runCommand(
    printUrisCommand.command,
    printUrisCommand.args,
  );
  console.log(`[DEBUG] APTSS metadata result code: ${metadataResult.code}`);
  console.log(
    `[DEBUG] APTSS metadata stdout: ${metadataResult.stdout.substring(0, 500)}`,
  );
  console.log(
    `[DEBUG] APTSS metadata stderr: ${metadataResult.stderr.substring(0, 500)}`,
  );

  const commandError = getCommandError(
    `aptss metadata query for ${item.pkgname}`,
    metadataResult,
  );
  if (commandError) {
    console.log(`[DEBUG] APTSS metadata error: ${commandError}`);
    return { item: null, warning: commandError };
  }

  const metadata = parsePrintUrisOutput(metadataResult.stdout);
  console.log(`[DEBUG] APTSS parsed metadata:`, metadata);

  if (!metadata) {
    return {
      item: null,
      warning: `aptss metadata query for ${item.pkgname} returned no package metadata`,
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

const enrichAptssItems = async (
  items: UpdateCenterItem[],
  runCommand: UpdateCenterCommandRunner,
): Promise<UpdateCenterLoadItemsResult> => {
  const results = await Promise.all(
    items.map((item) => loadAptssItemMetadata(item, runCommand)),
  );

  return {
    items: results.flatMap((result) => (result.item ? [result.item] : [])),
    warnings: results.flatMap((result) =>
      result.warning ? [result.warning] : [],
    ),
  };
};

const getStoreArch = (
  item: Pick<UpdateCenterItem, "source" | "arch">,
): string => {
  const arch = item.arch;
  if (!arch) {
    return "";
  }

  if (arch.includes("-")) {
    return arch;
  }

  return `${arch}-${item.source === "aptss" ? "store" : "apm"}`;
};

const loadJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }

  return (await response.json()) as T;
};

const loadStoreCategoryMap = async (
  storeArch: string,
): Promise<StoreAppMetadataMap> => {
  const categories = await loadJson<Record<string, unknown>>(
    `${REMOTE_STORE_BASE_URL}/${storeArch}/categories.json`,
  );
  const categoryEntries = await Promise.allSettled(
    Object.keys(categories).map(async (category) => {
      const apps = await loadJson<RemoteCategoryAppEntry[]>(
        `${REMOTE_STORE_BASE_URL}/${storeArch}/${category}/applist.json`,
      );

      return { apps, category };
    }),
  );

  const categoryMap: StoreAppMetadataMap = new Map();
  for (const entry of categoryEntries) {
    if (entry.status !== "fulfilled") {
      continue;
    }

    for (const app of entry.value.apps) {
      if (app.Pkgname && !categoryMap.has(app.Pkgname)) {
        categoryMap.set(app.Pkgname, {
          category: entry.value.category,
          name: app.Name,
        });
      }
    }
  }

  return categoryMap;
};

const getStoreCategoryMap = (
  storeArch: string,
): Promise<StoreAppMetadataMap> => {
  const cached = categoryCache.get(storeArch);
  if (cached) {
    return cached;
  }

  const pending = loadStoreCategoryMap(storeArch).catch(() => {
    categoryCache.delete(storeArch);
    return new Map();
  });
  categoryCache.set(storeArch, pending);
  return pending;
};

const enrichItemCategories = async (
  items: UpdateCenterItem[],
): Promise<UpdateCenterItem[]> => {
  return await Promise.all(
    items.map(async (item) => {
      if (item.category) {
        return item;
      }

      const storeArch = getStoreArch(item);
      if (!storeArch) {
        return item;
      }

      const categoryMap = await getStoreCategoryMap(storeArch);
      const metadata = categoryMap.get(item.pkgname);
      return metadata
        ? {
            ...item,
            category: metadata.category,
            ...(metadata.name ? { name: metadata.name } : {}),
          }
        : item;
    }),
  );
};

const enrichItemIcons = (items: UpdateCenterItem[]): UpdateCenterItem[] => {
  return items.map((item) => {
    const icons = resolveUpdateItemIcons(item);

    return Object.keys(icons).length > 0 ? { ...item, ...icons } : item;
  });
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

  const [categorizedAptssItems, categorizedApmItems] = await Promise.all([
    enrichItemCategories(aptssItems),
    enrichItemCategories(apmItems),
  ]);
  const [enrichedAptssItems, enrichedApmItems] = await Promise.all([
    enrichAptssItems(categorizedAptssItems, runCommand),
    enrichApmItems(categorizedApmItems, runCommand),
  ]);

  return {
    items: mergeUpdateSources(
      enrichItemIcons(enrichedAptssItems.items),
      enrichItemIcons(enrichedApmItems.items),
      installedSources,
    ),
    warnings: [
      ...warnings,
      ...enrichedAptssItems.warnings,
      ...enrichedApmItems.warnings,
    ],
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

  updateCenterService = createUpdateCenterService({
    loadItems: loadUpdateCenterItems,
  });
  registerUpdateCenterIpc(ipcMain, updateCenterService);

  return updateCenterService;
};

export { createUpdateCenterService } from "./service";
