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
});
