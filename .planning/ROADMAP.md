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
- [ ] **Phase 3.2: Fix Snyk SAST False Positives** - Resolve ISS-006 EC failures (INSERTED)
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

### Phase 3.2: Fix Snyk SAST False Positives (INSERTED)
**Goal**: Resolve ISS-006 — Snyk SAST false positives causing EC failures on operator/proxy/webhook PRs
**Depends on**: Phase 3.1
**Research**: Complete (see 03.2-RESEARCH.md)
**Plans**: 2 plans
**Status**: Planned

Plans:
- [ ] 03.2-01: Locate false positives and test #nosec suppression approach
- [ ] 03.2-02: Implement fix and verify EC passes

**Problem (ISS-006):**
- Snyk SAST scanner flags 15-16 "hardcoded credentials" false positives
- Kubernetes Secret resource names (e.g., `"tekton-results-postgres"`) flagged as credentials
- Environment variable keys (e.g., `"POSTGRES_PASSWORD"`) flagged as credentials
- These are NOT actual credentials, just string constants for names/keys
- EC checks fail but GitHub merge still works (workaround)

**Approach (from research):**
1. Primary: Add `#nosec G101` comments with justification (most maintainable)
2. Fallback: Use IGNORE_FILE_PATHS if #nosec doesn't work with Snyk Code
3. Alternative: Snyk Web UI ignores (requires org access)

**Must complete before:** Phase 4 (Stage Release)

### Phase 4: Stage Release
**Goal**: Execute stage release — CORE → CLI → OPERATOR → INDEX to registry.stage.redhat.io
**Depends on**: Phase 3.2 (ISS-006 must be resolved first)
**Research**: Unlikely (following established /osp:stage-release workflow)
**Plans**: 1 plan
**Status**: Waiting on Phase 3.2

Plans:
- [ ] 04-01: Execute stage release using /osp:stage-release

**Blocker Details (ISS-006):**
- Snyk SAST scanner flags Kubernetes Secret resource names as "hardcoded credentials"
- Affects operator/proxy/webhook PRs (15-16 findings each)
- EC checks fail but GitHub merge still works
- Must fix before stage release
- See `.planning/ISSUES.md` for fix options

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
| 2. Fix Blockers | 4/4 | Complete | 2026-01-19 |
| 3. Dev Release | 2/2 | Complete | 2026-01-20 |
| 3.1 Skill Refinement | 1/1 | ✅ Complete (INSERTED) | 2026-01-21 |
| 3.2 Fix Snyk SAST | 0/2 | Planned (INSERTED) | - |
| 4. Stage Release | 0/1 | Waiting on 3.2 | - |
| 5. Production Release | 0/1 | Not started | - |
