import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import UserManagementView from "@/components/UserManagementView.vue";
import type { DownloadedAppRecord, SparkUser } from "@/global/typedefinition";

const user: SparkUser = {
  id: 1,
  flarumUserId: "123",
  username: "momen",
  displayName: "Momen",
  avatarUrl: "https://bbs.spark-app.store/avatar.png",
  forumLevel: "管理员",
  forumGroups: ["管理员"],
};

const download: DownloadedAppRecord = {
  id: 1,
  appKey: "app:office:wps",
  pkgname: "wps",
  name: "WPS",
  category: "office",
  selectedOrigin: "apm",
  version: "1.0.0",
  packageArch: "amd64",
  downloadedAt: "2026-05-18T00:00:00Z",
};

describe("UserManagementView", () => {
  it("renders profile, forum level, links, downloads, and sync preference", () => {
    render(UserManagementView, {
      props: {
        user,
        downloadedApps: [download],
        syncEnabled: true,
        loading: false,
        error: "",
        syncing: false,
        syncMessage: "",
      },
    });

    expect(screen.getByText("Momen")).toBeTruthy();
    expect(screen.getByText("管理员")).toBeTruthy();
    expect(screen.getByText("论坛首页")).toBeTruthy();
    expect(screen.getByText("修改论坛资料")).toBeTruthy();
    expect(screen.getByText("WPS")).toBeTruthy();
    expect(screen.getByLabelText("自动同步已安装应用")).toBeChecked();
  });

  it("shows manual sync progress and result feedback", async () => {
    const { rerender } = render(UserManagementView, {
      props: {
        user,
        downloadedApps: [],
        syncEnabled: false,
        loading: false,
        error: "",
        syncing: true,
        syncMessage: "",
      },
    });

    expect(screen.getByRole("button", { name: "同步中..." })).toBeDisabled();

    await rerender({ syncing: false, syncMessage: "同步完成" });

    expect(screen.getByText("同步完成")).toBeTruthy();
  });

  it("renders the forum profile cover when available", () => {
    render(UserManagementView, {
      props: {
        user: {
          ...user,
          coverUrl:
            "https://bbs.spark-app.store/assets/covers/JizZCVjiSFASrEfp.jpg",
        },
        downloadedApps: [],
        syncEnabled: false,
        loading: false,
        error: "",
        syncing: false,
        syncMessage: "",
      },
    });

    expect(screen.getByTestId("profile-cover")).toHaveStyle({
      backgroundImage:
        'url("https://bbs.spark-app.store/assets/covers/JizZCVjiSFASrEfp.jpg")',
    });
  });
});
