---
phase: 01-assessment
plan: 02
subsystem: konflux-pipelines
tags: [assessment, konflux, pipeline-freshness, image-retention, github-api]

# Dependency graph
requires:
  - phase: 01-01
    provides: release-state-baseline
provides:
  - konflux-pipeline-freshness-report
  - stale-components-list (8 components)
  - component-branch-mappings
affects: [02-fix-blockers, 02-01]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "72-hour Konflux image retention threshold"
    - "hack repo as source of truth for component branches"

key-files:
  created:
    - .planning/phases/01-assessment/KONFLUX-FRESHNESS-REPORT.md
  modified:
    - .planning/ROADMAP.md

key-decisions:
  - "11 components tracked via hack config (not 14 as originally planned)"
  - "opc, tekton-caches, tektoncd-pruner not in 1.15.x release scope"
  - "Empty commit is recommended method for triggering rebuilds"

patterns-established:
  - "Use hack repo config/konflux/repos/*.yaml for authoritative component list"
  - "Check last commit date on release branch to determine pipeline freshness"

issues-created: []

# Metrics
duration: 3min
completed: 2026-01-19
---

# Phase 1 Plan 2: Konflux Pipeline Freshness Assessment Summary

**Identified 8 of 11 Konflux components as STALE (>72h) requiring on-push pipeline re-trigger before 1.15.4 release**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-19T11:56:47Z
- **Completed:** 2026-01-19T11:59:40Z
- **Tasks:** 4
- **Files created:** 1

## Accomplishments

- Extracted all 11 component/branch mappings from hack repo `config/konflux/repos/`
- Checked last commit date for each component on their release branches via GitHub API
- Identified 8 stale components needing Konflux rebuild (images expired)
- Created comprehensive freshness report with re-trigger checklist for Phase 2
- Updated Phase 2 scope with concrete stale component list

## Task Execution

1. **Task 1: Get exact branch names from hack config** - Cloned hack repo, extracted 11 component configs
2. **Task 2: Check pipeline freshness for each component** - GitHub API calls for branch commit dates
3. **Task 3: Compile stale components list** - Created KONFLUX-FRESHNESS-REPORT.md
4. **Task 4: Update Phase 2 scope** - Updated ROADMAP.md with findings

## Files Created/Modified

- `.planning/phases/01-assessment/KONFLUX-FRESHNESS-REPORT.md` - Complete freshness report with re-trigger checklist
- `.planning/ROADMAP.md` - Updated Assessment Findings section with stale component details

## Key Findings

### Component Status (11 total)

| Status | Count | Components |
|--------|-------|------------|
| FRESH (< 72h) | 3 | console-plugin (10h), manual-approval-gate (9h), operator (9h) |
| STALE (> 72h) | 8 | tektoncd-pipeline (2263h), tektoncd-triggers (2504h), tektoncd-chains (2505h), tektoncd-results (2505h), tektoncd-hub (2505h), tektoncd-cli (1934h), pac-downstream (1935h), tektoncd-git-clone (2505h) |

### Components Not in Scope

- `opc` - Not in hack config for 1.15.x
- `tekton-caches` - Not in hack config for 1.15.x
- `tektoncd-pruner` - Not in hack config for 1.15.x

## Decisions Made

1. **11 components tracked, not 14** - The hack repo's `config/konflux/repos/` is authoritative; opc/caches/pruner not included
2. **Empty commit recommended** - Simplest method to trigger on-push pipelines without code changes
3. **Check commit date, not workflow run** - Commit date on branch is sufficient proxy for pipeline freshness

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed bash array syntax for zsh compatibility**
- **Found during:** Task 2 (Check pipeline freshness)
- **Issue:** Associative array syntax `declare -A` failed in zsh
- **Fix:** Rewrote script using function calls instead of associative arrays
- **Verification:** Script executed successfully, all 11 components checked

---

**Total deviations:** 1 auto-fixed (blocking bash syntax issue)
**Impact on plan:** Minor script adjustment, no impact on assessment results

## Issues Encountered

None - all GitHub API calls succeeded, all components accessible

## Next Phase Readiness

**Phase 1: Assessment is now COMPLETE (2/2 plans)**

Ready for Phase 2: Fix Blockers with clear action items:
- **02-01:** Re-trigger 8 stale Konflux on-push pipelines
- **02-02:** Diagnose PR #903 Konflux pipeline failure
- **02-03:** Verify all images built successfully

**Blockers carried forward:**
- 8 components need rebuild before dev release can proceed
- PR #903 has pipeline failure to investigate

---
*Phase: 01-assessment*
*Completed: 2026-01-19*
