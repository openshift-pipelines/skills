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
- [ ] **Phase 2: Fix Blockers** - Resolve CVEs, upstream deps, build/CI issues, re-trigger stale Konflux builds
- [ ] **Phase 3: Dev Release** - Execute development release for internal testing
- [ ] **Phase 4: Stage Release** - Execute stage release (CORE → CLI → OPERATOR → INDEX)
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
- [ ] 02-03: Diagnose and fix PR #903 Konflux pipeline failure
- [ ] 02-04: Verify all images built successfully before dev release

### Phase 3: Dev Release
**Goal**: Execute development release for internal testing and validation
**Depends on**: Phase 2
**Research**: Unlikely (following established workflow)
**Plans**: 1 plan

Plans:
- [ ] 03-01: Execute dev release workflow

### Phase 4: Stage Release
**Goal**: Execute stage release — CORE → CLI → OPERATOR → INDEX to registry.stage.redhat.io
**Depends on**: Phase 3
**Research**: Unlikely (following established /osp:stage-release workflow)
**Plans**: 1 plan

Plans:
- [ ] 04-01: Execute stage release using /osp:stage-release

### Phase 5: Production Release
**Goal**: Execute production release after QE validation — all images to registry.redhat.io
**Depends on**: Phase 4 + QE sign-off
**Research**: Unlikely (following established /osp:prod-release workflow)
**Plans**: 1 plan

Plans:
- [ ] 05-01: Execute production release using /osp:prod-release

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Assessment | 2/2 | Complete | 2026-01-19 |
| 2. Fix Blockers | 2/4 | In progress | - |
| 3. Dev Release | 0/1 | Not started | - |
| 4. Stage Release | 0/1 | Not started | - |
| 5. Production Release | 0/1 | Not started | - |
