---
phase: 03-dev-release
plan: 02
subsystem: release
tags: [konflux, operator, index, skopeo, quay]

requires:
  - phase: 02-fix-blockers
    provides: CVE fixes in Konflux builds
  - phase: 03-dev-release/03-01
    provides: Index images copied to dev registry
provides:
  - Version bump to 1.15.4 in project.yaml
  - Update-sources workflow synced upstream changes
  - Index-render-template workflow updated catalogs
  - All 31 component images copied to quay.io/openshift-pipeline
affects: [04-stage-release, deployment]

tech-stack:
  added: []
  patterns: [multi-arch image copy with skopeo]

key-files:
  created: []
  modified:
    - operator/project.yaml (version bump)
    - operator/.konflux/olm-catalog (catalog updates)

key-decisions:
  - "Branch is release-v1.15.x (not release-v1.15)"
  - "operator-update-images workflow misconfigured for release branches"
  - "31 multi-arch images require parallel copy for efficiency"
  - "Index images need fresh build from Konflux after catalog PR merge"

patterns-established:
  - "Parallel skopeo copy (4 concurrent) for multi-arch images"

issues-created: []

duration: ~75 min
completed: 2026-01-19 (partial)
---

# Phase 3 Plan 2: Dev Release 1.15.4 Summary

**Version bump to 1.15.4, all component images copied to dev registry. BLOCKED on fresh index image.**

## Performance

- **Duration:** ~75 min (plus background image copy time)
- **Started:** 2026-01-19T19:04:39Z
- **Status:** Partial - blocked on index image
- **Tasks:** 5/7 completed, 1 blocked, 1 pending

## Accomplishments

- Version updated to 1.15.4 in project.yaml (PR #14237 merged)
- Update-sources workflow synced upstream (PR #14238 merged)
- Index-render-template workflow ran (PR #14239 for v4.12 merged)
- All 31 component images copied to quay.io/openshift-pipeline

## Task Status

| Task | Status | Details |
|------|--------|---------|
| 1. Update project.yaml to 1.15.4 | ✅ Complete | PR #14237 merged |
| 2. Run update-sources workflow | ✅ Complete | PR #14238 merged |
| 3. Run operator-update-images | ✅ Complete | Bundle already correct in repo |
| 4. Run index-render-template | ✅ Complete | PR #14239 merged |
| 5. Copy images to dev registry | ✅ Complete | 31/31 images copied |
| 6. Test deployment | ⚠️ BLOCKED | Index image stale |
| 7. Generate QE handoff | ⏸️ Pending | Waiting on deployment |

## Files Created/Modified

In openshift-pipelines/operator repo:
- `project.yaml` - Version bump from 1.15.3 to 1.15.4
- Catalog PRs merged for index templates

## Decisions Made

1. **Branch naming:** Correct branch is `release-v1.15.x` (not `release-v1.15`)
2. **operator-update-images skipped:** Workflow configured for main branch; bundle in repo already has correct dev registry references
3. **Parallel copy strategy:** 4 concurrent skopeo processes to copy multi-arch images efficiently

## Deviations from Plan

### Discovery: Index image timing issue

- **Found during:** Task 6 (Test deployment)
- **Issue:** Index image in `quay.io/openshift-pipeline/pipelines-index-4.18:1.15` was built at 15:47:58Z, but catalog PR merged at 19:14:21Z
- **Impact:** Index contains old bundle referencing `registry.redhat.io` instead of new bundle referencing `quay.io/openshift-pipeline`
- **Result:** Pods fail with ImagePullBackOff trying to pull from registry.redhat.io

## Blocker: Fresh Index Image Needed

**Problem:**
The index image in the dev registry predates the catalog PR merge. It contains the old bundle that references `registry.redhat.io/openshift-pipelines/` but those images don't exist with the new SHAs.

**Component images:** ✅ Exist in `quay.io/openshift-pipeline/` with correct SHAs
**Bundle CSV in repo:** ✅ References `quay.io/openshift-pipeline/`
**Index image:** ❌ Contains old bundle referencing `registry.redhat.io`

**Resolution:**
Need to copy fresh index images from Konflux after their on-push builds complete:
1. Wait for Konflux to build new index images (triggered by catalog PR merge)
2. Copy from `quay.io/redhat-user-workloads/tekton-ecosystem-tenant/1-15/index-4-18` to `quay.io/openshift-pipeline/pipelines-index-4.18:1.15`
3. Restart deployment test

**Konflux Authentication:** Required for accessing `quay.io/redhat-user-workloads/`

## Images Copied to Dev Registry

All 31 component images successfully copied from Konflux to dev registry:

```
pipelines-chains-controller-rhel8
pipelines-cli-tkn-rhel8
pipelines-console-plugin-rhel8
pipelines-git-init-rhel8
pipelines-hub-api-rhel8
pipelines-hub-db-migration-rhel8
pipelines-hub-ui-rhel8
pipelines-manual-approval-gate-controller-rhel8
pipelines-manual-approval-gate-webhook-rhel8
pipelines-operator-bundle-rhel8
pipelines-rhel8-operator
pipelines-operator-proxy-rhel8
pipelines-operator-webhook-rhel8
pipelines-pipeline-controller-rhel8
pipelines-pipeline-entrypoint-rhel8
pipelines-pipeline-events-rhel8
pipelines-pipeline-nop-rhel8
pipelines-pipeline-resolvers-rhel8
pipelines-pipeline-sidecarlogresults-rhel8
pipelines-pipeline-webhook-rhel8
pipelines-pipeline-workingdirinit-rhel8
pipelines-pipelines-as-code-cli-rhel8
pipelines-pipelines-as-code-controller-rhel8
pipelines-pipelines-as-code-watcher-rhel8
pipelines-pipelines-as-code-webhook-rhel8
pipelines-results-api-rhel8
pipelines-results-watcher-rhel8
pipelines-triggers-controller-rhel8
pipelines-triggers-core-interceptors-rhel8
pipelines-triggers-eventlistenersink-rhel8
pipelines-triggers-webhook-rhel8
```

## Test Cluster Status

**Cluster:** OCP 4.18.30 (api.e8yd8-jboom-ft5.xazm.p3.openshiftapps.com)

- CatalogSource: ✅ Ready
- Operator CSV: v1.15.3 Succeeded (old version from stale index)
- Component Pods: ❌ ImagePullBackOff

## Next Steps

1. **Re-authenticate to Konflux** - Need fresh token for `quay.io/redhat-user-workloads/`
2. **Copy fresh index images** - From Konflux builds to dev registry
3. **Re-test deployment** - Should work once index references dev registry
4. **Generate QE handoff** - After successful deployment verification

## Issues Encountered

- operator-update-images workflow runs on main branch but release branch doesn't have the Makefile target
- mirror-operand-images workflow has same issue
- ImageDigestMirrorSet not available on hosted cluster (ROSA)

---
*Phase: 03-dev-release*
*Partial completion: 2026-01-19*
