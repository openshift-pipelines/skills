---
phase: 03-dev-release
plan: 01
subsystem: release
tags: [index, devel, images, konflux, skopeo]

# Dependency graph
requires:
  - phase: 02-fix-blockers
    provides: [fresh component images, operator bundle updated]
provides:
  - All 5 OCP index images in quay.io/openshift-pipeline
  - Dev release ready for QE testing
  - Updated /osp:konflux-image skill with Snapshots API
affects: [stage-release, prod-release]

# Tech tracking
tech-stack:
  added: []
  patterns: [konflux-snapshots-api]

key-files:
  created: []
  modified:
    - commands/osp/konflux-image.md

key-decisions:
  - "Use Snapshots API for reliable image references (not PipelineRuns)"
  - "Digest-based references work with skopeo even without tenant membership"
  - "Removed OCP 4.12 (EOL) from index images"

patterns-established:
  - "Konflux Snapshots API is authoritative source for release images"
  - "Image reference format: @sha256:digest (not :tag)"

issues-created: []

# Metrics
duration: 45min
completed: 2026-01-19
---

# Phase 3 Plan 1: Dev Release Summary

**Index images copied but deployment test FAILED — component images missing from devel registry**

## Performance

- **Duration:** 45 min
- **Started:** 2026-01-19
- **Completed:** 2026-01-19
- **Tasks:** 4 (workflow + merge + copy + verify)
- **Files modified:** 1 (konflux-image.md skill updated)

## Accomplishments

- Ran index-render-template workflow (run #21143589277)
- Fixed ISS-005 (serviceAccountName for index pipelines) via PR #14224
- Merged all 5 catalog PRs (#14227, #14228, #14229, #14231, #14232)
- Discovered Konflux Snapshots API as reliable image source
- Updated `/osp:konflux-image` skill with snapshot and batch modes
- Copied all 5 index images to quay.io/openshift-pipeline

## Index Images

| OCP Version | Registry | Tag | Architectures | Status |
|-------------|----------|-----|---------------|--------|
| v4.14 | quay.io/openshift-pipeline/pipelines-index-4.14 | 1.15 | amd64 | ✅ |
| v4.15 | quay.io/openshift-pipeline/pipelines-index-4.15 | 1.15 | amd64 | ✅ |
| v4.16 | quay.io/openshift-pipeline/pipelines-index-4.16 | 1.15 | amd64 | ✅ |
| v4.17 | quay.io/openshift-pipeline/pipelines-index-4.17 | 1.15 | amd64 | ✅ |
| v4.18 | quay.io/openshift-pipeline/pipelines-index-4.18 | 1.15 | arm64,ppc64le,s390x,amd64 | ✅ |

## QE Handoff

### Installation Instructions

**For OCP 4.14-4.18:**

```yaml
apiVersion: operators.coreos.com/v1alpha1
kind: CatalogSource
metadata:
  name: openshift-pipelines-dev
  namespace: openshift-marketplace
spec:
  sourceType: grpc
  image: quay.io/openshift-pipeline/pipelines-index-{OCP_VERSION}:1.15
  displayName: OpenShift Pipelines 1.15.4 Dev
  publisher: Red Hat
```

Replace `{OCP_VERSION}` with your cluster version (e.g., `4.18`).

**Example for OCP 4.18:**
```bash
oc apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: CatalogSource
metadata:
  name: openshift-pipelines-dev
  namespace: openshift-marketplace
spec:
  sourceType: grpc
  image: quay.io/openshift-pipeline/pipelines-index-4.18:1.15
  displayName: OpenShift Pipelines 1.15.4 Dev
  publisher: Red Hat
EOF
```

### What's Fixed in 1.15.4

**CVE Fixes:**
- jwt-go upgraded to v4.5.2
- golang.org/x/crypto upgraded to v0.35.0
- golang.org/x/oauth2 upgraded to v0.27.0

**Build Fixes:**
- PAC_BUILDER registry issue resolved (PR #906)
- TKN_VERSION updated to 0.37.2 (PR #907)
- Index pipeline serviceAccountName fix (PR #14224)

### Testing Checklist

- [ ] CatalogSource created successfully
- [ ] Operator subscription shows "Upgradeable" status
- [ ] Upgrade from 1.15.3 to 1.15.4 completes
- [ ] Pipeline runs work after upgrade
- [ ] Triggers work after upgrade
- [ ] Chains signing works after upgrade (if enabled)

## Decisions Made

1. **Use Snapshots API for image references** — The Snapshots API contains images that passed Enterprise Contract validation, making it the authoritative source for release images.

2. **Digest-based references for skopeo** — Using `@sha256:digest` format works even without tenant membership in quay.io/redhat-user-workloads.

3. **Removed OCP 4.12 from index** — OCP 4.12 is EOL and was causing pipeline failures due to missing Tekton catalog entries.

## Issues Encountered

1. **Registry authentication** — Initial skopeo copy failed due to missing authentication. Resolved by using digest-based references which work with the user's quay.io login.

2. **ISS-005: Index pipelines failing** — Konflux PR pipelines for index images failed due to missing `serviceAccountName` in pipeline definition. Fixed via PR #14224.

## Skill Improvements

Updated `/osp:konflux-image` with:
- **snapshot mode** (recommended) — Gets images from Konflux Snapshots API
- **batch mode** — Gets all index images for a version with skopeo commands
- Documented registry authentication requirements

## Deployment Test Results

**Test Cluster:** OCP 4.18.30 (api.e8yd8-jboom-ft5.xazm.p3.openshiftapps.com)

| Test | Status | Notes |
|------|--------|-------|
| CatalogSource created | ✅ | openshift-pipelines-dev |
| CatalogSource READY | ✅ | Pod running |
| Operator installed | ✅ | CSV v1.15.3 Succeeded |
| TektonConfig created | ✅ | |
| Component pods running | ❌ | ImagePullBackOff |

### Root Cause Analysis

The bundle CSV correctly references `quay.io/openshift-pipeline/` for component images:
```
pipelines-controller-rhel8@sha256:90e3d9dd...
pipelines-webhook-rhel8@sha256:9c87878a...
pipelines-resolvers-rhel8@sha256:c6c99a28...
pipelines-events-rhel8@sha256:69842d77...
```

**BUT** these images don't exist in `quay.io/openshift-pipeline/` — we only copied the INDEX images, not the component images.

### What Was Missing

The dev release workflow needs to copy **ALL** images to the devel registry:
1. **Component images** (11 components × multiple images each)
   - pipelines-controller, webhook, resolvers, events, entrypoint, git-init, etc.
   - triggers-controller, webhook, core-interceptors, eventlistenersink
   - chains-controller
   - hub-api, hub-ui, hub-db-migration
   - operator, proxy, webhook
   - etc.
2. **Index images** (5 OCP versions) ← We only did this

### Version Issue

The operator installed as **1.15.3** not 1.15.4 because:
- VERSION wasn't bumped in Dockerfiles before the release build
- The CVE fixes ARE in the code, but version string wasn't updated

## Next Steps

**Plan 03-02: Dev Release 2nd Try** is needed to:
1. Copy all component images to quay.io/openshift-pipeline/
2. Re-test deployment on cluster
3. Verify all pods come up correctly

---
*Phase: 03-dev-release*
*Plan 1 Status: INCOMPLETE - requires Plan 2*
*Updated: 2026-01-19*
