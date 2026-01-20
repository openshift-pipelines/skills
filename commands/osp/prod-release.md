---
name: prod-release
description: Execute production release for OpenShift Pipelines
allowed-tools:
  - Bash
  - Read
  - Write
  - WebFetch
  - AskUserQuestion
  - TodoWrite
---

# Production Release Process

<objective>
Execute the production release for OpenShift Pipelines. This follows the same release order as stage: CORE → CLI → OPERATOR → INDEX, with production-specific configurations.

Use this skill after `/osp:stage-release` is complete and QE has validated the stage build.
</objective>

<execution_context>
**Prerequisites:**
- Stage release complete and validated (`/osp:stage-release`)
- QE sign-off on stage build
- prodsec contacted (2-3 days before prod release)
- `oc` CLI authenticated to Konflux RH02 cluster
- GitHub CLI (`gh`) authenticated

**Release Order (Same as Stage):**
1. **CORE** - Pipeline, Triggers, Chains, Results, Hub, PAC, git-init, MAG, Console-plugin
2. **CLI** - CLI (tkn), OPC (depends on PAC CLI prod image)
3. **OPERATOR** - Operator, Bundle
4. **INDEX** - OLM index images for each OCP version

**Target Registry:** `registry.redhat.io/openshift-pipelines`

**Release Type:** RHEA (Red Hat Enhancement Advisory) for minor releases

**Reference:** See `docs/references/minor-release-guide.md` for full documentation.

**Registry Flow (Full Release Lifecycle):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  quay.io/openshift-pipeline/     →  Dev/CI builds (publicly accessible)
│  registry.stage.redhat.io/       →  Stage releases (/osp:stage-release)
│  registry.redhat.io/             →  Production releases (this skill)
└─────────────────────────────────────────────────────────────────────┘
```

**PAC_BUILDER Lifecycle:**
The `tektoncd-cli` Dockerfile has a `PAC_BUILDER` ARG referencing the PAC CLI image. This must be updated at each stage:
- **Before stage:** Update to `registry.stage.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel9@sha256:...`
- **Before prod:** Update to `registry.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel9@sha256:...` (this step)
- **After prod expires:** Revert to `quay.io/openshift-pipeline/pipelines-pipelines-as-code-cli-rhel8:1.15` (dev image)
</execution_context>

<process>
<step name="get_input">
Get the release version from user if not provided.

Use AskUserQuestion:
- header: "Version"
- question: "Which release version for production? (e.g., 1.20.0)"

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
Verify prerequisites before starting production release:

```bash
echo "=== Production Release Prerequisites ==="
echo ""
echo "1. Stage Release Status:"
echo "   - Stage release completed? ___"
echo "   - QE validation passed? ___"
echo ""
echo "2. prodsec Contact:"
echo "   - Contacted Przemyslaw Roguski <proguski@redhat.com>? ___"
echo "   - Version marked as Live? ___"
echo ""
echo "3. Konflux Resources:"
echo "   oc project tekton-ecosystem-tenant"
echo "   oc get releaseplanadmission | grep ${MINOR_VERSION}.*prod"
echo "   oc get releaseplan | grep ${MINOR_VERSION}.*prod"
```

Use AskUserQuestion:
- header: "Prerequisites"
- question: "Have all prerequisites been met (stage validated, QE signed off, prodsec contacted)?"
- options: ["Yes, all ready", "Stage not validated yet", "prodsec not contacted"]
</step>

<step name="clone_hack_repo">
Clone the hack repo with release branch:

```bash
MINOR_VERSION="1.20"
RELEASE_VERSION="1.20.0"
BRANCH="release-v${MINOR_VERSION}.x"

WORK_DIR="/tmp/hack-prod-${RELEASE_VERSION}"
rm -rf "${WORK_DIR}"
git clone https://github.com/openshift-pipelines/hack -b "${BRANCH}" "${WORK_DIR}"
cd "${WORK_DIR}"

# Navigate to prod release directory
cd "config/release/${RELEASE_VERSION}/prod"
ls -la

echo "Working in: $(pwd)"
```
</step>

<step name="release_core">
**Step 1: CORE Release (Production)**

**Get the latest core snapshot:**
```bash
MINOR_VERSION="1.20"
VERSION_DASH="${MINOR_VERSION//./-}"

echo "=== Getting Core Snapshot for Production ==="
echo ""
echo "Go to Konflux UI:"
echo "https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant/applications/openshift-pipelines-${VERSION_DASH}"
echo ""
echo "1. Click on 'Snapshots' tab"
echo "2. Find the latest successful snapshot"
echo "3. Copy the snapshot name"
echo ""
echo "Note: This may be the same snapshot as stage if no changes since then"
```

Use AskUserQuestion:
- header: "Core Snapshot"
- question: "Enter the core snapshot name for production:"

**Update and apply core release:**
```bash
RELEASE_VERSION="1.20.0"
CORE_SNAPSHOT="openshift-pipelines-1-20-xxxxx"  # Replace with actual

cd "${WORK_DIR}/config/release/${RELEASE_VERSION}/prod"

# Update the release file
sed -i "s/SNAPSHOT_PLACEHOLDER/${CORE_SNAPSHOT}/" "openshift-pipelines-core-${RELEASE_VERSION}-release.yaml"

echo "Updated release file:"
cat "openshift-pipelines-core-${RELEASE_VERSION}-release.yaml"

echo ""
echo "=== Applying Core Release (Production) ==="
oc apply -f "openshift-pipelines-core-${RELEASE_VERSION}-release.yaml"
```

**Monitor core release:**
```bash
echo "=== Monitoring Core Release ==="
echo ""
echo "oc get release | grep core-${RELEASE_VERSION}"
echo "oc get pipelinerun -l release.appstudio.openshift.io/name=openshift-pipelines-core-${RELEASE_VERSION}-prod"
```

**Wait for core release pipeline success.**
</step>

<step name="update_cli_pac_dependency">
**Step 2: CLI - Update PAC CLI Dependency for Production**

Update the PAC CLI prod URL in tektoncd-cli Dockerfile.

```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

echo "=== Updating CLI PAC Dependency (Production) ==="
echo ""
echo "1. Get PAC CLI prod URL from registry.redhat.io"
echo ""
echo "Check PAC CLI image in prod registry:"
skopeo inspect --no-tags "docker://registry.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel9" 2>/dev/null | \
  jq '{digest: .Digest, created: .Created}' || echo "Check prod registry manually (requires auth)"

echo ""
echo "2. Update tektoncd-cli Dockerfile with prod PAC CLI URL"
echo ""
echo "git clone https://github.com/openshift-pipelines/tektoncd-cli -b ${BRANCH}"
echo ""
echo "Update .konflux/dockerfiles/<dockerfile> with:"
echo "registry.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel9@sha256:<SHA>"
```

**Create PR to update PAC CLI reference:**
```bash
CLI_DIR="/tmp/tektoncd-cli-prod-${MINOR_VERSION}"
rm -rf "${CLI_DIR}"
git clone "https://github.com/openshift-pipelines/tektoncd-cli" -b "${BRANCH}" "${CLI_DIR}"
cd "${CLI_DIR}"

echo "=== Current PAC CLI reference ==="
grep -r "pac-cli\|pipelines-as-code-cli" .konflux/dockerfiles/ 2>/dev/null

echo ""
echo "Update the PAC CLI reference to prod URL and create PR"
```

**Wait for new CLI build after PR merge.**
</step>

<step name="release_cli">
**Step 3: CLI Release (Production)**

After CLI builds with updated PAC dependency:

**Update CLI SHA in operator:**
```bash
echo "=== Updating CLI SHA in Operator ==="
echo ""
echo "Check for Nudge PR on operator repo:"
gh pr list --repo "openshift-pipelines/operator" --base "${BRANCH}" --state open \
  --json number,title | jq '.[] | select(.title | test("nudge|cli"; "i"))'
```

**Get CLI snapshot and apply release:**
```bash
MINOR_VERSION="1.20"
VERSION_DASH="${MINOR_VERSION//./-}"

echo "=== Getting CLI Snapshot for Production ==="
echo ""
echo "Go to Konflux UI:"
echo "https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant/applications/openshift-pipelines-cli-${VERSION_DASH}"
```

Use AskUserQuestion:
- header: "CLI Snapshot"
- question: "Enter the CLI snapshot name for production:"

**Apply CLI release:**
```bash
RELEASE_VERSION="1.20.0"
CLI_SNAPSHOT="openshift-pipelines-cli-1-20-xxxxx"  # Replace with actual

cd "${WORK_DIR}/config/release/${RELEASE_VERSION}/prod"

sed -i "s/SNAPSHOT_PLACEHOLDER/${CLI_SNAPSHOT}/" "openshift-pipelines-cli-${RELEASE_VERSION}-release.yaml"

cat "openshift-pipelines-cli-${RELEASE_VERSION}-release.yaml"

echo ""
oc apply -f "openshift-pipelines-cli-${RELEASE_VERSION}-release.yaml"
```

**Wait for CLI release pipeline success.**
</step>

<step name="release_operator">
**Step 4: OPERATOR Release (Production)**

**Run operator-update-images workflow:**
```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

echo "=== Running operator-update-images (production) ==="

gh workflow run operator-update-images.yaml \
  --repo openshift-pipelines/operator \
  --ref "${BRANCH}" \
  -f environment="production"

sleep 5

RUN_ID=$(gh run list --repo openshift-pipelines/operator \
  --workflow operator-update-images.yaml \
  --limit 1 --json databaseId --jq '.[0].databaseId')

echo "Run ID: ${RUN_ID}"
echo "gh run watch ${RUN_ID} --repo openshift-pipelines/operator"
```

**Merge PR and wait for bundle:**
```bash
echo "=== Merge Operator Update PR ==="

PR_NUMBER=$(gh pr list --repo openshift-pipelines/operator \
  --base "${BRANCH}" --state open \
  --json number,title | jq -r '.[] | select(.title | test("operator-update-images|CSV")) | .number' | head -1)

echo "Operator PR: https://github.com/openshift-pipelines/operator/pull/${PR_NUMBER}"
gh pr merge ${PR_NUMBER} --repo openshift-pipelines/operator --squash
```

**Get operator snapshot and apply release:**

Use AskUserQuestion:
- header: "Operator Snapshot"
- question: "Enter the operator snapshot name for production:"

```bash
RELEASE_VERSION="1.20.0"
OPERATOR_SNAPSHOT="openshift-pipelines-operator-1-20-xxxxx"  # Replace with actual

cd "${WORK_DIR}/config/release/${RELEASE_VERSION}/prod"

sed -i "s/SNAPSHOT_PLACEHOLDER/${OPERATOR_SNAPSHOT}/" "openshift-pipelines-operator-${RELEASE_VERSION}-release.yaml"

cat "openshift-pipelines-operator-${RELEASE_VERSION}-release.yaml"

echo ""
oc apply -f "openshift-pipelines-operator-${RELEASE_VERSION}-release.yaml"
```

**Wait for operator release success.**
</step>

<step name="release_index">
**Step 5: INDEX Release (Production)**

**Run index-render-template workflow:**
```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

echo "=== Running index-render-template (production) ==="

gh workflow run index-render-template.yaml \
  --repo openshift-pipelines/operator \
  --ref "${BRANCH}" \
  -f environment="production"

sleep 5

RUN_ID=$(gh run list --repo openshift-pipelines/operator \
  --workflow index-render-template.yaml \
  --limit 1 --json databaseId --jq '.[0].databaseId')

echo "Run ID: ${RUN_ID}"
```

**Merge index PRs:**
```bash
for PR in $(gh pr list --repo openshift-pipelines/operator \
  --base "${BRANCH}" --state open \
  --json number,title | jq -r '.[] | select(.title | test("index|catalog")) | .number'); do
  echo "Merging PR #${PR}..."
  gh pr merge ${PR} --repo openshift-pipelines/operator --squash
done
```

**Get index snapshots and apply releases:**

Use AskUserQuestion:
- header: "Index Snapshots"
- question: "Enter index snapshots for production (format: 4.14=snapshot1,4.15=snapshot2,...)"

```bash
RELEASE_VERSION="1.20.0"
cd "${WORK_DIR}/config/release/${RELEASE_VERSION}/prod"

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

<step name="verify_prod_images">
Verify images are available in production registry:

```bash
echo "=== Verifying Production Images ==="
REGISTRY="registry.redhat.io/openshift-pipelines"

# Check operator bundle
echo "Operator bundle:"
skopeo inspect --no-tags "docker://${REGISTRY}/pipelines-operator-bundle-rhel9" 2>/dev/null | \
  jq '{digest: .Digest, created: .Created}' || echo "Requires registry auth"

# Check index images
for ocp in 4.14 4.15 4.16 4.17 4.18 4.19 4.20; do
  echo ""
  echo "Index v${ocp}:"
  skopeo inspect --no-tags "docker://${REGISTRY}/pipelines-index-rhel9:v${ocp}" 2>/dev/null | \
    jq '{digest: .Digest}' || echo "Requires registry auth"
done

echo ""
echo "Alternative verification via Red Hat Container Catalog:"
echo "https://catalog.redhat.com/software/containers/search?q=openshift-pipelines"
```
</step>

<step name="prod_announce">
**Production Release Announcement**

Once all releases are successful:

```markdown
# OpenShift Pipelines ${RELEASE_VERSION} Production Release

**Release Date:** $(date +%Y-%m-%d)
**Release Type:** RHEA (Red Hat Enhancement Advisory)
**Advisory:** [Insert advisory link]

## Release Summary

OpenShift Pipelines ${RELEASE_VERSION} has been released to production.

## Component Versions

| Component | Status |
|-----------|--------|
| Core | ✅ Released |
| CLI | ✅ Released |
| Operator | ✅ Released |
| Index (4.14-4.20) | ✅ Released |

## Images

All images are available in:
- `registry.redhat.io/openshift-pipelines/`

## OCP Compatibility

- OCP 4.14
- OCP 4.15
- OCP 4.16
- OCP 4.17
- OCP 4.18
- OCP 4.19
- OCP 4.20

## Installation

Install via OperatorHub on OCP console or:
\`\`\`bash
oc apply -f https://operatorhub.io/install/openshift-pipelines-operator-rh.yaml
\`\`\`

## Documentation

- Release Notes: [link]
- Documentation: [link]

## Next Steps

1. Update documentation
2. Announce on mailing lists
3. Update website
4. Close Jira version
```

**Post to team channel:**
Sample format: https://redhat-internal.slack.com/archives/CG5GV6CJD/p1752646759861289
</step>

<step name="post_release_tasks">
**Post-Release Tasks**

```bash
echo "=== Post-Release Tasks ==="
echo ""
echo "1. Documentation Updates:"
echo "   - Update release notes"
echo "   - Update product documentation"
echo "   - Update compatibility matrix"
echo ""
echo "2. Jira Cleanup:"
echo "   - Close Jira version ${RELEASE_VERSION}"
echo "   - Move incomplete issues to next version"
echo "   Run: /osp:release-status ${RELEASE_VERSION}"
echo ""
echo "3. Announcements:"
echo "   - Internal team channel"
echo "   - Red Hat mailing lists"
echo "   - External announcements (if applicable)"
echo ""
echo "4. Metrics:"
echo "   - Update release metrics document"
echo "   - Record release timeline"
```
</step>

<step name="generate_todos">
Generate todo items for prod release:

```
TodoWrite with items:

## Production Release ${RELEASE_VERSION}

### Prerequisites
- [ ] Stage release validated
- [ ] QE sign-off received
- [ ] prodsec contacted and version Live

### Core Release
- [ ] Get core snapshot
- [ ] Update release YAML with snapshot
- [ ] Apply core release
- [ ] Wait for core release pipeline success

### CLI Release
- [ ] Update PAC CLI dependency to prod URL in tektoncd-cli
- [ ] Wait for new CLI build
- [ ] Update CLI SHA in operator project.yaml
- [ ] Get CLI snapshot
- [ ] Apply CLI release
- [ ] Wait for CLI release pipeline success

### Operator Release
- [ ] Run operator-update-images (production)
- [ ] Merge operator update PR
- [ ] Wait for bundle build
- [ ] Update bundle SHA in project.yaml
- [ ] Get operator snapshot
- [ ] Apply operator release
- [ ] Wait for operator release pipeline success

### Index Release
- [ ] Run index-render-template (production)
- [ ] Merge index PRs
- [ ] Wait for index builds
- [ ] Get index snapshots for each OCP version
- [ ] Apply index releases
- [ ] Wait for all index releases success

### Verification
- [ ] Verify images in registry.redhat.io
- [ ] Verify in Red Hat Container Catalog

### Announcements
- [ ] Post release announcement to team
- [ ] Update documentation
- [ ] Close Jira version

### Complete
- [ ] Release ${RELEASE_VERSION} complete!
```
</step>
</process>

<output>
Complete production release execution:
1. Core components released to production
2. CLI released with production PAC dependency
3. Operator released with production CSV
4. Index images released for all OCP versions
5. All images verified in production registry
6. Release announced to stakeholders
7. Post-release tasks initiated
</output>

<success_criteria>
- [ ] Prerequisites verified (stage validated, QE sign-off, prodsec Live)
- [ ] Core release pipeline completed successfully
- [ ] CLI PAC dependency updated to production URL
- [ ] CLI release pipeline completed successfully
- [ ] Operator update-images workflow completed (production)
- [ ] Operator release pipeline completed successfully
- [ ] Index render-template workflow completed (production)
- [ ] Index releases completed for all OCP versions
- [ ] All images verified in registry.redhat.io
- [ ] Production release announced
- [ ] Post-release tasks initiated
- [ ] Jira version closed
</success_criteria>
