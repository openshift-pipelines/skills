---
phase: 02-fix-blockers
plan: 04
subsystem: infra
tags: [konflux, ci, pipeline, verification, release-readiness]

# Dependency graph
requires:
  - phase: 02-fix-blockers
    provides: [re-triggered pipelines, PAC_BUILDER fix, component-builds skill]
provides:
  - All 11 component images verified fresh (<72h)
  - All Konflux on-push pipelines passing
  - oauth2 CVE fix merged via PR #908
  - Phase 2 blockers resolved
affects: [dev-release, stage-release, prod-release]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified: []

key-decisions:
  - "Close PR #903 and use update-sources workflow for fresh sync"
  - "PR #908 created with oauth2 v0.27.0 fix from upstream"
  - "Trigger operator-update-images workflow to update bundle with fresh component images"

patterns-established:
  - "Release build order: CORE → CLI → OPERATOR → INDEX"

issues-created: []

# Metrics
duration: 38min
completed: 2026-01-19
---

# Phase 2 Plan 4: Verify All Images Summary

**All 11 Konflux components verified fresh with passing pipelines — ready for dev release**

## Performance

- **Duration:** 38 min
- **Started:** 2026-01-19T13:26:48Z
- **Completed:** 2026-01-19T14:04:28Z
- **Tasks:** 3 + operator update
- **Files modified:** 0 (verification only)

## Accomplishments

- Verified all 8 re-triggered component pipelines completed successfully
- Closed stale PR #903 and triggered fresh upstream sync via workflow
- PR #908 created and merged with oauth2 v0.27.0 CVE fix
- All 11 component images confirmed fresh (<72h) and ready for release
- Triggered operator-update-images workflow to update bundle with fresh images
- Operator PR #14206 merged and on-push build completed successfully

## Pipeline Results

| # | Component | Pipeline Status | Conclusion |
|---|-----------|-----------------|------------|
| 1 | tektoncd-pipeline | completed | ✅ success |
| 2 | tektoncd-triggers | completed | ✅ success |
| 3 | tektoncd-chains | completed | ✅ success |
| 4 | tektoncd-results | completed | ✅ success |
| 5 | tektoncd-hub | completed | ✅ success |
| 6 | tektoncd-cli | completed | ✅ success |
| 7 | pac-downstream | completed | ✅ success |
| 8 | tektoncd-git-clone | completed | ✅ success |
| 9 | console-plugin | completed | ✅ success |
| 10 | manual-approval-gate | completed | ✅ success |
| 11 | operator | completed | ✅ success |

## Image Freshness

| # | Component | Branch | Age | Status |
|---|-----------|--------|-----|--------|
| 1 | tektoncd-pipeline | release-v1.15.x | 7h | ✅ FRESH |
| 2 | tektoncd-triggers | release-v1.15.x | 7h | ✅ FRESH |
| 3 | tektoncd-chains | release-v1.15.x | 7h | ✅ FRESH |
| 4 | tektoncd-results | release-v1.15.x | 7h | ✅ FRESH |
| 5 | tektoncd-hub | release-v1.15.x | 7h | ✅ FRESH |
| 6 | tektoncd-cli | release-v1.15.x | 5h | ✅ FRESH |
| 7 | pac-downstream | release-v1.15.x | 7h | ✅ FRESH |
| 8 | tektoncd-git-clone | release-v1.15.x | 7h | ✅ FRESH |
| 9 | console-plugin | release-v1.15.x | 12h | ✅ FRESH |
| 10 | manual-approval-gate | release-v0.2.2 | 11h | ✅ FRESH |
| 11 | operator | release-v1.15.x | 11h | ✅ FRESH |

## PR Status

### PR #903 (original oauth2 fix)
- **State:** CLOSED
- **Reason:** Stale after PRs #906/#907 merged; replaced by fresh sync

### PR #906 (PAC_BUILDER fix)
- **State:** MERGED (2026-01-19)
- **Impact:** Fixed Konflux pipeline for tektoncd-cli

### PR #907 (TKN_VERSION update)
- **State:** MERGED (2026-01-19)
- **Impact:** Updated to 0.37.2

### PR #908 (fresh upstream sync)
- **State:** MERGED (2026-01-19T13:38:28Z)
- **Impact:** Brought oauth2 v0.27.0 fix from upstream tektoncd/cli release-v0.37.2

### Operator PR #14206 (bundle update)
- **State:** MERGED (2026-01-19T14:01:05Z)
- **Impact:** Updated operator bundle with fresh component image references
- **Triggered by:** `operator-update-images` workflow with `environment=devel`

## Release Build Order (Critical Knowledge)

Builds must complete in this order for each layer to pick up fresh images:

1. **CORE** — pipeline, triggers, chains, results, hub, pac, git-clone, console-plugin, manual-approval-gate
2. **CLI** — tektoncd-cli (depends on CORE)
3. **OPERATOR** — bundles all component images (depends on CORE + CLI)
4. **INDEX** — per-OCP-version index images (depends on OPERATOR) — *Next step in dev release*

## Blockers Resolved

- [x] 8 stale components rebuilt (02-01)
- [x] PAC_BUILDER registry issue fixed (PR #906)
- [x] TKN_VERSION updated (PR #907)
- [x] oauth2 CVE fix merged (PR #908)
- [x] All 11 component pipelines passing
- [x] All images fresh (<72h)
- [x] Operator bundle updated with fresh images (PR #14206)

## Decisions Made

1. **Close PR #903, use workflow for fresh sync** — PR #903 was stale after #906/#907 merged. Running `update-sources-release-v1.15.x` workflow created a fresh PR #908 with clean history.

2. **Trigger operator-update-images workflow manually** — After component builds complete, the operator needs to be updated with fresh image references. Ran `gh workflow run operator-update-images --ref release-v1.15.x -f environment=devel` to trigger the update.

## Deviations from Plan

None - plan executed as written with user-directed workflow for PR handling.

## Issues Encountered

None

## Next Phase Readiness

**Phase 2: Fix Blockers COMPLETE**

All blocking issues resolved:
- CVEs: All 3 fixed (jwt-go v4.5.2, x/crypto v0.35.0, oauth2 v0.27.0)
- Konflux: All 11 components have fresh, passing builds
- PRs: All required PRs merged (#906, #907, #908)

**Ready for Phase 3: Dev Release**

Run: `/gsd:plan-phase 3`

---
*Phase: 02-fix-blockers*
*Completed: 2026-01-19*
