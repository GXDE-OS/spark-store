import { fireEvent, render, screen } from "@testing-library/vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ReviewsPanel from "@/components/ReviewsPanel.vue";
import {
  createReviewReply,
  deleteReview,
  deleteReviewReply,
  fetchRatingSummary,
  fetchReviews,
  likeReview,
  likeReviewReply,
  submitReview,
} from "@/modules/backendApi";
import type {
  AppReview,
  AppReviewReply,
  RatingSummary,
  ReviewTags,
} from "@/global/typedefinition";

const emptySummary: RatingSummary = {
  averageRating: 0,
  reviewCount: 0,
  starCounts: {},
};

vi.mock("@/modules/backendApi", () => ({
  createReviewReply: vi.fn(),
  deleteReview: vi.fn(),
  deleteReviewReply: vi.fn(),
  fetchRatingSummary: vi.fn(async () => emptySummary),
  fetchReviews: vi.fn(async () => []),
  likeReview: vi.fn(),
  likeReviewReply: vi.fn(),
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

const makeReview = (overrides: Partial<AppReview>): AppReview => ({
  id: 1,
  rating: 5,
  content: "默认评价",
  version: tags.version,
  packageArch: tags.packageArch,
  clientArch: tags.clientArch,
  distro: tags.distro,
  origin: tags.origin,
  category: tags.category,
  createdAt: "2026-05-20T00:00:00Z",
  updatedAt: "2026-05-20T00:00:00Z",
  userDisplayName: "星火用户",
  userAvatarUrl: "",
  likeCount: 0,
  likedByCurrentUser: false,
  canDelete: false,
  isAuthor: false,
  isDeleted: false,
  replies: [],
  ...overrides,
});

const makeReply = (overrides: Partial<AppReviewReply>): AppReviewReply => ({
  id: 101,
  reviewId: 1,
  parentId: null,
  content: "默认回复",
  createdAt: "2026-05-20T00:00:00Z",
  updatedAt: "2026-05-20T00:00:00Z",
  userDisplayName: "回复用户",
  userAvatarUrl: "",
  likeCount: 0,
  likedByCurrentUser: false,
  canDelete: false,
  isAuthor: false,
  isDeleted: false,
  replies: [],
  ...overrides,
});

describe("ReviewsPanel", () => {
  beforeEach(() => {
    vi.mocked(fetchRatingSummary).mockReset();
    vi.mocked(fetchReviews).mockReset();
    vi.mocked(submitReview).mockReset();
    vi.mocked(likeReview).mockReset();
    vi.mocked(createReviewReply).mockReset();
    vi.mocked(deleteReview).mockReset();
    vi.mocked(likeReviewReply).mockReset();
    vi.mocked(deleteReviewReply).mockReset();
    vi.mocked(fetchRatingSummary).mockResolvedValue(emptySummary);
    vi.mocked(fetchReviews).mockResolvedValue([]);
    vi.mocked(likeReview).mockResolvedValue({
      likedByCurrentUser: true,
      likeCount: 1,
    });
    vi.mocked(createReviewReply).mockResolvedValue(makeReply({}));
    vi.mocked(deleteReview).mockResolvedValue(undefined);
    vi.mocked(likeReviewReply).mockResolvedValue({
      likedByCurrentUser: true,
      likeCount: 1,
    });
    vi.mocked(deleteReviewReply).mockResolvedValue(undefined);
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

  it("shows a re-login prompt when loading reviews with a stale token", async () => {
    vi.mocked(fetchRatingSummary).mockRejectedValueOnce(
      new Error("Request failed with status code 401"),
    );

    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    expect(
      await screen.findByText("登录状态已失效，请重新登录星火账号。"),
    ).toBeTruthy();
  });

  it("submits the rating selected by sliding over stars", async () => {
    vi.mocked(submitReview).mockResolvedValueOnce(
      makeReview({ rating: 3, content: "一般" }),
    );
    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    const slider = screen.getByRole("slider", { name: "评分" });
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 500,
      height: 40,
      top: 0,
      left: 0,
      right: 500,
      bottom: 40,
      toJSON: () => ({}),
    });

    const pointerDown = new MouseEvent("pointerdown", {
      bubbles: true,
      clientX: 250,
    });
    const pointerMove = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 250,
    });
    const pointerUp = new MouseEvent("pointerup", {
      bubbles: true,
      clientX: 250,
    });
    Object.defineProperty(pointerDown, "pointerId", { value: 1 });
    Object.defineProperty(pointerMove, "pointerId", { value: 1 });
    Object.defineProperty(pointerUp, "pointerId", { value: 1 });

    await fireEvent(slider, pointerDown);
    await fireEvent(slider, pointerMove);
    await fireEvent(slider, pointerUp);
    await fireEvent.update(
      screen.getByPlaceholderText("分享你的使用体验"),
      "一般",
    );
    await fireEvent.click(screen.getByRole("button", { name: "发表评论" }));

    expect(submitReview).toHaveBeenCalledWith(
      "apm:amd64-apm:office:wps",
      expect.objectContaining({ rating: 3 }),
    );
  });

  it("updates rating preview from hovering over the star hitbox", async () => {
    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    const slider = screen.getByRole("slider", { name: "评分" });
    vi.spyOn(slider, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      width: 500,
      height: 40,
      top: 0,
      left: 0,
      right: 500,
      bottom: 40,
      toJSON: () => ({}),
    });

    const pointerMove = new MouseEvent("pointermove", {
      bubbles: true,
      clientX: 250,
    });
    Object.defineProperty(pointerMove, "pointerId", { value: 1 });

    await fireEvent(slider, pointerMove);

    expect(slider).toHaveAttribute("aria-valuenow", "3");
  });

  it("does not include a trailing rating label in the star slider hitbox", () => {
    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    const slider = screen.getByRole("slider", { name: "评分" });

    expect(slider).not.toHaveTextContent("星");
    expect(slider).not.toHaveClass("border");
    expect(slider).not.toHaveClass("bg-amber-50");
  });

  it("supports keyboard changes for the sliding star rating", async () => {
    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    const slider = screen.getByRole("slider", { name: "评分" });
    await fireEvent.keyDown(slider, { key: "ArrowLeft" });
    await fireEvent.keyDown(slider, { key: "ArrowLeft" });

    expect(slider).toHaveAttribute("aria-valuenow", "3");
  });

  it("filters loaded reviews by package architecture and distro", async () => {
    vi.mocked(fetchReviews).mockResolvedValue([
      {
        id: 11,
        rating: 5,
        content: "amd64 deepin",
        version: tags.version,
        packageArch: "amd64",
        clientArch: tags.clientArch,
        distro: "deepin 25",
        origin: tags.origin,
        category: tags.category,
        createdAt: "2026-05-20T00:00:00Z",
        updatedAt: "2026-05-20T00:00:00Z",
        userDisplayName: "Deepin User",
        userAvatarUrl: "",
      },
      {
        id: 12,
        rating: 4,
        content: "arm64 gxde",
        version: tags.version,
        packageArch: "arm64",
        clientArch: tags.clientArch,
        distro: "GXDE OS 25",
        origin: tags.origin,
        category: tags.category,
        createdAt: "2026-05-20T00:00:00Z",
        updatedAt: "2026-05-20T00:00:00Z",
        userDisplayName: "GXDE User",
        userAvatarUrl: "",
      },
    ]);

    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    expect(await screen.findByText("amd64 deepin")).toBeTruthy();
    expect(screen.getByText("arm64 gxde")).toBeTruthy();

    await fireEvent.change(screen.getByLabelText("按架构筛选"), {
      target: { value: "arm64" },
    });

    expect(screen.queryByText("amd64 deepin")).toBeNull();
    expect(screen.getByText("arm64 gxde")).toBeTruthy();

    await fireEvent.change(screen.getByLabelText("按架构筛选"), {
      target: { value: "" },
    });
    await fireEvent.change(screen.getByLabelText("按发行版筛选"), {
      target: { value: "GXDE OS 25" },
    });

    expect(screen.queryByText("amd64 deepin")).toBeNull();
    expect(screen.getByText("arm64 gxde")).toBeTruthy();
  });

  it("resets stale review filters when the app key changes", async () => {
    vi.mocked(fetchReviews)
      .mockResolvedValueOnce([
        makeReview({ id: 21, content: "first amd64", packageArch: "amd64" }),
        makeReview({
          id: 22,
          content: "first arm64",
          packageArch: "arm64",
          distro: "GXDE OS 25",
        }),
      ])
      .mockResolvedValueOnce([
        makeReview({
          id: 23,
          content: "second only amd64",
          packageArch: "amd64",
        }),
      ]);

    const rendered = render(ReviewsPanel, {
      props: { appKey: "first", tags, loggedIn: true },
    });

    expect(await screen.findByText("first amd64")).toBeTruthy();
    await fireEvent.change(screen.getByLabelText("按架构筛选"), {
      target: { value: "arm64" },
    });
    expect(screen.queryByText("first amd64")).toBeNull();
    expect(screen.getByText("first arm64")).toBeTruthy();

    await rendered.rerender({ appKey: "second", tags, loggedIn: true });

    expect(await screen.findByText("second only amd64")).toBeTruthy();
    expect(screen.queryByText("没有符合筛选条件的评价")).toBeNull();
  });

  it("exposes reviewer detail affordances from avatar and name buttons", async () => {
    vi.mocked(fetchReviews).mockResolvedValue([
      makeReview({
        id: 31,
        content: "用户资料入口",
        userDisplayName: "Detail User",
      }),
    ]);
    const { emitted } = render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    await fireEvent.click(
      await screen.findByRole("button", { name: "查看Detail User的资料" }),
    );
    expect(screen.getByText("正在查看 Detail User 的资料")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "Detail User" }));
    expect(emitted()["show-user"]).toHaveLength(2);
  });

  it("calls backend review actions and only shows delete from backend metadata", async () => {
    vi.mocked(fetchReviews).mockResolvedValue([
      makeReview({ id: 41, content: "普通评价", userDisplayName: "Reader" }),
      makeReview({
        id: 42,
        content: "作者评价",
        userDisplayName: "Author",
        isAuthor: true,
        canDelete: true,
      }),
    ]);

    const rendered = render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    expect(await screen.findByText("普通评价")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "点赞" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "回复" })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "删除" })).toHaveLength(1);

    await fireEvent.click(screen.getAllByRole("button", { name: "点赞" })[0]);
    expect(likeReview).toHaveBeenCalledWith("apm:amd64-apm:office:wps", 41);
    expect(fetchReviews).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("作者评价")).toBeTruthy();

    await fireEvent.click(screen.getAllByRole("button", { name: "删除" })[0]);
    expect(deleteReview).toHaveBeenCalledWith("apm:amd64-apm:office:wps", 42);

    await rendered.rerender({
      appKey: "apm:amd64-apm:office:wps",
      tags,
      loggedIn: true,
      currentUserIsAdmin: true,
    });

    expect(screen.getAllByRole("button", { name: "删除" })).toHaveLength(1);
  });

  it("creates review replies and nested replies through backend APIs", async () => {
    vi.mocked(fetchReviews).mockResolvedValue([
      makeReview({
        id: 51,
        content: "可回复评价",
        replies: [
          makeReply({
            id: 151,
            reviewId: 51,
            content: "已有回复",
            replies: [
              makeReply({
                id: 152,
                reviewId: 51,
                parentId: 151,
                content: "已有二级回复",
              }),
            ],
          }),
        ],
      }),
    ]);
    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    await fireEvent.click(
      (await screen.findAllByRole("button", { name: "回复" }))[0],
    );
    expect(screen.getByText("已有二级回复")).toBeTruthy();
    await fireEvent.update(
      screen.getByPlaceholderText("写下你的回复"),
      "一级回复",
    );
    await fireEvent.click(screen.getByRole("button", { name: "发送回复" }));

    expect(createReviewReply).toHaveBeenCalledWith(
      "apm:amd64-apm:office:wps",
      51,
      { content: "一级回复" },
    );
    expect(await screen.findByText("已有回复")).toBeTruthy();

    await fireEvent.click(screen.getAllByRole("button", { name: "回复" })[1]);
    await fireEvent.update(
      screen.getByPlaceholderText("写下你的回复"),
      "二级回复",
    );
    await fireEvent.click(screen.getByRole("button", { name: "发送回复" }));

    expect(createReviewReply).toHaveBeenCalledWith(
      "apm:amd64-apm:office:wps",
      51,
      { content: "二级回复", parentId: 151 },
    );
  });

  it("calls backend reply actions and shows permission errors", async () => {
    vi.mocked(deleteReview).mockRejectedValueOnce(
      new Error("请登录星火账号后重试。"),
    );
    vi.mocked(fetchReviews).mockResolvedValue([
      makeReview({
        id: 61,
        content: "带回复评价",
        canDelete: true,
        replies: [
          makeReply({
            id: 161,
            reviewId: 61,
            content: "可操作回复",
            canDelete: true,
          }),
        ],
      }),
    ]);
    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    expect(await screen.findByText("可操作回复")).toBeTruthy();

    await fireEvent.click(screen.getAllByRole("button", { name: "点赞" })[1]);
    expect(likeReviewReply).toHaveBeenCalledWith(
      "apm:amd64-apm:office:wps",
      61,
      161,
    );
    expect(await screen.findByText("可操作回复")).toBeTruthy();

    await fireEvent.click(screen.getAllByRole("button", { name: "删除" })[0]);
    expect(await screen.findByText("请登录星火账号后重试。"));

    await fireEvent.click(screen.getAllByRole("button", { name: "删除" })[1]);
    expect(deleteReviewReply).toHaveBeenCalledWith(
      "apm:amd64-apm:office:wps",
      61,
      161,
    );
  });

  it("preserves stale-token prompts from review action failures", async () => {
    vi.mocked(likeReview).mockRejectedValueOnce(
      new Error("登录状态已失效，请重新登录星火账号。"),
    );
    vi.mocked(fetchReviews).mockResolvedValue([
      makeReview({ id: 71, content: "旧登录态评价" }),
    ]);

    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    expect(await screen.findByText("旧登录态评价")).toBeTruthy();

    await fireEvent.click(screen.getByRole("button", { name: "点赞" }));

    expect(
      await screen.findByText("登录状态已失效，请重新登录星火账号。"),
    ).toBeTruthy();
  });

  it("shows reviewer avatars when available", async () => {
    vi.mocked(fetchRatingSummary).mockResolvedValue({
      averageRating: 5,
      reviewCount: 1,
      starCounts: { 5: 1 },
    });
    vi.mocked(fetchReviews).mockResolvedValue([
      {
        id: 3,
        rating: 5,
        content: "头像正常显示",
        version: tags.version,
        packageArch: tags.packageArch,
        clientArch: tags.clientArch,
        distro: tags.distro,
        origin: tags.origin,
        category: tags.category,
        createdAt: "2026-05-19T00:00:00Z",
        updatedAt: "2026-05-19T00:00:00Z",
        userDisplayName: "Avatar User",
        userAvatarUrl: "https://bbs.spark-app.store/avatar.png",
      },
    ]);

    render(ReviewsPanel, {
      props: { appKey: "apm:amd64-apm:office:wps", tags, loggedIn: true },
    });

    const avatar = await screen.findByAltText("Avatar User 的头像");
    expect(avatar).toHaveAttribute(
      "src",
      "https://bbs.spark-app.store/avatar.png",
    );
  });
});
