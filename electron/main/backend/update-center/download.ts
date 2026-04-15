import { downloadPackage } from "../shared-installer";
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

  // 使用与商店安装相同的下载逻辑
  const metalinkUrl = `${item.downloadUrl}.metalink`;

  const result = await downloadPackage({
    pkgname: item.pkgname,
    metalinkUrl,
    filename: item.fileName,
    downloadDir,
    onLog,
    onProgress,
    signal,
  });

  return { filePath: result.filePath };
};
