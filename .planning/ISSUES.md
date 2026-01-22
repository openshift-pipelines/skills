# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Blockers

### ISS-008: CVE-2025-59375 (libexpat) causing EC verification failures

- **Discovered:** Phase 3.2 (2026-01-22) — during operator EC verification log analysis
- **Severity:** HIGH (blocking EC verification)
- **Impact:** ALL operator image architectures fail EC with `cve.cve_blockers` violation (amd64, arm64, ppc64le, s390x)
- **Root Cause:** libexpat < 2.7.2 in UBI8 base image has resource exhaustion vulnerability via XML parsing
- **CVE Details:**
  - ID: CVE-2025-59375
  - Type: CWE-770 (Allocation of Resources Without Limits or Throttling)
  - Fix: libexpat >= 2.7.2
  - Published: 2025-09-15
- **Options to fix:**
  1. **Wait for UBI8 update** — Red Hat releases UBI8 image with libexpat >= 2.7.2
  2. **EC policy exclusion** — Add `"cve.cve_blockers:CVE-2025-59375"` to policy config (temporary)
  3. **Check for new base image** — Verify if updated UBI8 already available
- **References:**
  - https://nvd.nist.gov/vuln/detail/CVE-2025-59375
  - https://access.redhat.com/security/cve/cve-2025-59375
- **Timeline:** Must fix BEFORE stage release (blocker for Phase 4)

---

## Open Enhancements

*None*

## Closed Enhancements

### ISS-007: Missing dev images in quay.io/openshift-pipeline

- **Discovered:** Phase 3.2 (2026-01-21) — QE reported 16 images missing during dev release testing
- **Resolved:** Phase 3.2 (2026-01-22)
- **Resolution:** Copied all 16 missing images from Konflux registry (`quay.io/redhat-user-workloads/tekton-ecosystem-tenant/1-15`) to dev registry (`quay.io/openshift-pipeline`). Images verified accessible with correct SHA256 digests. See `.planning/phases/03.2-fix-missing-dev-images/COPY-LOG.md`.

### ISS-006: Snyk SAST false positives on operator/proxy/webhook (DOWNGRADED)

- **Discovered:** Phase 3 Plan 2 (2026-01-20) — during PR #14352 EC failure investigation
- **Resolved:** Phase 3.2 (2026-01-22) — downgraded to warning-only
- **Resolution:** Analysis of EC verification logs revealed Snyk SAST findings are classified as "informative tests" (`test.no_failed_informative_tests`), which produce **warnings only** — they do NOT cause EC verification to fail. The findings (15-16 "hardcoded credentials" false positives for Kubernetes Secret names) can be safely ignored. Phase 3.3 (Snyk SAST fix) is no longer needed.
- **Original concern:** Thought these caused EC failures blocking stage release
- **Actual status:** Warnings don't block — PRs merge fine, builds succeed

### ISS-004: Document registry usage for different release stages in skills

- **Discovered:** Phase 2 Plan 3 (2026-01-19) — during PR #903 pipeline failure diagnosis
- **Resolved:** Phase 3 (2026-01-20)
- **Resolution:**
  - Added "Registry Flow" and "PAC_BUILDER Lifecycle" sections to `/osp:stage-release` and `/osp:prod-release`
  - Created new `/osp:registry-info` skill with comprehensive registry documentation:
    - Full registry flow diagram (quay.io → stage → prod)
    - Image inspection commands for all three registries
    - PAC_BUILDER update workflow documentation
    - Dockerfile version sync checklist for upstream syncs

### ISS-005: Index PR Konflux pipelines failing due to missing service account

- **Discovered:** Phase 3 Plan 1 (2026-01-19) — during dev release execution
- **Resolved:** Phase 3 Plan 1 (2026-01-20) — PR #14224 merged
- **Resolution:** Fixed the `.tekton` pipeline configurations. All 5 catalog PRs (v4.14-v4.18) merged successfully with passing on-push pipelines. OCP 4.12 skipped (EOL).

### ISS-003: Create /osp:wait-for-builds skill for Konflux pipeline monitoring

- **Discovered:** Phase 2 Task 1 (2026-01-19) — during Konflux rebuild trigger execution
- **Resolved:** Phase 2 Plan 2 (2026-01-19)
- **Resolution:** Implemented as `/osp:component-builds` skill with three modes:
  - `status`: One-shot pipeline status check for all 11 components
  - `watch`: Poll every 15 minutes until complete (3hr timeout)
  - `freshness`: Verify images are fresh (<72h since last commit)
- Skill file: `commands/osp/component-builds.md`
- Covers all ISS-003 requirements plus freshness checking

### ISS-001: Create /osp:pr-pipeline-status skill to diagnose Konflux pipeline failures

- **Discovered:** Phase 1 Task 2 (2026-01-19)
- **Resolved:** Phase 1 (2026-01-19)
- **Resolution:** Created `commands/osp/pr-pipeline-status.md` skill with:
  - PR check status via `gh pr checks`
  - Konflux pipeline URL parsing
  - SSO authentication flow (prompts user to configure via `/osp:configure`)
  - Common failure pattern diagnosis (base images, EC, build errors)
  - Actionable fix recommendations
- Updated `/osp:configure` to support Konflux SSO cookie storage

### ISS-002: Register release-checklist skill in package.json

- **Discovered:** Phase 1 Task 2 (2026-01-19)
- **Resolved:** Phase 1 (2026-01-19)
- **Resolution:** Not needed - install script auto-discovers all `.md` files in `commands/osp/`. The skill file already exists and will be available after reinstall (`node bin/install.js -g`).
