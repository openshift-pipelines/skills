# Roadmap: OpenShift Pipelines 1.15.4 Patch Release

## Overview

Execute the 1.15.4 patch release from assessment through production. Start by understanding the release state and blocking issues, resolve CVEs and build problems, then execute the release pipeline through dev → stage → production environments.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Assessment** - Analyze Jira version, identify all blocking issues, check Konflux pipeline freshness
- [x] **Phase 2: Fix Blockers** - Resolve CVEs, upstream deps, build/CI issues, re-trigger stale Konflux builds
- [x] **Phase 3: Dev Release** - Execute development release for internal testing ✅ **COMPLETE**
- [x] **Phase 3.1: Skill Refinement** - Improve skills based on project learnings (INSERTED) ✅ **COMPLETE**
- [x] **Phase 3.2: Fix Missing Dev Images** - Copy missing images reported by QE (INSERTED) ✅ **COMPLETE**
- [x] **Phase 3.3: Fix Snyk SAST False Positives** - ~~Resolve ISS-006 EC failures~~ **CANCELLED** (warnings only, don't block EC)
- [x] **Phase 3.4: Cherry-pick FIPS Fix** - Cherry-pick nop.Dockerfile FIPS fix to release-v1.15.x (INSERTED) ✅ **COMPLETE**
- [ ] **Phase 3.5: Dev Release v2** - Re-execute dev release with FIPS fix, fresh images for QE (INSERTED)
- [ ] **Phase 4: Stage Release** - Execute stage release (CORE → CLI → OPERATOR → INDEX) — **BLOCKED** on CVE-2025-59375
- [ ] **Phase 5: Production Release** - Execute production release after QE validation

## Phase Details

### Phase 1: Assessment
**Goal**: Understand complete release state — all issues, CVEs, blockers, component status, Konflux pipeline freshness
**Depends on**: Nothing (first phase)
**Research**: Unlikely (using existing skills that query Jira API and GitHub)
**Plans**: 2 plans

Plans:
- [x] 01-01: Run release-status and release-checklist skills
- [x] 01-02: Check Konflux on-push pipeline freshness for all components (72hr threshold)

### Phase 2: Fix Blockers
**Goal**: Resolve all blocking issues — CVEs via upstream-first, build/CI fixes, pending PRs, re-trigger stale Konflux builds
**Depends on**: Phase 1
**Research**: Likely (need to check upstream releases, dependency versions, CVE fix versions)
**Research topics**: Upstream tektoncd/* release branches, CVE fix versions for jwt-go/oauth2/x/crypto, Konflux pipeline status
**Plans**: 4 plans (updated from assessment + ISS-003)

**Assessment Findings (from 01-01 and 01-02):**
- CVEs: 2/3 already fixed (jwt-go v4.5.2, x/crypto v0.35.0), 1 pending in PR #903 (oauth2)
- Konflux freshness (11 components total):
  - **3 FRESH** (< 72h): console-plugin, manual-approval-gate, operator
  - **8 STALE** (> 72h): tektoncd-pipeline, tektoncd-triggers, tektoncd-chains, tektoncd-results, tektoncd-hub, tektoncd-cli, pac-downstream, tektoncd-git-clone
- PR #903 (operator): Has Konflux pipeline failure needing diagnosis
- See: `.planning/phases/01-assessment/KONFLUX-FRESHNESS-REPORT.md` for full details

Plans:
- [x] 02-01: Re-trigger stale Konflux on-push pipelines (8 components need rebuild)
- [x] 02-02: Create /osp:component-builds skill (ISS-003 - status/watch/freshness modes)
- [x] 02-03: Diagnose and fix PR #903 Konflux pipeline failure (PRs #906, #907 created)
- [x] 02-04: Verify all images built successfully, update operator bundle (PR #14206)

### Phase 3: Dev Release
**Goal**: Execute development release for internal testing and validation
**Depends on**: Phase 2
**Research**: Unlikely (following established workflow)
**Plans**: 2 plans
**Status**: ✅ **COMPLETE** (2026-01-20)

Plans:
- [x] 03-01: Execute dev release workflow — Index images copied to dev registry
- [x] 03-02: Copy component images, deploy to cluster, verify, create QE handoff

**Completed:**
- 28 component images copied to quay.io/openshift-pipeline
- Deployed on OCP 4.18.30 cluster
- TektonConfig Ready, version 1.15.4
- TaskRun verification passed
- QE handoff: `.planning/phases/03-dev-release/QE-HANDOFF.md`

### Phase 3.1: Skill Refinement (INSERTED)
**Goal**: Improve OSP skills based on project learnings — add domain knowledge, fix discoverability, add cross-references
**Depends on**: Phase 3
**Research**: Unlikely (reviewing existing skills and project history)
**Plans**: 1 plan (executed via checkpoint)
**Status**: ✅ **COMPLETE** (2026-01-21)

Plans:
- [x] 03.1-01: Review and improve all OSP skills with project learnings

**Scope:**
- Update skills with knowledge gained during 1.15.4 release
- Improve specificity and discoverability
- Add cross-references between related skills
- Document common workflows and patterns
- Fix any gaps identified during execution

**Skills Updated:**
- `/osp:help` — Added Common Workflows section, Troubleshooting Quick Reference
- `/osp:release-status` — Added Jira-GitHub sync gap warning with verification steps
- `/osp:component-builds` — Added CEL path filtering, rebuild triggers, build order docs
- `/osp:konflux-image` — Added Snapshots API rationale, comprehensive troubleshooting section
- `/osp:configure` — Added cookie expiration warning, cluster auth section
- `/osp:registry-info` — Added 72-hour freshness rule, registry decision tree

**Key Learnings Encoded:**
- Snapshots API is authoritative (not PipelineRuns)
- Empty commits don't trigger Konflux (CEL path filtering)
- SSO cookies expire after 8-24h
- 72-hour freshness threshold for release images

### Phase 3.2: Fix Missing Dev Images (INSERTED)
**Goal**: Copy 16 missing images reported by QE to quay.io/openshift-pipeline dev registry
**Depends on**: Phase 3.1
**Research**: Unlikely (straightforward image copy operation)
**Plans**: 1 plan
**Status**: ✅ **COMPLETE** (2026-01-22)

Plans:
- [x] 03.2-01: Copy missing images to dev registry and verify QE cluster access

**Completed:**
- All 16 images copied from Konflux registry to quay.io/openshift-pipeline
- Images verified accessible with correct SHA256 digests
- Multi-arch support preserved (4 architectures per image)
- See: `.planning/phases/03.2-fix-missing-dev-images/COPY-LOG.md`

### Phase 3.3: Fix Snyk SAST False Positives (INSERTED) — CANCELLED
**Goal**: ~~Resolve ISS-006 — Snyk SAST false positives causing EC failures~~
**Status**: ❌ **CANCELLED** (2026-01-22)

**Reason for cancellation:**
Analysis of EC verification logs revealed that Snyk SAST findings are classified as "informative tests" (`test.no_failed_informative_tests`), which produce **warnings only**. They do NOT cause EC verification to fail or block releases.

The actual EC failure is caused by **CVE-2025-59375** (libexpat in UBI8 base image), not Snyk SAST.

Plans cancelled:
- ~~03.3-01: Locate false positives and test #nosec suppression approach~~
- ~~03.3-02: Implement fix and verify EC passes~~

See ISS-006 in ISSUES.md (closed as warning-only).

### Phase 3.4: Cherry-pick FIPS Fix (INSERTED)
**Goal**: Cherry-pick FIPS nop.Dockerfile fix from release-v1.20.x to release-v1.15.x
**Depends on**: Phase 3.2
**Research**: None needed
**Plans**: 1 plan
**Status**: ✅ **COMPLETE** (2026-01-22)

Plans:
- [x] 03.4-01: Cherry-pick commit and create PR

**Completed:**
- PR #1540 created and merged to release-v1.15.x
- Merge commit: `ad8982f1db020880b3376c88ea058d4f82b24f12`
- Konflux on-push pipeline triggered for tektoncd-pipeline component
- FIPS nop.Dockerfile fix now in release-v1.15.x branch

### Phase 3.5: Dev Release v2 (INSERTED)
**Goal**: Re-execute dev release with FIPS fix and CPE labels, provide fresh images to QE for validation
**Depends on**: Phase 3.4
**Research**: Completed (see 03.5-RESEARCH.md)
**Plans**: 3 plans in 2 waves
**Status**: Not started

Plans:
- [ ] 03.5-01: Add CPE labels to pac-downstream and p12n-manual-approval-gate Dockerfiles (Wave 1)
- [ ] 03.5-02: Monitor FIPS nop rebuild status and confirm new SHA (Wave 1)
- [ ] 03.5-03: Trigger operator-update-images, copy fresh images, update QE handoff (Wave 2)

**Wave Structure:**
| Wave | Plans | Can Run Parallel |
|------|-------|------------------|
| 1 | 03.5-01, 03.5-02 | Yes (independent) |
| 2 | 03.5-03 | No (depends on Wave 1) |

**Context:**
- Phase 3.4 FIPS fix merged — tektoncd-pipeline nop image will rebuild
- Research identified 5 Dockerfiles missing CPE label (pac-downstream: 3, manual-approval-gate: 2)
- CPE labels required for stage/prod release (enforceContainerFirstSecurityLabels will be enabled)
- After Wave 1 completes, Wave 2 propagates all changes to dev registry

**Workflow:**
1. [Wave 1] Add CPE labels to 5 Dockerfiles, merge PRs, trigger Konflux rebuilds
2. [Wave 1] Monitor FIPS nop rebuild, confirm new SHA available
3. [Wave 2] Trigger operator-update-images workflow
4. [Wave 2] Copy fresh images to quay.io/openshift-pipeline
5. [Wave 2] Update QE-HANDOFF.md with v2 section

### Phase 4: Stage Release
**Goal**: Execute stage release — CORE → CLI → OPERATOR → INDEX to registry.stage.redhat.io
**Depends on**: Phase 3.5 + CVE-2025-59375 resolution
**Research**: Unlikely (following established /osp:stage-release workflow)
**Plans**: 1 plan
**Status**: **BLOCKED** on CVE-2025-59375

Plans:
- [ ] 04-01: Execute stage release using /osp:stage-release

**Pre-requisites (must complete before stage release):**

1. **CVE-2025-59375 (libexpat) fix** — BLOCKING
   - HIGH severity CVE in UBI8 base image
   - All operator image architectures fail EC verification
   - Fix: libexpat >= 2.7.2 in base image
   - Options: Wait for UBI8 update OR request EC policy exclusion
   - See ISS-008 in ISSUES.md

2. **Phase 3.5: Dev Release v2** — Required
   - FIPS fix and CPE labels must be in dev images first

**Note:** ISS-006 (Snyk SAST) is NOT a blocker — findings are warnings only.

### Phase 5: Production Release
**Goal**: Execute production release after QE validation — all images to registry.redhat.io
**Depends on**: Phase 4 + QE sign-off
**Research**: Unlikely (following established /osp:prod-release workflow)
**Plans**: 1 plan

Plans:
- [ ] 05-01: Execute production release using /osp:prod-release

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 3.1 → 3.2 → ~~3.3~~ → 3.4 → 3.5 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Assessment | 2/2 | ✅ Complete | 2026-01-19 |
| 2. Fix Blockers | 4/4 | ✅ Complete | 2026-01-19 |
| 3. Dev Release | 2/2 | ✅ Complete | 2026-01-20 |
| 3.1 Skill Refinement | 1/1 | ✅ Complete (INSERTED) | 2026-01-21 |
| 3.2 Fix Missing Images | 1/1 | ✅ Complete (INSERTED) | 2026-01-22 |
| 3.3 Fix Snyk SAST | - | ❌ Cancelled (warnings only) | 2026-01-22 |
| 3.4 Cherry-pick FIPS | 1/1 | ✅ Complete (INSERTED) | 2026-01-22 |
| 3.5 Dev Release v2 | 0/3 | Not started (INSERTED) | - |
| 4. Stage Release | 0/1 | ⏸️ Blocked on CVE-2025-59375 | - |
| 5. Production Release | 0/1 | Not started | - |
