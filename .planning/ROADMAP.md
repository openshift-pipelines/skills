# Roadmap: OpenShift Pipelines 1.15.4 Patch Release

## Overview

Execute the 1.15.4 patch release from assessment through production. Start by understanding the release state and blocking issues, resolve CVEs and build problems, then execute the release pipeline through dev → stage → production environments.

## Domain Expertise

None

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Assessment** - Analyze Jira version, identify all blocking issues
- [ ] **Phase 2: Fix Blockers** - Resolve CVEs, upstream deps, build/CI issues
- [ ] **Phase 3: Dev Release** - Execute development release for internal testing
- [ ] **Phase 4: Stage Release** - Execute stage release (CORE → CLI → OPERATOR → INDEX)
- [ ] **Phase 5: Production Release** - Execute production release after QE validation

## Phase Details

### Phase 1: Assessment
**Goal**: Understand complete release state — all issues, CVEs, blockers, component status
**Depends on**: Nothing (first phase)
**Research**: Unlikely (using existing skills that query Jira API)
**Plans**: 1 plan

Plans:
- [x] 01-01: Run release-status and release-checklist skills

### Phase 2: Fix Blockers
**Goal**: Resolve all blocking issues — CVEs via upstream-first, build/CI fixes, pending PRs
**Depends on**: Phase 1
**Research**: Likely (need to check upstream releases, dependency versions, CVE fix versions)
**Research topics**: Upstream tektoncd/* release branches, CVE fix versions for jwt-go/oauth2/x/crypto, Konflux pipeline status
**Plans**: TBD (depends on assessment findings)

Plans:
- [ ] 02-01: TBD after assessment

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
| 1. Assessment | 1/1 | Complete | 2026-01-19 |
| 2. Fix Blockers | 0/? | Not started | - |
| 3. Dev Release | 0/1 | Not started | - |
| 4. Stage Release | 0/1 | Not started | - |
| 5. Production Release | 0/1 | Not started | - |
