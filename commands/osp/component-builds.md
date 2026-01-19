---
name: component-builds
description: Check Konflux build status, monitor pipelines, and verify image freshness
allowed-tools:
  - Bash
  - Read
  - AskUserQuestion
---

# Component Builds

<objective>
Comprehensive Konflux build monitoring for OpenShift Pipelines release readiness. Provides three modes of operation:

1. **status** (default): One-shot check of current pipeline status for all components
2. **watch**: Poll every 15 minutes until all complete or 3-hour timeout
3. **freshness**: Check if images are fresh (<72h) based on last successful build

Use this skill to monitor build progress after triggering rebuilds, verify all components are ready before release, or diagnose stale images.
</objective>

<execution_context>
**Default Components (11 for 1.15.x release):**

| Component | Repository | Branch |
|-----------|------------|--------|
| pipeline | tektoncd-pipeline | release-v1.15.x |
| triggers | tektoncd-triggers | release-v1.15.x |
| chains | tektoncd-chains | release-v1.15.x |
| results | tektoncd-results | release-v1.15.x |
| hub | tektoncd-hub | release-v1.15.x |
| cli | tektoncd-cli | release-v1.15.x |
| pac | pac-downstream | release-v1.15.x |
| git-clone | tektoncd-git-clone | release-v1.15.x |
| console-plugin | console-plugin | release-v1.15.x |
| manual-approval-gate | manual-approval-gate | release-v0.2.2 |
| operator | operator | release-v1.15.x |

**Requirements:**
- GitHub CLI (`gh`) authenticated with access to openshift-pipelines org
- `jq` for JSON parsing

**Thresholds:**
- Freshness: 72 hours (images older are considered STALE)
- Watch timeout: 3 hours
- Poll interval: 15 minutes
</execution_context>

<process>
<step name="parse_mode">
Determine operation mode from arguments.

**Accepted formats:**
- No args: `status` mode (default)
- `watch`: Monitor until all complete
- `freshness`: Check image age
- `status [components]`: Custom component list

```bash
MODE="${1:-status}"
shift 2>/dev/null || true

case "$MODE" in
  status|watch|freshness)
    echo "Mode: $MODE"
    ;;
  *)
    echo "Unknown mode: $MODE"
    echo "Usage: /osp:component-builds [status|watch|freshness] [components...]"
    exit 1
    ;;
esac
```

If additional arguments provided, use as custom component list instead of defaults.
</step>

<step name="define_components">
Set the component list based on mode and arguments.

```bash
# Default 1.15.x components (repo:branch format)
COMPONENTS=(
  "tektoncd-pipeline:release-v1.15.x"
  "tektoncd-triggers:release-v1.15.x"
  "tektoncd-chains:release-v1.15.x"
  "tektoncd-results:release-v1.15.x"
  "tektoncd-hub:release-v1.15.x"
  "tektoncd-cli:release-v1.15.x"
  "pac-downstream:release-v1.15.x"
  "tektoncd-git-clone:release-v1.15.x"
  "console-plugin:release-v1.15.x"
  "manual-approval-gate:release-v0.2.2"
  "operator:release-v1.15.x"
)

ORG="openshift-pipelines"
TOTAL=${#COMPONENTS[@]}

echo "Checking $TOTAL components..."
```

**Note:** For other releases, modify the branch names. The manual-approval-gate has a fixed version branch that may differ.
</step>

<step name="check_pipeline_status">
**Mode: status** - Get current on-push pipeline status for each component.

```bash
echo ""
echo "## Component Build Status"
echo ""
echo "**Mode:** status (one-shot check)"
echo "**Checked at:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""
echo "| Component | Branch | Status | Conclusion |"
echo "|-----------|--------|--------|------------|"

PASSED=0
FAILED=0
PENDING=0
NO_RUNS=0

for ENTRY in "${COMPONENTS[@]}"; do
  REPO="${ENTRY%%:*}"
  BRANCH="${ENTRY##*:}"

  # Get on-push pipeline check runs
  RESULT=$(gh api "repos/${ORG}/${REPO}/commits/${BRANCH}/check-runs" \
    --jq '.check_runs[] | select(.name | contains("on-push")) | "\(.status)|\(.conclusion // "n/a")"' 2>/dev/null | head -1)

  STATUS=$(echo "$RESULT" | cut -d'|' -f1)
  CONCLUSION=$(echo "$RESULT" | cut -d'|' -f2)

  # Handle missing data
  if [[ -z "$STATUS" ]]; then
    STATUS="no-runs"
    CONCLUSION="n/a"
    ((NO_RUNS++))
  elif [[ "$STATUS" == "completed" ]]; then
    if [[ "$CONCLUSION" == "success" ]]; then
      ((PASSED++))
    else
      ((FAILED++))
    fi
  else
    ((PENDING++))
  fi

  # Status emoji
  case "$CONCLUSION" in
    success) EMOJI="✅" ;;
    failure) EMOJI="❌" ;;
    n/a) EMOJI="⚪" ;;
    *) EMOJI="⏳" ;;
  esac

  echo "| ${EMOJI} ${REPO} | ${BRANCH} | ${STATUS} | ${CONCLUSION} |"
done

echo ""
echo "**Summary:** ${PASSED} passed, ${FAILED} failed, ${PENDING} pending, ${NO_RUNS} no-runs"
```

If failures found, list commands to diagnose:
```bash
if [[ $FAILED -gt 0 ]]; then
  echo ""
  echo "### Action Required"
  echo ""
  echo "Failed components need diagnosis. Run:"
  echo ""
  # List failed repos with their diagnosis command
fi
```
</step>

<step name="check_freshness">
**Mode: freshness** - Verify images are fresh (<72h since last commit).

```bash
THRESHOLD_HOURS=72
NOW=$(date +%s)

echo ""
echo "## Component Freshness Check"
echo ""
echo "**Mode:** freshness (age verification)"
echo "**Threshold:** ${THRESHOLD_HOURS} hours"
echo "**Checked at:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""
echo "| Component | Branch | Last Commit | Age | Status |"
echo "|-----------|--------|-------------|-----|--------|"

FRESH=0
STALE=0

for ENTRY in "${COMPONENTS[@]}"; do
  REPO="${ENTRY%%:*}"
  BRANCH="${ENTRY##*:}"

  # Get last commit date on branch
  COMMIT_DATE=$(gh api "repos/${ORG}/${REPO}/commits/${BRANCH}" \
    --jq '.commit.committer.date' 2>/dev/null)

  if [[ -z "$COMMIT_DATE" ]]; then
    echo "| ⚠️ ${REPO} | ${BRANCH} | N/A | N/A | ERROR |"
    continue
  fi

  # Parse date (macOS compatible)
  if [[ "$(uname)" == "Darwin" ]]; then
    COMMIT_TS=$(date -j -f "%Y-%m-%dT%H:%M:%SZ" "$COMMIT_DATE" +%s 2>/dev/null || echo "0")
  else
    COMMIT_TS=$(date -d "$COMMIT_DATE" +%s 2>/dev/null || echo "0")
  fi

  AGE_HOURS=$(( (NOW - COMMIT_TS) / 3600 ))

  if [[ $AGE_HOURS -lt $THRESHOLD_HOURS ]]; then
    STATUS="FRESH"
    EMOJI="✅"
    ((FRESH++))
  else
    STATUS="STALE"
    EMOJI="⚠️"
    ((STALE++))
  fi

  # Truncate date for display
  COMMIT_SHORT="${COMMIT_DATE:0:10}"

  echo "| ${EMOJI} ${REPO} | ${BRANCH} | ${COMMIT_SHORT} | ${AGE_HOURS}h | ${STATUS} |"
done

echo ""
echo "**Summary:** ${FRESH} fresh (<${THRESHOLD_HOURS}h), ${STALE} stale (>${THRESHOLD_HOURS}h)"

if [[ $STALE -gt 0 ]]; then
  echo ""
  echo "### Stale Components Need Rebuild"
  echo ""
  echo "Trigger rebuilds with Dockerfile comment changes (see 02-01-PLAN.md pattern)."
fi
```
</step>

<step name="watch_mode">
**Mode: watch** - Poll until all pipelines complete or timeout.

```bash
POLL_INTERVAL=900  # 15 minutes in seconds
MAX_WAIT=10800     # 3 hours in seconds
START_TIME=$(date +%s)

echo ""
echo "## Watching Component Builds"
echo ""
echo "**Mode:** watch (poll until complete)"
echo "**Poll interval:** 15 minutes"
echo "**Timeout:** 3 hours"
echo "**Started:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo ""

ITERATION=1

while true; do
  echo "### Check #${ITERATION} - $(date -u +"%H:%M:%S UTC")"
  echo ""

  PASSED=0
  FAILED=0
  PENDING=0

  echo "| Component | Status | Conclusion |"
  echo "|-----------|--------|------------|"

  for ENTRY in "${COMPONENTS[@]}"; do
    REPO="${ENTRY%%:*}"
    BRANCH="${ENTRY##*:}"

    RESULT=$(gh api "repos/${ORG}/${REPO}/commits/${BRANCH}/check-runs" \
      --jq '.check_runs[] | select(.name | contains("on-push")) | "\(.status)|\(.conclusion // "n/a")"' 2>/dev/null | head -1)

    STATUS=$(echo "$RESULT" | cut -d'|' -f1)
    CONCLUSION=$(echo "$RESULT" | cut -d'|' -f2)

    [[ -z "$STATUS" ]] && STATUS="no-runs" && CONCLUSION="n/a"

    if [[ "$STATUS" == "completed" ]]; then
      [[ "$CONCLUSION" == "success" ]] && ((PASSED++)) || ((FAILED++))
    else
      ((PENDING++))
    fi

    echo "| ${REPO} | ${STATUS} | ${CONCLUSION} |"
  done

  echo ""
  echo "**Status:** ${PASSED} passed, ${FAILED} failed, ${PENDING} pending"

  # Exit conditions
  if [[ $PENDING -eq 0 ]]; then
    echo ""
    echo "✅ **All pipelines complete!**"
    if [[ $FAILED -gt 0 ]]; then
      echo "⚠️ **${FAILED} failures need attention.**"
    fi
    break
  fi

  ELAPSED=$(($(date +%s) - START_TIME))
  ELAPSED_MIN=$((ELAPSED / 60))

  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    echo ""
    echo "⏱️ **Timeout after 3 hours** - ${PENDING} pipelines still pending"
    break
  fi

  REMAINING=$((MAX_WAIT - ELAPSED))
  REMAINING_MIN=$((REMAINING / 60))

  echo ""
  echo "⏳ Next check in 15 minutes... (${ELAPSED_MIN}m elapsed, ${REMAINING_MIN}m remaining)"
  echo "---"
  echo ""

  sleep $POLL_INTERVAL
  ((ITERATION++))
done

echo ""
echo "**Finished:** $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
```

**Note:** Watch mode is blocking. Use `Ctrl+C` to cancel. Consider running in background for long waits.
</step>

<step name="display_results">
Format and display final results based on mode.

```markdown
## Final Report

### Build Status Summary

**Total Components:** {TOTAL}
**Passed:** {PASSED}
**Failed:** {FAILED}
**Pending:** {PENDING}

### Failed Components

{For each failed component:}
- **{REPO}**: Use `/osp:pr-pipeline-status {REPO} {BRANCH}` to diagnose

### Stale Components

{For freshness mode, list stale components:}
- **{REPO}**: Last commit {AGE}h ago, needs rebuild

### Next Steps

1. **If failures:** Run `/osp:pr-pipeline-status` for each failed component
2. **If stale:** Trigger rebuilds with Dockerfile comment changes
3. **If all green:** Ready to proceed with release

---

*Checked at: {TIMESTAMP}*
```
</step>

<step name="offer_next_actions">
Based on results, suggest appropriate next actions:

**All passed:**
```
✅ All component builds are successful and fresh.

Ready to proceed with release:
- Dev release: `/gsd:execute-plan .planning/phases/03-dev-release/03-01-PLAN.md`
- Stage release: `/osp:stage-release 1.15.4`
```

**Some failures:**
```
⚠️ {N} component builds failed.

Diagnose failures:
{List of /osp:pr-pipeline-status commands for each failed component}

After fixing, re-run: `/osp:component-builds status`
```

**Some pending:**
```
⏳ {N} component builds still running.

Options:
1. Wait and re-check: `/osp:component-builds status` (run again later)
2. Watch mode: `/osp:component-builds watch` (auto-poll until complete)
```

**Some stale:**
```
⚠️ {N} components have stale images (>${THRESHOLD}h old).

These need fresh Konflux builds. See 02-01-PLAN.md for rebuild trigger pattern.
```
</step>
</process>

<output>
- Build status table for all components
- Pass/fail/pending summary counts
- Freshness assessment (if freshness mode)
- Actionable next steps based on results
- Specific commands for failed components
</output>

<success_criteria>
- [ ] All components checked via GitHub API
- [ ] Status correctly categorized (passed/failed/pending)
- [ ] Freshness calculated correctly (hours since last commit)
- [ ] Clear summary with counts provided
- [ ] Actionable recommendations based on results
- [ ] Watch mode polls correctly (if used)
</success_criteria>
