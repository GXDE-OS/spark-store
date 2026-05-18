import { render, screen } from "@testing-library/vue";
import { describe, expect, it } from "vitest";

import ReviewsPanel from "@/components/ReviewsPanel.vue";
import type { ReviewTags } from "@/global/typedefinition";

const tags: ReviewTags = {
  origin: "apm",
  category: "office",
  pkgname: "wps",
  version: "1.0.0",
  packageArch: "amd64",
  clientArch: "amd64",
  distro: "deepin 25",
};

describe("ReviewsPanel", () => {
  it("shows anonymous login prompt and read-only review tags", () => {
    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: false },
    });

    expect(screen.getByText("登录后发表评论")).toBeTruthy();
    expect(screen.getByText("1.0.0")).toBeTruthy();
    expect(screen.getByText("deepin 25")).toBeTruthy();
  });
});
