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

export const requestFlarumToken = async (
  payload: FlarumLoginPayload,
): Promise<FlarumTokenResponse> => {
  const data = asRecord(
    await window.ipcRenderer.invoke("request-flarum-token", payload),
  );

  return {
    token: String(data.token || ""),
    userId: String(data.userId || data.user_id || ""),
  };
};
