# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Ship 1.15.4 with all blocking CVEs and issues resolved.
**Current focus:** Phase 3 — Dev Release (testing deployment on cluster)

## Current Position

Phase: 3 of 5 (Dev Release)
Plan: 2 of 2 in current phase
Status: **READY** — Plan 03-02 created
Last activity: 2026-01-19 — Deployment test revealed missing component images

Progress: █████████░ 85%

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
- ~~ISS-004: Document registry usage for different release stages in skills~~ (CLOSED - created /osp:registry-info skill)
- ~~ISS-005: Index PR Konflux pipelines failing~~ (CLOSED - PR #14224 merged)
- **ISS-006: Snyk SAST false positives causing EC failures** (OPEN - deferred post-1.15.4)

**1 open issue** — ISS-006 is a **stage release blocker** (must fix before Phase 4).

### Blockers/Concerns

**Phase 2 Complete — All blockers resolved:**
- ~~CVEs needing fixes (jwt-go, oauth2, x/crypto)~~ → **ALL FIXED** (jwt-go v4.5.2, x/crypto v0.35.0, oauth2 v0.27.0 via PR #908)
- ~~Upstream changes pending~~ → **MERGED** (PR #908)
- ~~Konflux image freshness~~ → **RESOLVED: All 11 components FRESH**
- ~~Konflux pipeline failure on PR #903~~ → **FIXED** (PRs #906, #907 merged, PR #903 closed, PR #908 created fresh)
- ~~8 stale components need rebuild~~ → **COMPLETE: All 11 passed**
- ~~Operator needs fresh images~~ → **COMPLETE** (PR #14206 merged, on-push build passed)

**Phase 3 COMPLETE — All blockers resolved**

- ~~ISS-005: Index PR Konflux pipelines failing~~ → **FIXED** (PR #14224 merged)
- All 5 catalog PRs merged and on-push pipelines passed
- All 5 index images copied to quay.io/openshift-pipeline
- Dev release ready for QE testing

**No current blockers.**

## Session Continuity

Last session: 2026-01-20T19:30:00Z
Stopped at: Waiting on PR #14352 approval; ISS-006 (Snyk false positives) documented as stage blocker
Resume file: .planning/phases/03-dev-release/.continue-here.md

**Current state:** PR #14352 (Go builder update) awaiting team approval. EC failures are pre-existing Snyk SAST false positives (ISS-006). Dev release can proceed after merge; ISS-006 must be fixed before stage release.

**Phase 3: Dev Release**

### Plan 03-01: Index Images (COMPLETE - 2nd attempt succeeded)
- [x] Task 1: Run index-render-template workflow ✅
- [x] Task 2: Fix duplicate bundle issue (PR #14345) ✅
- [x] Task 3: Merge catalog PRs (v4.14-v4.18) ✅
- [x] Task 4: Close OCP 4.12 (EOL) ✅

**Catalog PRs Merged:**
- #14346 (v4.14), #14347 (v4.18), #14348 (v4.15), #14350 (v4.16), #14340 (v4.17)

### Plan 03-02: Dev Release (IN PROGRESS)
**New blocker discovered:** ubi8/ubi base images are 2 months stale

**UBI8 Status:**
- ubi8/ubi:latest (operator/proxy/webhook): sha256:bcfca5f (Nov 2025) - STALE
- ubi8/ubi-minimal (bundle): sha256:b3b8ab0 (Jan 2026) - CURRENT
- Konflux nudge PR #14184 exists but has failing pipelines

**Remaining tasks:**
- [ ] Investigate/fix ubi8 nudge PR #14184 failures
- [ ] Merge ubi8 update and trigger component rebuilds
- [ ] Copy index images to dev registry
- [ ] Copy component images to dev registry
- [ ] Test deployment on OCP 4.18 cluster
- [ ] Generate QE handoff

**Test Cluster:** OCP 4.18.30 (api.e8yd8-jboom-ft5.xazm.p3.openshiftapps.com)

**Next:** Investigate PR #14184 Konflux pipeline failures
