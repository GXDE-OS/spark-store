# Update Notifier APM Aggregation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `tool/update-upgrade/ss-update-notifier.sh` so one notifier aggregates effective Spark and APM updates, honoring `hold` status and shared ignored entries while skipping the Spark branch when `aptss` is unavailable.

**Architecture:** Keep the current notifier script as the single entrypoint and add a second APM counting branch beside the existing Spark branch. Reuse the existing ignored-entry loading logic, count Spark and APM updates independently after source-specific filtering, then combine the remaining counts into one notification.

**Tech Stack:** Bash, aptss, apm, amber-pm-debug, dpkg-query

---

## File Structure

- Modify: `tool/update-upgrade/ss-update-notifier.sh`
  Responsibility: add APM update parsing and counting, guard Spark execution behind `aptss` availability, reuse ignored-entry filtering for both branches, and keep one aggregated notification path.

### Task 1: Add Source-Specific Counting Helpers

**Files:**

- Modify: `tool/update-upgrade/ss-update-notifier.sh`

- [ ] **Step 1: Write the failing shell behavior expectation as comments in the plan**

```bash
# Expected behavior after implementation:
# 1. If aptss is missing, the script does not call aptss update/ssupdate.
# 2. If apm reports upgradable apps, ignored pkg|newVersion entries suppress them.
# 3. Spark and APM effective counts are added into one final count.
```

- [ ] **Step 2: Run syntax check before changes**

Run: `bash -n tool/update-upgrade/ss-update-notifier.sh`
Expected: exit 0

- [ ] **Step 3: Add minimal helper functions for APM parsing and per-source counting**

```bash
function has-command() {
    command -v "$1" >/dev/null 2>&1
}

function get_apm_upgradable_list() {
    local output
    output=$(env LANGUAGE=en_US apm list --upgradable 2>/dev/null | awk 'NR>1')
    local ifs_old="$IFS"
    IFS=$'\n'
    for line in $output; do
        local pkg_name
        local pkg_new_ver
        local pkg_cur_ver
        pkg_name=$(echo "$line" | awk -F '/' '{print $1}')
        pkg_new_ver=$(echo "$line" | awk '{print $2}')
        pkg_cur_ver=$(printf '%s\n' "$line" | sed -n 's/.*\[\(upgradable from\|from\):[[:space:]]*\([^]]*\)\].*/\2/p')
        if [ -n "$pkg_name" ] && [ -n "$pkg_new_ver" ] && [ -n "$pkg_cur_ver" ]; then
            echo "$pkg_name $pkg_new_ver $pkg_cur_ver"
        fi
    done
    IFS="$ifs_old"
}
```

- [ ] **Step 4: Re-run syntax check after helper changes**

Run: `bash -n tool/update-upgrade/ss-update-notifier.sh`
Expected: exit 0

### Task 2: Aggregate Spark And APM Effective Counts

**Files:**

- Modify: `tool/update-upgrade/ss-update-notifier.sh`

- [ ] **Step 1: Guard Spark refresh and counting behind aptss availability**

```bash
spark_update_count=0
if has-command aptss; then
    # existing aptss update / aptss ssupdate logic
    # existing spark upgradable counting logic
fi
```

- [ ] **Step 2: Add APM refresh and counting branch with hold + ignored filtering**

```bash
apm_update_count=0
if has-command apm; then
    updatetext=$(LANGUAGE=en_US apm update 2>&1)
    # retry loop matching current script style
    apm clean
    PKG_LIST="$(get_apm_upgradable_list)"
    apm_update_count=$(printf '%s\n' "$PKG_LIST" | awk 'NF { count++ } END { print count + 0 }')
    # for each package:
    # - skip if new <= current
    # - skip if amber-pm-debug dpkg-query says hold
    # - skip if ignored_apps["$PKG_NAME|$PKG_NEW_VER"] exists
    # - otherwise increment apm_update_count
fi
```

- [ ] **Step 3: Replace single-source final count with aggregated count**

```bash
update_app_number=$((spark_update_count + apm_update_count))
if [ "$update_app_number" -le 0 ]; then
    exit 0
fi
```

- [ ] **Step 4: Keep one final notification path**

```bash
notify-send -a spark-store \
  "${TRANSHELL_CONTENT_SPARK_STORE_UPGRADE_NOTIFY}" \
  "${TRANSHELL_CONTENT_THERE_ARE_APPS_TO_UPGRADE}" || true
```

- [ ] **Step 5: Re-run syntax check after aggregation changes**

Run: `bash -n tool/update-upgrade/ss-update-notifier.sh`
Expected: exit 0

### Task 3: Verification And Commit

**Files:**

- Modify: `tool/update-upgrade/ss-update-notifier.sh`

- [ ] **Step 1: Run notifier syntax verification**

Run: `bash -n tool/update-upgrade/ss-update-notifier.sh`
Expected: exit 0

- [ ] **Step 2: Run repository lint**

Run: `npm run lint`
Expected: exit 0

- [ ] **Step 3: Run repository build**

Run: `npm run build:vite`
Expected: exit 0

- [ ] **Step 4: Review final diff**

Run: `git diff -- tool/update-upgrade/ss-update-notifier.sh docs/superpowers/specs/2026-04-15-update-notifier-apm-aggregation-design.md docs/superpowers/plans/2026-04-15-update-notifier-apm-aggregation.md`
Expected: only notifier aggregation and spec/plan changes appear

- [ ] **Step 5: Commit**

```bash
git add tool/update-upgrade/ss-update-notifier.sh docs/superpowers/specs/2026-04-15-update-notifier-apm-aggregation-design.md docs/superpowers/plans/2026-04-15-update-notifier-apm-aggregation.md
git commit -m "fix(update): 聚合 Spark 和 APM 升级通知"
```
