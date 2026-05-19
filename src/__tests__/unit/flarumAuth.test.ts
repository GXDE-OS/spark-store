import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requestFlarumToken } from "@/modules/flarumAuth";

vi.mock("axios", () => ({
  default: {
    post: vi.fn(),
  },
}));

describe("requestFlarumToken", () => {
  beforeEach(() => {
    vi.mocked(window.ipcRenderer.invoke).mockReset();
    vi.mocked(axios.post).mockReset();
  });

  it("requests the Flarum token through main-process IPC", async () => {
    vi.mocked(window.ipcRenderer.invoke).mockResolvedValue({
      token: "forum-token",
      user_id: 42,
    });

    const payload = { identification: "user@example.com", password: "secret" };

    const token = await requestFlarumToken(payload);

    expect(window.ipcRenderer.invoke).toHaveBeenCalledWith(
      "request-flarum-token",
      payload,
    );
    expect(axios.post).not.toHaveBeenCalled();
    expect(token).toEqual({ token: "forum-token", userId: "42" });
  });

  it("rejects malformed token responses from main-process IPC", async () => {
    vi.mocked(window.ipcRenderer.invoke).mockResolvedValue({
      token: "",
      user_id: 42,
    });

    await expect(
      requestFlarumToken({ identification: "momen", password: "secret" }),
    ).rejects.toThrow("论坛登录响应异常，请稍后重试。");
  });

  it("strips Electron IPC wrapper text from known login errors", async () => {
    vi.mocked(window.ipcRenderer.invoke).mockRejectedValue(
      new Error(
        "Error invoking remote method 'request-flarum-token': Error: 无法连接星火论坛，请检查网络后重试。",
      ),
    );

    await expect(
      requestFlarumToken({ identification: "momen", password: "secret" }),
    ).rejects.toMatchObject({
      message: "无法连接星火论坛，请检查网络后重试。",
    });
  });
});
