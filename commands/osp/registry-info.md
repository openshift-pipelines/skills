---
name: registry-info
description: Quick reference for OpenShift Pipelines registry usage across release stages
allowed-tools:
  - Bash
  - Read
---

# Registry Info

<objective>
Quick reference for understanding the OpenShift Pipelines container registry flow across different release stages. Use this when you need to know which registry to use, check image availability, or understand the PAC_BUILDER lifecycle.
</objective>

<important_note>
## ⚠️ 72-Hour Freshness Rule

**Before any release, verify images are < 72 hours old.** Stale images may miss:
- Base image security updates
- Konflux nudge PR fixes
- Latest Go builder patches

**Why 72 hours?** This is the threshold for "stale" in release criteria. Images older than 72h should be rebuilt before proceeding with stage/prod releases.

**Quick check:**
```bash
# Check image age
skopeo inspect docker://quay.io/openshift-pipeline/IMAGE:TAG 2>/dev/null | \
  jq -r '"Created: \(.Created)"'
```

**If stale:** Trigger rebuild via `/osp:component-builds` or by pushing a Dockerfile change.
</important_note>

<decision_tree>
## Which Registry Should I Use?

```
START: What are you trying to do?
│
├─► "Run a dev/test deployment"
│   └─► Use: quay.io/openshift-pipeline/
│       • Public, no auth needed
│       • Contains latest Konflux on-push builds
│       • For: local testing, dev clusters, CI
│
├─► "Prepare stage release"
│   └─► Use: registry.stage.redhat.io/openshift-pipelines/
│       • Requires RH SSO auth
│       • Contains stage-approved images
│       • For: stage release process, QE validation
│
├─► "Prepare prod release"
│   └─► Use: registry.redhat.io/openshift-pipelines/
│       • Requires RH SSO auth
│       • Contains prod-released images
│       • For: production release, customer clusters
│
├─► "Copy images from Konflux"
│   └─► Source: quay.io/redhat-user-workloads/tekton-ecosystem-tenant/
│       • Requires Konflux/RH SSO auth
│       • Contains raw Konflux build outputs
│       • Use /osp:konflux-image to get refs
│
└─► "Debug a build issue"
    └─► Check: quay.io/redhat-user-workloads/...
        • Raw pipeline outputs
        • Multi-arch manifests
        • Useful for comparing digests
```

## Quick Reference Table

| Scenario | Registry | Auth | Skill |
|----------|----------|------|-------|
| Get latest dev image | quay.io/openshift-pipeline | None | `/osp:konflux-image` |
| Copy Konflux build to dev | quay.io/redhat-user-workloads | SSO | `/osp:konflux-image` |
| Check stage readiness | registry.stage.redhat.io | SSO | skopeo inspect |
| Check prod availability | registry.redhat.io | SSO | skopeo inspect |
| Trigger new build | (push to repo) | GH | `/osp:component-builds` |

## Image Availability by Release Stage

| Stage | Index Available | Bundle Available | Components |
|-------|-----------------|------------------|------------|
| **Dev** | ✓ (quay.io) | ✓ | All 31 images |
| **Stage** | ✓ (after release pipeline) | ✓ | All images |
| **Prod** | ✓ (after release pipeline) | ✓ | All images |

**Note:** Stage/Prod images only appear AFTER the respective release pipeline completes. Don't expect images there until the release is processed.
</decision_tree>

<execution_context>
**Registry Flow Overview:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OpenShift Pipelines Registry Flow                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DEV/CI          STAGE              PROD                                     │
│  ──────          ─────              ────                                     │
│                                                                              │
│  quay.io/        registry.stage     registry.redhat.io/                      │
│  openshift-      .redhat.io/        openshift-pipelines/                     │
│  pipeline/       openshift-                                                  │
│                  pipelines/                                                  │
│                                                                              │
│  ┌─────────┐     ┌─────────┐       ┌─────────┐                              │
│  │ Konflux │ ──► │  Stage  │ ──►   │  Prod   │                              │
│  │  Build  │     │ Release │       │ Release │                              │
│  └─────────┘     └─────────┘       └─────────┘                              │
│       │                                                                      │
│       └── on-push builds go here                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Registries:**

| Registry | Purpose | Auth Required | Public |
|----------|---------|---------------|--------|
| `quay.io/openshift-pipeline/` | Dev/CI builds, Konflux on-push | No | Yes |
| `registry.stage.redhat.io/openshift-pipelines/` | Stage releases | Yes (RH SSO) | No |
| `registry.redhat.io/openshift-pipelines/` | Production releases | Yes (RH SSO) | No |

**Image Name Patterns:**

| Component | Image Name |
|-----------|------------|
| Pipeline | `pipelines-controller-rhel8` |
| Triggers | `pipelines-triggers-controller-rhel8` |
| Chains | `pipelines-chains-controller-rhel8` |
| Results | `pipelines-results-watcher-rhel8` |
| PAC | `pipelines-pipelines-as-code-controller-rhel8` |
| CLI | `pipelines-cli-tkn-rhel8` |
| Operator | `pipelines-rhel8-operator` |
| Bundle | `pipelines-operator-bundle-rhel9` |
| Index | `pipelines-index-rhel9:v4.XX` |

**Note:** RHEL9 images use `-rhel9` suffix instead of `-rhel8`.
</execution_context>

<process>
<step name="check_dev_images">
**Check Dev/CI Images (quay.io)**

Public images, no auth required:

```bash
REGISTRY="quay.io/openshift-pipeline"
VERSION="1.15"

echo "=== Dev Registry Images ==="
echo ""

# Check core components
for IMAGE in \
  "pipelines-controller-rhel8:v${VERSION}" \
  "pipelines-triggers-controller-rhel8:v${VERSION}" \
  "pipelines-chains-controller-rhel8:v${VERSION}" \
  "pipelines-pipelines-as-code-controller-rhel8:v${VERSION}" \
  "pipelines-cli-tkn-rhel8:v${VERSION}"; do

  echo "Checking: ${IMAGE}"
  skopeo inspect --no-tags "docker://${REGISTRY}/${IMAGE}" 2>/dev/null | \
    jq -r '"  Digest: \(.Digest[0:19])... | Created: \(.Created[0:10])"' || \
    echo "  Not found"
done
```
</step>

<step name="check_stage_images">
**Check Stage Images (registry.stage.redhat.io)**

Requires Red Hat SSO authentication:

```bash
REGISTRY="registry.stage.redhat.io/openshift-pipelines"

echo "=== Stage Registry Images ==="
echo ""
echo "Note: Requires RH SSO auth. If unauthorized, run:"
echo "  podman login registry.stage.redhat.io"
echo ""

# Check operator bundle (latest)
echo "Operator Bundle:"
skopeo inspect --no-tags "docker://${REGISTRY}/pipelines-operator-bundle-rhel9" 2>/dev/null | \
  jq -r '"  Digest: \(.Digest[0:19])... | Created: \(.Created[0:10])"' || \
  echo "  Not found or auth required"

# Check index images
echo ""
echo "Index Images:"
for OCP in 4.14 4.15 4.16 4.17 4.18; do
  echo "  v${OCP}:"
  skopeo inspect --no-tags "docker://${REGISTRY}/pipelines-index-rhel9:v${OCP}" 2>/dev/null | \
    jq -r '"    Digest: \(.Digest[0:19])..."' || \
    echo "    Not found or auth required"
done
```
</step>

<step name="check_prod_images">
**Check Production Images (registry.redhat.io)**

Requires Red Hat SSO authentication:

```bash
REGISTRY="registry.redhat.io/openshift-pipelines"

echo "=== Production Registry Images ==="
echo ""
echo "Note: Requires RH SSO auth. If unauthorized, run:"
echo "  podman login registry.redhat.io"
echo ""
echo "Or check via Red Hat Container Catalog:"
echo "  https://catalog.redhat.com/software/containers/search?q=openshift-pipelines"
echo ""

# Check operator bundle
echo "Operator Bundle:"
skopeo inspect --no-tags "docker://${REGISTRY}/pipelines-operator-bundle-rhel9" 2>/dev/null | \
  jq -r '"  Digest: \(.Digest[0:19])... | Created: \(.Created[0:10])"' || \
  echo "  Not found or auth required"

# Check index images
echo ""
echo "Index Images:"
for OCP in 4.14 4.15 4.16 4.17 4.18; do
  echo "  v${OCP}:"
  skopeo inspect --no-tags "docker://${REGISTRY}/pipelines-index-rhel9:v${OCP}" 2>/dev/null | \
    jq -r '"    Digest: \(.Digest[0:19])..."' || \
    echo "    Not found or auth required"
done
```
</step>

<step name="pac_builder_info">
**PAC_BUILDER Lifecycle**

The `tektoncd-cli` Dockerfile has a `PAC_BUILDER` ARG that must be updated at each release stage:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PAC_BUILDER Update Workflow                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DEVELOPMENT (default)                                                       │
│  ─────────────────────                                                       │
│  ARG PAC_BUILDER=quay.io/openshift-pipeline/                                │
│      pipelines-pipelines-as-code-cli-rhel8:1.15                             │
│                                                                              │
│  BEFORE STAGE RELEASE                                                        │
│  ────────────────────                                                        │
│  Update to stage registry with SHA:                                          │
│  ARG PAC_BUILDER=registry.stage.redhat.io/openshift-pipelines/              │
│      pipelines-pipelines-as-code-cli-rhel9@sha256:abc123...                 │
│                                                                              │
│  BEFORE PROD RELEASE                                                         │
│  ───────────────────                                                         │
│  Update to prod registry with SHA:                                           │
│  ARG PAC_BUILDER=registry.redhat.io/openshift-pipelines/                    │
│      pipelines-pipelines-as-code-cli-rhel9@sha256:def456...                 │
│                                                                              │
│  AFTER PROD IMAGES EXPIRE                                                    │
│  ────────────────────────                                                    │
│  Revert to quay.io dev image (publicly accessible)                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Get current PAC CLI SHA for stage:**
```bash
skopeo inspect "docker://registry.stage.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel9" 2>/dev/null | \
  jq -r '.Digest'
```

**Get current PAC CLI SHA for prod:**
```bash
skopeo inspect "docker://registry.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel9" 2>/dev/null | \
  jq -r '.Digest'
```
</step>

<step name="dockerfile_versions">
**Dockerfile Version Updates on Upstream Sync**

When syncing from upstream (e.g., tektoncd/cli), Dockerfiles need manual updates:

| ARG | Source | Notes |
|-----|--------|-------|
| `TKN_VERSION` | `VERSION` file in upstream | Must match synced version |
| `PAC_BUILDER` | Stage/prod registry | Update per release stage |
| Base images | Konflux nudge PRs | Usually automatic |

**Example issue:** PR #903 synced upstream 0.37.2 but Dockerfile had `TKN_VERSION=0.37.1`. Required PR #907 to fix.

**Checklist for upstream sync:**
1. Check `VERSION` file in synced PR
2. Verify `TKN_VERSION` ARG matches
3. Update `PAC_BUILDER` if needed for current release stage
4. Check for Konflux nudge PRs for base image updates
</step>
</process>

<output>
- Registry overview with all three environments
- Image inspection commands for each registry
- PAC_BUILDER lifecycle documentation
- Dockerfile version update checklist
</output>

<success_criteria>
- [ ] User understands which registry to use for each stage
- [ ] User can check image availability in any registry
- [ ] PAC_BUILDER update workflow is clear
- [ ] Dockerfile version sync process is documented
</success_criteria>
