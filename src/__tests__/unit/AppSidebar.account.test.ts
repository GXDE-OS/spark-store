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

  it("closes the quick menu after clicking outside the account area", async () => {
    render(AppSidebar, { props: { ...baseProps, currentUser: user } });

    await fireEvent.click(screen.getByRole("button", { name: /Momen/ }));
    expect(screen.getByText("用户管理")).toBeTruthy();

    await fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("button", { name: "用户管理" })).toBeNull();
  });

  it("keeps long account names inside the sidebar account entry", () => {
    const longUser: SparkUser = {
      ...user,
      username: "SuperEndermanSMSuperEndermanSMSuperEndermanSM",
      displayName: "",
    };

    const { container } = render(AppSidebar, {
      props: { ...baseProps, currentUser: longUser },
    });

    const accountButton = screen.getByRole("button", {
      name: /SuperEndermanSM/,
    });
    const textWrapper = accountButton.querySelector(
      "[data-testid='account-text']",
    );
    const accountName = screen.getByText(longUser.username);

    expect(textWrapper?.className).toContain("min-w-0");
    expect(accountName.className).toContain("truncate");
    expect(container.textContent).toContain(longUser.username);
  });

  it.each([
    ["用户管理", "open-user-management"],
    ["我的收藏", "open-favorites"],
    ["论坛首页", "open-forum"],
    ["修改论坛资料", "edit-profile"],
    ["退出登录", "logout"],
  ] as const)(
    "closes the quick menu after selecting %s",
    async (label, eventName) => {
      const rendered = render(AppSidebar, {
        props: { ...baseProps, currentUser: user },
      });

      await fireEvent.click(screen.getByRole("button", { name: /Momen/ }));
      await fireEvent.click(screen.getByRole("button", { name: label }));

      expect(rendered.emitted(eventName)).toHaveLength(1);
      expect(screen.queryByRole("button", { name: "用户管理" })).toBeNull();
    },
  );

  it("closes the quick menu after selecting a sidebar action", async () => {
    const rendered = render(AppSidebar, {
      props: { ...baseProps, currentUser: user },
    });

    await fireEvent.click(screen.getByRole("button", { name: /Momen/ }));
    await fireEvent.click(screen.getByRole("button", { name: "应用管理" }));

    expect(rendered.emitted("list")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "用户管理" })).toBeNull();
  });
});
