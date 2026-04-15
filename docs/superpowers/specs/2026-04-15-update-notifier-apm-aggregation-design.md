# Update Notifier APM Aggregation Design

## Background

`tool/update-upgrade/ss-update-notifier.sh` currently counts Spark (`aptss`) updates, filters them through `hold` state and `~/.config/spark-store/ignored_apps.conf`, then sends one desktop notification. A separate APM-side notifier pattern exists, but it is not merged into the current Spark notifier script.

The goal is to let the current notifier aggregate both Spark and APM upgradable items into one notification, while keeping the existing user-level ignored-update behavior and avoiding hard failures on systems that do not provide `aptss`.

## Goals

1. Keep a single notifier script: `tool/update-upgrade/ss-update-notifier.sh`.
2. Count both Spark and APM upgradable applications in that script.
3. Continue to use one shared ignored-update file: `~/.config/spark-store/ignored_apps.conf`.
4. Apply ignored filtering to both Spark and APM using exact `pkgname|newVersion` keys.
5. Apply `hold` filtering independently for Spark and APM.
6. Aggregate the remaining Spark and APM counts into one notification.
7. If `aptss` is unavailable, skip the Spark branch without failing the script.

## Non-Goals

1. Do not create a second notifier service or script.
2. Do not change the ignored-update file format.
3. Do not change Electron or update-center UI behavior in this task.
4. Do not add a compatibility layer for `/etc/spark-store/ignored_apps.conf`.

## Recommended Approach

Extend the existing notifier in place and keep Spark and APM as two counting branches inside the same script.

Spark keeps its current `aptss`-based flow. APM adds a second branch that parses `apm list --upgradable`, applies APM `hold` detection via `amber-pm-debug dpkg-query`, and reuses the same ignored-entry set already loaded from user config files. The final notification count becomes `spark_count + apm_count`.

This keeps the script small, preserves the current Spark path, and avoids introducing a second source of notification truth.

## Data Sources

### Spark branch

- Command availability gate: `command -v aptss`
- Refresh commands: `aptss update`, `LANGUAGE=en_US aptss ssupdate`
- Upgradable list source: `/opt/durapps/spark-store/bin/update-upgrade/ss-do-upgrade-worker.sh upgradable-list`
- Hold check: `dpkg-query -W -f='${db:Status-Want}' <pkg>`

### APM branch

- Command availability gate: `command -v apm`
- Refresh commands: `LANGUAGE=en_US apm update`, followed by `apm clean`
- Upgradable list source: `env LANGUAGE=en_US apm list --upgradable`
- Output compatibility: support both `[upgradable from: <version>]` and legacy `[from: <version>]` variants when extracting the current version
- Hold check: `amber-pm-debug dpkg-query -W -f='${db:Status-Want}' <pkg>`

## Filtering Rules

### Ignored entries

The script continues to load ignored entries from `~/.config/spark-store/ignored_apps.conf`, using the existing user-detection plus `/home/*` scan behavior.

Each valid line is still interpreted as:

```text
pkgname|version
```

Matching rule:

- Spark item is ignored when `pkgname|sparkNewVersion` exists in the ignored set.
- APM item is ignored when `pkgname|apmNewVersion` exists in the ignored set.

Ignored matching is intentionally source-agnostic. If Spark and APM expose the same package name and target version, one ignore entry suppresses both.

### Hold entries

- Spark item is excluded if `dpkg-query` reports `hold`.
- APM item is excluded if `amber-pm-debug dpkg-query` reports `hold`.

### Invalid or stale version entries

Each branch keeps its own version sanity check before counting:

- Spark continues to skip items where `newVersion <= currentVersion`.
- APM does the same after parsing `apm list --upgradable` output from either supported bracket variant.

## Availability Rules

### Missing `aptss`

If `aptss` is not installed or not in `PATH`:

1. Skip Spark refresh commands entirely.
2. Skip Spark upgradable counting entirely.
3. Continue with APM counting if `apm` is available.

### Missing `apm`

If `apm` is not installed or not in `PATH`:

1. Skip APM refresh commands entirely.
2. Skip APM upgradable counting entirely.
3. Continue with Spark counting if `aptss` is available.

### Both unavailable

If both `aptss` and `apm` are unavailable, the script exits without sending a notification.

## Notification Behavior

The script sends one notification only when:

```text
spark_effective_count + apm_effective_count > 0
```

The notification remains a single desktop message. The implementation may update the wording to mention both Spark and APM updates, but the key requirement is one aggregated notification rather than separate per-source notifications.

## Implementation Boundaries

1. Keep the current `detect-notify-user` and ignored-config discovery logic.
2. Add APM parsing as a second source-specific helper path instead of rewriting the whole script.
3. Keep the shell implementation POSIX-compatible with the current Bash usage already present in the file.
4. Avoid changing unrelated installer or update-center code in this task.

## Verification

1. `bash -n tool/update-upgrade/ss-update-notifier.sh`
2. Manual dry-run reasoning for all four cases:
   - Spark only
   - APM only
   - Spark + APM
   - neither available
3. Confirm ignored entries suppress both branches via exact `pkg|newVersion` matching.
