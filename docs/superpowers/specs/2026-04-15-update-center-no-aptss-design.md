# Update Center No-APTSS Behavior Design

## Background

The Electron update center currently loads Spark (`aptss`) and APM updates together inside `electron/main/backend/update-center/index.ts`. The loader unconditionally runs Spark-side commands and Spark metadata enrichment, even on systems where `aptss` is not installed.

In that environment, the update center should not continue the Spark update path and surface command failures. Instead, Spark updates should be skipped cleanly while the APM path continues to work.

## Goals

1. When `aptss` is unavailable, the update center must not keep executing Spark update queries.
2. When `aptss` is unavailable but APM is available, the update center should still open and show APM updates.
3. Spark metadata loading must also be skipped when `aptss` is unavailable.
4. Missing `aptss` should not be surfaced as a fatal update-center error by itself.
5. Existing behavior should remain unchanged on systems where `aptss` is available.

## Non-Goals

1. Do not redesign the update-center service or UI.
2. Do not change notifier behavior in this task.
3. Do not change how APM updates are loaded.
4. Do not add a new settings toggle or user-facing prompt.

## Recommended Approach

Add a lightweight backend availability gate for the Spark branch at the start of `loadUpdateCenterItems()`.

If `aptss` is unavailable, treat the Spark source as absent rather than failed:

1. Skip the Spark upgradable query.
2. Skip the Spark installed-package query.
3. Skip Spark metadata enrichment.
4. Continue loading APM items normally.

This keeps the change local to the update-center backend and avoids reporting a missing Spark source as an error when the APM source can still provide valid updates.

## Data Flow Changes

### Current behavior

`loadUpdateCenterItems()` currently runs these in parallel:

1. Spark upgradable query
2. APM upgradable query
3. Spark installed query
4. APM installed query

Then it always attempts category/icon/metadata enrichment for both source lists.

### New behavior

Before starting source queries, check whether `aptss` exists in `PATH`.

If available:

- Keep the existing Spark path unchanged.

If unavailable:

- Set Spark upgradable result to an empty successful result.
- Set Spark installed result to an empty successful result.
- Skip Spark metadata enrichment by passing an empty Spark item list forward.

APM loading remains unchanged in both cases.

## Error Handling

### Missing `aptss`

Missing `aptss` is treated as “Spark source not present”, not as “update center failed”.

That means:

- No fatal error is thrown solely because `aptss` is missing.
- No Spark warning is emitted just because `aptss` is absent.
- APM-only results are considered valid update-center output.

### Both sources unavailable or failing

If both Spark and APM are unavailable or both real source queries fail, the update center may continue to use the existing combined error path.

## Testing

Add a backend unit test covering this scenario:

1. `aptss` is unavailable.
2. APM upgradable and installed commands succeed.
3. Spark metadata command is never called.
4. `loadUpdateCenterItems()` returns APM items without throwing.

This test should prove the missing-`aptss` case is handled as a skip rather than an error.
