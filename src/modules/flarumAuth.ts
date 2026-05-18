import axios from "axios";

import { FLARUM_BASE_URL } from "@/global/storeConfig";
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
  const response = await axios.post(`${FLARUM_BASE_URL}/api/token`, payload);
  const data = asRecord(response.data);

  return {
    token: String(data.token || ""),
    userId: String(data.userId || data.user_id || ""),
  };
};
