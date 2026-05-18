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
      },
    });

    expect(screen.getByText("Momen")).toBeTruthy();
    expect(screen.getByText("管理员")).toBeTruthy();
    expect(screen.getByText("论坛首页")).toBeTruthy();
    expect(screen.getByText("修改论坛资料")).toBeTruthy();
    expect(screen.getByText("WPS")).toBeTruthy();
    expect(screen.getByLabelText("自动同步已安装应用")).toBeChecked();
  });
});
