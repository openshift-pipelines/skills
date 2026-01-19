# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Ship 1.15.4 with all blocking CVEs and issues resolved.
**Current focus:** Phase 3 — Dev Release (BLOCKED)

## Current Position

Phase: 3 of 5 (Dev Release)
Plan: 1 of 1 in current phase
Status: **BLOCKED** — ISS-005 (index PR pipelines failing)
Last activity: 2026-01-19 — Phase 3 execution started, hit blocker at Task 2

Progress: ██████░░░░ 60%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 16.8 min
- Total execution time: 1.68 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Assessment | 2/2 | 13 min | 6.5 min |
| 2. Fix Blockers | 4/4 | 87 min | 21.8 min |

**Recent Trend:**
- Last 5 plans: 01-02 (3 min), 02-01 (15 min), 02-02 (2 min), 02-03 (32 min), 02-04 (38 min)
- Trend: Phase 2 complete, all blockers resolved

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

| Phase | Decision | Rationale |
|-------|----------|-----------|
| 01-01 | 2 of 3 CVEs already fixed | jwt-go v4.5.2 and x/crypto v0.35.0 meet fix versions |
| 01-01 | oauth2 fix in PR #903 | Upstream release-v0.37.2 has v0.27.0, PR brings it downstream |
| 01-02 | 11 components in scope (not 14) | hack repo config is authoritative; opc/caches/pruner not included |
| 01-02 | 8 components need rebuild | Images > 72h old: pipeline, triggers, chains, results, hub, cli, pac, git-clone |
| 02-01 | Dockerfile comment trigger (not empty commit) | Konflux CEL path filtering requires actual file changes |
| 02-02 | Combined skill design | status/watch/freshness modes in single /osp:component-builds skill |
| 02-03 | Use quay.io dev registry for PAC_BUILDER | registry.redhat.io image was purged; quay.io/openshift-pipeline is publicly accessible |
| 02-03 | Separate PRs for PAC_BUILDER and TKN_VERSION | Cleaner git history, independent changes |
| 02-04 | Close PR #903, use update-sources workflow | Fresh sync via workflow cleaner than rebasing stale PR |
| 02-04 | Trigger operator-update-images manually | Ensures operator bundle has fresh component images before dev release |
| 02-04 | Release build order: CORE → CLI → OPERATOR → INDEX | Each layer must complete before next to pick up fresh images |

### Deferred Issues

See .planning/ISSUES.md:
- ~~ISS-001: Create /osp:pr-pipeline-status skill~~ (CLOSED)
- ~~ISS-002: Register release-checklist skill~~ (CLOSED)
- ~~ISS-003: Create /osp:wait-for-builds skill~~ (CLOSED - implemented as /osp:component-builds)
- **ISS-004: Document registry usage for different release stages in skills** (OPEN)
  - Registry flow: quay.io (dev) → registry.stage.redhat.io (stage) → registry.redhat.io (prod)
  - PAC_BUILDER update workflow for CLI
  - Dockerfile version updates on upstream sync

### Blockers/Concerns

**Phase 2 Complete — All blockers resolved:**
- ~~CVEs needing fixes (jwt-go, oauth2, x/crypto)~~ → **ALL FIXED** (jwt-go v4.5.2, x/crypto v0.35.0, oauth2 v0.27.0 via PR #908)
- ~~Upstream changes pending~~ → **MERGED** (PR #908)
- ~~Konflux image freshness~~ → **RESOLVED: All 11 components FRESH**
- ~~Konflux pipeline failure on PR #903~~ → **FIXED** (PRs #906, #907 merged, PR #903 closed, PR #908 created fresh)
- ~~8 stale components need rebuild~~ → **COMPLETE: All 11 passed**
- ~~Operator needs fresh images~~ → **COMPLETE** (PR #14206 merged, on-push build passed)

**Phase 3 BLOCKED — ISS-005: Index PR Konflux pipelines failing**

- **Issue:** All 6 index PRs (#14207-#14212) fail Konflux PR pipelines immediately (~25s)
- **Root cause:** `.tekton/operator-1-15-index-*-pull-request.yaml` files missing `serviceAccountName` in `taskRunTemplate`
- **Error:** `clone-repository` task fails with "Unauthorized error, wrong registry credentials"
- **Why:** Without service account, no registry push credentials for OCI artifact storage
- **Comparison:** Bundle pipeline has `serviceAccountName: build-pipeline-operator-1-15-bundle` and PASSES

**Fix options:**
1. Update hack repo template to include service account for index pipelines
2. Manually add service account to operator repo .tekton files (temporary)
3. Configure Konflux index applications with proper image repository secrets
4. Force merge with `/override` (workaround, not recommended)

**Full details:** See ISS-005 in .planning/ISSUES.md

## Session Continuity

Last session: 2026-01-19
Stopped at: 03-01-PLAN.md Task 2 — blocked by ISS-005 (index PR Konflux pipeline failures)
Resume file: None

**Phase 3 Execution Progress:**
- [x] Task 1: Run index-render-template workflow ✅ (run #21140605709)
- [ ] Task 2: Merge index PRs — **BLOCKED** (all 6 PRs fail Konflux CI)
- [ ] Task 3: Copy images to devel registry (skopeo copy)
- [ ] Task 4: Verify and generate QE handoff

**Next actions (in order of preference):**
1. **Fix ISS-005** — Update hack repo or operator .tekton files to add service account
2. **Workaround** — Force merge with `/override` if blocking release
3. **Wait** — For upstream fix from hack repo maintainers

**To resume:** `/gsd:progress` or `/gsd:execute-plan .planning/phases/03-dev-release/03-01-PLAN.md`

**Plan updates made this session:**
- Added Task 3 (skopeo copy) to 03-01-PLAN.md — per release guide "Get Devel Build" section
- Updated /osp:operator-release skill with devel image copy step
