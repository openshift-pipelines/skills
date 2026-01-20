---
name: konflux-image
description: Extract image references (URL, digest) from Konflux for skopeo copy operations
allowed-tools:
  - Bash
  - Read
  - WebFetch
  - AskUserQuestion
---

# Konflux Image Extractor

<objective>
Extract full image references (with digest) from Konflux for skopeo copy operations during releases.

Supports multiple modes:
1. **snapshot** (recommended) - Get latest image from Snapshot API (most reliable)
2. **component** - Get image from Component status
3. **pipelinerun** - Extract from a specific pipeline run
4. **batch** - Get all index images for a release version
</objective>

<execution_context>
**Requirements:**
- Konflux SSO authentication configured via `/osp:configure`
- Cookie stored in `~/.config/osp/config.json` under `konflux.cookie`

**Konflux API Endpoints:**
- PipelineRuns: `/api/k8s/apis/tekton.dev/v1/namespaces/{ns}/pipelineruns/{name}`
- List PipelineRuns: `/api/k8s/apis/tekton.dev/v1/namespaces/{ns}/pipelineruns?labelSelector=...`

**Pipeline Result Names:**
- `IMAGE_URL` - Full image reference (registry/repo:tag or @sha256:...)
- `IMAGE_DIGEST` - Image digest (sha256:...)
- `IMAGE_REF` - Alternative name for image reference

**Default Namespace:** `tekton-ecosystem-tenant`

## Why Snapshots API is Authoritative

**Critical Knowledge:** Always use Snapshots API over PipelineRuns for release image references.

| Source | Reliability | Why |
|--------|-------------|-----|
| **Snapshots** ✅ | Authoritative | Contains exact images that passed Enterprise Contract (EC) checks |
| PipelineRuns | Unreliable | May show failed runs, get pruned after ~7 days, or have incomplete results |
| Component status | Stale | Updated async, may not reflect latest build |

**The Snapshot represents what's actually releasable.** During the 1.15.4 release, we discovered that PipelineRun results can be misleading:
- PipelineRuns are pruned after ~7 days (older builds disappear)
- A PipelineRun may succeed at building but fail EC (image exists but isn't release-ready)
- Component status updates are eventually consistent, not immediate

The Snapshot is created only after the full build-test-EC pipeline succeeds. If you can find an image in a Snapshot, it's ready for release.
</execution_context>

<process>
<step name="parse_input">
Parse the input to determine mode:

**Accepted formats:**
- PipelineRun URL: `https://konflux-ui.apps.../ns/{ns}/pipelinerun/{name}`
- PipelineRun name: `operator-1-15-index-4-18-on-push-h44cs`
- Component name with version: `operator-1-15-index-4-18` or `index-4-18 1.15`
- Just "list" to show available components

```bash
INPUT="$1"
VERSION="${2:-1.15}"

if [[ "$INPUT" =~ konflux-ui.*pipelinerun/([^/]+) ]]; then
  MODE="pipelinerun"
  PIPELINERUN="${BASH_REMATCH[1]}"
  NAMESPACE=$(echo "$INPUT" | grep -oE 'ns/[^/]+' | cut -d'/' -f2)
elif [[ "$INPUT" =~ ^operator-.*-on-(push|pull-request) ]]; then
  MODE="pipelinerun"
  PIPELINERUN="$INPUT"
  NAMESPACE="tekton-ecosystem-tenant"
elif [[ "$INPUT" == "list" ]]; then
  MODE="list"
else
  MODE="component"
  COMPONENT="$INPUT"
  NAMESPACE="tekton-ecosystem-tenant"
fi

echo "Mode: $MODE"
```
</step>

<step name="check_auth">
Verify Konflux authentication is configured:

```bash
KONFLUX_URL=$(jq -r '.konflux.base_url // empty' ~/.config/osp/config.json 2>/dev/null)
KONFLUX_COOKIE_NAME=$(jq -r '.konflux.cookie_name // empty' ~/.config/osp/config.json 2>/dev/null)
KONFLUX_COOKIE=$(jq -r '.konflux.cookie // empty' ~/.config/osp/config.json 2>/dev/null)

if [ -z "$KONFLUX_COOKIE" ]; then
  echo "ERROR: Konflux authentication not configured."
  echo ""
  echo "Run: /osp:configure"
  echo "Select: Konflux authentication"
  echo ""
  echo "This will open a browser to authenticate via SSO and save the cookie."
  exit 1
fi

# Test authentication
TEST_RESULT=$(curl -s -w "%{http_code}" -o /dev/null \
  -H "Cookie: ${KONFLUX_COOKIE_NAME}=${KONFLUX_COOKIE}" \
  "${KONFLUX_URL}/api/k8s/apis/tekton.dev/v1/namespaces/tekton-ecosystem-tenant/pipelineruns?limit=1")

if [ "$TEST_RESULT" != "200" ]; then
  echo "ERROR: Konflux cookie expired or invalid (HTTP $TEST_RESULT)"
  echo ""
  echo "Re-authenticate: /osp:configure"
  exit 1
fi

echo "Konflux authentication: OK"
```
</step>

<step name="get_from_snapshot">
**Mode: snapshot** (RECOMMENDED) - Get image from latest Snapshot.

The Snapshots API is the most reliable way to get image references because it contains the exact images that passed Enterprise Contract and are ready for release.

```bash
KONFLUX_URL=$(jq -r '.konflux.base_url' ~/.config/osp/config.json)
KONFLUX_COOKIE_NAME=$(jq -r '.konflux.cookie_name' ~/.config/osp/config.json)
KONFLUX_COOKIE=$(jq -r '.konflux.cookie' ~/.config/osp/config.json)
NAMESPACE="${NAMESPACE:-tekton-ecosystem-tenant}"

# Input: component name (e.g., "operator-1-15-index-4-18")
COMPONENT="$1"

# Derive application name (component + "-application")
APPLICATION="${COMPONENT}-application"

echo "Looking up: ${COMPONENT}"
echo "Application: ${APPLICATION}"
echo ""

# Get latest snapshot for this application
SNAPSHOT=$(curl -s \
  -H "Cookie: ${KONFLUX_COOKIE_NAME}=${KONFLUX_COOKIE}" \
  "${KONFLUX_URL}/api/k8s/apis/appstudio.redhat.com/v1alpha1/namespaces/${NAMESPACE}/snapshots?labelSelector=appstudio.openshift.io/application=${APPLICATION}&limit=1")

# Extract image for the component
IMAGE=$(echo "$SNAPSHOT" | jq -r ".items[0].spec.components[] | select(.name == \"${COMPONENT}\") | .containerImage")

if [ -n "$IMAGE" ] && [ "$IMAGE" != "null" ]; then
  SNAPSHOT_NAME=$(echo "$SNAPSHOT" | jq -r '.items[0].metadata.name')
  CREATED=$(echo "$SNAPSHOT" | jq -r '.items[0].metadata.creationTimestamp')

  echo "## Image Reference"
  echo ""
  echo "Snapshot: ${SNAPSHOT_NAME}"
  echo "Created: ${CREATED}"
  echo ""
  echo "**Full Image Reference:**"
  echo "\`${IMAGE}\`"
  echo ""
  echo "## Skopeo Copy Command"
  echo ""
  echo "\`\`\`bash"
  echo "skopeo copy --all \\"
  echo "  docker://${IMAGE} \\"
  echo "  docker://quay.io/openshift-pipeline/YOUR_DEST_TAG"
  echo "\`\`\`"
else
  echo "ERROR: No snapshot found for application ${APPLICATION}"
  echo ""
  echo "Check available applications:"
  curl -s \
    -H "Cookie: ${KONFLUX_COOKIE_NAME}=${KONFLUX_COOKIE}" \
    "${KONFLUX_URL}/api/k8s/apis/appstudio.redhat.com/v1alpha1/namespaces/${NAMESPACE}/applications" | \
    jq -r '.items[].metadata.name' | grep -i "${COMPONENT%%index*}" | head -5
fi
```
</step>

<step name="batch_index_images">
**Mode: batch** - Get all index images for a release version.

Use this to get all OCP index images for skopeo copy during dev/stage/prod release.

```bash
KONFLUX_URL=$(jq -r '.konflux.base_url' ~/.config/osp/config.json)
KONFLUX_COOKIE_NAME=$(jq -r '.konflux.cookie_name' ~/.config/osp/config.json)
KONFLUX_COOKIE=$(jq -r '.konflux.cookie' ~/.config/osp/config.json)
NAMESPACE="tekton-ecosystem-tenant"

VERSION="${1:-1.15}"
VERSION_DASH="${VERSION//./-}"

echo "## Index Images for OpenShift Pipelines ${VERSION}"
echo ""
echo "| OCP | Full Image Reference |"
echo "|-----|----------------------|"

# Store for skopeo commands
declare -a IMAGES

for OCP in 4.14 4.15 4.16 4.17 4.18; do
  OCP_DASH="${OCP//./-}"
  COMPONENT="operator-${VERSION_DASH}-index-${OCP_DASH}"
  APPLICATION="${COMPONENT}-application"

  # Get from snapshot
  IMAGE=$(curl -s \
    -H "Cookie: ${KONFLUX_COOKIE_NAME}=${KONFLUX_COOKIE}" \
    "${KONFLUX_URL}/api/k8s/apis/appstudio.redhat.com/v1alpha1/namespaces/${NAMESPACE}/snapshots?labelSelector=appstudio.openshift.io/application=${APPLICATION}&limit=1" | \
    jq -r ".items[0].spec.components[] | select(.name == \"${COMPONENT}\") | .containerImage")

  if [ -n "$IMAGE" ] && [ "$IMAGE" != "null" ]; then
    # Truncate for table display
    SHORT="${IMAGE:0:70}..."
    echo "| v${OCP} | ${SHORT} |"
    IMAGES+=("${OCP}|${IMAGE}")
  else
    echo "| v${OCP} | NOT_FOUND |"
  fi
done

echo ""
echo "## Skopeo Copy Commands"
echo ""
echo "Copy to devel registry (\`quay.io/openshift-pipeline\`):"
echo ""
echo "\`\`\`bash"
for ENTRY in "${IMAGES[@]}"; do
  OCP="${ENTRY%%|*}"
  IMAGE="${ENTRY#*|}"
  echo "skopeo copy --all \\"
  echo "  \"docker://${IMAGE}\" \\"
  echo "  \"docker://quay.io/openshift-pipeline/pipelines-index-${OCP}:${VERSION}\""
  echo ""
done
echo "\`\`\`"
echo ""
echo "**Note:** Requires authentication to source registry (quay.io/redhat-user-workloads)."
echo "Run \`skopeo login quay.io\` with your Red Hat SSO-linked quay.io credentials."
```
</step>

<step name="fetch_pipelinerun">
**Mode: pipelinerun** - Fetch specific pipeline run results:

```bash
KONFLUX_URL=$(jq -r '.konflux.base_url' ~/.config/osp/config.json)
KONFLUX_COOKIE_NAME=$(jq -r '.konflux.cookie_name' ~/.config/osp/config.json)
KONFLUX_COOKIE=$(jq -r '.konflux.cookie' ~/.config/osp/config.json)

NAMESPACE="${NAMESPACE:-tekton-ecosystem-tenant}"
API_URL="${KONFLUX_URL}/api/k8s/apis/tekton.dev/v1/namespaces/${NAMESPACE}/pipelineruns/${PIPELINERUN}"

echo "Fetching PipelineRun: $PIPELINERUN"
echo ""

RESULT=$(curl -s \
  -H "Cookie: ${KONFLUX_COOKIE_NAME}=${KONFLUX_COOKIE}" \
  "$API_URL")

# Check if found
if echo "$RESULT" | jq -e '.code == 404' >/dev/null 2>&1; then
  echo "ERROR: PipelineRun not found: $PIPELINERUN"
  echo "It may have been pruned. Try finding a more recent one."
  exit 1
fi

# Extract status
STATUS=$(echo "$RESULT" | jq -r '.status.conditions[0].reason // "Unknown"')
echo "Status: $STATUS"

if [ "$STATUS" != "Succeeded" ]; then
  echo "WARNING: PipelineRun did not succeed. Results may be incomplete."
fi

# Extract image results
echo ""
echo "## Pipeline Results"
echo ""

IMAGE_URL=$(echo "$RESULT" | jq -r '.status.results[] | select(.name == "IMAGE_URL" or .name == "IMAGE_REF") | .value' | head -1)
IMAGE_DIGEST=$(echo "$RESULT" | jq -r '.status.results[] | select(.name == "IMAGE_DIGEST") | .value' | head -1)

if [ -n "$IMAGE_URL" ]; then
  echo "IMAGE_URL: $IMAGE_URL"
else
  echo "IMAGE_URL: (not found)"
fi

if [ -n "$IMAGE_DIGEST" ]; then
  echo "IMAGE_DIGEST: $IMAGE_DIGEST"
else
  echo "IMAGE_DIGEST: (not found)"
fi

# Full reference for skopeo
if [ -n "$IMAGE_URL" ] && [ -n "$IMAGE_DIGEST" ]; then
  # If IMAGE_URL doesn't already have digest, append it
  if [[ "$IMAGE_URL" != *"@sha256"* ]]; then
    FULL_REF="${IMAGE_URL%:*}@${IMAGE_DIGEST}"
  else
    FULL_REF="$IMAGE_URL"
  fi
  echo ""
  echo "## Full Image Reference (for skopeo)"
  echo ""
  echo "$FULL_REF"
fi
```
</step>

<step name="find_component_pipeline">
**Mode: component** - Find the latest successful on-push pipeline for a component:

```bash
KONFLUX_URL=$(jq -r '.konflux.base_url' ~/.config/osp/config.json)
KONFLUX_COOKIE_NAME=$(jq -r '.konflux.cookie_name' ~/.config/osp/config.json)
KONFLUX_COOKIE=$(jq -r '.konflux.cookie' ~/.config/osp/config.json)

NAMESPACE="${NAMESPACE:-tekton-ecosystem-tenant}"
COMPONENT="$1"  # e.g., "operator-1-15-index-4-18" or "index-4-18"
VERSION="${2:-1.15}"
VERSION_DASH="${VERSION//./-}"

# Normalize component name
if [[ "$COMPONENT" =~ ^index-([0-9]-[0-9]+)$ ]]; then
  COMPONENT="operator-${VERSION_DASH}-index-${BASH_REMATCH[1]}"
fi

echo "Looking for: ${COMPONENT}-on-push"
echo ""

# List recent pipelineruns for this component
API_URL="${KONFLUX_URL}/api/k8s/apis/tekton.dev/v1/namespaces/${NAMESPACE}/pipelineruns"
LABEL_SELECTOR="appstudio.openshift.io/component=${COMPONENT}"

RESULT=$(curl -s \
  -H "Cookie: ${KONFLUX_COOKIE_NAME}=${KONFLUX_COOKIE}" \
  "${API_URL}?labelSelector=${LABEL_SELECTOR}&limit=10")

# Find latest successful on-push pipeline
LATEST=$(echo "$RESULT" | jq -r '
  [.items[] |
   select(.metadata.name | contains("-on-push-")) |
   select(.status.conditions[0].reason == "Succeeded")] |
  sort_by(.metadata.creationTimestamp) |
  reverse |
  .[0]')

if [ "$LATEST" == "null" ] || [ -z "$LATEST" ]; then
  echo "ERROR: No successful on-push pipeline found for $COMPONENT"
  echo ""
  echo "Available pipelineruns:"
  echo "$RESULT" | jq -r '.items[].metadata.name' | head -10
  exit 1
fi

PIPELINERUN=$(echo "$LATEST" | jq -r '.metadata.name')
echo "Found: $PIPELINERUN"

# Extract image results
IMAGE_URL=$(echo "$LATEST" | jq -r '.status.results[] | select(.name == "IMAGE_URL" or .name == "IMAGE_REF") | .value' | head -1)
IMAGE_DIGEST=$(echo "$LATEST" | jq -r '.status.results[] | select(.name == "IMAGE_DIGEST") | .value' | head -1)

echo ""
echo "## Image Reference"
echo ""
echo "IMAGE_URL: $IMAGE_URL"
echo "IMAGE_DIGEST: $IMAGE_DIGEST"

if [ -n "$IMAGE_URL" ] && [ -n "$IMAGE_DIGEST" ]; then
  if [[ "$IMAGE_URL" != *"@sha256"* ]]; then
    FULL_REF="${IMAGE_URL%:*}@${IMAGE_DIGEST}"
  else
    FULL_REF="$IMAGE_URL"
  fi
  echo ""
  echo "## Full Reference (for skopeo)"
  echo "$FULL_REF"
fi
```
</step>

<step name="list_components">
**Mode: list** - List available index components for a release:

```bash
VERSION="${1:-1.15}"
VERSION_DASH="${VERSION//./-}"

echo "## Index Components for ${VERSION}"
echo ""
echo "| OCP Version | Component Name | On-Push Pipeline |"
echo "|-------------|----------------|------------------|"

for OCP in 4.14 4.15 4.16 4.17 4.18; do
  OCP_DASH="${OCP//./-}"
  COMPONENT="operator-${VERSION_DASH}-index-${OCP_DASH}"
  echo "| v${OCP} | ${COMPONENT} | ${COMPONENT}-on-push-* |"
done

echo ""
echo "**Usage:**"
echo "  /osp:konflux-image operator-${VERSION_DASH}-index-4-18"
echo "  /osp:konflux-image index-4-18 ${VERSION}"
```
</step>

<step name="batch_extract">
**Extract all index images for a release:**

If the user requests all index images for a version, iterate through OCP versions:

```bash
VERSION="${1:-1.15}"
VERSION_DASH="${VERSION//./-}"

echo "## Index Images for ${VERSION}"
echo ""
echo "| OCP | Image Reference |"
echo "|-----|-----------------|"

for OCP in 4.14 4.15 4.16 4.17 4.18; do
  OCP_DASH="${OCP//./-}"
  COMPONENT="operator-${VERSION_DASH}-index-${OCP_DASH}"

  # Find latest on-push (same logic as find_component_pipeline)
  # ... extract IMAGE_URL and IMAGE_DIGEST ...

  echo "| v${OCP} | ${FULL_REF:-NOT_FOUND} |"
done

echo ""
echo "**Copy commands:**"
echo ""
for OCP in 4.14 4.15 4.16 4.17 4.18; do
  echo "skopeo copy docker://{SOURCE_REF} docker://quay.io/openshift-pipeline/pipelines-index-rhel8:v${OCP}"
done
```
</step>

<step name="generate_skopeo_commands">
After extracting image references, generate skopeo copy commands:

```markdown
## Skopeo Copy Commands

**Source Registry:** quay.io/redhat-user-workloads/tekton-ecosystem-tenant/...
**Destination Registry:** quay.io/openshift-pipeline/...

```bash
# Copy index images to devel registry
skopeo copy --all \
  docker://{IMAGE_URL}@{IMAGE_DIGEST} \
  docker://quay.io/openshift-pipeline/pipelines-index-rhel8:v{OCP}
```

**Note:** Requires authentication to both source and destination registries.
- Source: Konflux robot account or user credentials
- Destination: quay.io/openshift-pipeline push access
```
</step>
</process>

<output>
- Full image reference with digest (e.g., `quay.io/.../image@sha256:...`)
- Generated skopeo copy commands for release workflow
- Batch mode provides all index images for a release version
</output>

<success_criteria>
- [ ] Konflux authentication verified
- [ ] Image reference extracted from Snapshot or PipelineRun
- [ ] Full reference includes @sha256 digest
- [ ] Skopeo copy command generated
- [ ] Ready for image copy operations
</success_criteria>

<examples>
**Get single component image:**
```
/osp:konflux-image operator-1-15-index-4-18
```

**Get all index images for 1.15:**
```
/osp:konflux-image batch 1.15
```

**Get image from specific pipeline run:**
```
/osp:konflux-image operator-1-15-index-4-18-on-push-abc123
```
</examples>

<troubleshooting>
## Common Errors and Solutions

### Cookie Expired (HTTP 401/403)

**Symptom:** API calls return 401 Unauthorized or 403 Forbidden
```
ERROR: Konflux cookie expired or invalid (HTTP 401)
```

**Cause:** SSO cookies expire after 8-24 hours depending on session activity.

**Solution:**
```bash
# Re-authenticate via /osp:configure
/osp:configure
# Select: Konflux authentication
```

**Prevention:** Before starting a multi-hour release session, refresh your cookie.

---

### No Snapshot Found

**Symptom:**
```
ERROR: No snapshot found for application operator-1-15-index-4-18-application
```

**Possible Causes:**
1. **Build hasn't completed** — Pipeline still running or recently triggered
2. **EC check failed** — Build succeeded but Enterprise Contract rejected it
3. **Wrong component name** — Typo or incorrect version in component name

**Diagnosis:**
```bash
# Check if pipeline is still running
/osp:component-builds status operator-1-15-index-4-18

# Check application exists
curl -s -H "Cookie: ..." \
  "${KONFLUX_URL}/api/.../applications" | jq '.items[].metadata.name' | grep index
```

**Solution:** Wait for pipeline to complete, or check for EC failures in Konflux UI.

---

### Manifest Unknown (skopeo copy fails)

**Symptom:**
```
FATA[0001] Error reading manifest sha256:abc123... in quay.io/...: manifest unknown
```

**Cause:** The digest in your reference points to an image that no longer exists in the source registry (may have been garbage collected or overwritten).

**Solution:**
1. Re-run `/osp:konflux-image` to get fresh Snapshot reference
2. Use `--all` flag with skopeo to copy all architectures
3. Verify source image exists: `skopeo inspect docker://SOURCE_IMAGE`

---

### Authentication to quay.io/redhat-user-workloads

**Symptom:**
```
Error: unauthorized: access to the requested resource is not authorized
```

**Cause:** The source registry `quay.io/redhat-user-workloads` requires Red Hat SSO authentication.

**Solution:**
```bash
# Login to quay.io with your Red Hat SSO-linked account
skopeo login quay.io

# Or use robot account credentials if available
skopeo login quay.io -u "robot$account" -p "token"
```

---

### Image Reference Has Tag Instead of Digest

**Symptom:** Image reference shows `:tag` instead of `@sha256:...`

**Risk:** Tags are mutable — the underlying image can change between copy operations.

**Solution:** Always use the full reference from Snapshot which includes the digest:
```
quay.io/redhat-user-workloads/tekton-ecosystem-tenant/1-15/index-4-18@sha256:abc123...
```

If you only have a tag, resolve it to digest:
```bash
skopeo inspect docker://IMAGE:TAG | jq -r '.Digest'
```
</troubleshooting>
