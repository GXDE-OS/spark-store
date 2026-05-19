import type { FlarumLoginPayload } from "@/global/typedefinition";

type FlarumTokenResponse = {
  token: string;
  userId: string;
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const knownLoginErrorMessages = [
  "无法连接星火论坛，请检查网络后重试。",
  "论坛登录失败，请检查账号和密码。",
  "论坛登录响应异常，请稍后重试。",
  "登录信息格式不正确，请重新输入。",
];

const normalizeIpcError = (error: unknown): Error => {
  if (!(error instanceof Error)) {
    return new Error("登录失败，请稍后重试");
  }

  const knownMessage = knownLoginErrorMessages.find((message) =>
    error.message.includes(message),
  );
  return knownMessage ? new Error(knownMessage) : error;
};

export const requestFlarumToken = async (
  payload: FlarumLoginPayload,
): Promise<FlarumTokenResponse> => {
  let data: Record<string, unknown>;
  try {
    data = asRecord(
      await window.ipcRenderer.invoke("request-flarum-token", payload),
    );
  } catch (error) {
    throw normalizeIpcError(error);
  }

  const token = data.token;
  const userId = data.userId ?? data.user_id;
  if (
    typeof token !== "string" ||
    !token ||
    userId === undefined ||
    userId === null
  ) {
    throw new Error("论坛登录响应异常，请稍后重试。");
  }

  return {
    token,
    userId: String(userId),
  };
};
