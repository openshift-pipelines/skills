---
name: operator-release
description: Run operator update workflows and generate index images for release
allowed-tools:
  - Bash
  - Read
  - WebFetch
  - AskUserQuestion
  - TodoWrite
---

# Operator Release Workflow

<objective>
Execute the operator release workflow for a specific environment (devel, staging, or production). This includes updating component image references, generating index images, and verifying builds.

Use this skill after all component PRs are merged and their Konflux pipelines have passed.
</objective>

<execution_context>
**Prerequisites:**
- All component PRs merged (e.g., CLI PR with CVE fixes)
- All component Konflux on-push pipelines passed (including Enterprise Contract)
- Component images available in `quay.io/redhat-user-workloads/tekton-ecosystem-tenant/...`

**Environments:**
| Environment | Target Registry | Purpose |
|-------------|-----------------|---------|
| `devel` | quay.io/openshift-pipeline | QE testing |
| `staging` | registry.stage.redhat.io/openshift-pipelines | Stage release |
| `production` | registry.redhat.io/openshift-pipelines | Production release |

**Workflows:**
| Workflow | Repo | Purpose |
|----------|------|---------|
| `operator-update-images.yaml` | openshift-pipelines/operator | Updates component SHAs in CSV |
| `index-render-template.yaml` | openshift-pipelines/operator | Generates OLM index images |

**Release Order:**
1. DEVEL → QE testing
2. STAGING → Stage release
3. PRODUCTION → Prod release
</execution_context>

<process>
<step name="get_input">
Get release version and environment from user if not provided.

Use AskUserQuestion:
- header: "Version"
- question: "Which release version? (e.g., 1.15, 1.19, 1.20)"

- header: "Environment"
- question: "Which environment to release?"
- options: ["devel (QE testing)", "staging", "production"]
</step>

<step name="verify_prerequisites">
**Verify all component pipelines have passed before proceeding.**

```bash
VERSION="1.15"
BRANCH="release-v${VERSION}.x"

# List of component repos to check
COMPONENTS=(
  "tektoncd-pipeline"
  "tektoncd-triggers"
  "tektoncd-chains"
  "tektoncd-results"
  "tektoncd-hub"
  "pac-downstream"
  "tektoncd-cli"
  "tektoncd-git-clone"
  "console-plugin"
  "operator"
)

echo "=== Checking component pipeline status ==="
for component in "${COMPONENTS[@]}"; do
  echo "Checking openshift-pipelines/${component}..."

  # Get recent workflow runs on the release branch
  FAILED=$(gh run list --repo "openshift-pipelines/${component}" \
    --branch "${BRANCH}" --limit 5 \
    --json conclusion | jq '[.[] | select(.conclusion == "failure")] | length')

  IN_PROGRESS=$(gh run list --repo "openshift-pipelines/${component}" \
    --branch "${BRANCH}" --status in_progress \
    --json databaseId | jq 'length')

  if [ "$IN_PROGRESS" -gt 0 ]; then
    echo "  ⏳ ${component}: ${IN_PROGRESS} workflow(s) in progress"
  elif [ "$FAILED" -gt 0 ]; then
    echo "  ❌ ${component}: Has recent failures"
  else
    echo "  ✅ ${component}: OK"
  fi
done
```

**Check Konflux builds:**
```bash
# Verify images exist in quay for key components
echo ""
echo "=== Checking Konflux images ==="

# CLI image check
skopeo inspect --no-tags \
  docker://quay.io/redhat-user-workloads/tekton-ecosystem-tenant/1-15/tkn-rhel8 2>/dev/null | \
  jq '{digest: .Digest, created: .Created}' || echo "CLI image not found"

# Operator image check
skopeo inspect --no-tags \
  docker://quay.io/redhat-user-workloads/tekton-ecosystem-tenant/1-15/operator-rhel8 2>/dev/null | \
  jq '{digest: .Digest, created: .Created}' || echo "Operator image not found"
```

**Stop if any components have failures or in-progress workflows.**
</step>

<step name="run_operator_update_images">
**Run the operator-update-images workflow to update component SHAs.**

```bash
VERSION="1.15"
ENVIRONMENT="devel"  # or staging, production
BRANCH="release-v${VERSION}.x"

# Trigger the workflow
gh workflow run operator-update-images.yaml \
  --repo openshift-pipelines/operator \
  --ref "${BRANCH}" \
  -f environment="${ENVIRONMENT}"

# Wait a moment for the workflow to start
sleep 5

# Get the run ID
RUN_ID=$(gh run list --repo openshift-pipelines/operator \
  --workflow operator-update-images.yaml \
  --branch "${BRANCH}" --limit 1 \
  --json databaseId --jq '.[0].databaseId')

echo "Workflow run ID: ${RUN_ID}"

# Watch the workflow
gh run watch ${RUN_ID} --repo openshift-pipelines/operator --exit-status
```

**After workflow completes, it creates a PR with updated CSVs.**

```bash
# Find the PR created by the workflow
gh pr list --repo openshift-pipelines/operator \
  --base "${BRANCH}" --state open \
  --json number,title,url | jq '.[] | select(.title | test("operator-update-images|Update.*CSV"))'
```
</step>

<step name="merge_operator_pr">
**Review and merge the operator update PR.**

```bash
# Get the PR number
PR_NUMBER=$(gh pr list --repo openshift-pipelines/operator \
  --base "${BRANCH}" --state open \
  --json number,title | jq -r '.[] | select(.title | test("operator-update-images|bot")) | .number' | head -1)

echo "Operator update PR: https://github.com/openshift-pipelines/operator/pull/${PR_NUMBER}"

# View PR details
gh pr view ${PR_NUMBER} --repo openshift-pipelines/operator

# Merge the PR (after review)
gh pr merge ${PR_NUMBER} --repo openshift-pipelines/operator --squash
```
</step>

<step name="monitor_operator_pipelines">
**Monitor operator on-push pipelines after merge (including Enterprise Contract).**

```bash
VERSION="1.15"
BRANCH="release-v${VERSION}.x"

# Wait for pipelines to start
sleep 10

# List running pipelines
echo "=== Operator pipeline status ==="
gh run list --repo openshift-pipelines/operator \
  --branch "${BRANCH}" --limit 5 \
  --json name,status,conclusion,createdAt

# Wait for completion
echo ""
echo "Waiting for pipelines to complete..."
while true; do
  IN_PROGRESS=$(gh run list --repo openshift-pipelines/operator \
    --branch "${BRANCH}" --status in_progress \
    --json databaseId | jq 'length')

  if [ "$IN_PROGRESS" -eq 0 ]; then
    echo "All pipelines completed!"
    break
  fi

  echo "  ${IN_PROGRESS} pipeline(s) still running..."
  sleep 30
done

# Check for failures
FAILED=$(gh run list --repo openshift-pipelines/operator \
  --branch "${BRANCH}" --limit 5 \
  --json conclusion | jq '[.[] | select(.conclusion == "failure")] | length')

if [ "$FAILED" -gt 0 ]; then
  echo "❌ Some pipelines failed! Check Konflux for details."
  gh run list --repo openshift-pipelines/operator \
    --branch "${BRANCH}" --limit 5 \
    --json name,conclusion,url | jq '.[] | select(.conclusion == "failure")'
else
  echo "✅ All operator pipelines passed!"
fi
```

**Verify in Konflux UI:**
1. Go to: https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant
2. Check Applications → `openshift-pipelines-operator-{version}`
3. Verify bundle and operator builds are green
4. Check Enterprise Contract passed
</step>

<step name="run_index_render_template">
**Run index-render-template to generate OLM index images.**

```bash
VERSION="1.15"
ENVIRONMENT="devel"  # usually devel for index generation
BRANCH="release-v${VERSION}.x"

# Trigger the workflow
gh workflow run index-render-template.yaml \
  --repo openshift-pipelines/operator \
  --ref "${BRANCH}" \
  -f environment="${ENVIRONMENT}"

# Wait for workflow to start
sleep 5

# Get the run ID
RUN_ID=$(gh run list --repo openshift-pipelines/operator \
  --workflow index-render-template.yaml \
  --branch "${BRANCH}" --limit 1 \
  --json databaseId --jq '.[0].databaseId')

echo "Index workflow run ID: ${RUN_ID}"

# Watch the workflow
gh run watch ${RUN_ID} --repo openshift-pipelines/operator --exit-status
```

**This workflow generates index images for each OCP version (4.14, 4.15, 4.16, etc.).**
</step>

<step name="merge_index_prs">
**Merge the index PRs created by the workflow.**

```bash
BRANCH="release-v${VERSION}.x"

# List index PRs
echo "=== Index PRs ==="
gh pr list --repo openshift-pipelines/operator \
  --base "${BRANCH}" --state open \
  --json number,title | jq '.[] | select(.title | test("index|catalog"))'

# Merge each index PR
for PR in $(gh pr list --repo openshift-pipelines/operator \
  --base "${BRANCH}" --state open \
  --json number,title | jq -r '.[] | select(.title | test("index|catalog")) | .number'); do
  echo "Merging PR #${PR}..."
  gh pr merge ${PR} --repo openshift-pipelines/operator --squash
done
```
</step>

<step name="monitor_index_pipelines">
**Monitor index image pipelines after merge.**

```bash
# Wait for index pipelines to complete
echo "Waiting for index pipelines..."
sleep 30

# Check status
gh run list --repo openshift-pipelines/operator \
  --branch "${BRANCH}" --limit 10 \
  --json name,status,conclusion | jq '.[] | select(.name | test("index|push"))'
```

**Verify index images in Konflux:**
1. Check Applications → `openshift-pipelines-index-{version}`
2. Verify index builds for each OCP version are green
</step>

<step name="copy_devel_images">
**FOR DEVEL ONLY: Copy images from Konflux to devel registry.**

Per the release guide: "Once CI is green, do skopeo copy from `quay.io/redhat-user-workload` to `quay.io/openshift-pipeline`"

This step is ONLY required for devel environment. Stage and prod releases go through the Konflux release pipeline which handles image promotion automatically.

```bash
VERSION="1.15"
VERSION_DASH="${VERSION//./-}"  # 1-15

# Source: Konflux build registry
SRC_REGISTRY="quay.io/redhat-user-workloads/tekton-ecosystem-tenant/${VERSION_DASH}"

# Destination: Devel registry
DST_REGISTRY="quay.io/openshift-pipeline"

echo "=== Copying Images to Devel Registry ==="
echo "Source: ${SRC_REGISTRY}"
echo "Destination: ${DST_REGISTRY}"
echo ""

# Copy index images for each OCP version
for OCP in 4.12 4.14 4.15 4.16 4.17 4.18; do
  OCP_DASH="${OCP//./-}"  # 4-17

  echo "Copying index v${OCP}..."

  SRC_IMAGE="${SRC_REGISTRY}/operator-${VERSION_DASH}-index-${OCP_DASH}-rhel8"
  DST_IMAGE="${DST_REGISTRY}/pipelines-index-rhel8:v${OCP}"

  skopeo copy --all \
    "docker://${SRC_IMAGE}" \
    "docker://${DST_IMAGE}" && \
    echo "  ✅ Copied index v${OCP}" || \
    echo "  ❌ Failed to copy index v${OCP}"
done

# Also copy operator bundle
echo ""
echo "Copying operator bundle..."
skopeo copy --all \
  "docker://${SRC_REGISTRY}/operator-${VERSION_DASH}-bundle-rhel8" \
  "docker://${DST_REGISTRY}/pipelines-operator-bundle-rhel8" && \
  echo "  ✅ Copied operator bundle" || \
  echo "  ❌ Failed to copy operator bundle"
```

**Authentication required:** You need push access to `quay.io/openshift-pipeline`. Run `podman login quay.io` first if needed.

**Why this step exists:** Konflux builds images to `quay.io/redhat-user-workloads/...` (the build registry). For devel testing, QE needs images in `quay.io/openshift-pipeline` (the devel registry). This manual copy step bridges that gap. Stage/prod releases use the Konflux release pipeline which handles promotion automatically.
</step>

<step name="verify_images">
**Verify images are available in the target registry.**

```bash
ENVIRONMENT="devel"
VERSION="1.15"

case "$ENVIRONMENT" in
  "devel")
    REGISTRY="quay.io/openshift-pipeline"
    ;;
  "staging")
    REGISTRY="registry.stage.redhat.io/openshift-pipelines"
    ;;
  "production")
    REGISTRY="registry.redhat.io/openshift-pipelines"
    ;;
esac

echo "=== Verifying images in ${REGISTRY} ==="

# Check operator bundle
echo "Operator bundle:"
skopeo inspect --no-tags "docker://${REGISTRY}/pipelines-operator-bundle-rhel8" 2>/dev/null | \
  jq '{digest: .Digest, created: .Created}' || echo "Not found"

# Check index images (for each OCP version)
for OCP in 4.12 4.14 4.15 4.16 4.17 4.18; do
  echo "Index v${OCP}:"
  skopeo inspect --no-tags "docker://${REGISTRY}/pipelines-index-rhel8:v${OCP}" 2>/dev/null | \
    jq '{digest: .Digest}' || echo "Not found"
done
```
</step>

<step name="generate_summary">
**Generate release summary for tracking.**

```markdown
# Operator Release Summary

**Version:** {VERSION}
**Environment:** {ENVIRONMENT}
**Date:** {DATE}

## Workflows Executed

| Workflow | Status | Run ID |
|----------|--------|--------|
| operator-update-images | ✅ | {run_id} |
| index-render-template | ✅ | {run_id} |

## PRs Merged

| PR | Title | Status |
|----|-------|--------|
| operator#{pr} | Update CSV for {env} | ✅ Merged |
| operator#{pr} | Index v4.14 | ✅ Merged |
| operator#{pr} | Index v4.15 | ✅ Merged |
| ... | ... | ... |

## Images Verified

| Image | Registry | Status |
|-------|----------|--------|
| operator-bundle | {registry} | ✅ |
| index v4.14 | {registry} | ✅ |
| index v4.15 | {registry} | ✅ |
| ... | ... | ... |

## Next Steps

- **If devel:** Notify QE team for testing with index images
- **If staging:** Proceed with stage release process
- **If production:** Proceed with production release process
```
</step>

<step name="create_todos">
**Create TodoWrite items for tracking.**

```
TodoWrite with items based on environment:

## For DEVEL:
- [x] Run operator-update-images (devel)
- [x] Merge operator CSV PR
- [x] Monitor operator pipelines
- [x] Run index-render-template (devel)
- [x] Merge index PRs
- [x] Wait for Konflux on-push pipelines to complete
- [x] Copy images from quay.io/redhat-user-workloads to quay.io/openshift-pipeline
- [x] Verify images in quay.io/openshift-pipeline
- [ ] Notify QE team for testing

## For STAGING (after QE approval):
- [ ] Run operator-update-images (staging)
- [ ] Merge operator CSV PR
- [ ] Run index-render-template (staging)
- [ ] Verify images in registry.stage.redhat.io
- [ ] Execute stage release

## For PRODUCTION (after stage verification):
- [ ] Run operator-update-images (production)
- [ ] Merge operator CSV PR
- [ ] Run index-render-template (production)
- [ ] Verify images in registry.redhat.io
- [ ] Execute production release
```
</step>
</process>

<output>
A complete operator release execution including:
1. Pre-flight verification of component pipelines
2. operator-update-images workflow execution
3. Operator PR merge and pipeline monitoring
4. index-render-template workflow execution
5. Index PR merges and pipeline monitoring
6. **[DEVEL ONLY]** Copy images from Konflux to devel registry
7. Image verification in target registry
8. Release summary and next steps
</output>

<success_criteria>
- [ ] All component pipelines verified as passing
- [ ] operator-update-images workflow completed successfully
- [ ] Operator update PR merged
- [ ] Operator on-push pipelines passed (including EC)
- [ ] index-render-template workflow completed successfully
- [ ] All index PRs merged
- [ ] Index on-push pipelines passed
- [ ] **[DEVEL ONLY]** Images copied from quay.io/redhat-user-workloads to quay.io/openshift-pipeline
- [ ] Images verified in target registry
- [ ] Summary generated with next steps
</success_criteria>
