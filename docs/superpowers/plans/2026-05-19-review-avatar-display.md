# Review Avatar Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show cached backend user avatar URLs beside comments in the app review list.

**Architecture:** Use the existing `AppReview.userAvatarUrl` field returned by the backend. `ReviewsPanel.vue` renders an avatar image when present and a stable fallback when missing or failed; tests cover the rendered avatar contract.

**Tech Stack:** Vue 3 SFC, Tailwind CSS utilities, Vitest, Testing Library Vue.

---

## File Structure

- Modify: `src/components/ReviewsPanel.vue` - render reviewer avatar/fallback in each review card and handle broken avatar images.
- Modify: `src/__tests__/unit/ReviewsPanel.test.ts` - add test coverage for avatar display.

## Task 1: Add Avatar Rendering Test

**Files:**
- Modify: `src/__tests__/unit/ReviewsPanel.test.ts`

- [ ] **Step 1: Add review with avatar test**

Append this test inside `describe("ReviewsPanel", () => { ... })` before the final closing brace:

```ts
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
    expect(avatar).toHaveAttribute("src", "https://bbs.spark-app.store/avatar.png");
  });
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- --run src/__tests__/unit/ReviewsPanel.test.ts`

Expected: FAIL because no avatar image with alt text is rendered.

## Task 2: Render Review Avatars

**Files:**
- Modify: `src/components/ReviewsPanel.vue`
- Modify: `src/__tests__/unit/ReviewsPanel.test.ts`

- [ ] **Step 1: Update review article layout**

In `src/components/ReviewsPanel.vue`, replace the review `<article>` body with this structure:

```vue
        <div class="flex gap-3">
          <img
            v-if="review.userAvatarUrl"
            :src="review.userAvatarUrl"
            :alt="`${review.userDisplayName || '星火用户'} 的头像`"
            class="h-9 w-9 flex-shrink-0 rounded-full bg-slate-100 object-cover dark:bg-slate-800"
            loading="lazy"
            referrerpolicy="no-referrer"
            @error="hideAvatar"
          />
          <div
            v-else
            class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300"
            aria-hidden="true"
          >
            {{ review.userDisplayName?.slice(0, 1) || "星" }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-3">
              <strong class="truncate text-slate-700 dark:text-slate-200">
                {{ review.userDisplayName || "星火用户" }}
              </strong>
              <span class="flex-shrink-0 text-xs text-slate-400">{{ review.rating }} 星</span>
            </div>
            <p class="mt-2 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
              {{ review.content || "暂无评论内容" }}
            </p>
          </div>
        </div>
```

- [ ] **Step 2: Add avatar error handler**

In the `<script setup>` block of `src/components/ReviewsPanel.vue`, add:

```ts
const hideAvatar = (event: Event) => {
  (event.target as HTMLElement).style.display = "none";
};
```

- [ ] **Step 3: Run focused test**

Run: `npm run test -- --run src/__tests__/unit/ReviewsPanel.test.ts`

Expected: PASS.

- [ ] **Step 4: Run build verification**

Run: `npm run build:vite`

Expected: PASS.

- [ ] **Step 5: Commit and push**

Run:

```bash
git add docs/superpowers/plans/2026-05-19-review-avatar-display.md src/components/ReviewsPanel.vue src/__tests__/unit/ReviewsPanel.test.ts
git commit -m "feat(reviews): show reviewer avatars"
git push origin Erotica
```

Expected: commit and push succeed.
