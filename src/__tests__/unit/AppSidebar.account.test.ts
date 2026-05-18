import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import AppSidebar from "@/components/AppSidebar.vue";
import type { SparkUser } from "@/global/typedefinition";

const baseProps = {
  activeTab: "all",
  categoryCounts: { all: 0 },
  themeMode: "auto" as const,
  storeFilter: "both" as const,
  sparkAvailable: true,
  apmAvailable: true,
  sidebarEntries: [],
  entryCounts: {},
};

const user: SparkUser = {
  id: 1,
  flarumUserId: "123",
  username: "momen",
  displayName: "Momen",
  avatarUrl: "https://bbs.spark-app.store/avatar.png",
  forumLevel: "管理员",
  forumGroups: ["管理员"],
};

describe("AppSidebar account entry", () => {
  it("prompts login when anonymous", async () => {
    const rendered = render(AppSidebar, {
      props: { ...baseProps, currentUser: null },
    });

    await fireEvent.click(screen.getByRole("button", { name: /登录 \/ 注册/ }));

    expect(rendered.emitted("request-login")).toHaveLength(1);
  });

  it("opens quick menu for logged-in users", async () => {
    render(AppSidebar, { props: { ...baseProps, currentUser: user } });

    await fireEvent.click(screen.getByRole("button", { name: /Momen/ }));

    expect(screen.getByText("用户管理")).toBeTruthy();
    expect(screen.getByText("我的收藏")).toBeTruthy();
    expect(screen.getByText("退出登录")).toBeTruthy();
  });
});
