# Dev Release Deployment Testing

This document describes how to test OpenShift Pipelines 1.15.4 dev release using index images.

## Prerequisites

- OpenShift cluster (4.14, 4.15, 4.16, 4.17, or 4.18)
- `oc` CLI authenticated to cluster with cluster-admin privileges
- Access to `quay.io/openshift-pipeline` (public)

## Index Images

| OCP Version | Index Image |
|-------------|-------------|
| 4.14 | `quay.io/openshift-pipeline/pipelines-index-4.14:1.15` |
| 4.15 | `quay.io/openshift-pipeline/pipelines-index-4.15:1.15` |
| 4.16 | `quay.io/openshift-pipeline/pipelines-index-4.16:1.15` |
| 4.17 | `quay.io/openshift-pipeline/pipelines-index-4.17:1.15` |
| 4.18 | `quay.io/openshift-pipeline/pipelines-index-4.18:1.15` |

## Deployment Steps

### Step 1: Check Current Cluster Version

```bash
oc version
# Note the server version (e.g., 4.18.x)
```

### Step 2: Check Existing OpenShift Pipelines Installation

```bash
# Check if operator is already installed
oc get csv -n openshift-operators | grep pipelines

# Check current version
oc get tektonconfig config -o jsonpath='{.status.version}'
```

### Step 3: Create Dev CatalogSource

Replace `{OCP_VERSION}` with your cluster version (e.g., `4.18`):

```bash
cat <<EOF | oc apply -f -
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
  updateStrategy:
    registryPoll:
      interval: 10m
EOF
```

**Example for OCP 4.18:**
```bash
cat <<EOF | oc apply -f -
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
  updateStrategy:
    registryPoll:
      interval: 10m
EOF
```

### Step 4: Verify CatalogSource is Ready

```bash
# Wait for catalog source pod to be ready
oc get pods -n openshift-marketplace | grep openshift-pipelines-dev

# Check catalog source status
oc get catalogsource openshift-pipelines-dev -n openshift-marketplace -o jsonpath='{.status.connectionState.lastObservedState}'
# Should show: READY
```

### Step 5: Check Available Package

```bash
# Verify the package is available from our catalog
oc get packagemanifest openshift-pipelines-operator-rh -o jsonpath='{.status.catalogSource}'
# Should show: openshift-pipelines-dev (or may show both if existing catalog exists)

# Check available channels
oc get packagemanifest openshift-pipelines-operator-rh -o jsonpath='{.status.channels[*].name}'
```

### Step 6: Install or Upgrade Operator

**For fresh installation:**

```bash
cat <<EOF | oc apply -f -
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
```

**For upgrade from existing installation:**

If OpenShift Pipelines is already installed from the default Red Hat catalog, you need to update the subscription to use the dev catalog:

```bash
# Patch the existing subscription to use dev catalog
oc patch subscription openshift-pipelines-operator-rh -n openshift-operators \
  --type=merge \
  -p '{"spec":{"source":"openshift-pipelines-dev"}}'
```

### Step 7: Verify Installation

```bash
# Check CSV status
oc get csv -n openshift-operators | grep pipelines
# Should show: openshift-pipelines-operator-rh.v1.15.4   Succeeded

# Check operator pod
oc get pods -n openshift-operators | grep pipelines

# Check TektonConfig
oc get tektonconfig config -o jsonpath='{.status.version}'
# Should show: 1.15.4

# Check all Tekton components are ready
oc get tektonconfig config -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'
# Should show: True
```

## Verification Tests

### Test 1: Basic Pipeline Run

```bash
# Create a test namespace
oc new-project pipelines-test

# Create a simple task
cat <<EOF | oc apply -f -
apiVersion: tekton.dev/v1
kind: Task
metadata:
  name: hello-world
  namespace: pipelines-test
spec:
  steps:
    - name: echo
      image: registry.access.redhat.com/ubi8/ubi-minimal:latest
      script: |
        echo "Hello from OpenShift Pipelines 1.15.4!"
        echo "Testing CVE fixes: jwt-go, oauth2, x/crypto"
EOF

# Create and run a TaskRun
cat <<EOF | oc create -f -
apiVersion: tekton.dev/v1
kind: TaskRun
metadata:
  generateName: hello-world-
  namespace: pipelines-test
spec:
  taskRef:
    name: hello-world
EOF

# Watch the TaskRun
oc get taskrun -n pipelines-test -w
```

### Test 2: Verify Component Versions

```bash
# Check controller images
oc get deployment -n openshift-pipelines -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.template.spec.containers[0].image}{"\n"}{end}'
```

### Test 3: Triggers (if enabled)

```bash
# Check triggers controller
oc get pods -n openshift-pipelines | grep triggers

# Verify EventListener can be created
cat <<EOF | oc apply -f -
apiVersion: triggers.tekton.dev/v1beta1
kind: EventListener
metadata:
  name: test-listener
  namespace: pipelines-test
spec:
  serviceAccountName: pipeline
  triggers:
    - name: test-trigger
      template:
        ref: test-template
EOF

# Check EventListener status (will show error for missing template, but proves triggers work)
oc get eventlistener test-listener -n pipelines-test
```

### Test 4: Chains (if enabled)

```bash
# Check if chains controller is running
oc get pods -n openshift-pipelines | grep chains

# Check chains config
oc get tektonconfig config -o jsonpath='{.spec.chain}'
```

## Cleanup

After testing, clean up the dev catalog:

```bash
# Delete test namespace
oc delete project pipelines-test

# If you want to revert to production catalog:
oc patch subscription openshift-pipelines-operator-rh -n openshift-operators \
  --type=merge \
  -p '{"spec":{"source":"redhat-operators"}}'

# Delete dev catalog source
oc delete catalogsource openshift-pipelines-dev -n openshift-marketplace
```

## Troubleshooting

### CatalogSource not ready

```bash
# Check catalog pod logs
oc logs -n openshift-marketplace -l olm.catalogSource=openshift-pipelines-dev

# Check events
oc get events -n openshift-marketplace --sort-by='.lastTimestamp' | tail -20
```

### Operator not upgrading

```bash
# Check install plan
oc get installplan -n openshift-operators

# Approve if manual approval required
oc patch installplan <install-plan-name> -n openshift-operators \
  --type=merge -p '{"spec":{"approved":true}}'
```

### CSV stuck in Pending

```bash
# Check CSV status
oc describe csv openshift-pipelines-operator-rh.v1.15.4 -n openshift-operators

# Check operator pod logs
oc logs -n openshift-operators -l name=openshift-pipelines-operator
```

## Test Results Template

| Test | Status | Notes |
|------|--------|-------|
| CatalogSource created | ⬜ | |
| CatalogSource READY | ⬜ | |
| Operator installed/upgraded | ⬜ | |
| CSV Succeeded | ⬜ | |
| TektonConfig Ready | ⬜ | |
| Version shows 1.15.4 | ⬜ | |
| Basic TaskRun works | ⬜ | |
| Triggers controller running | ⬜ | |
| Chains controller running | ⬜ | |

---
*Created: 2026-01-19*
*For: OpenShift Pipelines 1.15.4 Dev Release Testing*
