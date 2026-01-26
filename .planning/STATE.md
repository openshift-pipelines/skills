# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-01-19)

**Core value:** Ship 1.15.4 with all blocking CVEs and issues resolved.
**Current focus:** Phase 3.5 (Dev Release v2 with FIPS fix), then resolve CVE-2025-59375 before Stage Release

## Current Position

Phase: 3.5 of 5 (Dev Release v2) — **IN PROGRESS**
Plan: 3 of 4
Status: Plans 1-3 complete (partial) — Component images copied, index blocked
Last activity: 2026-01-26 — Completed 03.5-02 (FIPS verify), 03.5-03 (partial - component images copied)

Progress: █████████░ 95% (Phase 3.5 Plans 1-3 complete, Plan 4 deferred, index images pending)

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
| 03.5-01 | pac-downstream already had CPE labels | Research was outdated - no PR needed for pac-downstream |
| 03.5-01 | Merged PR #38 for Konflux configs | Required for v1.15.x on-push pipelines to trigger |

### Roadmap Evolution

- Phase 3.1 inserted after Phase 3: Skill Refinement (INSERTED) — improve skills with project learnings while waiting for ISS-006 resolution
- Phase 3.2 inserted: Fix Missing Dev Images (INSERTED) — 16 images missing from quay.io/openshift-pipeline reported by QE
- Phase 3.3: Fix Snyk SAST False Positives — **CANCELLED** (warnings only, don't block EC)
- Phase 3.4 inserted: Cherry-pick FIPS Fix (INSERTED) — nop.Dockerfile FIPS fix needed on release-v1.15.x — **COMPLETE**
- Phase 3.5 inserted: Dev Release v2 (INSERTED) — re-execute dev release with FIPS fix, fresh images for QE

### Deferred Issues

See .planning/ISSUES.md:
- ~~ISS-001: Create /osp:pr-pipeline-status skill~~ (CLOSED)
- ~~ISS-002: Register release-checklist skill~~ (CLOSED)
- ~~ISS-003: Create /osp:wait-for-builds skill~~ (CLOSED - implemented as /osp:component-builds)
- ~~ISS-004: Document registry usage for different release stages in skills~~ (CLOSED - created /osp:registry-info skill)
- ~~ISS-005: Index PR Konflux pipelines failing~~ (CLOSED - PR #14224 merged)
- ~~ISS-006: Snyk SAST false positives~~ (CLOSED - downgraded to warning-only, doesn't block EC)
- ~~ISS-007: Missing dev images in quay.io/openshift-pipeline~~ (CLOSED - 16 images copied)
- **ISS-008: CVE-2025-59375 (libexpat) in UBI8 base image** (OPEN - blocking EC verification)

**1 open issue** — ISS-008 blocks stage release (CVE in base image).

### Blockers/Concerns

**BLOCKER: CVE-2025-59375 (libexpat) in UBI8 base image:**
- HIGH severity CVE causing EC verification failures on operator images
- Affects ALL architectures (amd64, arm64, ppc64le, s390x)
- Fix: libexpat >= 2.7.2 in base image
- Options: Wait for UBI8 update OR request EC policy exclusion
- See ISS-008 in ISSUES.md

**RESOLVED:**
- ~~Phase 3.2 — Missing Dev Images~~ → 16 images copied to quay.io/openshift-pipeline
- ~~Phase 3.3 — Snyk SAST~~ → Downgraded to warning-only, doesn't block EC
- ~~Phase 3.4 — Cherry-pick FIPS Fix~~ → PR #1540 merged, Konflux rebuild triggered

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
- Dev release deployed and verified
- **QE handoff delivered** — testing in progress (found missing images)

**Recent Progress (2026-01-20):**
- PR #14352: Go builder updated to v1.25 (for Go 1.25.0 support)
- PR #14353-14355: Operator/proxy/webhook rebuilt with new builder
- Dev release images contain all CVE fixes (jwt-go, oauth2, x/crypto)

## Jira Version Status

**Last checked:** 2026-01-20
**Source:** https://issues.redhat.com/projects/SRVKP/versions/12453355

| Status | Count | % |
|--------|-------|---|
| Closed | 30 | 77% |
| Verified | 2 | 5% |
| In Progress | 1 | 3% |
| To Do | 6 | 15% |
| **Total** | **39** | 100% |

### Issues Needing Jira Update (Fixed but not closed)

| Key | CVE | Status | Fix |
|-----|-----|--------|-----|
| SRVKP-7344 | jwt-go memory allocation | To Do | ✅ jwt-go v4.5.2 in images |
| SRVKP-7201 | oauth2 memory consumption | To Do | ✅ PR #908 merged |
| SRVKP-7198 | x/crypto DoS | To Do | ✅ x/crypto v0.35.0 in images |

### Still In Progress

| Key | Issue | Assignee |
|-----|-------|----------|
| SRVKP-9931 | CVE-2025-66506 Fulcio DoS (chains) | Anitha Natarajan |

### Pending (Not Release Blockers)

| Key | Issue | Assignee |
|-----|-------|----------|
| SRVKP-10435 | QE: ResourceIcon colors | Jayesh Garg |
| SRVKP-7482 | Performance regression testing | Unassigned |
| SRVKP-7480 | Release Operator story | Unassigned |

## Session Continuity

Last session: 2026-01-26T12:15:00Z
Stopped at: Phase 3.5 Plans 02/03 executed — component images copied, index blocked on auth
Resume file: .planning/phases/03.5-dev-release-v2/.continue-here.md

**Phase 3.5: Dev Release v2 — IN PROGRESS**

✅ Completed:
- Plan 03.5-01: CPE labels added
- Plan 03.5-02: FIPS rebuild verified (new nop SHA: `96ea90a4...`)
- Plan 03.5-03 (partial): Component images copied to dev registry:
  - pipelines-pipeline-nop-rhel8 (FIPS fix)
  - pipelines-operator-bundle-rhel8
  - pipelines-pipelines-as-code-controller/watcher/cli-rhel8

⚠️ Blocked:
- Index images: Need Konflux auth for index namespace
- Plan 03.5-04: Konflux component registration for 4.19/4.20/4.21

**QE-HANDOFF.md:** Updated with v2 section at `.planning/phases/03-dev-release/QE-HANDOFF.md`

**Test Cluster:** OCP 4.18.30 (api.zjdmf-xyift-oaz.6ccc.p3.openshiftapps.com)

**Before Stage Release:**
1. ~~**Phase 3.4** — Cherry-pick FIPS fix~~ ✅ DONE
2. **Phase 3.5** — Dev Release v2 ⚠️ Partial (component images done, index pending)
3. **CVE-2025-59375 fix** — Wait for UBI8 base image update with libexpat >= 2.7.2

**Next:** Get Konflux auth for index images, then Phase 4 (blocked on CVE fix)
