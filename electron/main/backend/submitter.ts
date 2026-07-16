import { BrowserWindow, dialog, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import https from "node:https";
import pino from "pino";

const logger = pino({ name: "submitter.ts" });

interface DebInfo {
  pkgname: string;
  version: string;
  author: string;
  maintainer: string;
  homepage: string;
  description: string;
  architecture: string;
}

interface HistoryAppInfo {
  id: number;
  name: string;
  pkgname: string;
  version: string;
  store: string;
  author: string;
  contributor: string;
  website: string;
  category: string;
  tags: string;
  more: string;
  icon: string;
  imgs: string[];
}

interface OssUploadMetadata {
  code: number;
  msg: string;
  data: {
    dir: string;
    host: string;
    ossAccessKeyId: string;
    policy: string;
    signature: string;
  };
}

function generateUUID(): string {
  const hexChars = "0123456789abcdef";
  let uuid = "";
  for (let i = 0; i < 32; i++) {
    uuid += hexChars[Math.floor(Math.random() * 16)];
  }
  return uuid;
}

function getUUIDFileNameSuggestIcoPic(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace(".", "");
  const uuid = generateUUID();
  return `${uuid}.${ext}`;
}

function getUUIDFileNameSuggestDeb(_filePath: string): string {
  const uuid = generateUUID();
  return `${uuid}.deb`;
}

async function getOssUploadMetadata(
  type: "icons" | "pic" | "deb",
): Promise<OssUploadMetadata> {
  const startTime = Date.now();
  const pathMap: Record<string, string> = {
    icons: "upload_icons",
    pic: "upload_pic",
    deb: "upload_deb",
  };
  const url = `https://upload.deepinos.org.cn/api/index/${pathMap[type]}`;
  logger.info(
    `[Submitter] ============== GET OSS METADATA START (${type}) ==============`,
  );
  logger.info(
    { url, timestamp: new Date().toISOString() },
    `[Submitter] Getting OSS metadata for ${type}`,
  );

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": getUserAgent(),
    },
  });

  const duration = Date.now() - startTime;
  logger.info(
    { status: response.status, statusText: response.statusText, duration },
    `[Submitter] OSS metadata response for ${type}`,
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error(
      { errorText },
      `[Submitter] Failed to get OSS metadata for ${type}`,
    );
    throw new Error(
      `获取 ${type} 上传签名失败: ${response.status} - ${errorText.substring(0, 200)}`,
    );
  }

  const responseText = await response.text();
  logger.info(
    {
      responseTextLength: responseText.length,
      responseText: responseText.substring(0, 1000),
    },
    `[Submitter] Raw OSS metadata response for ${type}`,
  );

  let result: unknown;
  try {
    result = JSON.parse(responseText);
    logger.info(
      {
        resultType: typeof result,
        resultKeys:
          typeof result === "object" && result !== null
            ? Object.keys(result as object)
            : [],
      },
      `[Submitter] Parsed OSS metadata result type for ${type}`,
    );
  } catch (parseError) {
    logger.error(
      { parseError: (parseError as Error)?.message },
      `[Submitter] Failed to parse OSS metadata response for ${type}`,
    );
    throw new Error(
      `解析 ${type} 上传签名响应失败: ${(parseError as Error)?.message}`,
    );
  }

  if (typeof result !== "object" || result === null) {
    logger.error(
      { result },
      `[Submitter] OSS metadata response is not an object for ${type}`,
    );
    throw new Error(`${type} 上传签名响应格式错误`);
  }

  const resultObj = result as Record<string, unknown>;
  if (resultObj.data === undefined || resultObj.data === null) {
    logger.error(
      { result },
      `[Submitter] OSS metadata response data field is undefined for ${type}`,
    );
    throw new Error(`${type} 上传签名响应缺少 data 字段`);
  }

  const dataObj = resultObj.data as Record<string, unknown>;
  if (!dataObj.host || !dataObj.dir) {
    logger.error(
      { data: resultObj.data },
      `[Submitter] OSS metadata response data missing host or dir for ${type}`,
    );
    throw new Error(`${type} 上传签名响应 data 字段缺少 host 或 dir`);
  }

  const ossMetadata: OssUploadMetadata = {
    code: Number(resultObj.code) || 0,
    msg: String(resultObj.msg || ""),
    data: {
      dir: String(dataObj.dir),
      host: String(dataObj.host),
      ossAccessKeyId: String(
        dataObj.OSSAccessKeyId ||
          dataObj.ossAccessKeyId ||
          dataObj.oss_access_key_id ||
          "",
      ),
      policy: String(dataObj.policy || ""),
      signature: String(dataObj.signature || ""),
    },
  };

  logger.info(
    `[Submitter] ============== OSS METADATA RECEIVED (${type}) ==============`,
  );
  logger.info(
    { code: ossMetadata.code, msg: ossMetadata.msg },
    `[Submitter] OSS metadata result for ${type}`,
  );
  logger.info(
    { host: ossMetadata.data.host, dir: ossMetadata.data.dir },
    `[Submitter] OSS upload host and dir for ${type}`,
  );
  logger.info(
    {
      ossAccessKeyIdLength: ossMetadata.data.ossAccessKeyId.length,
      policyLength: ossMetadata.data.policy.length,
      signatureLength: ossMetadata.data.signature.length,
    },
    `[Submitter] OSS credential lengths for ${type}`,
  );

  return ossMetadata;
}

type UploadProgressCallback = (progress: number, fileType: string) => void;

async function uploadFileToOss(
  metadata: OssUploadMetadata,
  filePath: string,
  fileName: string,
  mimeType: string,
  fileType: string,
  progressCallback?: UploadProgressCallback,
): Promise<string> {
  const startTime = Date.now();
  const { host, dir, ossAccessKeyId, policy, signature } = metadata.data;
  const uploadUrl = host;
  const objectKey = `${dir}${fileName}`;

  logger.info(
    `[Submitter] ============== UPLOAD FILE START (${fileType}) ==============`,
  );
  logger.info(
    {
      uploadUrl,
      objectKey,
      filePath,
      fileName,
      mimeType,
      timestamp: new Date().toISOString(),
    },
    `[Submitter] Starting upload for ${fileType}`,
  );

  const fileStat = fs.statSync(filePath);
  const fileSize = fileStat.size;
  logger.info(
    { fileSize, fileSizeHuman: `${(fileSize / 1024 / 1024).toFixed(2)} MB` },
    `[Submitter] File size for ${fileType}`,
  );

  const fileBuffer = fs.readFileSync(filePath);
  logger.info(
    { bufferSize: fileBuffer.length },
    `[Submitter] File buffer ready for ${fileType}`,
  );

  const boundary = `----SparkStoreUploadBoundary${Date.now().toString(36)}`;
  const CRLF = Buffer.from("\r\n", "ascii");

  const encodeField = (str: string) => Buffer.from(str, "utf8");

  const headerBuffers: Buffer[] = [];
  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(
    encodeField(`Content-Disposition: form-data; name="key"\r\n\r\n`),
  );
  headerBuffers.push(encodeField(objectKey));
  headerBuffers.push(CRLF);

  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(
    encodeField(
      `Content-Disposition: form-data; name="ossAccessKeyId"\r\n\r\n`,
    ),
  );
  headerBuffers.push(encodeField(ossAccessKeyId));
  headerBuffers.push(CRLF);

  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(
    encodeField(`Content-Disposition: form-data; name="policy"\r\n\r\n`),
  );
  headerBuffers.push(encodeField(policy));
  headerBuffers.push(CRLF);

  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(
    encodeField(`Content-Disposition: form-data; name="signature"\r\n\r\n`),
  );
  headerBuffers.push(encodeField(signature));
  headerBuffers.push(CRLF);

  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(
    encodeField(
      `Content-Disposition: form-data; name="success_action_status"\r\n\r\n`,
    ),
  );
  headerBuffers.push(encodeField("200"));
  headerBuffers.push(CRLF);

  headerBuffers.push(encodeField(`--${boundary}\r\n`));
  headerBuffers.push(
    encodeField(
      `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n`,
    ),
  );
  headerBuffers.push(encodeField(`Content-Type: ${mimeType}\r\n\r\n`));

  const formHeaderBuffer = Buffer.concat(headerBuffers);
  const formFooterBuffer = Buffer.concat([
    CRLF,
    encodeField(`--${boundary}--\r\n`),
  ]);
  const totalLength =
    formHeaderBuffer.length + fileBuffer.length + formFooterBuffer.length;

  logger.info(
    {
      formHeaderLength: formHeaderBuffer.length,
      formFooterLength: formFooterBuffer.length,
      totalLength,
      fileSize,
    },
    `[Submitter] Form lengths for ${fileType}`,
  );

  return new Promise((resolve, reject) => {
    const url = new URL(uploadUrl);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: url.port ? parseInt(url.port) : 443,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "User-Agent": getUserAgent(),
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": totalLength,
      },
    };

    logger.info(
      `[Submitter] ============== SENDING UPLOAD REQUEST (${fileType}) ==============`,
    );

    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      res.on("end", () => {
        const duration = Date.now() - startTime;
        logger.info(
          `[Submitter] ============== UPLOAD RESPONSE RECEIVED (${fileType}) ==============`,
        );
        logger.info(
          { status: res.statusCode, duration },
          `[Submitter] Upload response for ${fileType}`,
        );
        logger.info(
          { responseHeaders: res.headers },
          `[Submitter] Response headers for ${fileType}`,
        );
        logger.info(
          { responseBody: responseData.substring(0, 1000) },
          `[Submitter] Response body for ${fileType}`,
        );

        if (res.statusCode !== 200) {
          logger.error(
            { errorText: responseData.substring(0, 500) },
            `[Submitter] Upload failed for ${fileType}`,
          );
          reject(
            new Error(
              `${fileType} 上传失败: ${res.statusCode} - ${responseData.substring(0, 500)}`,
            ),
          );
          return;
        }

        const finalUrl = `${host}${objectKey}`;
        logger.info(
          { finalUrl },
          `[Submitter] ${fileType} upload successful, URL: ${finalUrl}`,
        );
        resolve(finalUrl);
      });
    });

    req.on("error", (err) => {
      logger.error({ err }, `[Submitter] Upload request error for ${fileType}`);
      reject(new Error(`${fileType} 上传失败: ${err.message}`));
    });

    req.write(formHeaderBuffer);

    let uploadedBytes = formHeaderBuffer.length;

    const chunkSize = 1024 * 1024;
    for (let offset = 0; offset < fileBuffer.length; offset += chunkSize) {
      const chunk = fileBuffer.slice(
        offset,
        Math.min(offset + chunkSize, fileBuffer.length),
      );
      req.write(chunk);
      uploadedBytes += chunk.length;

      if (progressCallback) {
        const progress = Math.min((uploadedBytes / totalLength) * 100, 100);
        progressCallback(progress, fileType);
      }
    }

    req.write(formFooterBuffer);
    req.end();
  });
}

function getAppVersion(): string {
  const appRoot = process.env.APP_ROOT;
  if (!appRoot) return "dev";
  const pkgPath = path.join(appRoot, "package.json");
  try {
    const raw = fs.readFileSync(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { version?: string };
    return typeof pkg.version === "string" ? pkg.version : "dev";
  } catch {
    return "dev";
  }
}

function getUserAgent(): string {
  return `Spark-Store/${getAppVersion()}`;
}

export function registerSubmitterHandlers(
  preload: string,
  indexHtml: string,
  viteDevServerUrl: string | undefined,
  getSubmitterWin: () => BrowserWindow | null,
  setSubmitterWin: (win: BrowserWindow | null) => void,
) {
  ipcMain.handle("launch-submitter", async () => {
    try {
      if (getSubmitterWin() && !getSubmitterWin()!.isDestroyed()) {
        getSubmitterWin()!.show();
        getSubmitterWin()!.focus();
        return { success: true };
      }

      const newWin = new BrowserWindow({
        title: "星火应用商店 - 投稿应用",
        width: 800,
        height: 900,
        frame: false,
        show: false,
        autoHideMenuBar: true,
        icon: path.join(process.env.VITE_PUBLIC!, "favicon.ico"),
        webPreferences: {
          preload,
        },
      });

      if (viteDevServerUrl) {
        newWin.loadURL(`${viteDevServerUrl}#submitter`);
      } else {
        newWin.loadFile(indexHtml, { hash: "submitter" });
      }

      newWin.once("ready-to-show", () => {
        newWin.show();
        newWin.focus();
      });

      newWin.on("closed", () => {
        setSubmitterWin(null);
      });

      newWin.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith("https:")) shell.openExternal(url);
        return { action: "deny" };
      });

      setSubmitterWin(newWin);
      logger.info("Submitter window opened");
      return { success: true };
    } catch (err) {
      logger.error({ err }, "Failed to open submitter window");
      return {
        success: false,
        message: (err as Error)?.message || String(err),
      };
    }
  });

  ipcMain.on("close-submitter-window", () => {
    getSubmitterWin()?.close();
  });

  ipcMain.handle("select-deb-file", async (_event) => {
    try {
      const result = await dialog.showOpenDialog({
        title: "选择 deb 安装包",
        filters: [{ name: "Debian 包", extensions: ["deb"] }],
        properties: ["openFile"],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        return { success: true, filePath: result.filePaths[0] };
      }

      return { success: false, message: "用户取消选择" };
    } catch (err) {
      logger.error({ err }, "Failed to select deb file");
      return {
        success: false,
        message: (err as Error)?.message || "选择文件失败",
      };
    }
  });

  ipcMain.handle("parse-deb-file", async (_event, debPath: string) => {
    try {
      logger.info({ debPath }, "[Submitter] Starting parse-deb-file handler");

      const { exec } = await import("node:child_process");
      const util = await import("util");
      const execAsync = util.promisify(exec);

      const absoluteDebPath = path.resolve(debPath);
      logger.info(
        { debPath, absoluteDebPath },
        "[Submitter] Resolved absolute deb path",
      );

      if (!fs.existsSync(absoluteDebPath)) {
        logger.error(
          { debPath, absoluteDebPath },
          "[Submitter] Deb file not found",
        );
        return { success: false, message: `文件不存在: ${absoluteDebPath}` };
      }

      logger.info(
        { absoluteDebPath },
        "[Submitter] Deb file exists, executing dpkg-deb command",
      );

      const { stdout, stderr } = await execAsync(
        `dpkg-deb -f "${absoluteDebPath}" Package Version Maintainer Homepage Description Architecture`,
      );

      logger.info({ stdout, stderr }, "[Submitter] dpkg-deb command executed");

      if (stderr) {
        logger.error({ stderr }, "[Submitter] dpkg-deb returned error");
        return { success: false, message: stderr };
      }

      const lines = stdout.trim().split("\n");
      logger.info(
        { lineCount: lines.length, rawOutput: stdout },
        "[Submitter] Parsing dpkg-deb output",
      );

      const debInfo: DebInfo = {
        pkgname: "",
        version: "",
        author: "",
        maintainer: "",
        homepage: "",
        description: "",
        architecture: "",
      };

      for (const line of lines) {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();
        logger.debug(
          { line, key, value },
          "[Submitter] Processing dpkg-deb line",
        );

        switch (key.trim()) {
          case "Package":
            debInfo.pkgname = value.toLowerCase();
            logger.info(
              { pkgname: debInfo.pkgname },
              "[Submitter] Found Package name",
            );
            break;
          case "Version":
            debInfo.version = value;
            logger.info(
              { version: debInfo.version },
              "[Submitter] Found Version",
            );
            break;
          case "Maintainer":
            debInfo.maintainer = value;
            debInfo.author = value;
            logger.info(
              { maintainer: debInfo.maintainer },
              "[Submitter] Found Maintainer",
            );
            break;
          case "Homepage":
            debInfo.homepage = value;
            logger.info(
              { homepage: debInfo.homepage },
              "[Submitter] Found Homepage",
            );
            break;
          case "Description":
            debInfo.description = value;
            logger.info(
              { description: debInfo.description.substring(0, 100) + "..." },
              "[Submitter] Found Description",
            );
            break;
          case "Architecture":
            debInfo.architecture = value;
            logger.info(
              { architecture: debInfo.architecture },
              "[Submitter] Found Architecture",
            );
            break;
        }
      }

      logger.info(
        { debInfo },
        "[Submitter] Deb file parsing completed successfully",
      );

      return { success: true, data: debInfo };
    } catch (err) {
      logger.error(
        { err, debPath },
        "[Submitter] Failed to parse deb file with exception",
      );
      return {
        success: false,
        message: (err as Error)?.message || "解析deb文件失败",
      };
    }
  });

  ipcMain.handle(
    "search-history-app",
    async (_event, pkgname: string, useMirror = false) => {
      try {
        const baseUrl = useMirror
          ? "https://mirrors.sdu.edu.cn/spark-store"
          : "https://spk-json.spark-app.store";
        const storeArchs = ["store", "aarch64-store", "loong64-store"];
        const categories = [
          "chat",
          "development",
          "games",
          "image_graphics",
          "music",
          "network",
          "office",
          "others",
          "reading",
          "themes",
          "tools",
          "video",
        ];
        const results: HistoryAppInfo[] = [];

        logger.info(
          "[Submitter] ============== SEARCH HISTORY APP START ==============",
        );
        logger.info(
          { pkgname, useMirror, baseUrl, storeArchs, categories },
          "[Submitter] Search parameters",
        );

        const allPromises: Promise<void>[] = [];

        for (const arch of storeArchs) {
          for (const category of categories) {
            const url = `${baseUrl}/${arch}/${category}/${pkgname}/app.json`;
            logger.info(
              { arch, category, url },
              "[Submitter] Starting search request",
            );

            const promise = fetch(url, {
              headers: { "User-Agent": getUserAgent() },
            })
              .then(async (response) => {
                logger.info(
                  { arch, category, status: response.status },
                  "[Submitter] Fetch completed",
                );

                if (response.ok) {
                  const json = await response.json();
                  logger.info(
                    {
                      arch,
                      category,
                      rawJson: JSON.stringify(json, null, 2),
                    },
                    "[Submitter] Response parsed",
                  );

                  const appPkgname =
                    json?.pkgname || json?.Pkgname || json?.packageName || "";
                  logger.info(
                    { arch, category, appPkgname, searchPkgname: pkgname },
                    "[Submitter] Comparing pkgname",
                  );

                  if (appPkgname.toLowerCase() === pkgname.toLowerCase()) {
                    logger.info(
                      { arch, category, item: json },
                      "[Submitter] Found matching item",
                    );

                    let iconUrl = json.icons || json.icon || "";
                    let imgs = json.imgUrls || json.imgs || json.img_urls || [];

                    if (typeof imgs === "string") {
                      try {
                        imgs = JSON.parse(imgs);
                        logger.info(
                          {
                            arch,
                            category,
                            parsedImgsCount: Array.isArray(imgs)
                              ? imgs.length
                              : 0,
                          },
                          "[Submitter] Parsed img_urls from string",
                        );
                      } catch {
                        imgs = [];
                        logger.warn(
                          { arch, category, imgsString: imgs },
                          "[Submitter] Failed to parse img_urls string",
                        );
                      }
                    }

                    if (iconUrl && typeof iconUrl === "string") {
                      if (useMirror) {
                        iconUrl = iconUrl.replace(
                          "spk-json.spark-app.store",
                          "mirrors.sdu.edu.cn/spark-store",
                        );
                      }
                    }

                    if (Array.isArray(imgs)) {
                      imgs = imgs.map((img: string) => {
                        if (useMirror && typeof img === "string") {
                          return img.replace(
                            "spk-json.spark-app.store",
                            "mirrors.sdu.edu.cn/spark-store",
                          );
                        }
                        return img;
                      });
                    }

                    results.push({
                      id: json.id || json.Id || 0,
                      name: json.name || json.Name || "",
                      pkgname: json.pkgname || json.Pkgname || "",
                      version: json.version || json.Version || "",
                      store: arch,
                      author: json.author || json.Author || "",
                      contributor: json.contributor || json.Contributor || "",
                      website: json.website || json.Website || "",
                      category: category,
                      tags: json.tags || json.Tags || "",
                      more: json.more || json.More || "",
                      icon: iconUrl,
                      imgs: imgs,
                    });

                    logger.info(
                      { arch, count: results.length },
                      "[Submitter] Added to results",
                    );
                  }
                }
              })
              .catch((error) => {
                logger.warn(
                  { arch, category, error },
                  "[Submitter] Request failed or exception caught",
                );
              });

            allPromises.push(promise);
          }
        }

        await Promise.all(allPromises);

        logger.info(
          "[Submitter] ============== SEARCH COMPLETED ==============",
        );
        logger.info(
          { totalResults: results.length, results },
          "[Submitter] Search results",
        );

        return { success: true, data: results };
      } catch (err) {
        logger.error("[Submitter] ============== SEARCH FAILED ==============");
        logger.error(
          {
            errorType: (err as Error)?.name,
            errorMessage: (err as Error)?.message,
            errorStack: (err as Error)?.stack,
          },
          "[Submitter] Exception caught",
        );
        return {
          success: false,
          message: (err as Error)?.message || "搜索历史信息失败",
        };
      }
    },
  );

  ipcMain.handle("get-category-list", async () => {
    try {
      const apiUrl = "https://upload.deepinos.org.cn/api/index/get_type_list";
      logger.info(
        "[Submitter] ============== GET CATEGORY LIST START ==============",
      );
      logger.info(
        { apiUrl, userAgent: getUserAgent() },
        "[Submitter] Request parameters",
      );

      const startTime = Date.now();
      const response = await fetch(apiUrl, {
        headers: { "User-Agent": getUserAgent() },
      });
      const endTime = Date.now();

      logger.info(
        {
          status: response.status,
          statusText: response.statusText,
          duration: endTime - startTime,
        },
        "[Submitter] Fetch completed",
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, errorBody: errorText },
          "[Submitter] Request failed",
        );
        return {
          success: false,
          message: `获取分类列表失败 (${response.status})`,
        };
      }

      const json = await response.json();
      logger.info(
        {
          code: json?.code,
          msg: json?.msg,
          dataType: typeof json?.data,
          dataLength: json?.data?.length || "N/A",
          response: json,
        },
        "[Submitter] Response parsed",
      );

      return { success: true, data: json };
    } catch (err) {
      logger.error(
        {
          errorType: (err as Error)?.name,
          errorMessage: (err as Error)?.message,
          errorStack: (err as Error)?.stack,
        },
        "[Submitter] Exception caught",
      );
      return {
        success: false,
        message: (err as Error)?.message || "获取分类列表失败",
      };
    }
  });

  ipcMain.handle("get-git-email", async () => {
    try {
      const { exec } = await import("node:child_process");
      const util = await import("util");
      const execAsync = util.promisify(exec);
      const { stdout } = await execAsync("git config user.email");
      const email = stdout.trim();
      logger.info({ email }, "[Submitter] Git email retrieved");
      return { success: true, data: email || "" };
    } catch (err) {
      logger.warn(
        { err },
        "[Submitter] Failed to get git email, not a git repo or git not installed",
      );
      return { success: false, data: "" };
    }
  });

  ipcMain.handle("get-tags-list", async () => {
    try {
      const apiUrl = "https://upload.deepinos.org.cn/api/index/get_tags_list";
      logger.info(
        "[Submitter] ============== GET TAGS LIST START ==============",
      );
      logger.info(
        { apiUrl, userAgent: getUserAgent() },
        "[Submitter] Request parameters",
      );

      const startTime = Date.now();
      const response = await fetch(apiUrl, {
        headers: { "User-Agent": getUserAgent() },
      });
      const endTime = Date.now();

      logger.info(
        {
          status: response.status,
          statusText: response.statusText,
          duration: endTime - startTime,
        },
        "[Submitter] Fetch completed",
      );

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(
          { status: response.status, errorBody: errorText },
          "[Submitter] Request failed",
        );
        return {
          success: false,
          message: `获取标签列表失败 (${response.status})`,
        };
      }

      const json = await response.json();
      logger.info(
        {
          code: json?.code,
          msg: json?.msg,
          dataType: typeof json?.data,
          dataLength: json?.data?.length || "N/A",
          response: json,
        },
        "[Submitter] Response parsed",
      );

      return { success: true, data: json };
    } catch (err) {
      logger.error(
        {
          errorType: (err as Error)?.name,
          errorMessage: (err as Error)?.message,
          errorStack: (err as Error)?.stack,
        },
        "[Submitter] Exception caught",
      );
      return {
        success: false,
        message: (err as Error)?.message || "获取标签列表失败",
      };
    }
  });

  ipcMain.handle("submit-app", async (event, formData: unknown) => {
    try {
      const startTime = Date.now();
      logger.info("[Submitter] ============== SUBMIT APP START ==============");
      logger.info(
        { timestamp: new Date().toISOString() },
        "[Submitter] Submission started at",
      );

      if (typeof formData !== "object" || formData === null) {
        logger.error("[Submitter] Form data is not an object");
        return { success: false, message: "表单数据格式错误" };
      }

      const dataObj = formData as Record<string, unknown>;
      logger.info(
        "[Submitter] ============== FORM DATA RECEIVED ==============",
      );
      logger.info({ name: dataObj.name }, "[Submitter] App name");
      logger.info({ pkgname: dataObj.pkgname }, "[Submitter] Package name");
      logger.info({ version: dataObj.version }, "[Submitter] Version");
      logger.info({ author: dataObj.author }, "[Submitter] Author");
      logger.info(
        { contributor: dataObj.contributor },
        "[Submitter] Contributor",
      );
      logger.info({ website: dataObj.website }, "[Submitter] Website");
      logger.info(
        { debFilePath: dataObj.debFilePath },
        "[Submitter] Deb file path",
      );
      logger.info({ iconPath: dataObj.iconPath }, "[Submitter] Icon path");
      logger.info({ category: dataObj.category }, "[Submitter] Category");
      logger.info({ tags: dataObj.tags }, "[Submitter] Tags");
      logger.info(
        {
          descriptionLength:
            typeof dataObj.description === "string"
              ? dataObj.description.length
              : 0,
        },
        "[Submitter] Description length",
      );
      logger.info(
        {
          screenshotsCount: Array.isArray(dataObj.screenshots)
            ? dataObj.screenshots.length
            : 0,
        },
        "[Submitter] Screenshots count",
      );

      const debFilePath = String(dataObj.debFilePath || "");
      const iconPath = String(dataObj.iconPath || "");
      const screenshots = Array.isArray(dataObj.screenshots)
        ? dataObj.screenshots
        : [];

      if (!debFilePath) {
        logger.error("[Submitter] Deb file path is empty");
        return { success: false, message: "请选择 deb 文件" };
      }

      if (!fs.existsSync(debFilePath)) {
        logger.error({ debFilePath }, "[Submitter] Deb file does not exist");
        return { success: false, message: `deb 文件不存在: ${debFilePath}` };
      }

      const sendUploadProgress = (
        step: string,
        progress: number,
        message: string,
      ) => {
        event.sender.send("submit-upload-progress", {
          step,
          progress,
          message,
        });
      };

      let iconUrl = "";
      if (iconPath) {
        logger.info(
          "[Submitter] ============== STEP 1: UPLOAD ICON ==============",
        );
        let iconFilePath = iconPath;

        if (iconPath.startsWith("data:")) {
          logger.info("[Submitter] Icon is a Base64 data URL, decoding");
          const base64Data = iconPath.split(",")[1];
          if (!base64Data) {
            return { success: false, message: "图标数据格式错误" };
          }
          const tempDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "spark-store-submitter-"),
          );
          iconFilePath = path.join(tempDir, "icon.png");
          try {
            fs.writeFileSync(iconFilePath, Buffer.from(base64Data, "base64"));
            logger.info(
              { iconFilePath },
              "[Submitter] Icon decoded from data URL",
            );
          } catch (err) {
            logger.error({ err }, "[Submitter] Failed to decode icon data URL");
            return {
              success: false,
              message: `图标解码失败: ${(err as Error).message}`,
            };
          }
        } else if (
          iconPath.startsWith("http://") ||
          iconPath.startsWith("https://")
        ) {
          logger.info(
            { iconPath },
            "[Submitter] Icon is a remote URL, downloading first",
          );
          const tempDir = fs.mkdtempSync(
            path.join(os.tmpdir(), "spark-store-submitter-"),
          );
          iconFilePath = path.join(tempDir, "icon.png");

          try {
            const response = await fetch(iconPath);
            if (!response.ok) {
              throw new Error(`下载图标失败: ${response.status}`);
            }
            const blob = await response.blob();
            const buffer = Buffer.from(await blob.arrayBuffer());
            fs.writeFileSync(iconFilePath, buffer);
            logger.info(
              { iconFilePath, size: buffer.length },
              "[Submitter] Icon downloaded successfully",
            );
          } catch (err) {
            logger.error(
              { err, iconPath },
              "[Submitter] Failed to download icon from URL",
            );
            return {
              success: false,
              message: `下载图标失败: ${(err as Error).message}`,
            };
          }
        }

        if (fs.existsSync(iconFilePath)) {
          const iconMetadata = await getOssUploadMetadata("icons");
          const iconFileName = getUUIDFileNameSuggestIcoPic(iconFilePath);
          sendUploadProgress("icon", 0, "正在上传图标...");
          iconUrl = await uploadFileToOss(
            iconMetadata,
            iconFilePath,
            iconFileName,
            "image/png",
            "icon",
            (progress) => {
              sendUploadProgress(
                "icon",
                progress,
                `正在上传图标... ${Math.floor(progress)}%`,
              );
            },
          );
          sendUploadProgress("icon", 100, "图标上传完成");
          logger.info({ iconUrl }, "[Submitter] Icon upload completed");

          if (
            iconPath.startsWith("http://") ||
            iconPath.startsWith("https://") ||
            iconPath.startsWith("data:")
          ) {
            fs.unlinkSync(iconFilePath);
            fs.rmdirSync(path.dirname(iconFilePath));
          }
        } else {
          logger.error(
            { iconFilePath },
            "[Submitter] Icon file does not exist",
          );
          return {
            success: false,
            message: `图标文件不存在: ${iconFilePath}`,
          };
        }
      }

      const screenshotUrls: string[] = [];
      for (let i = 0; i < screenshots.length; i++) {
        const screenshot = screenshots[i];
        logger.info(
          { index: i, screenshot },
          "[Submitter] Processing screenshot",
        );

        if (typeof screenshot === "string") {
          logger.info(
            `[Submitter] ============== STEP 2: UPLOAD SCREENSHOT ${i + 1} ==============`,
          );
          let screenshotFilePath = screenshot;

          if (
            screenshot.startsWith("http://") ||
            screenshot.startsWith("https://")
          ) {
            logger.info(
              { screenshot },
              "[Submitter] Screenshot is a remote URL, downloading first",
            );
            const tempDir = fs.mkdtempSync(
              path.join(os.tmpdir(), "spark-store-submitter-"),
            );
            screenshotFilePath = path.join(tempDir, `screen_${i + 1}.png`);

            try {
              const response = await fetch(screenshot);
              if (!response.ok) {
                throw new Error(`下载截图失败: ${response.status}`);
              }
              const blob = await response.blob();
              const buffer = Buffer.from(await blob.arrayBuffer());
              fs.writeFileSync(screenshotFilePath, buffer);
              logger.info(
                { screenshotFilePath, size: buffer.length },
                "[Submitter] Screenshot downloaded successfully",
              );
            } catch (err) {
              logger.error(
                { err, screenshot },
                "[Submitter] Failed to download screenshot from URL",
              );
              continue;
            }
          }

          if (fs.existsSync(screenshotFilePath)) {
            const picMetadata = await getOssUploadMetadata("pic");
            const picFileName =
              getUUIDFileNameSuggestIcoPic(screenshotFilePath);
            sendUploadProgress(
              `screenshot-${i}`,
              0,
              `正在上传截图 ${i + 1}...`,
            );
            const picUrl = await uploadFileToOss(
              picMetadata,
              screenshotFilePath,
              picFileName,
              "image/png",
              `screenshot ${i + 1}`,
              (progress) => {
                sendUploadProgress(
                  `screenshot-${i}`,
                  progress,
                  `正在上传截图 ${i + 1}... ${Math.floor(progress)}%`,
                );
              },
            );
            sendUploadProgress(
              `screenshot-${i}`,
              100,
              `截图 ${i + 1} 上传完成`,
            );
            screenshotUrls.push(picUrl);
            logger.info(
              { picUrl },
              `[Submitter] Screenshot ${i + 1} upload completed`,
            );

            if (
              screenshot.startsWith("http://") ||
              screenshot.startsWith("https://")
            ) {
              fs.unlinkSync(screenshotFilePath);
              fs.rmdirSync(path.dirname(screenshotFilePath));
            }
          } else {
            logger.warn(
              { screenshotFilePath },
              "[Submitter] Screenshot file does not exist, skipping",
            );
          }
        }
      }

      logger.info(
        "[Submitter] ============== STEP 3: UPLOAD DEB ==============",
      );
      logger.info(
        {
          debFilePath,
          debFileName: getUUIDFileNameSuggestDeb(debFilePath),
        },
        "[Submitter] Starting deb upload",
      );
      const debMetadata = await getOssUploadMetadata("deb");
      const debFileName = getUUIDFileNameSuggestDeb(debFilePath);
      sendUploadProgress("deb", 0, "正在上传安装包...");
      const debUrl = await uploadFileToOss(
        debMetadata,
        debFilePath,
        debFileName,
        "application/vnd.debian.binary-package",
        "deb",
        (progress) => {
          sendUploadProgress(
            "deb",
            progress,
            `正在上传安装包... ${Math.floor(progress)}%`,
          );
        },
      );
      sendUploadProgress("deb", 100, "安装包上传完成");
      logger.info(
        "[Submitter] ============== DEB UPLOAD SUCCESSFUL ==============",
      );
      logger.info(
        { debUrl, debFileName },
        "[Submitter] Deb upload completed successfully",
      );

      logger.info(
        "[Submitter] ============== STEP 4: SUBMIT APPLICATION ==============",
      );

      const debFileStat = fs.statSync(debFilePath);

      // 参考老 Qt 投稿器：根据 deb 元数据构造 file_name: {pkgname}_{version}_{arch}.deb
      // arch 由前端解析 deb 时获取并传入，无需再次调用 dpkg-deb
      const debArch = String(dataObj.arch || "amd64");
      const pkgVersion = String(dataObj.version || "0.0.0");
      const debPkgName = String(dataObj.pkgname || "unknown");
      const formFileName = `${debPkgName}_${pkgVersion}_${debArch}.deb`;
      logger.info({ formFileName, debArch }, "[Submitter] Constructed file_name");

      const categoryName = String(dataObj.category || "");
      const categoryId = Number(dataObj.categoryId) || 0;
      logger.info(
        { categoryName, categoryId },
        "[Submitter] Category name and ID",
      );

      const tagsString = String(dataObj.tags || "");
      const tagsArray = tagsString
        ? tagsString
            .split(";")
            .map((t: string) => t.trim())
            .filter((t: string) => t)
        : [];
      logger.info({ tagsString, tagsArray }, "[Submitter] Tags conversion");

      const remark =
        ((dataObj.remark as string) || "") +
        " - (来自于投稿器_v" +
        getAppVersion() +
        ")";

      const submitData: Record<string, unknown> = {
        application_name: debPkgName,
        application_name_zh: String(dataObj.name || ""),
        contributor: String(dataObj.contributor || ""),
        icons: iconUrl,
        size: debFileStat.size,
        file_name: formFileName,
        website: String(dataObj.website || ""),
        version: pkgVersion,
        more: String(dataObj.description || ""),
        type_id: categoryId,
        author: String(dataObj.author || ""),
        remark,
        img_urls: screenshotUrls,
        deb_url: debUrl,
        mail: String(dataObj.mail || dataObj.contributor || ""),
        tags: tagsArray,
        architecture: debArch,
      };

      logger.info(
        "[Submitter] ============== VALIDATING SUBMISSION DATA ==============",
      );
      // 对齐老 Qt 投稿器 isReadySubmit() 的完整校验
      const checks: Array<{ field: keyof typeof submitData; label: string }> = [
        { field: "application_name", label: "包名" },
        { field: "application_name_zh", label: "应用名称" },
        { field: "contributor", label: "贡献者" },
        { field: "icons", label: "图标URL" },
        { field: "size", label: "文件大小" },
        { field: "file_name", label: "文件名" },
        { field: "website", label: "官网地址" },
        { field: "version", label: "版本号" },
        { field: "more", label: "应用描述" },
        { field: "type_id", label: "分类ID" },
        { field: "author", label: "作者" },
        { field: "remark", label: "测试情况" },
        { field: "deb_url", label: "安装包URL" },
        { field: "mail", label: "联系邮箱" },
      ];
      const missingFields: string[] = [];
      for (const { field, label } of checks) {
        const val = submitData[field];
        if (val === undefined || val === null || val === "" || val === 0) {
          missingFields.push(`${label}(${field})`);
        }
      }
      if (screenshotUrls.length === 0) {
        missingFields.push("截图(img_urls)");
      }
      if (tagsArray.length === 0) {
        missingFields.push("标签(tags)");
      }
      if (missingFields.length > 0) {
        logger.error({ missingFields }, "[Submitter] Missing required fields");
        return {
          success: false,
          message: `缺少必填字段: ${missingFields.join(", ")}`,
        };
      }

      logger.info(
        "[Submitter] ============== PREPARING SUBMISSION REQUEST ==============",
      );
      logger.info({ submitData }, "[Submitter] Final submission data");
      logger.info(
        `[Submitter] ============== FULL SUBMIT JSON ==============\n${JSON.stringify(submitData, null, 2)}`,
      );

      const submitterApiUrl =
        "https://upload.deepinos.org.cn/api/index/upload_application";
      logger.info({ submitterApiUrl }, "[Submitter] Submission API URL");

      logger.info(
        "[Submitter] ============== SENDING SUBMISSION REQUEST ==============",
      );
      logger.info(
        { submitterApiUrl, timestamp: new Date().toISOString() },
        "[Submitter] Submission request sent to API",
      );

      const response = await fetch(submitterApiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": getUserAgent(),
        },
        body: JSON.stringify(submitData),
      });

      const requestDuration = Date.now() - startTime;
      logger.info(
        "[Submitter] ============== SUBMISSION RESPONSE RECEIVED ==============",
      );
      logger.info(
        { status: response.status, statusText: response.statusText },
        "[Submitter] Submission response status",
      );
      logger.info(
        { duration: requestDuration },
        "[Submitter] Total submission duration (ms)",
      );

      const responseText = await response.text();
      logger.info(
        { responseTextLength: responseText.length },
        "[Submitter] Submission response text length",
      );

      if (!response.ok) {
        logger.error(
          "[Submitter] ============== SUBMISSION FAILED ==============",
        );
        logger.error(
          { status: response.status, statusText: response.statusText },
          "[Submitter] Submission failed with status",
        );
        logger.error(
          { responseText: responseText.substring(0, 2000) },
          "[Submitter] Submission API error response (full)",
        );

        let message = "提交失败";
        let apiResponse: unknown = null;

        try {
          apiResponse = JSON.parse(responseText);
          logger.error(
            { apiResponse },
            "[Submitter] Parsed API error response",
          );
        } catch (parseError) {
          logger.warn(
            { parseError: (parseError as Error)?.message },
            "[Submitter] Failed to parse error response as JSON",
          );
        }

        if (response.status === 521) {
          message = "服务器暂时不可用，请稍后重试";
        } else if (response.status === 400) {
          if (typeof apiResponse === "object" && apiResponse !== null) {
            const errorObj = apiResponse as Record<string, unknown>;
            message = String(
              errorObj.msg || errorObj.message || "请求参数错误",
            );
          } else {
            message = responseText.substring(0, 200) || "请求参数错误";
          }
        } else if (response.status === 401) {
          message = "未授权，请登录后再试";
        } else if (response.status === 403) {
          message = "权限不足";
        } else if (response.status === 429) {
          message = "请求过于频繁，请稍后重试";
        } else {
          message = `提交失败 [${response.status}]: ${responseText.substring(0, 200)}`;
        }

        logger.error(
          { finalMessage: message },
          "[Submitter] Final error message to user",
        );
        return { success: false, message, apiResponse };
      }

      let result: unknown;
      try {
        result = JSON.parse(responseText);
      } catch (parseError) {
        logger.warn(
          { parseError: (parseError as Error)?.message },
          "[Submitter] Failed to parse success response as JSON",
        );
        result = responseText;
      }

      // 检查响应体中是否有业务错误码（部分 API HTTP 200 但业务失败）
      if (result && typeof result === "object" && !Array.isArray(result)) {
        const respObj = result as Record<string, unknown>;
        if (respObj.code !== undefined && respObj.code !== 0) {
          logger.error(
            { respCode: respObj.code, respMsg: respObj.msg },
            "[Submitter] API returned business error",
          );
          return {
            success: false,
            message: String(respObj.msg || respObj.message || "提交失败"),
            apiResponse: result,
          };
        }
      }

      logger.info(
        "[Submitter] ============== SUBMISSION SUCCESSFUL ==============",
      );
      logger.info({ result }, "[Submitter] Submission API response content");
      logger.info(
        { duration: requestDuration },
        "[Submitter] Total duration (ms)",
      );

      return { success: true, data: result };
    } catch (err) {
      logger.error(
        "[Submitter] ============== EXCEPTION CAUGHT ==============",
      );
      logger.error(
        { errorType: (err as Error)?.name },
        "[Submitter] Error type",
      );
      logger.error(
        { errorMessage: (err as Error)?.message },
        "[Submitter] Error message",
      );
      logger.error(
        { errorStack: (err as Error)?.stack },
        "[Submitter] Error stack",
      );

      return {
        success: false,
        message: (err as Error)?.message || "提交失败",
      };
    }
  });

  ipcMain.handle("package-app", async (event, formData: unknown) => {
    try {
      const startTime = Date.now();
      logger.info(
        "[Submitter] ============== PACKAGE APP START ==============",
      );

      if (typeof formData !== "object" || formData === null) {
        return { success: false, message: "表单数据格式错误" };
      }

      const dataObj = formData as Record<string, unknown>;
      const pkgname = String(dataObj.pkgname || "");
      const packageName = String(dataObj.name || "");
      const packageVersion = String(dataObj.version || "");
      const packageCategory = String(dataObj.category || "");
      const packageAuthor = String(dataObj.author || "");
      const packageContributor = String(dataObj.contributor || "");
      const packageWebsite = String(dataObj.website || "");
      const packageDescription = String(dataObj.description || "");
      const packageTags = String(dataObj.tags || "");
      const debFilePath = String(dataObj.debFilePath || "");
      const iconPath = String(dataObj.iconPath || "");
      const screenshots = Array.isArray(dataObj.screenshots)
        ? dataObj.screenshots
        : [];
      const storeArch = String(dataObj.storeArch || "store");

      if (!debFilePath) return { success: false, message: "请选择 deb 文件" };
      if (!fs.existsSync(debFilePath))
        return { success: false, message: `deb 文件不存在: ${debFilePath}` };
      if (!pkgname) return { success: false, message: "包名不能为空" };

      const sendPackageProgress = (
        step: string,
        progress: number,
        message: string,
      ) => {
        try {
          event.sender.send("package-progress", {
            step,
            progress,
            message,
          });
        } catch (e) {
          logger.warn({ e }, "[Submitter] Failed to send progress event");
        }
      };

      const { exec } = await import("node:child_process");
      const util = await import("util");
      const execAsync = util.promisify(exec);

      sendPackageProgress("init", 0, "正在创建临时目录...");

      const { stdout: tempDir } = await execAsync("mktemp -d");
      const baseTempDir = tempDir.trim();
      logger.info({ baseTempDir }, "[Submitter] Temp directory created");

      const packDir = path.join(baseTempDir, packageCategory, pkgname);
      fs.mkdirSync(packDir, { recursive: true });
      logger.info({ packDir }, "[Submitter] Package directory created");

      sendPackageProgress("icon", 10, "正在处理图标...");
      logger.info({ iconPath }, "[Submitter] Processing icon...");
      if (iconPath) {
        const iconDest = path.join(packDir, "icon.png");
        if (iconPath.startsWith("http://") || iconPath.startsWith("https://")) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 10000);
          try {
            const response = await fetch(iconPath, {
              signal: controller.signal,
            });
            clearTimeout(timeout);
            if (response.ok) {
              const buffer = Buffer.from(await response.arrayBuffer());
              fs.writeFileSync(iconDest, buffer);
            } else {
              return {
                success: false,
                message: `下载图标失败: ${response.status}`,
              };
            }
          } catch (e) {
            clearTimeout(timeout);
            return {
              success: false,
              message: `下载图标失败: ${(e as Error).message}`,
            };
          }
        } else if (iconPath.startsWith("data:")) {
          const base64Data = iconPath.split(",")[1];
          if (base64Data) {
            fs.writeFileSync(iconDest, Buffer.from(base64Data, "base64"));
          } else {
            return { success: false, message: "图标数据格式错误" };
          }
        } else if (fs.existsSync(iconPath)) {
          fs.copyFileSync(iconPath, iconDest);
        } else {
          return {
            success: false,
            message: `图标文件不存在: ${iconPath}`,
          };
        }
      } else {
        return { success: false, message: "请选择应用图标" };
      }
      logger.info("[Submitter] Icon processed");

      sendPackageProgress("screenshots", 30, "正在处理截图...");
      logger.info(
        { count: screenshots.length },
        "[Submitter] Processing screenshots...",
      );
      const imgUrls: string[] = [];
      const originUrl = `https://spk-json.spark-app.store/${storeArch}/${packageCategory}/${pkgname}`;

      for (let i = 0; i < screenshots.length && i < 5; i++) {
        const screenshot = screenshots[i];
        const screenFileName = `screen_${i + 1}.png`;
        const screenFilePath = path.join(packDir, screenFileName);

        if (typeof screenshot === "string") {
          if (
            screenshot.startsWith("http://") ||
            screenshot.startsWith("https://")
          ) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            try {
              const response = await fetch(screenshot, {
                signal: controller.signal,
              });
              clearTimeout(timeout);
              if (response.ok) {
                const buffer = Buffer.from(await response.arrayBuffer());
                fs.writeFileSync(screenFilePath, buffer);
              }
            } catch {
              clearTimeout(timeout);
              logger.warn(
                { screenshot },
                "[Submitter] Failed to download screenshot, skipping",
              );
            }
          } else if (screenshot.startsWith("data:")) {
            const base64Data = screenshot.split(",")[1];
            if (base64Data) {
              fs.writeFileSync(
                screenFilePath,
                Buffer.from(base64Data, "base64"),
              );
            }
          } else if (fs.existsSync(screenshot)) {
            fs.copyFileSync(screenshot, screenFilePath);
          }
          imgUrls.push(`${originUrl}/${screenFileName}`);
        }
      }
      logger.info("[Submitter] Screenshots processed");

      sendPackageProgress("deb", 50, "正在复制安装包...");
      logger.info({ debFilePath }, "[Submitter] Processing deb package...");
      let debInfoRaw: string;
      try {
        const result = await execAsync(
          `dpkg-deb -f "${debFilePath}" Package Version Architecture`,
        );
        debInfoRaw = result.stdout;
      } catch (debErr) {
        logger.error({ debErr }, "[Submitter] dpkg-deb failed");
        return {
          success: false,
          message: `读取 deb 信息失败: ${(debErr as Error).message}`,
        };
      }
      logger.info({ debInfoRaw }, "[Submitter] dpkg-deb output");
      let debPkgName = pkgname;
      let debVersion = packageVersion;
      let debArch = "amd64";

      for (const line of debInfoRaw.trim().split("\n")) {
        const [key, ...valueParts] = line.split(":");
        const value = valueParts.join(":").trim();
        switch (key.trim()) {
          case "Package":
            debPkgName = value.toLowerCase();
            break;
          case "Version":
            debVersion = value;
            break;
          case "Architecture":
            debArch = value;
            break;
        }
      }
      logger.info(
        { debPkgName, debVersion, debArch },
        "[Submitter] Deb metadata parsed",
      );

      const packDebFileName = `${debPkgName}_${debVersion}_${debArch}.deb`;
      logger.info(
        {
          from: debFilePath,
          to: path.join(packDir, packDebFileName),
        },
        "[Submitter] Copying deb file...",
      );
      fs.copyFileSync(debFilePath, path.join(packDir, packDebFileName));
      logger.info({ packDebFileName }, "[Submitter] Deb copied");

      const debFileStat = fs.statSync(debFilePath);
      const sizeInMb = debFileStat.size / 1000 / 1000;
      const sizeStr =
        sizeInMb < 10
          ? `${Math.round(debFileStat.size / 1000)} Kb`
          : `${Math.round(sizeInMb)} Mb`;
      logger.info({ sizeStr }, "[Submitter] Deb size calculated");

      sendPackageProgress("json", 70, "正在生成 app.json...");
      logger.info("[Submitter] Generating app.json...");

      const now = new Date();
      const updateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

      const appJson = {
        Name: packageName,
        Version: packageVersion,
        Filename: packDebFileName,
        Torrent_address: `${packDebFileName}.torrent`,
        Pkgname: pkgname,
        Author: packageAuthor,
        Contributor: packageContributor,
        Website: packageWebsite,
        Update: updateStr,
        Size: sizeStr,
        More: packageDescription,
        Tags: packageTags,
        img_urls: imgUrls,
        icons: `${originUrl}/icon.png`,
      };

      fs.writeFileSync(
        path.join(packDir, "app.json"),
        JSON.stringify(appJson, null, 2),
      );
      logger.info("[Submitter] app.json written");

      sendPackageProgress("tar", 85, "正在打包 tar.gz...");
      logger.info("[Submitter] Starting tar...");

      const tarFileName = `${pkgname}-${storeArch}.tar.gz`;
      const tarOutputPath = path.join(baseTempDir, tarFileName);
      try {
        await execAsync(
          `tar czf "${tarOutputPath}" -C "${baseTempDir}" "${packageCategory}"`,
        );
        logger.info({ tarOutputPath }, "[Submitter] tar command succeeded");
      } catch (tarErr) {
        logger.error({ tarErr }, "[Submitter] tar command failed");
        return {
          success: false,
          message: `打包失败: ${(tarErr as Error).message}`,
        };
      }

      if (!fs.existsSync(tarOutputPath)) {
        return {
          success: false,
          message: "打包后的 tar.gz 文件未找到",
        };
      }

      sendPackageProgress("done", 100, "打包完成！");

      logger.info({ baseTempDir }, "[Submitter] Opening folder");
      await shell.openPath(baseTempDir);

      const duration = Date.now() - startTime;
      logger.info(
        {
          tarOutputPath: tarOutputPath,
          duration,
          tempDir: baseTempDir,
        },
        "[Submitter] Package completed successfully",
      );

      return {
        success: true,
        data: {
          tarPath: tarOutputPath,
          tempDir: baseTempDir,
          tarFileName,
        },
      };
    } catch (err) {
      logger.error(
        "[Submitter] ============== PACKAGE EXCEPTION ==============",
      );
      logger.error(
        {
          errorMessage: (err as Error)?.message,
          errorStack: (err as Error)?.stack,
        },
        "[Submitter] Exception caught",
      );
      return {
        success: false,
        message: (err as Error)?.message || "打包失败",
      };
    }
  });
}
