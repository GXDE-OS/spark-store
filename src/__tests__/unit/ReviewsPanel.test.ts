import { fireEvent, render, screen } from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReviewsPanel from "@/components/ReviewsPanel.vue";
import {
  fetchRatingSummary,
  fetchReviews,
  submitReview,
} from "@/modules/backendApi";
import type {
  AppReview,
  RatingSummary,
  ReviewTags,
} from "@/global/typedefinition";

const emptySummary: RatingSummary = {
  averageRating: 0,
  reviewCount: 0,
  starCounts: {},
};

vi.mock("@/modules/backendApi", () => ({
  fetchRatingSummary: vi.fn(async () => emptySummary),
  fetchReviews: vi.fn(async () => []),
  submitReview: vi.fn(),
}));

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
  beforeEach(() => {
    vi.mocked(fetchRatingSummary).mockReset();
    vi.mocked(fetchReviews).mockReset();
    vi.mocked(submitReview).mockReset();
    vi.mocked(fetchRatingSummary).mockResolvedValue(emptySummary);
    vi.mocked(fetchReviews).mockResolvedValue([]);
  });

  it("shows anonymous login prompt and read-only review tags", () => {
    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: false },
    });

    expect(screen.getByText("登录后发表评论")).toBeTruthy();
    expect(screen.getByText("1.0.0")).toBeTruthy();
    expect(screen.getByText("deepin 25")).toBeTruthy();
    expect(fetchRatingSummary).not.toHaveBeenCalled();
    expect(fetchReviews).not.toHaveBeenCalled();
  });

  it("hides the submit form when reviews are read-only", () => {
    render(ReviewsPanel, {
      props: {
        appKey: "apm:amd64-apm:office:wps",
        tags,
        loggedIn: true,
        canSubmit: false,
      },
    });

    expect(screen.queryByRole("button", { name: "发表评论" })).toBeNull();
    expect(screen.getByText("安装应用后可发表评论。")).toBeTruthy();
  });

  it("ignores stale review responses after app key changes", async () => {
    let resolveFirstSummary!: (summary: RatingSummary) => void;
    let resolveFirstReviews!: (reviews: AppReview[]) => void;
    let resolveSecondSummary!: (summary: RatingSummary) => void;
    let resolveSecondReviews!: (reviews: AppReview[]) => void;

    vi.mocked(fetchRatingSummary)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstSummary = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecondSummary = resolve;
        }),
      );
    vi.mocked(fetchReviews)
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveFirstReviews = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSecondReviews = resolve;
        }),
      );

    const rendered = render(ReviewsPanel, {
      props: { appKey: "first", tags, loggedIn: true },
    });

    await rendered.rerender({ appKey: "second", tags, loggedIn: true });

    resolveSecondSummary({ averageRating: 5, reviewCount: 1, starCounts: {} });
    resolveSecondReviews([
      {
        id: 2,
        rating: 5,
        content: "second review",
        version: tags.version,
        packageArch: tags.packageArch,
        clientArch: tags.clientArch,
        distro: tags.distro,
        origin: tags.origin,
        category: tags.category,
        createdAt: "2026-05-18T00:00:00Z",
        updatedAt: "2026-05-18T00:00:00Z",
        userDisplayName: "Second User",
        userAvatarUrl: "",
      },
    ]);

    expect(await screen.findByText("second review")).toBeTruthy();
    expect(screen.getByText("5.0 / 5 (1)")).toBeTruthy();

    resolveFirstSummary({ averageRating: 1, reviewCount: 1, starCounts: {} });
    resolveFirstReviews([
      {
        id: 1,
        rating: 1,
        content: "first review",
        version: tags.version,
        packageArch: tags.packageArch,
        clientArch: tags.clientArch,
        distro: tags.distro,
        origin: tags.origin,
        category: tags.category,
        createdAt: "2026-05-18T00:00:00Z",
        updatedAt: "2026-05-18T00:00:00Z",
        userDisplayName: "First User",
        userAvatarUrl: "",
      },
    ]);

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByText("second review")).toBeTruthy();
    expect(screen.getByText("5.0 / 5 (1)")).toBeTruthy();
    expect(screen.queryByText("first review")).toBeNull();
    expect(screen.queryByText("1.0 / 5 (1)")).toBeNull();
  });

  it("shows a friendly submit error instead of raw network errors", async () => {
    vi.mocked(submitReview).mockRejectedValueOnce(new Error("Network Error"));
    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    await fireEvent.update(
      screen.getByPlaceholderText("分享你的使用体验"),
      "好用",
    );
    await fireEvent.click(screen.getByRole("button", { name: "发表评论" }));

    expect(
      await screen.findByText("无法连接星火账号服务，请稍后重试。"),
    ).toBeTruthy();
  });
});
