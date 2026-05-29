import { fireEvent, render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import ReviewUserProfileModal from "@/components/ReviewUserProfileModal.vue";
import type { ReviewUserProfile } from "@/global/typedefinition";

const profile = (
  overrides: Partial<ReviewUserProfile> = {},
): ReviewUserProfile => ({
  displayName: "Momen",
  ...overrides,
});

describe("ReviewUserProfileModal", () => {
  it("does not insert unsafe cover URLs into background image styles", () => {
    const { container } = render(ReviewUserProfileModal, {
      props: {
        show: true,
        profile: profile({ coverUrl: "javascript:alert(1)" }),
      },
    });

    expect(container.innerHTML).not.toContain("javascript:alert(1)");
    const cover = container.querySelector("[data-testid='review-user-cover']");
    expect((cover as HTMLElement | null)?.style.backgroundImage).toBe("");
  });

  it("emits close when Escape is pressed inside the dialog", async () => {
    const rendered = render(ReviewUserProfileModal, {
      props: {
        show: true,
        profile: profile(),
      },
    });

    await fireEvent.keyDown(screen.getByRole("dialog", { name: "用户资料" }), {
      key: "Escape",
    });

    expect(rendered.emitted("close")).toHaveLength(1);
  });

  it("emits the forum profile URL when opening a username profile", async () => {
    const rendered = render(ReviewUserProfileModal, {
      props: {
        show: true,
        profile: profile({ username: "momen" }),
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: "查看论坛资料" }));

    expect(rendered.emitted("open-forum-profile")?.[0]?.[0]).toMatch(
      /\/u\/momen$/,
    );
  });
});
