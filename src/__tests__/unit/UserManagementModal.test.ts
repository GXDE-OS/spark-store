import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import UserManagementModal from "@/components/UserManagementModal.vue";
import type { SparkUser } from "@/global/typedefinition";

const user: SparkUser = {
  id: 1,
  flarumUserId: "42",
  username: "momen",
  displayName: "Momen",
  avatarUrl: "https://bbs.spark-app.store/avatar.png",
  coverUrl: "https://bbs.spark-app.store/assets/covers/JizZCVjiSFASrEfp.jpg",
  forumLevel: "管理员",
  forumGroups: ["管理员"],
};

describe("UserManagementModal", () => {
  it("renders account management in an independent iframe without token query params", () => {
    render(UserManagementModal, {
      props: {
        show: true,
        user,
        downloadedApps: [],
        syncEnabled: true,
        loading: false,
        error: "",
      },
    });

    const frame = screen.getByTitle("星火账号用户管理") as HTMLIFrameElement;
    expect(frame).toBeTruthy();
    expect(frame.src).toContain("account.spark-app.store");
    expect(frame.src).toContain("/account");
    expect(frame.src).not.toMatch(/token|jwt|password|access/i);
  });

  it("shows retry controls when iframe reports a load failure", async () => {
    render(UserManagementModal, {
      props: {
        show: true,
        user,
        downloadedApps: [],
        syncEnabled: true,
        loading: false,
        error: "",
      },
    });

    await fireEvent.error(screen.getByTitle("星火账号用户管理"));

    expect(screen.getByText("账号页面加载失败")).toBeTruthy();
    expect(screen.getByRole("button", { name: "重试" })).toBeTruthy();
  });
});
