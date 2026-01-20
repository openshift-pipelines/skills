# OpenShift Pipelines 1.15.4 Dev Release - QE Handoff

**Release Date:** 2026-01-20
**Version:** 1.15.4
**Status:** Ready for QE Testing

## Index Images

| OCP Version | Registry | Tag | Architectures |
|-------------|----------|-----|---------------|
| v4.14 | quay.io/openshift-pipeline/pipelines-index-4.14 | 1.15 | amd64 |
| v4.15 | quay.io/openshift-pipeline/pipelines-index-4.15 | 1.15 | amd64 |
| v4.16 | quay.io/openshift-pipeline/pipelines-index-4.16 | 1.15 | amd64 |
| v4.17 | quay.io/openshift-pipeline/pipelines-index-4.17 | 1.15 | amd64 |
| v4.18 | quay.io/openshift-pipeline/pipelines-index-4.18 | 1.15 | amd64, arm64, ppc64le, s390x |

## Installation Instructions

### Step 1: Create CatalogSource

Replace `{OCP_VERSION}` with your cluster version (e.g., `4.18`, `4.17`, `4.16`):

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

### Step 2: Create Subscription

```yaml
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: openshift-pipelines-operator
  namespace: openshift-operators
spec:
  channel: pipelines-1.15
  name: openshift-pipelines-operator-rh
  source: openshift-pipelines-dev
  sourceNamespace: openshift-marketplace
  installPlanApproval: Automatic
```

### Example: OCP 4.18 Quick Install

```bash
# Create CatalogSource
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

# Wait for CatalogSource to be ready
sleep 30

# Create Subscription
oc apply -f - <<EOF
apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: openshift-pipelines-operator
  namespace: openshift-operators
spec:
  channel: pipelines-1.15
  name: openshift-pipelines-operator-rh
  source: openshift-pipelines-dev
  sourceNamespace: openshift-marketplace
  installPlanApproval: Automatic
EOF

# Wait for TektonConfig to be ready
oc wait --for=condition=Ready tektonconfig/config --timeout=10m
```

## What's Fixed in 1.15.4

### CVE Fixes

| CVE | Component | Fix Version | Description |
|-----|-----------|-------------|-------------|
| CVE-2024-28180 | jwt-go | v4.5.2 | JWT token validation bypass |
| CVE-2024-XXXXX | golang.org/x/crypto | v0.35.0 | Cryptographic vulnerability |
| CVE-2024-XXXXX | golang.org/x/oauth2 | v0.27.0 | OAuth2 token handling |

### Build Fixes

- **PAC_BUILDER registry issue** — Fixed builder image reference (PR #906)
- **TKN_VERSION update** — Updated to 0.37.2 (PR #907)
- **Index pipeline fix** — Fixed serviceAccountName for Konflux pipelines (PR #14224)
- **Go 1.25 builder** — Updated Go builder to support Go 1.25.0 (PR #14352)

## Verified Deployment

**Test Cluster:** OCP 4.18.30 (api.zjdmf-xyift-oaz.6ccc.p3.openshiftapps.com)

| Test | Status |
|------|--------|
| CatalogSource created | PASS |
| CatalogSource READY | PASS |
| CSV installed (v1.15.4) | PASS |
| TektonConfig Ready | PASS |
| All pods Running | PASS |
| TaskRun execution | PASS |

### Components Verified

All 14 pods running in `openshift-pipelines` namespace:
- pipelines-as-code-controller
- pipelines-as-code-watcher
- pipelines-as-code-webhook
- pipelines-console-plugin
- tekton-chains-controller
- tekton-events-controller
- tekton-operator-proxy-webhook
- tekton-pipelines-controller
- tekton-pipelines-remote-resolvers
- tekton-pipelines-webhook
- tekton-triggers-controller
- tekton-triggers-core-interceptors
- tekton-triggers-webhook
- tkn-cli-serve

## Testing Checklist

### Fresh Install Testing
- [ ] CatalogSource created successfully
- [ ] Operator subscription created
- [ ] CSV reaches "Succeeded" phase
- [ ] TektonConfig becomes Ready
- [ ] All pods in openshift-pipelines running
- [ ] Basic TaskRun works

### Upgrade Testing (from 1.15.3)
- [ ] Upgrade from 1.15.3 to 1.15.4 completes
- [ ] Existing PipelineRuns continue working
- [ ] No data loss during upgrade
- [ ] Version shows 1.15.4 post-upgrade

### Component Testing
- [ ] Pipeline execution works
- [ ] Trigger execution works
- [ ] Chains signing works (if enabled)
- [ ] PAC integration works
- [ ] Results API works
- [ ] Hub integration works (if configured)

### Regression Testing
- [ ] No new failures compared to 1.15.3
- [ ] Performance is comparable
- [ ] Console plugin loads correctly

## Known Issues

### ISS-006: Snyk SAST False Positives
- **Impact:** Konflux EC checks show failures on operator/proxy/webhook PRs
- **Root Cause:** Snyk flags Kubernetes Secret resource names as "hardcoded credentials"
- **Workaround:** EC failures don't block GitHub merge - PRs can be merged with lgtm+approved
- **Status:** Will be fixed before stage release (Phase 4)

## Notes

- The index images were built from the operator `release-v1.15.x` branch
- All component images are multi-arch (amd64 required, others where available)
- The bundle in this release was built before the Go 1.25 builder update; operator/proxy/webhook use the previous Go version
- A follow-up rebuild will be done for stage release with the Go 1.25 updates

---
*Generated: 2026-01-20*
*Phase: 03-dev-release Plan 02*
