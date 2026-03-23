---
name: operator-config
description: Configure the operator for a minor release
allowed-tools:
  - Bash
  - Read
  - Write
  - WebFetch
  - AskUserQuestion
  - TodoWrite
---

# Operator Configuration

<objective>
Configure the OpenShift Pipelines Operator for a minor release. This includes updating `.tekton` files, Dockerfiles, `project.yaml` with versions and component SHAs, hack scripts for RHEL version, and OLM catalog configurations.

Use this skill after `/osp:component-config` has been completed for all components. The operator depends on all component images being built first.
</objective>

<execution_context>
**Prerequisites:**
- All component images built (pipeline, triggers, chains, results, hub, pac, cli, git-init, etc.)
- Hack-generated PRs merged on operator repo
- GitHub CLI (`gh`) authenticated
- Access to openshift-pipelines GitHub org

**Operator Repository:** https://github.com/openshift-pipelines/operator

**Key Files:**
- `.tekton/` - Tekton pipeline definitions
- `.konflux/dockerfiles/` - Component Dockerfiles
- `.konflux/olm-catalog/` - Bundle and Index configurations
- `project.yaml` - Version and SHA configurations
- `hack/` - Build scripts (index-render-template.sh, operator-fetch-payload.sh)

**RHEL Version Mapping:**
- OSP 1.14.x - 1.17.x: RHEL8
- OSP 1.18.x onwards: RHEL9

**Reference:** See `docs/references/minor-release-guide.md` for full documentation.
</execution_context>

<process>
<step name="get_input">
Get the release version from user if not provided.

Use AskUserQuestion:
- header: "Version"
- question: "Which minor release version? (e.g., 1.20)"

Derive values:
```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

# Determine RHEL version
MINOR_NUM=${MINOR_VERSION#*.}
if [ "$MINOR_NUM" -ge 18 ]; then
  RHEL_VERSION="rhel9"
else
  RHEL_VERSION="rhel8"
fi

echo "Minor version: ${MINOR_VERSION}"
echo "Branch: ${BRANCH}"
echo "RHEL version: ${RHEL_VERSION}"
```
</step>

<step name="check_branch">
Verify the operator release branch exists:

```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

# Check if branch exists
BRANCH_EXISTS=$(gh api "repos/openshift-pipelines/operator/branches/${BRANCH}" --jq '.name' 2>/dev/null || echo "NOT_FOUND")

if [ "$BRANCH_EXISTS" = "NOT_FOUND" ]; then
  echo "ERROR: Branch ${BRANCH} does not exist on openshift-pipelines/operator"
  echo ""
  echo "Available release branches:"
  gh api "repos/openshift-pipelines/operator/branches" --jq '.[].name | select(startswith("release-"))' | head -10
  exit 1
fi

echo "Branch ${BRANCH} exists"
```
</step>

<step name="check_component_images">
Verify all component images are built before configuring the operator:

```bash
MINOR_VERSION="1.20"
VERSION_DASH="${MINOR_VERSION//./-}"  # e.g., 1-20

echo "=== Checking component images ==="

# Key components to verify
COMPONENTS=(
  "pipeline-controller-rhel9"
  "pipeline-webhook-rhel9"
  "triggers-controller-rhel9"
  "triggers-webhook-rhel9"
  "chains-controller-rhel9"
  "results-api-rhel9"
  "results-watcher-rhel9"
  "pac-controller-rhel9"
  "pac-watcher-rhel9"
  "pac-webhook-rhel9"
  "tkn-rhel9"
)

MISSING=0
for comp in "${COMPONENTS[@]}"; do
  IMAGE="quay.io/redhat-user-workloads/tekton-ecosystem-tenant/${VERSION_DASH}/${comp}"
  if skopeo inspect --no-tags "docker://${IMAGE}" &>/dev/null; then
    echo "✅ ${comp}"
  else
    echo "❌ ${comp} - NOT FOUND"
    MISSING=$((MISSING + 1))
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo ""
  echo "WARNING: ${MISSING} component images not found."
  echo "Run /osp:component-config for missing components first."
fi
```

Use AskUserQuestion if images are missing:
- header: "Continue?"
- question: "Some component images are missing. Continue anyway?"
- options: ["Continue", "Stop and configure components first"]
</step>

<step name="check_hack_prs">
Check for and merge hack-generated PRs:

```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

echo "=== Open PRs from hack workflows ==="
gh pr list --repo "openshift-pipelines/operator" --base "${BRANCH}" --state open \
  --json number,title,author,createdAt | jq '
  .[] | select(.title | test("hack|konflux|tekton|bot"; "i")) |
  {number, title, author: .author.login, created: .createdAt}
'

echo ""
echo "=== Recently merged PRs ==="
gh pr list --repo "openshift-pipelines/operator" --base "${BRANCH}" --state merged --limit 5 \
  --json number,title,mergedAt | jq '.[] | {number, title, merged: .mergedAt}'
```

**Expected PRs from hack:**
1. `.tekton/` configuration PR - Tekton pipeline definitions
2. `.github/workflows/` PR - GitHub Actions workflows

Merge these PRs before proceeding.
</step>

<step name="clone_repo">
Clone the operator repository:

```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

WORK_DIR="/tmp/operator-${MINOR_VERSION}"
rm -rf "${WORK_DIR}"
git clone "https://github.com/openshift-pipelines/operator" -b "${BRANCH}" "${WORK_DIR}"
cd "${WORK_DIR}"

echo "Cloned to ${WORK_DIR}"
```
</step>

<step name="verify_tekton_configs">
Verify `.tekton` directory configurations:

```bash
cd "${WORK_DIR}"

echo "=== .tekton directory contents ==="
ls -la .tekton/

echo ""
echo "=== Checking branch references in .tekton ==="
grep -r "${BRANCH}" .tekton/ | head -10 || echo "No branch refs found"

echo ""
echo "=== Checking Dockerfile paths in .tekton ==="
grep -r "dockerfile" .tekton/ | head -10

echo ""
echo "=== Checking for bundle/index pipeline configs ==="
ls .tekton/*bundle* .tekton/*index* 2>/dev/null || echo "Check .tekton for bundle/index configs"
```

**Verify:**
- Branch names are correct in all pipeline files
- Dockerfile paths exist and are correct for operator, bundle, and index
</step>

<step name="update_dockerfiles">
Update Dockerfiles with correct base images and versions.

**Dockerfile locations:**
- `.konflux/dockerfiles/` - Operator component Dockerfiles
- `.konflux/olm-catalog/bundle/` - Bundle Dockerfile
- `.konflux/olm-catalog/index/` - Index Dockerfiles (per OCP version)

```bash
cd "${WORK_DIR}"

echo "=== Operator Dockerfiles ==="
find .konflux/dockerfiles -name "*.Dockerfile" -o -name "Dockerfile*" 2>/dev/null

echo ""
echo "=== OLM Catalog Dockerfiles ==="
find .konflux/olm-catalog -name "Dockerfile*" 2>/dev/null

echo ""
echo "=== Current base images ==="
grep -r "^FROM\|^ARG.*registry" .konflux/dockerfiles/ 2>/dev/null | head -20
```

**Updates needed:**

1. **Base Image SHA:** Update to latest released SHA from https://catalog.redhat.com/

2. **Version ARG:** Update VERSION to release version

3. **RHEL Version:** For OSP 1.18+, use RHEL9 base images:
```bash
# Check for RHEL8 vs RHEL9
grep -r "ubi8\|ubi9\|rhel8\|rhel9" .konflux/dockerfiles/ 2>/dev/null
```
</step>

<step name="update_project_yaml">
Update `project.yaml` with version and component information.

**Critical fields to update:**

```bash
cd "${WORK_DIR}"

echo "=== Current project.yaml ==="
cat project.yaml

echo ""
echo "=== Fields to update ==="
echo "- current: The version planned for release (e.g., 1.20.0)"
echo "- previous: The previously released version"
echo "- previous_range: The previous minor release (e.g., 1.19.0)"
echo "- channel: Release channel name"
echo "- openshift.latest: Latest supported OCP version"
echo "- openshift.min: Minimum supported OCP version"
```

**project.yaml structure:**
```yaml
version:
  current: "1.20.0"        # Version being released
  previous: "1.19.1"       # Last released version (minor or patch)
  previous_range: "1.19.0" # Previous minor release
  channel: "pipelines-1.20"
openshift:
  latest: "4.20"
  min: "4.14"
```

**Update component SHAs:**
The `project.yaml` also contains SHA references for all components. These should be updated either:
1. Via Nudge PRs (automatic)
2. Manually after component builds complete

```bash
echo "=== Current component SHAs in project.yaml ==="
grep -A2 "sha:" project.yaml | head -30
```
</step>

<step name="check_nudge_prs">
Check for Nudge PRs that update component SHAs:

```bash
BRANCH="release-v${MINOR_VERSION}.x"

echo "=== Nudge PRs (SHA updates) ==="
gh pr list --repo "openshift-pipelines/operator" --base "${BRANCH}" --state open \
  --json number,title | jq '.[] | select(.title | test("nudge|sha|update.*sha"; "i"))'

echo ""
echo "IMPORTANT: It's common for nudge PRs to NOT be generated for some components."
echo "Manual SHA updates in project.yaml may be required."
```

**If Nudge PRs exist:**
- Review and merge each one
- Verify the SHA matches the built component image

**If Nudge PRs are missing:**
- Manually update `project.yaml` with correct SHAs from Konflux builds
</step>

<step name="update_hack_scripts">
Update operator hack scripts for the release.

**1. index-render-template.sh - RHEL version:**

```bash
cd "${WORK_DIR}"
MINOR_NUM=${MINOR_VERSION#*.}

echo "=== Current index-render-template.sh ==="
cat hack/index-render-template.sh | head -50

echo ""
if [ "$MINOR_NUM" -ge 18 ]; then
  echo "OSP ${MINOR_VERSION} requires RHEL9"
  echo "Ensure index-render-template.sh uses rhel9 base images"
else
  echo "OSP ${MINOR_VERSION} uses RHEL8"
fi

# Check current RHEL references
grep -n "rhel8\|rhel9" hack/index-render-template.sh
```

**2. operator-fetch-payload.sh - BUNDLE_ARGS and channel:**

```bash
echo "=== Current operator-fetch-payload.sh ==="
cat hack/operator-fetch-payload.sh | head -50

echo ""
echo "Check and update:"
echo "- BUNDLE_ARGS"
echo "- sed commands that change the channel"

grep -n "BUNDLE_ARGS\|channel\|sed" hack/operator-fetch-payload.sh
```
</step>

<step name="update_olm_bundle">
Update OLM bundle configuration.

**Bundle directory:** `.konflux/olm-catalog/bundle/`

```bash
cd "${WORK_DIR}"

echo "=== Bundle Dockerfile ==="
cat .konflux/olm-catalog/bundle/Dockerfile

echo ""
echo "=== Required updates for minor release ==="
echo "1. Channel name: pipelines-${MINOR_VERSION}"
echo "2. Ensure 'latest' is in both channels for minor releases"
echo ""
echo "Expected labels:"
echo '  LABEL operators.operatorframework.io.bundle.channel.default.v1="latest"'
echo '  LABEL operators.operatorframework.io.bundle.channels.v1="latest,pipelines-'${MINOR_VERSION}'"'
```

**Update annotations.yaml:**
```bash
echo ""
echo "=== Bundle annotations.yaml ==="
cat .konflux/olm-catalog/bundle/annotations.yaml 2>/dev/null || cat .konflux/olm-catalog/bundle/metadata/annotations.yaml 2>/dev/null

echo ""
echo "Verify channel annotations match Dockerfile"
```
</step>

<step name="update_olm_index">
Update OLM index configurations for each OCP version.

**Index directory:** `.konflux/olm-catalog/index/`

```bash
cd "${WORK_DIR}"

echo "=== Index directories (per OCP version) ==="
ls -la .konflux/olm-catalog/index/

echo ""
echo "Each index folder contains:"
echo "- Dockerfile"
echo "- catalog-template.json"
```

**For each OCP version:**
1. **Dockerfile:** Update channel information
2. **catalog-template.json:** Verify against base image

```bash
# Check index Dockerfile for OCP 4.14
echo "=== Index 4.14 Dockerfile ==="
cat .konflux/olm-catalog/index/v4.14/Dockerfile 2>/dev/null | head -30

# To verify catalog-template.json, render the base index:
echo ""
echo "To verify catalog-template.json:"
echo "opm render registry.redhat.io/redhat/redhat-operator-index:v4.14 > target-index-v4.14.json"
echo "Compare with .konflux/olm-catalog/index/v4.14/catalog-template.json"
```
</step>

<step name="create_pr">
If changes were made, create a PR:

```bash
cd "${WORK_DIR}"

# Check for changes
if [ -n "$(git status --porcelain)" ]; then
  echo "Changes detected, creating PR..."

  # Create branch
  git checkout -b "release-config-${MINOR_VERSION}"

  # Stage and commit
  git add -A
  git commit -m "$(cat <<EOF
chore(release): configure operator for v${MINOR_VERSION}

- Update project.yaml versions (current, previous, previous_range)
- Update component SHAs
- Update Dockerfile base images
- Update hack scripts for RHEL version
- Update OLM bundle/index configurations

Release: ${MINOR_VERSION}
EOF
)"

  # Push
  git push -u origin "release-config-${MINOR_VERSION}"

  # Create PR
  gh pr create \
    --base "${BRANCH}" \
    --head "release-config-${MINOR_VERSION}" \
    --title "chore(release): configure operator for v${MINOR_VERSION}" \
    --body "$(cat <<EOF
## Summary

Configure OpenShift Pipelines Operator for ${MINOR_VERSION} minor release.

## Changes

- Updated \`project.yaml\`:
  - current: ${MINOR_VERSION}.0
  - previous: (previous version)
  - previous_range: (previous minor)
  - channel: pipelines-${MINOR_VERSION}
  - openshift.latest/min versions
- Updated component SHAs in \`project.yaml\`
- Updated Dockerfile base images to latest SHAs
- Updated hack scripts for RHEL version
- Updated OLM bundle channel configuration
- Updated OLM index configurations

## Checklist

- [ ] project.yaml versions are correct
- [ ] Component SHAs are up to date
- [ ] Dockerfile base images are latest
- [ ] hack/index-render-template.sh uses correct RHEL version
- [ ] hack/operator-fetch-payload.sh BUNDLE_ARGS and channel are correct
- [ ] Bundle Dockerfile has correct channels
- [ ] Bundle annotations.yaml is correct
- [ ] Index Dockerfiles have correct channels
- [ ] catalog-template.json files are verified

## Next Steps

1. Wait for CI to pass
2. Merge this PR
3. Run \`update-sources-release-v${MINOR_VERSION}.x\` workflow
4. Wait for bot PR and merge
5. Run \`/osp:operator-release\` with environment=devel

## Dependencies

All component images must be built before operator release workflows can run.
EOF
)"
else
  echo "No changes needed - operator may already be configured"
fi
```
</step>

<step name="run_update_sources">
Run the update-sources workflow:

```bash
echo "=== Running update-sources workflow ==="

# Trigger the workflow
gh workflow run "update-sources-${BRANCH}.yaml" \
  --repo "openshift-pipelines/operator" \
  --ref main

echo ""
echo "Workflow triggered. Monitor at:"
echo "https://github.com/openshift-pipelines/operator/actions"

# Wait a moment and get run ID
sleep 5
RUN_ID=$(gh run list --repo "openshift-pipelines/operator" \
  --workflow "update-sources-${BRANCH}.yaml" \
  --limit 1 --json databaseId --jq '.[0].databaseId')

echo ""
echo "Run ID: ${RUN_ID}"
echo "Watch with: gh run watch ${RUN_ID} --repo openshift-pipelines/operator"
```
</step>

<step name="wait_for_ci">
Wait for CI and merge:

```bash
echo "=== Waiting for CI ==="
echo ""
echo "1. Wait for configuration PR to pass CI"
echo "2. Merge configuration PR"
echo "3. Wait for update-sources bot PR"
echo "4. Review and merge bot PR"
echo ""

# List open PRs
gh pr list --repo "openshift-pipelines/operator" --base "${BRANCH}" --state open \
  --json number,title,statusCheckRollup | jq '
  .[] | {
    number,
    title,
    checks: [.statusCheckRollup[]? | {name: .name, status: .status, conclusion: .conclusion}]
  }
'

echo ""
echo "After update-sources completes, a bot PR will be created."
echo "Review and merge it to trigger builds."
```
</step>

<step name="verify_builds">
After merging, verify builds are triggered:

```bash
echo "=== Recent workflow runs ==="
gh run list --repo "openshift-pipelines/operator" --branch "${BRANCH}" --limit 5 \
  --json name,status,conclusion,createdAt

echo ""
echo "=== Check Konflux builds ==="
echo "Verify at: https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant"
echo ""
echo "Check for:"
echo "- Application: openshift-pipelines-operator-${MINOR_VERSION//./-}"
echo "- Operator components build green"
echo "- Bundle image build green"
echo "- Enterprise Contract passed"
```
</step>

<step name="next_steps">
After operator configuration is complete:

```bash
echo "=== Next Steps ==="
echo ""
echo "1. Operator Configuration Complete:"
echo "   - All PRs merged"
echo "   - CI green on release branch"
echo "   - Operator and bundle images built"
echo ""
echo "2. Get Devel Build:"
echo "   Run: /osp:operator-release"
echo "   - Select environment: devel"
echo "   - This runs operator-update-images and index-render-template"
echo ""
echo "3. After Devel Testing:"
echo "   - QE validates devel build"
echo "   - Proceed to /osp:release-config for stage/prod"
echo ""
echo "4. Stage and Prod Releases:"
echo "   - /osp:stage-release"
echo "   - /osp:prod-release"
```
</step>

<step name="generate_todos">
Generate todo items for this configuration:

```
TodoWrite with items:

## Operator Configuration for ${MINOR_VERSION}

### Pre-requisites
- [x] Verify all component images built
- [x] Check release branch exists

### Configuration
- [x] Merge hack-generated PRs (.tekton, .github)
- [x] Verify .tekton directory configurations
- [x] Update Dockerfiles (base images, RHEL version)
- [ ] Update project.yaml versions
- [ ] Update component SHAs in project.yaml
- [ ] Update hack/index-render-template.sh (RHEL version)
- [ ] Update hack/operator-fetch-payload.sh (BUNDLE_ARGS, channel)
- [ ] Update OLM bundle Dockerfile (channels)
- [ ] Update OLM bundle annotations.yaml
- [ ] Update OLM index Dockerfiles and catalog-template.json

### PR and CI
- [ ] Create configuration PR
- [ ] Wait for CI to pass
- [ ] Merge configuration PR
- [ ] Run update-sources workflow
- [ ] Wait for bot PR and merge
- [ ] Verify Konflux builds pass

### Next Phase
- [ ] Run /osp:operator-release (devel)
- [ ] QE testing
- [ ] Proceed to /osp:release-config
```
</step>
</process>

<output>
A configured operator ready for the release:
1. Hack-generated PRs merged
2. Dockerfiles updated with correct base images and RHEL version
3. project.yaml updated with versions and component SHAs
4. Hack scripts updated for release
5. OLM bundle/index configurations updated
6. Configuration PR created and merged
7. update-sources workflow run
8. CI passing and builds triggered
</output>

<success_criteria>
- [ ] Release branch exists
- [ ] All component images built (prerequisites)
- [ ] Hack-generated PRs merged
- [ ] .tekton configurations verified
- [ ] Dockerfiles updated (base images, RHEL version)
- [ ] project.yaml updated:
  - [ ] current, previous, previous_range versions
  - [ ] channel name
  - [ ] openshift.latest/min
  - [ ] Component SHAs
- [ ] hack/index-render-template.sh uses correct RHEL version
- [ ] hack/operator-fetch-payload.sh BUNDLE_ARGS and channel correct
- [ ] OLM bundle Dockerfile has correct channels
- [ ] OLM bundle annotations.yaml updated
- [ ] OLM index configurations updated
- [ ] Configuration PR merged
- [ ] update-sources workflow completed
- [ ] Bot PR merged
- [ ] CI green on release branch
- [ ] Operator and bundle images built in Konflux
</success_criteria>
