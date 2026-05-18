import { beforeEach, describe, expect, it, vi } from "vitest";

describe("authState", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it("persists and clears a backend session", async () => {
    const { authSession, currentUser, isLoggedIn, setAuthSession, logout } =
      await import("@/global/authState");

    setAuthSession({
      accessToken: "jwt",
      tokenType: "bearer",
      user: {
        id: 1,
        flarumUserId: "123",
        username: "momen",
        displayName: "Momen",
        avatarUrl: "https://bbs.spark-app.store/avatar.png",
        forumLevel: "管理员",
        forumGroups: ["管理员"],
      },
    });

    expect(authSession.value?.accessToken).toBe("jwt");
    expect(currentUser.value?.displayName).toBe("Momen");
    expect(isLoggedIn.value).toBe(true);
    expect(
      JSON.parse(localStorage.getItem("spark-store-auth") || "{}").accessToken,
    ).toBe("jwt");

    logout();

    expect(authSession.value).toBeNull();
    expect(isLoggedIn.value).toBe(false);
    expect(localStorage.getItem("spark-store-auth")).toBeNull();
  });
});
