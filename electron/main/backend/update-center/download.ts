import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { spawn } from "node:child_process";

import type { UpdateCenterItem } from "./types";

export interface Aria2DownloadResult {
  filePath: string;
}

export interface RunAria2DownloadOptions {
  item: UpdateCenterItem;
  downloadDir: string;
  onProgress?: (progress: number) => void;
  onLog?: (message: string) => void;
  signal?: AbortSignal;
}

const PROGRESS_PATTERN = /(\d{1,3}(?:\.\d+)?)%/;

export const runAria2Download = async ({
  item,
  downloadDir,
  onProgress,
  onLog,
  signal,
}: RunAria2DownloadOptions): Promise<Aria2DownloadResult> => {
  if (!item.downloadUrl || !item.fileName) {
    throw new Error(`Missing download metadata for ${item.pkgname}`);
  }

  await mkdir(downloadDir, { recursive: true });

  const filePath = join(downloadDir, item.fileName);

  // Use .metalink URL for download (same as Qt version)
  const metalinkUrl = `${item.downloadUrl}.metalink`;

  await new Promise<void>((resolve, reject) => {
    const child = spawn("aria2c", [
      "--dir",
      downloadDir,
      "--out",
      item.fileName,
      "--enable-rpc=false",
      "--console-log-level=warn",
      "--summary-interval=1",
      "--allow-overwrite=true",
      "--connect-timeout=30",
      "--max-tries=3",
      metalinkUrl,
    ]);

    const abortDownload = () => {
      child.kill();
      reject(new Error(`Update task cancelled: ${item.pkgname}`));
    };

    if (signal?.aborted) {
      abortDownload();
      return;
    }

    signal?.addEventListener("abort", abortDownload, { once: true });

    const handleOutput = (chunk: Buffer) => {
      const message = chunk.toString().trim();
      if (!message) {
        return;
      }

      onLog?.(message);
      const progressMatch = message.match(PROGRESS_PATTERN);
      if (progressMatch) {
        onProgress?.(Number(progressMatch[1]));
      }
    };

    child.stdout?.on("data", handleOutput);
    child.stderr?.on("data", handleOutput);
    child.on("error", reject);
    child.on("close", (code) => {
      signal?.removeEventListener("abort", abortDownload);
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`aria2c exited with code ${code ?? -1}`));
    });
  });

  onProgress?.(100);

  return { filePath };
};
