---
name: konflux-image
description: Extract image references (URL, digest) from Konflux pipeline results
allowed-tools:
  - Bash
  - Read
  - WebFetch
  - AskUserQuestion
---

# Konflux Image Extractor

<objective>
Extract IMAGE_URL and IMAGE_DIGEST from Konflux pipeline results. Use this to get the full image reference for skopeo copy operations during releases.

Supports two modes:
1. **From PipelineRun URL** - Extract from a specific pipeline run
2. **From component name** - Find the latest successful on-push pipeline for a component
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
- Image URL and digest for the specified component/pipeline
- Full image reference for skopeo operations
- Generated skopeo copy commands for release workflow
</output>

<success_criteria>
- [ ] Konflux authentication verified
- [ ] PipelineRun fetched successfully
- [ ] IMAGE_URL and IMAGE_DIGEST extracted
- [ ] Full reference generated for skopeo
- [ ] Ready for image copy operations
</success_criteria>
