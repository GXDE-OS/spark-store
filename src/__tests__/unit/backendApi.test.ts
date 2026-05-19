import axios from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { exchangeFlarumToken, submitReview } from "@/modules/backendApi";

const axiosMocks = vi.hoisted(() => {
  const post = vi.fn();
  return {
    instance: {
      defaults: { headers: { common: {} as Record<string, unknown> } },
      get: vi.fn(),
      post,
    },
    post,
  };
});

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => axiosMocks.instance),
    isAxiosError: (error: unknown) =>
      Boolean((error as { isAxiosError?: boolean }).isAxiosError),
  },
}));

vi.mock("pino", () => ({
  default: () => loggerMocks,
}));

describe("backend API auth exchange", () => {
  beforeEach(() => {
    vi.mocked(axios.create).mockClear();
    axiosMocks.post.mockReset();
    loggerMocks.error.mockReset();
  });

  it("maps backend connection failures to a user-actionable login error", async () => {
    const error = Object.assign(new Error("Network Error"), {
      code: "ERR_NETWORK",
      isAxiosError: true,
      request: {},
    });
    axiosMocks.post.mockRejectedValue(error);

    await expect(
      exchangeFlarumToken({ flarumUserId: "42", flarumToken: "forum-token" }),
    ).rejects.toThrow("无法连接星火账号服务，请确认后端服务已启动或稍后重试。");
    expect(loggerMocks.error).toHaveBeenCalledWith(
      {
        code: "ERR_NETWORK",
        message: "Network Error",
        status: undefined,
      },
      "Spark backend auth exchange failed",
    );
    expect(JSON.stringify(loggerMocks.error.mock.calls)).not.toContain(
      "forum-token",
    );
  });

  it("maps backend server failures to an update-required login error", async () => {
    const error = Object.assign(
      new Error("Request failed with status code 500"),
      {
        isAxiosError: true,
        response: { status: 500 },
      },
    );
    axiosMocks.post.mockRejectedValue(error);

    await expect(
      exchangeFlarumToken({ flarumUserId: "42", flarumToken: "forum-token" }),
    ).rejects.toThrow("星火账号服务异常，请确认后端数据库迁移已执行后重试。");
  });

  it("maps review submission connection failures to a friendly error", async () => {
    const error = Object.assign(new Error("Network Error"), {
      code: "ERR_NETWORK",
      isAxiosError: true,
      request: {},
    });
    axiosMocks.post.mockRejectedValue(error);

    await expect(
      submitReview("apm:amd64-apm:office:wps", {
        rating: 5,
        content: "好用",
        tags: {
          origin: "apm",
          category: "office",
          pkgname: "wps",
          version: "1.0.0",
          packageArch: "amd64",
          clientArch: "amd64",
          distro: "deepin 25",
        },
      }),
    ).rejects.toThrow("无法连接星火账号服务，请稍后重试。");
  });
});
