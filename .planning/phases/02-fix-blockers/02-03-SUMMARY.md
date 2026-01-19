---
phase: 02-fix-blockers
plan: 03
subsystem: ci
tags: [konflux, registry, pac, cli, dockerfile]

# Dependency graph
requires:
  - phase: 01-assessment
    provides: PR #903 identified as blocker with Konflux failure
provides:
  - PR #906: PAC_BUILDER fix using quay.io dev registry
  - PR #907: TKN_VERSION update to 0.37.2
  - ISS-004: Registry workflow documentation enhancement
affects: [02-04-verify-builds, stage-release, prod-release]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Registry flow: quay.io (dev) → registry.stage.redhat.io (stage) → registry.redhat.io (prod)"
    - "Dockerfile version ARGs must be updated manually on upstream sync"

key-files:
  created: []
  modified: []

key-decisions:
  - "Use quay.io/openshift-pipeline dev registry for PAC_BUILDER (publicly accessible)"
  - "Separate PRs for PAC_BUILDER fix and TKN_VERSION update"
  - "Document registry workflow in skills (ISS-004)"

patterns-established:
  - "Registry usage pattern for different release stages"
  - "Dockerfile updates required on upstream sync"

issues-created: [ISS-004]

# Metrics
duration: 32min
completed: 2026-01-19
---

# Phase 2 Plan 3: Diagnose PR #903 Summary

**Diagnosed PAC_BUILDER registry issue, created PRs #906 and #907 to unblock CLI builds**

## Performance

- **Duration:** 32 min
- **Started:** 2026-01-19T12:51:18Z
- **Completed:** 2026-01-19T13:23:19Z
- **Tasks:** 3 (diagnosis, checkpoint decision, apply fix)
- **Files modified:** 0 (changes in external repo)

## Diagnosis

- **PR:** openshift-pipelines/tektoncd-cli #903
- **Failure Type:** Base image not found
- **Error Message:**
  ```
  Error: unable to copy from source docker://registry.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel8@sha256:dca3d61...
  manifest unknown
  ```
- **Root Cause:** The PAC CLI image at `registry.redhat.io` (production registry) was purged. The Konflux nudge bot had updated the Dockerfile to use production registry, but that image expired before a new release refreshed it.

## Registry Flow Discovered

| Registry | Purpose | Auth Required |
|----------|---------|---------------|
| `quay.io/openshift-pipeline/` | Dev/CI builds | No (public) |
| `registry.stage.redhat.io/` | Stage releases | Yes |
| `registry.redhat.io/` | Production releases | Yes |

The PAC_BUILDER must be updated at each release stage:
- Dev/CI: `quay.io/openshift-pipeline/pipelines-pipelines-as-code-cli-rhel8:1.15`
- Stage: `registry.stage.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel8@sha256:...`
- Prod: `registry.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel8@sha256:...`

## Fix Applied

Created two PRs to tektoncd-cli repository:

### PR #906: PAC_BUILDER fix
- **Change:** `registry.redhat.io/...@sha256:dca3d61...` → `quay.io/openshift-pipeline/...@sha256:9e48b69...`
- **URL:** https://github.com/openshift-pipelines/tektoncd-cli/pull/906

### PR #907: TKN_VERSION update
- **Change:** `ARG TKN_VERSION=0.37.1` → `ARG TKN_VERSION=0.37.2`
- **URL:** https://github.com/openshift-pipelines/tektoncd-cli/pull/907
- **Reason:** PR #903 syncs upstream 0.37.2 but Dockerfile wasn't updated

## Merge Order

1. PR #906 (PAC_BUILDER fix) — unblocks builds
2. PR #907 (TKN_VERSION) — matches upstream
3. PR #903 (oauth2 CVE fix) — rebase after above merged

## Issues Logged

- **ISS-004:** Document registry usage for different release stages in skills
  - Registry flow documentation
  - PAC_BUILDER update workflow
  - Dockerfile version updates on upstream sync

## Current Status

- **PR #906:** Open, awaiting review/merge
- **PR #907:** Open, awaiting review/merge
- **PR #903:** Will need rebase after #906 and #907 merge, then should pass

## Next Step

After PRs #906 and #907 merge:
1. Rebase PR #903 onto updated release-v1.15.x
2. Verify Konflux pipeline passes
3. Proceed to 02-04 (verify all builds)

---
*Phase: 02-fix-blockers*
*Completed: 2026-01-19*
