/**
 * 共享的安装/下载逻辑
 * 被 install-manager.ts 和 update-center 共同使用
 */
import { spawn, ChildProcess } from "node:child_process";
import { createWriteStream } from "node:fs";
import * as fs from "node:fs";
import * as path from "node:path";
import axios from "axios";
import pino from "pino";

const logger = pino({ name: "shared-installer" });

export const SHELL_CALLER_PATH = "/opt/spark-store/extras/shell-caller.sh";

export interface DownloadOptions {
  pkgname: string;
  metalinkUrl: string;
  filename: string;
  downloadDir: string;
  onLog?: (msg: string) => void;
  onProgress?: (progress: number) => void;
  onStatus?: (status: string) => void;
  signal?: AbortSignal;
}

export interface DownloadResult {
  filePath: string;
  downloadDir: string;
}

/**
 * 下载 metalink 文件并使用 aria2c 下载 deb 包
 * 与 install-manager.ts 中的下载逻辑保持一致
 */
export const downloadPackage = async ({
  pkgname,
  metalinkUrl,
  filename,
  downloadDir,
  onLog,
  onProgress,
  onStatus,
  signal,
}: DownloadOptions): Promise<DownloadResult> => {
  // 1. 创建下载目录
  try {
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir, { recursive: true });
    }
  } catch (err) {
    logger.error(`无法创建目录 ${downloadDir}: ${err}`);
    throw err;
  }

  const metalinkPath = path.join(downloadDir, `${filename}.metalink`);

  onLog?.(`正在获取 Metalink 文件: ${metalinkUrl}`);

  // 2. 下载 metalink 文件
  const response = await axios.get(metalinkUrl, {
    baseURL: "https://erotica.spark-app.store",
    responseType: "stream",
  });

  const writer = createWriteStream(metalinkPath);
  response.data.pipe(writer);

  await new Promise<void>((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  onLog?.("Metalink 文件下载完成");

  // 3. 清理下载目录中的旧文件（保留 .metalink 文件）
  const existingFiles = fs.readdirSync(downloadDir);
  for (const file of existingFiles) {
    if (file.endsWith(".metalink")) continue;
    const filePath = path.join(downloadDir, file);
    try {
      fs.unlinkSync(filePath);
      onLog?.(`已清理旧文件: ${file}`);
    } catch (err) {
      logger.warn(`清理文件失败 ${filePath}: ${err}`);
    }
  }

  // 4. 使用 aria2c 下载 deb 文件
  const aria2Args = [
    `--dir=${downloadDir}`,
    "--allow-overwrite=true",
    "--summary-interval=1",
    "--connect-timeout=10",
    "--timeout=15",
    "--max-tries=3",
    "--retry-wait=5",
    "--max-concurrent-downloads=4",
    "--min-split-size=1M",
    "--lowest-speed-limit=1K",
    "--auto-file-renaming=false",
    "-M",
    metalinkPath,
  ];

  onStatus?.("downloading");

  // 下载重试逻辑：每次超时时间递增，最多3次
  const timeoutList = [3000, 5000, 15000];
  let retryCount = 0;
  let downloadSuccess = false;

  while (retryCount < timeoutList.length && !downloadSuccess) {
    const currentTimeout = timeoutList[retryCount];

    if (retryCount > 0) {
      onLog?.(`第 ${retryCount} 次重试下载...`);
      onProgress?.(0);
      // 重试前清理旧文件
      const retryFiles = fs.readdirSync(downloadDir);
      for (const file of retryFiles) {
        if (file.endsWith(".metalink")) continue;
        const filePath = path.join(downloadDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (cleanErr) {
          logger.warn(`重试清理文件失败 ${filePath}: ${cleanErr}`);
        }
      }
    }

    try {
      await new Promise<void>((resolve, reject) => {
        onLog?.(`启动下载: aria2c ${aria2Args.join(" ")}`);
        const child = spawn("aria2c", aria2Args);

        let lastProgressTime = Date.now();
        let lastProgress = 0;
        const progressCheckInterval = 1000;

        // 设置超时检测定时器
        const timeoutChecker = setInterval(() => {
          const now = Date.now();
          // 只在进度为0时检查超时
          if (lastProgress === 0 && now - lastProgressTime > currentTimeout) {
            clearInterval(timeoutChecker);
            child.kill();
            reject(new Error(`下载卡在0%超过 ${currentTimeout / 1000} 秒`));
          }
        }, progressCheckInterval);

        child.stdout.on("data", (data) => {
          const str = data.toString();
          // Match ( 12%) or (12%)
          const match = str.match(/[0-9]+(\.[0-9]+)?%/g);
          if (match) {
            const p = parseFloat(match.at(-1)) / 100;
            if (p > lastProgress) {
              lastProgress = p;
              lastProgressTime = Date.now();
            }
            onProgress?.(p);
          }
        });
        child.stderr.on("data", (d) => onLog?.(`aria2c: ${d}`));

        // 处理取消信号
        const abortHandler = () => {
          clearInterval(timeoutChecker);
          child.kill();
          reject(new Error("下载已取消"));
        };

        signal?.addEventListener("abort", abortHandler, { once: true });

        child.on("close", (code) => {
          clearInterval(timeoutChecker);
          signal?.removeEventListener("abort", abortHandler);

          if (code === 0) {
            onProgress?.(1);
            resolve();
          } else {
            reject(new Error(`Aria2c exited with code ${code}`));
          }
        });
        child.on("error", (err) => {
          clearInterval(timeoutChecker);
          signal?.removeEventListener("abort", abortHandler);
          reject(err);
        });
      });

      // 检查是否已取消
      if (signal?.aborted) {
        throw new Error("下载已取消");
      }
      downloadSuccess = true;
    } catch (err) {
      retryCount++;
      if (retryCount >= timeoutList.length) {
        throw new Error(`下载失败，已重试 ${timeoutList.length} 次: ${err}`);
      }
      onLog?.(`下载失败，准备重试 (${retryCount}/${timeoutList.length})`);
      // 等待2秒后重试
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  const filePath = path.join(downloadDir, filename);
  return { filePath, downloadDir };
};

export interface InstallOptions {
  pkgname: string;
  filePath: string;
  origin: "spark" | "apm";
  superUserCmd?: string;
  onLog?: (msg: string) => void;
  signal?: AbortSignal;
}

/**
 * 安装已下载的包
 * 与 install-manager.ts 中的安装逻辑保持一致
 */
export const installPackage = async ({
  pkgname,
  filePath,
  origin,
  superUserCmd,
  onLog,
  signal,
}: InstallOptions): Promise<void> => {
  // 构建安装命令
  let execCommand = "";
  const execParams: string[] = [];

  if (origin === "spark") {
    execCommand = superUserCmd || SHELL_CALLER_PATH;
    if (superUserCmd) execParams.push(SHELL_CALLER_PATH);
    execParams.push(
      "ssinstall",
      filePath,
      "--delete-after-install",
      "--no-create-desktop-entry",
      "--native"
    );
  } else {
    // APM
    execCommand = superUserCmd || SHELL_CALLER_PATH;
    if (superUserCmd) {
      execParams.push(SHELL_CALLER_PATH);
    }
    execParams.push("apm", "ssinstall", filePath);
  }

  const cmdString = `${execCommand} ${execParams.join(" ")}`;
  onLog?.(`执行安装: ${cmdString}`);
  logger.info(`启动安装: ${cmdString}`);

  return new Promise<void>((resolve, reject) => {
    const child = spawn(execCommand, execParams, {
      shell: false,
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let logBuffer = "";
    let logBufferTimer: NodeJS.Timeout | null = null;
    const LOG_FLUSH_MS = 100;

    const flushLogBuffer = () => {
      if (logBuffer.length > 0) {
        onLog?.(logBuffer);
        logBuffer = "";
      }
      logBufferTimer = null;
    };

    const bufferedSendLog = (message: string) => {
      logBuffer += message;
      if (!logBufferTimer) {
        logBufferTimer = setTimeout(flushLogBuffer, LOG_FLUSH_MS);
      }
    };

    // 处理取消信号
    const abortHandler = () => {
      child.kill();
      reject(new Error("安装已取消"));
    };

    signal?.addEventListener("abort", abortHandler, { once: true });

    child.stdout?.on("data", (data) => {
      stdout += data.toString();
      bufferedSendLog(data.toString());
    });

    child.stderr?.on("data", (data) => {
      stderr += data.toString();
      bufferedSendLog(data.toString());
    });

    child.on("error", (err) => {
      signal?.removeEventListener("abort", abortHandler);
      if (logBufferTimer) clearTimeout(logBufferTimer);
      flushLogBuffer();
      reject(err);
    });

    child.on("close", (code) => {
      signal?.removeEventListener("abort", abortHandler);
      if (logBufferTimer) clearTimeout(logBufferTimer);
      flushLogBuffer();

      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`安装失败，退出码: ${code}`));
      }
    });
  });
};

/**
 * 检查是否有 apm 命令
 */
export const checkApmAvailable = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    const child = spawn("which", ["apm"]);
    let stdout = "";
    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.on("close", (code) => {
      resolve(code === 0 && stdout.trim().length > 0);
    });
    child.on("error", () => {
      resolve(false);
    });
  });
};

/**
 * 检查提权命令
 */
export const checkSuperUserCommand = async (): Promise<string> => {
  return new Promise((resolve) => {
    const child = spawn("which", ["/usr/bin/pkexec"]);
    let stdout = "";
    child.stdout?.on("data", (data) => {
      stdout += data.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        resolve("");
      }
    });
    child.on("error", () => {
      resolve("");
    });
  });
};
