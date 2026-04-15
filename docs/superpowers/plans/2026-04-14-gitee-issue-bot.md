# Gitee Issue Bot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a user-level `systemd`-driven issue bot that checks Spark Store Gitee issues every 6 hours, stores one ranked candidate locally, and only launches a new opencode window after explicit manual approval.

**Architecture:** Keep the implementation outside the Electron runtime by adding a small TypeScript script set under `scripts/issue-bot/`, with focused helpers for Gitee fetching, ranking, local state, approval, and opencode launching. Use user-cache state storage plus `systemd --user` service/timer units, and pass the `~/Desktop/spark-store` + `Erotica`-based worktree requirement into the generated opencode prompt instead of creating worktrees during polling.

**Tech Stack:** Node.js 22 with `--experimental-strip-types`, TypeScript strict mode, built-in `fetch`, Vitest, npm scripts, `systemd --user` units.

---

## File Map

- Create: `scripts/issue-bot/lib/types.ts` — shared strict TypeScript types for normalized issues, ranking results, and persisted state.
- Create: `scripts/issue-bot/lib/state.ts` — state file path resolution, JSON load/save, corruption backup, and default-state initialization.
- Create: `scripts/issue-bot/lib/ranking.ts` — issue filtering, heuristic scoring, and candidate selection.
- Create: `scripts/issue-bot/lib/gitee.ts` — fetch open issues from Gitee API first and normalize the response.
- Create: `scripts/issue-bot/lib/opencode.ts` — build approval prompt and spawn a configured opencode command.
- Create: `scripts/issue-bot/check-issues.ts` — one-shot polling entrypoint that updates `currentCandidate`.
- Create: `scripts/issue-bot/approve-issue.ts` — manual approval entrypoint that launches opencode and marks the approved issue.
- Create: `src/__tests__/unit/issue-bot/state.test.ts` — state initialization, backup, and save/load tests.
- Create: `src/__tests__/unit/issue-bot/ranking.test.ts` — scoring, filtering, and candidate selection tests.
- Create: `src/__tests__/unit/issue-bot/check-issues.test.ts` — polling orchestration tests using mocked fetch/state.
- Create: `src/__tests__/unit/issue-bot/approve-issue.test.ts` — approval and opencode-launch orchestration tests.
- Create: `src/__tests__/unit/issue-bot/packaging.test.ts` — npm script and systemd unit smoke tests.
- Modify: `package.json` — add `issue-bot:check` and `issue-bot:approve` scripts.
- Modify: `tsconfig.node.json` — include `scripts` for type-check coverage in build tooling.
- Create: `extras/systemd/spark-store-issue-bot.service` — `oneshot` user service for polling.
- Create: `extras/systemd/spark-store-issue-bot.timer` — six-hour persistent timer.

### Task 1: Add Shared Types and Local State Storage

**Files:**

- Create: `scripts/issue-bot/lib/types.ts`
- Create: `scripts/issue-bot/lib/state.ts`
- Test: `src/__tests__/unit/issue-bot/state.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createDefaultIssueBotState,
  getIssueBotStatePath,
  loadIssueBotState,
  saveIssueBotState,
} from "../../../../scripts/issue-bot/lib/state";

describe("issue-bot state", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.XDG_CACHE_HOME;
  });

  it("uses the XDG cache directory when available", () => {
    process.env.XDG_CACHE_HOME = "/tmp/spark-cache";

    expect(getIssueBotStatePath()).toBe(
      "/tmp/spark-cache/spark-store/issue-bot/state.json",
    );
  });

  it("returns a default state when the file does not exist", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    expect(loadIssueBotState()).toEqual(createDefaultIssueBotState());
  });

  it("backs up invalid JSON and resets to the default state", () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue("not-json");
    const renameSync = vi.spyOn(fs, "renameSync").mockImplementation(() => {});

    expect(loadIssueBotState()).toEqual(createDefaultIssueBotState());
    expect(renameSync).toHaveBeenCalledWith(
      expect.stringContaining("state.json"),
      expect.stringContaining("state.json.bak-"),
    );
  });

  it("creates parent directories before saving state", () => {
    const mkdirSync = vi
      .spyOn(fs, "mkdirSync")
      .mockImplementation(() => undefined);
    const writeFileSync = vi
      .spyOn(fs, "writeFileSync")
      .mockImplementation(() => undefined);

    saveIssueBotState({
      ...createDefaultIssueBotState(),
      lastRunStatus: "success",
      lastRunMessage: "candidate updated",
    });

    expect(mkdirSync).toHaveBeenCalledWith(
      path.dirname(getIssueBotStatePath()),
      { recursive: true },
    );
    expect(writeFileSync).toHaveBeenCalledWith(
      getIssueBotStatePath(),
      expect.stringContaining('"lastRunStatus": "success"'),
      "utf8",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/state.test.ts`

Expected: FAIL with `Cannot find module '../../../../scripts/issue-bot/lib/state'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/issue-bot/lib/types.ts
export interface NormalizedIssue {
  id: number;
  number: string;
  title: string;
  url: string;
  state: "open" | "closed";
  createdAt: string;
  updatedAt: string;
  labels: string[];
  bodyPreview: string;
}

export interface RankedIssue extends NormalizedIssue {
  score: number;
  rankingReasons: string[];
}

export interface ApprovedIssue {
  id: number;
  title: string;
  url: string;
  approvedAt: string;
}

export interface IssueBotState {
  currentCandidate: RankedIssue | null;
  approvedIssue: ApprovedIssue | null;
  seenIssueIds: number[];
  lastRunAt: string | null;
  lastRunStatus: "idle" | "success" | "network-error" | "parse-error";
  lastRunMessage: string | null;
}
```

```ts
// scripts/issue-bot/lib/state.ts
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { IssueBotState } from "./types";

export const createDefaultIssueBotState = (): IssueBotState => ({
  currentCandidate: null,
  approvedIssue: null,
  seenIssueIds: [],
  lastRunAt: null,
  lastRunStatus: "idle",
  lastRunMessage: null,
});

export const getIssueBotStatePath = (): string => {
  const cacheRoot =
    process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  return path.join(cacheRoot, "spark-store", "issue-bot", "state.json");
};

export const loadIssueBotState = (): IssueBotState => {
  const filePath = getIssueBotStatePath();
  if (!fs.existsSync(filePath)) return createDefaultIssueBotState();

  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return {
      ...createDefaultIssueBotState(),
      ...(JSON.parse(raw) as Partial<IssueBotState>),
    };
  } catch {
    const backupPath = `${filePath}.bak-${Date.now()}`;
    fs.renameSync(filePath, backupPath);
    return createDefaultIssueBotState();
  }
};

export const saveIssueBotState = (state: IssueBotState): void => {
  const filePath = getIssueBotStatePath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/state.test.ts`

Expected: PASS with 4 tests passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/issue-bot/lib/types.ts scripts/issue-bot/lib/state.ts src/__tests__/unit/issue-bot/state.test.ts
git commit -m "feat(issue-bot): add local state storage"
```

### Task 2: Add Ranking Rules and Candidate Selection

**Files:**

- Create: `scripts/issue-bot/lib/ranking.ts`
- Test: `src/__tests__/unit/issue-bot/ranking.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import {
  rankIssues,
  selectTopIssueCandidate,
} from "../../../../scripts/issue-bot/lib/ranking";
import type { NormalizedIssue } from "../../../../scripts/issue-bot/lib/types";

const makeIssue = (overrides: Partial<NormalizedIssue>): NormalizedIssue => ({
  id: 1,
  number: "I123",
  title: "示例 issue",
  url: "https://gitee.com/spark-store-project/spark-store/issues/I123",
  state: "open",
  createdAt: "2026-04-14T00:00:00.000Z",
  updatedAt: "2026-04-14T00:00:00.000Z",
  labels: [],
  bodyPreview: "用户反馈应用无法安装，并附上了复现步骤和日志。",
  ...overrides,
});

describe("issue-bot ranking", () => {
  it("prioritizes install failures with actionable details", () => {
    const ranked = rankIssues([
      makeIssue({ id: 1, title: "应用无法安装，附日志" }),
      makeIssue({ id: 2, title: "建议增加分类筛选", bodyPreview: "功能建议" }),
    ]);

    expect(ranked[0].id).toBe(1);
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].rankingReasons).toContain(
      "contains high-impact keyword: 无法安装",
    );
  });

  it("filters out closed issues and already-approved issues", () => {
    const candidate = selectTopIssueCandidate(
      [
        makeIssue({ id: 3, state: "closed", title: "已关闭问题" }),
        makeIssue({ id: 4, title: "白屏并卡死" }),
      ],
      { approvedIssueId: 4 },
    );

    expect(candidate).toBeNull();
  });

  it("prefers more recently updated issues when scores otherwise match", () => {
    const candidate = selectTopIssueCandidate(
      [
        makeIssue({
          id: 5,
          title: "启动白屏",
          updatedAt: "2026-04-14T08:00:00.000Z",
        }),
        makeIssue({
          id: 6,
          title: "启动白屏",
          updatedAt: "2026-04-14T09:00:00.000Z",
        }),
      ],
      { approvedIssueId: null },
    );

    expect(candidate?.id).toBe(6);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/ranking.test.ts`

Expected: FAIL with `Cannot find module '../../../../scripts/issue-bot/lib/ranking'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/issue-bot/lib/ranking.ts
import type { NormalizedIssue, RankedIssue } from "./types";

const HIGH_IMPACT_KEYWORDS = [
  "崩溃",
  "打不开",
  "无法安装",
  "升级失败",
  "卡死",
  "白屏",
  "闪退",
];

const CORE_FLOW_KEYWORDS = ["安装", "卸载", "更新", "启动", "搜索", "加载"];

const hasActionableDetail = (issue: NormalizedIssue): boolean =>
  /复现|日志|截图|error|错误/i.test(issue.bodyPreview);

const scoreIssue = (issue: NormalizedIssue): RankedIssue => {
  const reasons: string[] = [];
  let score = 0;
  const haystack = `${issue.title}\n${issue.bodyPreview}`;

  for (const keyword of HIGH_IMPACT_KEYWORDS) {
    if (haystack.includes(keyword)) {
      score += 10;
      reasons.push(`contains high-impact keyword: ${keyword}`);
    }
  }

  for (const keyword of CORE_FLOW_KEYWORDS) {
    if (haystack.includes(keyword)) {
      score += 4;
      reasons.push(`touches core flow: ${keyword}`);
      break;
    }
  }

  if (hasActionableDetail(issue)) {
    score += 6;
    reasons.push("includes actionable detail");
  }

  if (/建议|需求|希望/.test(haystack)) {
    score -= 4;
    reasons.push("looks like feature discussion");
  }

  return {
    ...issue,
    score,
    rankingReasons: reasons,
  };
};

export const rankIssues = (issues: NormalizedIssue[]): RankedIssue[] =>
  [...issues]
    .filter((issue) => issue.state === "open")
    .map(scoreIssue)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
    });

export const selectTopIssueCandidate = (
  issues: NormalizedIssue[],
  options: { approvedIssueId: number | null },
): RankedIssue | null => {
  const ranked = rankIssues(issues).filter(
    (issue) => issue.id !== options.approvedIssueId,
  );
  return ranked[0] ?? null;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/ranking.test.ts`

Expected: PASS with 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/issue-bot/lib/ranking.ts src/__tests__/unit/issue-bot/ranking.test.ts
git commit -m "feat(issue-bot): rank candidate issues"
```

### Task 3: Add Gitee Fetching and Polling Entrypoint

**Files:**

- Create: `scripts/issue-bot/lib/gitee.ts`
- Create: `scripts/issue-bot/check-issues.ts`
- Test: `src/__tests__/unit/issue-bot/check-issues.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  IssueBotState,
  NormalizedIssue,
} from "../../../../scripts/issue-bot/lib/types";

const loadState = vi.fn();
const saveState = vi.fn();
const listOpenIssues = vi.fn();

vi.mock("../../../../scripts/issue-bot/lib/state", () => ({
  createDefaultIssueBotState: () => ({
    currentCandidate: null,
    approvedIssue: null,
    seenIssueIds: [],
    lastRunAt: null,
    lastRunStatus: "idle",
    lastRunMessage: null,
  }),
  loadIssueBotState: loadState,
  saveIssueBotState: saveState,
}));

vi.mock("../../../../scripts/issue-bot/lib/gitee", () => ({
  listOpenIssues,
}));

describe("check-issues", () => {
  beforeEach(() => {
    vi.resetModules();
    loadState.mockReset();
    saveState.mockReset();
    listOpenIssues.mockReset();
  });

  it("stores the top-ranked issue candidate", async () => {
    const baseState: IssueBotState = {
      currentCandidate: null,
      approvedIssue: null,
      seenIssueIds: [],
      lastRunAt: null,
      lastRunStatus: "idle",
      lastRunMessage: null,
    };

    loadState.mockReturnValue(baseState);
    listOpenIssues.mockResolvedValue([
      {
        id: 10,
        number: "I10",
        title: "应用无法安装并白屏",
        url: "https://gitee.com/spark-store-project/spark-store/issues/I10",
        state: "open",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T09:00:00.000Z",
        labels: ["bug"],
        bodyPreview: "复现步骤：1. 打开商店 2. 点击安装。附日志。",
      },
    ] satisfies NormalizedIssue[]);

    const { runIssueBotCheck } =
      await import("../../../../scripts/issue-bot/check-issues");
    await runIssueBotCheck();

    expect(saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentCandidate: expect.objectContaining({
          id: 10,
          title: "应用无法安装并白屏",
        }),
        lastRunStatus: "success",
      }),
    );
  });

  it("keeps the previous candidate when fetching issues fails", async () => {
    loadState.mockReturnValue({
      currentCandidate: {
        id: 99,
        number: "I99",
        title: "旧候选",
        url: "https://gitee.com/spark-store-project/spark-store/issues/I99",
        state: "open",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        labels: [],
        bodyPreview: "旧摘要",
        score: 12,
        rankingReasons: ["legacy candidate"],
      },
      approvedIssue: null,
      seenIssueIds: [],
      lastRunAt: null,
      lastRunStatus: "idle",
      lastRunMessage: null,
    });
    listOpenIssues.mockRejectedValue(new Error("network down"));

    const { runIssueBotCheck } =
      await import("../../../../scripts/issue-bot/check-issues");
    await runIssueBotCheck();

    expect(saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentCandidate: expect.objectContaining({ id: 99 }),
        lastRunStatus: "network-error",
        lastRunMessage: "network down",
      }),
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/check-issues.test.ts`

Expected: FAIL with `Cannot find module '../../../../scripts/issue-bot/check-issues'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/issue-bot/lib/gitee.ts
import type { NormalizedIssue } from "./types";

interface GiteeIssueApiResponse {
  id: number;
  number: string;
  title: string;
  state: "open" | "closed";
  created_at: string;
  updated_at: string;
  body?: string;
  html_url: string;
  labels?: Array<{ name?: string }>;
}

const GITEE_ISSUES_API_URL =
  "https://gitee.com/api/v5/repos/spark-store-project/spark-store/issues?state=open&sort=updated&direction=desc&page=1&per_page=50";

export const listOpenIssues = async (): Promise<NormalizedIssue[]> => {
  const response = await fetch(GITEE_ISSUES_API_URL);
  if (!response.ok) {
    throw new Error(`Gitee request failed: ${response.status}`);
  }

  const payload = (await response.json()) as GiteeIssueApiResponse[];
  return payload.map((issue) => ({
    id: issue.id,
    number: issue.number,
    title: issue.title,
    url: issue.html_url,
    state: issue.state,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    labels: (issue.labels || [])
      .map((label) => label.name?.trim() || "")
      .filter((label) => label.length > 0),
    bodyPreview: (issue.body || "").slice(0, 500),
  }));
};
```

```ts
// scripts/issue-bot/check-issues.ts
import { listOpenIssues } from "./lib/gitee";
import { selectTopIssueCandidate } from "./lib/ranking";
import { loadIssueBotState, saveIssueBotState } from "./lib/state";

export const runIssueBotCheck = async (): Promise<void> => {
  const state = loadIssueBotState();
  const now = new Date().toISOString();

  try {
    const issues = await listOpenIssues();
    const candidate = selectTopIssueCandidate(issues, {
      approvedIssueId: state.approvedIssue?.id ?? null,
    });

    saveIssueBotState({
      ...state,
      currentCandidate: candidate,
      seenIssueIds: candidate
        ? Array.from(new Set([...state.seenIssueIds, candidate.id]))
        : state.seenIssueIds,
      lastRunAt: now,
      lastRunStatus: "success",
      lastRunMessage: candidate
        ? `candidate updated: ${candidate.title}`
        : "no candidate issues found",
    });
  } catch (error) {
    saveIssueBotState({
      ...state,
      lastRunAt: now,
      lastRunStatus: "network-error",
      lastRunMessage: error instanceof Error ? error.message : String(error),
    });
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runIssueBotCheck().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/check-issues.test.ts`

Expected: PASS with 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/issue-bot/lib/gitee.ts scripts/issue-bot/check-issues.ts src/__tests__/unit/issue-bot/check-issues.test.ts
git commit -m "feat(issue-bot): poll gitee issues"
```

### Task 4: Add Opencode Prompt Generation and Manual Approval

**Files:**

- Create: `scripts/issue-bot/lib/opencode.ts`
- Create: `scripts/issue-bot/approve-issue.ts`
- Test: `src/__tests__/unit/issue-bot/approve-issue.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadState = vi.fn();
const saveState = vi.fn();
const launchOpencodeForIssue = vi.fn();

vi.mock("../../../../scripts/issue-bot/lib/state", () => ({
  loadIssueBotState: loadState,
  saveIssueBotState: saveState,
}));

vi.mock("../../../../scripts/issue-bot/lib/opencode", () => ({
  launchOpencodeForIssue,
}));

describe("approve-issue", () => {
  beforeEach(() => {
    vi.resetModules();
    loadState.mockReset();
    saveState.mockReset();
    launchOpencodeForIssue.mockReset();
  });

  it("marks the current candidate as approved and launches opencode", async () => {
    loadState.mockReturnValue({
      currentCandidate: {
        id: 42,
        number: "I42",
        title: "应用升级失败并白屏",
        url: "https://gitee.com/spark-store-project/spark-store/issues/I42",
        state: "open",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        labels: ["bug"],
        bodyPreview: "更新后白屏，附日志。",
        score: 20,
        rankingReasons: ["contains high-impact keyword: 升级失败"],
      },
      approvedIssue: null,
      seenIssueIds: [42],
      lastRunAt: "2026-04-14T09:00:00.000Z",
      lastRunStatus: "success",
      lastRunMessage: "candidate updated",
    });

    const { runIssueBotApproval } =
      await import("../../../../scripts/issue-bot/approve-issue");
    await runIssueBotApproval();

    expect(launchOpencodeForIssue).toHaveBeenCalledWith(
      expect.objectContaining({ id: 42, title: "应用升级失败并白屏" }),
    );
    expect(saveState).toHaveBeenCalledWith(
      expect.objectContaining({
        currentCandidate: null,
        approvedIssue: expect.objectContaining({ id: 42 }),
      }),
    );
  });

  it("throws when there is no candidate to approve", async () => {
    loadState.mockReturnValue({
      currentCandidate: null,
      approvedIssue: null,
      seenIssueIds: [],
      lastRunAt: null,
      lastRunStatus: "idle",
      lastRunMessage: null,
    });

    const { runIssueBotApproval } =
      await import("../../../../scripts/issue-bot/approve-issue");

    await expect(runIssueBotApproval()).rejects.toThrow(
      "No current issue candidate to approve.",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/approve-issue.test.ts`

Expected: FAIL with `Cannot find module '../../../../scripts/issue-bot/approve-issue'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// scripts/issue-bot/lib/opencode.ts
import { spawn } from "node:child_process";

import type { RankedIssue } from "./types";

export const buildOpencodePrompt = (
  issue: RankedIssue,
): string => `请处理以下 Spark Store issue：

标题：${issue.title}
链接：${issue.url}
摘要：${issue.bodyPreview}
优先级原因：${issue.rankingReasons.join("；")}

要求：先分析根因，再开始修复。默认基仓库必须使用 ~/Desktop/spark-store。
如果开始修改代码，必须先使用 git worktree，从 Erotica 分支开出新的工作分支，并在该 worktree 中实施改动，不要直接在主工作区修改。`;

export const launchOpencodeForIssue = async (
  issue: RankedIssue,
): Promise<void> => {
  const configuredCommand = process.env.SPARK_STORE_OPENCODE_CMD || "opencode";
  const child = spawn(configuredCommand, [buildOpencodePrompt(issue)], {
    detached: true,
    stdio: "ignore",
    shell: true,
  });

  child.unref();
};
```

```ts
// scripts/issue-bot/approve-issue.ts
import { launchOpencodeForIssue } from "./lib/opencode";
import { loadIssueBotState, saveIssueBotState } from "./lib/state";

export const runIssueBotApproval = async (): Promise<void> => {
  const state = loadIssueBotState();
  const candidate = state.currentCandidate;

  if (!candidate) {
    throw new Error("No current issue candidate to approve.");
  }

  await launchOpencodeForIssue(candidate);

  saveIssueBotState({
    ...state,
    currentCandidate: null,
    approvedIssue: {
      id: candidate.id,
      title: candidate.title,
      url: candidate.url,
      approvedAt: new Date().toISOString(),
    },
  });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  runIssueBotApproval().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/approve-issue.test.ts`

Expected: PASS with 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add scripts/issue-bot/lib/opencode.ts scripts/issue-bot/approve-issue.ts src/__tests__/unit/issue-bot/approve-issue.test.ts
git commit -m "feat(issue-bot): approve candidates and launch opencode"
```

### Task 5: Wire npm Scripts and systemd Units

**Files:**

- Modify: `package.json`
- Modify: `tsconfig.node.json`
- Create: `extras/systemd/spark-store-issue-bot.service`
- Create: `extras/systemd/spark-store-issue-bot.timer`
- Create: `src/__tests__/unit/issue-bot/packaging.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";

import pkg from "../../../../package.json";
import serviceUnit from "../../../../extras/systemd/spark-store-issue-bot.service?raw";
import timerUnit from "../../../../extras/systemd/spark-store-issue-bot.timer?raw";

describe("issue-bot packaging", () => {
  it("adds npm scripts for polling and approval", () => {
    expect(pkg.scripts["issue-bot:check"]).toBe(
      "node --experimental-strip-types scripts/issue-bot/check-issues.ts",
    );
    expect(pkg.scripts["issue-bot:approve"]).toBe(
      "node --experimental-strip-types scripts/issue-bot/approve-issue.ts",
    );
  });

  it("installs a six-hour persistent user timer", () => {
    expect(serviceUnit).toContain("Type=oneshot");
    expect(serviceUnit).toContain(
      "ExecStart=/usr/bin/env npm run issue-bot:check",
    );
    expect(timerUnit).toContain("OnUnitActiveSec=6h");
    expect(timerUnit).toContain("Persistent=true");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/packaging.test.ts`

Expected: FAIL with `Failed to resolve import '../../../../extras/systemd/spark-store-issue-bot.service?raw'` and missing package scripts.

- [ ] **Step 3: Write minimal implementation**

```json
// package.json
{
  "scripts": {
    "issue-bot:check": "node --experimental-strip-types scripts/issue-bot/check-issues.ts",
    "issue-bot:approve": "node --experimental-strip-types scripts/issue-bot/approve-issue.ts"
  }
}
```

```json
// tsconfig.node.json
{
  "include": ["vite.config.ts", "package.json", "electron", "scripts"]
}
```

```ini
; extras/systemd/spark-store-issue-bot.service
[Unit]
Description=Spark Store issue bot poller

[Service]
Type=oneshot
WorkingDirectory=%h/Desktop/spark-store
ExecStart=/usr/bin/env npm run issue-bot:check
```

```ini
; extras/systemd/spark-store-issue-bot.timer
[Unit]
Description=Run Spark Store issue bot every 6 hours

[Timer]
OnBootSec=15m
OnUnitActiveSec=6h
Persistent=true
Unit=spark-store-issue-bot.service

[Install]
WantedBy=timers.target
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/packaging.test.ts`

Expected: PASS with 2 tests passed.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.node.json extras/systemd/spark-store-issue-bot.service extras/systemd/spark-store-issue-bot.timer src/__tests__/unit/issue-bot/packaging.test.ts
git commit -m "chore(issue-bot): wire scripts and timer units"
```

### Task 6: Run End-to-End Verification

**Files:**

- Modify: `scripts/issue-bot/check-issues.ts`
- Modify: `scripts/issue-bot/approve-issue.ts`
- Modify: `scripts/issue-bot/lib/gitee.ts`
- Modify: `scripts/issue-bot/lib/opencode.ts`
- Modify: `scripts/issue-bot/lib/ranking.ts`
- Modify: `scripts/issue-bot/lib/state.ts`
- Modify: `package.json`
- Modify: `tsconfig.node.json`
- Create: `extras/systemd/spark-store-issue-bot.service`
- Create: `extras/systemd/spark-store-issue-bot.timer`
- Test: `src/__tests__/unit/issue-bot/state.test.ts`
- Test: `src/__tests__/unit/issue-bot/ranking.test.ts`
- Test: `src/__tests__/unit/issue-bot/check-issues.test.ts`
- Test: `src/__tests__/unit/issue-bot/approve-issue.test.ts`
- Test: `src/__tests__/unit/issue-bot/packaging.test.ts`

- [ ] **Step 1: Run focused issue-bot tests**

Run: `npm run test -- --run src/__tests__/unit/issue-bot/state.test.ts src/__tests__/unit/issue-bot/ranking.test.ts src/__tests__/unit/issue-bot/check-issues.test.ts src/__tests__/unit/issue-bot/approve-issue.test.ts src/__tests__/unit/issue-bot/packaging.test.ts`

Expected: PASS with all issue-bot tests green.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: PASS with no ESLint errors in `scripts/issue-bot`, `src/__tests__/unit/issue-bot`, and touched config files.

- [ ] **Step 3: Run build verification**

Run: `npm run build:vite`

Expected: PASS with Electron/Vite bundles generated and no TypeScript errors after adding `scripts` to `tsconfig.node.json`.

- [ ] **Step 4: Manually verify CLI entrypoints**

Run: `npm run issue-bot:check`

Expected: `~/.cache/spark-store/issue-bot/state.json` exists and contains either a populated `currentCandidate` or a `lastRunMessage` of `no candidate issues found`.

Run: `SPARK_STORE_OPENCODE_CMD='printf' npm run issue-bot:approve`

Expected: command exits successfully and prints the generated prompt containing both `~/Desktop/spark-store` and `Erotica`.

- [ ] **Step 5: Manually verify systemd units**

Run: `systemctl --user start spark-store-issue-bot.service`

Expected: service runs once without unit-file syntax errors.

Run: `systemctl --user enable --now spark-store-issue-bot.timer`

Expected: timer is enabled, active, and reports the next run roughly 6 hours later.

- [ ] **Step 6: Commit**

```bash
git add scripts/issue-bot package.json tsconfig.node.json extras/systemd/spark-store-issue-bot.service extras/systemd/spark-store-issue-bot.timer src/__tests__/unit/issue-bot
git commit -m "feat(issue-bot): add automated issue polling workflow"
```

## Self-Review

### Spec coverage

- `systemd --user` timer requirement: covered by Task 5 and Task 6.
- One-candidate ranking with explainable reasons: covered by Task 2 and Task 3.
- Manual approval before opencode launch: covered by Task 4.
- Local cache-backed state with failure retention: covered by Task 1 and Task 3.
- `~/Desktop/spark-store` + `Erotica` worktree rule in the launch prompt: covered by Task 4 and manual verification in Task 6.

### Placeholder scan

- No `TBD`, `TODO`, or “implement later” placeholders remain.
- All code-changing steps include concrete code blocks.
- All verification steps include exact commands and expected outcomes.

### Type consistency

- `NormalizedIssue`, `RankedIssue`, `ApprovedIssue`, and `IssueBotState` are defined in Task 1 and reused consistently in Tasks 2-4.
- `runIssueBotCheck`, `runIssueBotApproval`, and `launchOpencodeForIssue` names stay unchanged across tests and implementation steps.
