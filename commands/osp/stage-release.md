---
name: stage-release
description: Execute stage release for OpenShift Pipelines
allowed-tools:
  - Bash
  - Read
  - Write
  - WebFetch
  - AskUserQuestion
  - TodoWrite
---

# Stage Release Process

<objective>
Execute the stage release for OpenShift Pipelines. This follows the release order: CORE → CLI → OPERATOR → INDEX, updating snapshots and applying release YAMLs.

Use this skill after `/osp:release-config` is complete and all Konflux resources are in place.
</objective>

<execution_context>
**Prerequisites:**
- Release configuration complete (`/osp:release-config`)
- RPA and RP resources applied to Konflux cluster
- Release YAML templates in hack repo
- `oc` CLI authenticated to Konflux RH02 cluster
- GitHub CLI (`gh`) authenticated

**Release Order (Critical):**
1. **CORE** - Pipeline, Triggers, Chains, Results, Hub, PAC, git-init, MAG, Console-plugin
2. **CLI** - CLI (tkn), OPC (depends on PAC CLI stage image)
3. **OPERATOR** - Operator, Bundle
4. **INDEX** - OLM index images for each OCP version

**Target Registry:** `registry.stage.redhat.io/openshift-pipelines`

**Reference:** See `docs/references/minor-release-guide.md` for full documentation.

**Registry Flow (Full Release Lifecycle):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  quay.io/openshift-pipeline/     →  Dev/CI builds (publicly accessible)
│  registry.stage.redhat.io/       →  Stage releases (this skill)
│  registry.redhat.io/             →  Production releases (/osp:prod-release)
└─────────────────────────────────────────────────────────────────────┘
```

**PAC_BUILDER Lifecycle:**
The `tektoncd-cli` Dockerfile has a `PAC_BUILDER` ARG referencing the PAC CLI image. This must be updated at each stage:
- **Before stage:** Update to `registry.stage.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel9@sha256:...`
- **Before prod:** Update to `registry.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel9@sha256:...`
- **After prod expires:** Revert to `quay.io/openshift-pipeline/pipelines-pipelines-as-code-cli-rhel8:1.15` (dev image)
</execution_context>

<process>
<step name="get_input">
Get the release version from user if not provided.

Use AskUserQuestion:
- header: "Version"
- question: "Which release version for stage? (e.g., 1.20.0)"

Derive values:
```bash
RELEASE_VERSION="1.20.0"
MINOR_VERSION="${RELEASE_VERSION%.*}"  # e.g., 1.20
BRANCH="release-v${MINOR_VERSION}.x"

echo "Release version: ${RELEASE_VERSION}"
echo "Minor version: ${MINOR_VERSION}"
echo "Branch: ${BRANCH}"
```
</step>

<step name="verify_prerequisites">
Verify prerequisites before starting stage release:

```bash
MINOR_VERSION="1.20"

echo "=== Verifying Konflux Resources ==="
echo ""
echo "Login to Konflux RH02 cluster and run:"
echo "oc project tekton-ecosystem-tenant"
echo ""
echo "Check RPA:"
echo "oc get releaseplanadmission | grep ${MINOR_VERSION}"
echo ""
echo "Check RP:"
echo "oc get releaseplan | grep ${MINOR_VERSION}"
```

Use AskUserQuestion:
- header: "Prerequisites"
- question: "Are RPA and RP resources verified in Konflux cluster?"
- options: ["Yes, verified", "Need to check", "Not yet applied"]
</step>

<step name="clone_hack_repo">
Clone the hack repo with release branch:

```bash
MINOR_VERSION="1.20"
RELEASE_VERSION="1.20.0"
BRANCH="release-v${MINOR_VERSION}.x"

WORK_DIR="/tmp/hack-stage-${RELEASE_VERSION}"
rm -rf "${WORK_DIR}"
git clone https://github.com/openshift-pipelines/hack -b "${BRANCH}" "${WORK_DIR}"
cd "${WORK_DIR}"

# Navigate to stage release directory
cd "config/release/${RELEASE_VERSION}/stage"
ls -la

echo "Working in: $(pwd)"
```
</step>

<step name="release_core">
**Step 1: CORE Release**

Core components: Pipeline, Triggers, Chains, Results, Hub, PAC, git-init, MAG, Console-plugin

**Get the latest core snapshot:**
```bash
MINOR_VERSION="1.20"
VERSION_DASH="${MINOR_VERSION//./-}"

echo "=== Getting Core Snapshot ==="
echo ""
echo "Go to Konflux UI:"
echo "https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant/applications/openshift-pipelines-${VERSION_DASH}"
echo ""
echo "1. Click on 'Snapshots' tab"
echo "2. Find the latest successful snapshot"
echo "3. Copy the snapshot name (e.g., openshift-pipelines-1-20-xxxxx)"
```

Use AskUserQuestion:
- header: "Core Snapshot"
- question: "Enter the core snapshot name:"

**Update the release YAML:**
```bash
RELEASE_VERSION="1.20.0"
CORE_SNAPSHOT="openshift-pipelines-1-20-xxxxx"  # Replace with actual

# Update the release file
sed -i "s/SNAPSHOT_PLACEHOLDER/${CORE_SNAPSHOT}/" "openshift-pipelines-core-${RELEASE_VERSION}-release.yaml"

echo "Updated release file:"
cat "openshift-pipelines-core-${RELEASE_VERSION}-release.yaml"
```

**Apply the release:**
```bash
echo "=== Applying Core Release ==="
echo ""
echo "Run on Konflux cluster:"
echo "oc project tekton-ecosystem-tenant"
echo "oc apply -f openshift-pipelines-core-${RELEASE_VERSION}-release.yaml"
echo ""
echo "Or from local:"
oc apply -f "openshift-pipelines-core-${RELEASE_VERSION}-release.yaml"
```

**Monitor the release pipeline:**
```bash
echo "=== Monitoring Core Release ==="
echo ""
echo "Check release status:"
echo "oc get release | grep core-${RELEASE_VERSION}"
echo ""
echo "Watch release pipeline:"
echo "oc get pipelinerun -l release.appstudio.openshift.io/name=openshift-pipelines-core-${RELEASE_VERSION}-stage"
echo ""
echo "Or check in Konflux UI → Releases"
```

**Wait for core release to complete before proceeding to CLI.**
</step>

<step name="update_cli_pac_dependency">
**Step 2: CLI - Update PAC CLI Dependency**

Before CLI release, update the PAC CLI stage URL in tektoncd-cli Dockerfile.

```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

echo "=== Updating CLI PAC Dependency ==="
echo ""
echo "1. Get PAC CLI stage URL from registry.stage.redhat.io"
echo ""
echo "Check PAC CLI image in stage registry:"
skopeo inspect --no-tags "docker://registry.stage.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel9" 2>/dev/null | \
  jq '{digest: .Digest, created: .Created}' || echo "Check stage registry manually"

echo ""
echo "2. Update tektoncd-cli Dockerfile with stage PAC CLI URL"
echo ""
echo "Clone tektoncd-cli:"
echo "git clone https://github.com/openshift-pipelines/tektoncd-cli -b ${BRANCH}"
echo ""
echo "Update .konflux/dockerfiles/<dockerfile> with:"
echo "registry.stage.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel9@sha256:<SHA>"
```

**Create PR to update PAC CLI reference:**
```bash
# Clone CLI repo
CLI_DIR="/tmp/tektoncd-cli-${MINOR_VERSION}"
rm -rf "${CLI_DIR}"
git clone "https://github.com/openshift-pipelines/tektoncd-cli" -b "${BRANCH}" "${CLI_DIR}"
cd "${CLI_DIR}"

echo "=== Current PAC CLI reference ==="
grep -r "pac-cli\|pipelines-as-code-cli" .konflux/dockerfiles/ 2>/dev/null

echo ""
echo "Update the PAC CLI reference to stage URL and create PR"
```

**Wait for new CLI build after PR merge.**
</step>

<step name="release_cli">
**Step 3: CLI Release**

After CLI builds with updated PAC dependency:

**Update CLI SHA in operator project.yaml:**
```bash
echo "=== Updating CLI SHA in Operator ==="
echo ""
echo "Check for Nudge PR on operator repo:"
gh pr list --repo "openshift-pipelines/operator" --base "${BRANCH}" --state open \
  --json number,title | jq '.[] | select(.title | test("nudge|cli"; "i"))'

echo ""
echo "If no Nudge PR, manually update project.yaml with new CLI SHA"
```

**Get CLI snapshot:**
```bash
MINOR_VERSION="1.20"
VERSION_DASH="${MINOR_VERSION//./-}"

echo "=== Getting CLI Snapshot ==="
echo ""
echo "Go to Konflux UI:"
echo "https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant/applications/openshift-pipelines-cli-${VERSION_DASH}"
echo ""
echo "Find the latest successful snapshot with updated PAC dependency"
```

Use AskUserQuestion:
- header: "CLI Snapshot"
- question: "Enter the CLI snapshot name:"

**Update and apply CLI release:**
```bash
RELEASE_VERSION="1.20.0"
CLI_SNAPSHOT="openshift-pipelines-cli-1-20-xxxxx"  # Replace with actual

cd "${WORK_DIR}/config/release/${RELEASE_VERSION}/stage"

# Update the release file
sed -i "s/SNAPSHOT_PLACEHOLDER/${CLI_SNAPSHOT}/" "openshift-pipelines-cli-${RELEASE_VERSION}-release.yaml"

echo "Updated release file:"
cat "openshift-pipelines-cli-${RELEASE_VERSION}-release.yaml"

echo ""
echo "Apply CLI release:"
oc apply -f "openshift-pipelines-cli-${RELEASE_VERSION}-release.yaml"
```

**Wait for CLI release pipeline success before proceeding to Operator.**
</step>

<step name="release_operator">
**Step 4: OPERATOR Release**

After CLI release is successful:

**Run operator-update-images workflow:**
```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

echo "=== Running operator-update-images (staging) ==="

gh workflow run operator-update-images.yaml \
  --repo openshift-pipelines/operator \
  --ref "${BRANCH}" \
  -f environment="staging"

echo ""
echo "Wait for workflow to complete..."
sleep 5

RUN_ID=$(gh run list --repo openshift-pipelines/operator \
  --workflow operator-update-images.yaml \
  --limit 1 --json databaseId --jq '.[0].databaseId')

echo "Run ID: ${RUN_ID}"
echo "gh run watch ${RUN_ID} --repo openshift-pipelines/operator"
```

**Merge the PR and wait for bundle build:**
```bash
echo "=== Merge Operator Update PR ==="

PR_NUMBER=$(gh pr list --repo openshift-pipelines/operator \
  --base "${BRANCH}" --state open \
  --json number,title | jq -r '.[] | select(.title | test("operator-update-images|CSV")) | .number' | head -1)

echo "Operator PR: https://github.com/openshift-pipelines/operator/pull/${PR_NUMBER}"

# Merge after review
gh pr merge ${PR_NUMBER} --repo openshift-pipelines/operator --squash
```

**Update bundle SHA in project.yaml:**
```bash
echo "=== Waiting for Bundle Build ==="
echo ""
echo "1. Wait for bundle image to build in Konflux"
echo "2. Check for Nudge PR with new bundle SHA"
echo "3. Or manually update project.yaml"

gh pr list --repo "openshift-pipelines/operator" --base "${BRANCH}" --state open \
  --json number,title | jq '.[] | select(.title | test("nudge|bundle"; "i"))'
```

**Get operator snapshot:**
```bash
MINOR_VERSION="1.20"
VERSION_DASH="${MINOR_VERSION//./-}"

echo "=== Getting Operator Snapshot ==="
echo ""
echo "Go to Konflux UI:"
echo "https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant/applications/openshift-pipelines-operator-${VERSION_DASH}"
echo ""
echo "Find the latest successful snapshot with updated bundle"
```

Use AskUserQuestion:
- header: "Operator Snapshot"
- question: "Enter the operator snapshot name:"

**Apply operator release:**
```bash
RELEASE_VERSION="1.20.0"
OPERATOR_SNAPSHOT="openshift-pipelines-operator-1-20-xxxxx"  # Replace with actual

cd "${WORK_DIR}/config/release/${RELEASE_VERSION}/stage"

sed -i "s/SNAPSHOT_PLACEHOLDER/${OPERATOR_SNAPSHOT}/" "openshift-pipelines-operator-${RELEASE_VERSION}-release.yaml"

cat "openshift-pipelines-operator-${RELEASE_VERSION}-release.yaml"

echo ""
echo "Apply operator release:"
oc apply -f "openshift-pipelines-operator-${RELEASE_VERSION}-release.yaml"
```

**Wait for operator release success before proceeding to INDEX.**
</step>

<step name="release_index">
**Step 5: INDEX Release**

After operator release is successful:

**Run index-render-template workflow:**
```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

echo "=== Running index-render-template (staging) ==="

gh workflow run index-render-template.yaml \
  --repo openshift-pipelines/operator \
  --ref "${BRANCH}" \
  -f environment="staging"

echo ""
sleep 5

RUN_ID=$(gh run list --repo openshift-pipelines/operator \
  --workflow index-render-template.yaml \
  --limit 1 --json databaseId --jq '.[0].databaseId')

echo "Run ID: ${RUN_ID}"
echo "gh run watch ${RUN_ID} --repo openshift-pipelines/operator"
```

**Merge index PRs:**
```bash
echo "=== Merge Index PRs ==="

for PR in $(gh pr list --repo openshift-pipelines/operator \
  --base "${BRANCH}" --state open \
  --json number,title | jq -r '.[] | select(.title | test("index|catalog")) | .number'); do
  echo "Merging PR #${PR}..."
  gh pr merge ${PR} --repo openshift-pipelines/operator --squash
done
```

**Wait for index builds and get snapshots for each OCP version:**
```bash
echo "=== Getting Index Snapshots ==="
echo ""
echo "Wait for index builds to complete for each OCP version."
echo ""
echo "Go to Konflux UI and get snapshots for:"
for ocp in 4.14 4.15 4.16 4.17 4.18 4.19 4.20; do
  echo "- Index v${ocp}"
done
```

Use AskUserQuestion (repeat for each OCP version or collect all):
- header: "Index Snapshots"
- question: "Enter index snapshots (format: 4.14=snapshot1,4.15=snapshot2,...)"

**Apply index releases:**
```bash
RELEASE_VERSION="1.20.0"
cd "${WORK_DIR}/config/release/${RELEASE_VERSION}/stage"

# Example - update and apply each index release
for ocp in 4.14 4.15 4.16 4.17 4.18 4.19 4.20; do
  INDEX_SNAPSHOT="openshift-pipelines-index-${ocp}-xxxxx"  # Get actual from user

  if [ -f "openshift-pipelines-index-${ocp}-${RELEASE_VERSION}-release.yaml" ]; then
    sed -i "s/SNAPSHOT_PLACEHOLDER/${INDEX_SNAPSHOT}/" "openshift-pipelines-index-${ocp}-${RELEASE_VERSION}-release.yaml"
    echo "Applying index v${ocp} release..."
    oc apply -f "openshift-pipelines-index-${ocp}-${RELEASE_VERSION}-release.yaml"
  fi
done
```

**Wait for all index releases to succeed.**
</step>

<step name="verify_stage_images">
Verify images are available in stage registry:

```bash
echo "=== Verifying Stage Images ==="
REGISTRY="registry.stage.redhat.io/openshift-pipelines"

# Check operator bundle
echo "Operator bundle:"
skopeo inspect --no-tags "docker://${REGISTRY}/pipelines-operator-bundle-rhel9" 2>/dev/null | \
  jq '{digest: .Digest, created: .Created}' || echo "Not found or auth required"

# Check index images
for ocp in 4.14 4.15 4.16 4.17 4.18 4.19 4.20; do
  echo ""
  echo "Index v${ocp}:"
  skopeo inspect --no-tags "docker://${REGISTRY}/pipelines-index-rhel9:v${ocp}" 2>/dev/null | \
    jq '{digest: .Digest}' || echo "Not found or auth required"
done
```
</step>

<step name="stage_announce">
**Stage Release Announcement**

Once all releases (Core, CLI, Operator, Index) are successful:

```markdown
# Stage Release Summary

**Version:** ${RELEASE_VERSION}
**Date:** $(date +%Y-%m-%d)
**Type:** RHEA (Minor Release)

## Release Status

| Component | Status | Snapshot |
|-----------|--------|----------|
| Core | ✅ | ${CORE_SNAPSHOT} |
| CLI | ✅ | ${CLI_SNAPSHOT} |
| Operator | ✅ | ${OPERATOR_SNAPSHOT} |
| Index 4.14 | ✅ | ${INDEX_414_SNAPSHOT} |
| Index 4.15 | ✅ | ${INDEX_415_SNAPSHOT} |
| Index 4.16 | ✅ | ${INDEX_416_SNAPSHOT} |
| Index 4.17 | ✅ | ${INDEX_417_SNAPSHOT} |
| Index 4.18 | ✅ | ${INDEX_418_SNAPSHOT} |
| Index 4.19 | ✅ | ${INDEX_419_SNAPSHOT} |
| Index 4.20 | ✅ | ${INDEX_420_SNAPSHOT} |

## Images Available

Registry: registry.stage.redhat.io/openshift-pipelines

## Next Steps

1. QE validation on stage images
2. After validation, proceed with prod release: `/osp:prod-release`
```

Share this summary with the team.
</step>

<step name="generate_todos">
Generate todo items for stage release:

```
TodoWrite with items:

## Stage Release ${RELEASE_VERSION}

### Core Release
- [ ] Get core snapshot
- [ ] Update release YAML with snapshot
- [ ] Apply core release
- [ ] Wait for core release pipeline success

### CLI Release
- [ ] Update PAC CLI dependency to stage URL in tektoncd-cli
- [ ] Wait for new CLI build
- [ ] Update CLI SHA in operator project.yaml
- [ ] Get CLI snapshot
- [ ] Update release YAML with snapshot
- [ ] Apply CLI release
- [ ] Wait for CLI release pipeline success

### Operator Release
- [ ] Run operator-update-images (staging)
- [ ] Merge operator update PR
- [ ] Wait for bundle build
- [ ] Update bundle SHA in project.yaml
- [ ] Get operator snapshot
- [ ] Update release YAML with snapshot
- [ ] Apply operator release
- [ ] Wait for operator release pipeline success

### Index Release
- [ ] Run index-render-template (staging)
- [ ] Merge index PRs
- [ ] Wait for index builds (all OCP versions)
- [ ] Get index snapshots for each OCP version
- [ ] Update release YAMLs with snapshots
- [ ] Apply index releases
- [ ] Wait for all index releases success

### Verification
- [ ] Verify images in registry.stage.redhat.io
- [ ] Announce stage release to team
- [ ] QE validation

### Next Step
- [ ] Proceed to prod release: /osp:prod-release
```
</step>
</process>

<output>
Complete stage release execution:
1. Core components released to stage
2. CLI released with updated PAC dependency
3. Operator released with updated CSV
4. Index images released for all OCP versions
5. All images verified in stage registry
6. Release summary shared with team
</output>

<success_criteria>
- [ ] Core release pipeline completed successfully
- [ ] CLI PAC dependency updated to stage URL
- [ ] CLI release pipeline completed successfully
- [ ] Operator update-images workflow completed (staging)
- [ ] Operator release pipeline completed successfully
- [ ] Index render-template workflow completed (staging)
- [ ] Index releases completed for all OCP versions
- [ ] All images verified in registry.stage.redhat.io
- [ ] Stage release announced to team
- [ ] QE validation initiated
</success_criteria>
