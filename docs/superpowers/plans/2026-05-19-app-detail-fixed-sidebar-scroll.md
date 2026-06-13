# App Detail Fixed Sidebar Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the app detail modal's left action/meta column fixed on desktop while the right detail/review column scrolls independently.

**Architecture:** Reuse the existing `AppDetailModal.vue` popup and change only its internal layout classes/markers. The modal panel becomes a bounded, non-scrolling shell on desktop, while the right column becomes the desktop scroll container; mobile keeps the single-column scroll behavior.

**Tech Stack:** Vue 3 SFC, Tailwind CSS utilities, Vitest, Testing Library Vue.

---

## File Structure

- Modify: `src/components/AppDetailModal.vue` - adjust modal shell, left column, right scroll column, and scroll reset target.
- Modify: `src/__tests__/unit/AppDetailModal.test.ts` - assert modal shell and scroll column contract.

## Task 1: Add Layout Contract Test

**Files:**
- Modify: `src/__tests__/unit/AppDetailModal.test.ts`

- [ ] **Step 1: Add assertions to the popup modal test**

In `src/__tests__/unit/AppDetailModal.test.ts`, update `renders detail content inside a popup-style modal overlay` so the body after the `.modal-panel` assertion is:

```ts
    const panel = overlay?.querySelector(".modal-panel");
    expect(panel).toBeTruthy();
    expect(panel?.className).toContain("overflow-hidden");
    expect(panel?.className).toContain("lg:max-h-[85vh]");
    expect(panel?.querySelector('[data-testid="detail-fixed-sidebar"]')).toBeTruthy();
    expect(panel?.querySelector('[data-testid="detail-scroll-content"]')).toBeTruthy();
    expect(
      panel?.querySelector('[data-testid="detail-scroll-content"]')?.className,
    ).toContain("lg:overflow-y-auto");
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm run test -- --run src/__tests__/unit/AppDetailModal.test.ts`

Expected: FAIL because `data-testid="detail-fixed-sidebar"`, `data-testid="detail-scroll-content"`, and the new modal classes are not present.

## Task 2: Implement Fixed Sidebar Layout

**Files:**
- Modify: `src/components/AppDetailModal.vue`
- Modify: `src/__tests__/unit/AppDetailModal.test.ts`

- [ ] **Step 1: Update modal shell classes**

In `src/components/AppDetailModal.vue`, change the `.modal-panel` class from:

```vue
class="modal-panel relative w-full max-w-5xl max-h-[85vh] overflow-y-auto overscroll-contain scrollbar-nowidth rounded-3xl border border-white/10 bg-white/95 px-6 pb-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
```

to:

```vue
class="modal-panel relative flex w-full max-w-5xl max-h-[85vh] overflow-y-auto overscroll-contain scrollbar-nowidth rounded-3xl border border-white/10 bg-white/95 px-6 pb-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900 lg:max-h-[85vh] lg:overflow-hidden lg:pb-0"
```

- [ ] **Step 2: Move the return button into the fixed sidebar**

In `src/components/AppDetailModal.vue`, replace the top-level return button and main layout start with:

```vue
        <!-- 主布局：左侧信息 + 右侧内容 -->
        <div class="flex w-full flex-col gap-6 lg:min-h-0 lg:flex-row">
          <!-- 左侧：图标、版本、来源、按钮、元信息 -->
          <div
            data-testid="detail-fixed-sidebar"
            class="w-full flex-shrink-0 space-y-5 lg:w-72 lg:self-start lg:py-4"
          >
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full border border-slate-200/70 bg-white/90 px-4 py-2 text-sm font-medium text-slate-600 shadow-lg backdrop-blur-sm transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/90 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              @click="closeModal"
              aria-label="返回"
            >
              <i class="fas fa-arrow-left"></i>
              <span>返回</span>
            </button>
```

Remove the old sticky top-level return button and the old left column opening:

```vue
        <!-- 返回按钮 - sticky定位在模态框内部左上角，滚动时始终可见 -->
        <button ...>...</button>

        <!-- 主布局：左侧信息 + 右侧内容 -->
        <div class="flex flex-col lg:flex-row gap-6">
          <!-- 左侧：图标、版本、来源、按钮、元信息 -->
          <div class="w-full lg:w-72 flex-shrink-0 space-y-5">
```

- [ ] **Step 3: Make the right column the desktop scroll container**

In `src/components/AppDetailModal.vue`, change the right column opening from:

```vue
          <div class="flex-1 min-w-0 space-y-5">
```

to:

```vue
          <div
            data-testid="detail-scroll-content"
            class="min-w-0 flex-1 space-y-5 lg:max-h-[85vh] lg:overflow-y-auto lg:overscroll-contain lg:py-4 lg:pr-2"
          >
```

- [ ] **Step 4: Update scroll reset target if needed**

In `src/App.vue`, keep the existing modal scroll reset selector if it still points at `.modal-panel`. If the right column needs reset instead, change the query to:

```ts
const modal = document.querySelector(
  '[data-app-modal="detail"] [data-testid="detail-scroll-content"]',
);
```

Use `modal.scrollTop = 0` as it does today.

- [ ] **Step 5: Run focused test**

Run: `npm run test -- --run src/__tests__/unit/AppDetailModal.test.ts`

Expected: PASS.

- [ ] **Step 6: Run build verification**

Run: `npm run build:vite`

Expected: PASS.

- [ ] **Step 7: Commit implementation**

Run:

```bash
git add src/components/AppDetailModal.vue src/App.vue src/__tests__/unit/AppDetailModal.test.ts
git commit -m "fix(ui): pin detail modal sidebar"
```

Expected: commit succeeds.
