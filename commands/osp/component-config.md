---
name: component-config
description: Configure a single component for a minor release
allowed-tools:
  - Bash
  - Read
  - Write
  - WebFetch
  - AskUserQuestion
  - TodoWrite
---

# Component Configuration

<objective>
Configure a single OpenShift Pipelines component for a minor release. This includes merging hack-generated PRs, updating Dockerfiles, running update-sources workflow, and ensuring CI passes.

Use this skill after `/osp:hack-config` has been completed and merged.
</objective>

<execution_context>
**Prerequisites:**
- Hack configuration completed and merged (generated PRs exist)
- GitHub CLI (`gh`) authenticated
- Access to openshift-pipelines GitHub org

**Component Types:**

| Type | Components | Has Upstream | Needs update-sources |
|------|------------|--------------|----------------------|
| Forked | pipeline, triggers, chains, results, hub, pac, cli, git-init, operator | Yes | Yes |
| Downstream | opc, manual-approval-gate, console-plugin, caches, pruner | No | No |

**Important Dependencies:**
- **PAC → CLI:** Configure PAC first, CLI depends on PAC image
- **All Components → Operator:** Operator is configured LAST

**Reference:** See `docs/references/minor-release-guide.md` for full documentation.
</execution_context>

<process>
<step name="get_input">
Get component and version from user if not provided.

Use AskUserQuestion:
- header: "Component"
- question: "Which component do you want to configure?"
- options: ["pipeline", "triggers", "chains", "results", "hub", "pac", "cli", "git-init", "opc", "manual-approval-gate", "console-plugin", "caches"]

Then:
- header: "Version"
- question: "Which minor release version? (e.g., 1.20)"
</step>

<step name="resolve_component">
Map component to repository and configuration:

```bash
COMPONENT="cli"
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

# Component to repo mapping
case "$COMPONENT" in
  pipeline) REPO="tektoncd-pipeline"; TYPE="forked"; UPSTREAM="tektoncd/pipeline" ;;
  triggers) REPO="tektoncd-triggers"; TYPE="forked"; UPSTREAM="tektoncd/triggers" ;;
  chains) REPO="tektoncd-chains"; TYPE="forked"; UPSTREAM="tektoncd/chains" ;;
  results) REPO="tektoncd-results"; TYPE="forked"; UPSTREAM="tektoncd/results" ;;
  hub) REPO="tektoncd-hub"; TYPE="forked"; UPSTREAM="tektoncd/hub" ;;
  pac) REPO="pac-downstream"; TYPE="forked"; UPSTREAM="pipelines-as-code/pipelines-as-code" ;;
  cli) REPO="tektoncd-cli"; TYPE="forked"; UPSTREAM="tektoncd/cli" ;;
  git-init) REPO="tektoncd-git-clone"; TYPE="forked"; UPSTREAM="tektoncd/catalog" ;;
  opc) REPO="opc"; TYPE="downstream"; UPSTREAM="" ;;
  manual-approval-gate) REPO="manual-approval-gate"; TYPE="downstream"; UPSTREAM="" ;;
  console-plugin) REPO="console-plugin"; TYPE="downstream"; UPSTREAM="" ;;
  caches) REPO="tekton-caches"; TYPE="downstream"; UPSTREAM="" ;;
  pruner) REPO="tektoncd-pruner"; TYPE="downstream"; UPSTREAM="" ;;
  *) echo "Unknown component: $COMPONENT"; exit 1 ;;
esac

FULL_REPO="openshift-pipelines/${REPO}"
echo "Repository: ${FULL_REPO}"
echo "Type: ${TYPE}"
echo "Branch: ${BRANCH}"
```
</step>

<step name="check_branch">
Verify the release branch exists:

```bash
# Check if branch exists
BRANCH_EXISTS=$(gh api "repos/${FULL_REPO}/branches/${BRANCH}" --jq '.name' 2>/dev/null || echo "NOT_FOUND")

if [ "$BRANCH_EXISTS" = "NOT_FOUND" ]; then
  echo "ERROR: Branch ${BRANCH} does not exist on ${FULL_REPO}"
  echo ""
  echo "Available release branches:"
  gh api "repos/${FULL_REPO}/branches" --jq '.[].name | select(startswith("release-"))' | head -10
  exit 1
fi

echo "Branch ${BRANCH} exists"
```
</step>

<step name="check_hack_prs">
Check for hack-generated PRs that need to be merged:

```bash
echo "=== Open PRs from hack workflows ==="
gh pr list --repo "${FULL_REPO}" --base "${BRANCH}" --state open \
  --json number,title,author,createdAt | jq '
  .[] | select(.title | test("hack|konflux|tekton|bot"; "i")) |
  {number, title, author: .author.login, created: .createdAt}
'

echo ""
echo "=== Recently merged PRs ==="
gh pr list --repo "${FULL_REPO}" --base "${BRANCH}" --state merged --limit 5 \
  --json number,title,mergedAt | jq '.[] | {number, title, merged: .mergedAt}'
```

**Expected PRs from hack:**
1. `.tekton/` configuration PR - Tekton pipeline definitions
2. `.github/workflows/` PR - GitHub Actions workflows

Merge these PRs before proceeding.
</step>

<step name="merge_hack_prs">
Merge the hack-generated PRs:

```bash
# List PRs to merge
HACK_PRS=$(gh pr list --repo "${FULL_REPO}" --base "${BRANCH}" --state open \
  --json number,title | jq -r '.[] | select(.title | test("hack|konflux|bot"; "i")) | .number')

if [ -z "$HACK_PRS" ]; then
  echo "No hack-generated PRs to merge"
else
  echo "Merging hack-generated PRs..."
  for pr in $HACK_PRS; do
    echo "Merging PR #${pr}..."
    gh pr merge "${pr}" --repo "${FULL_REPO}" --squash --admin
  done
fi
```

Use AskUserQuestion if there are PRs:
- header: "Merge PRs"
- question: "Found hack-generated PRs. Merge them now?"
- options: ["Merge all", "Review first", "Skip"]
</step>

<step name="clone_repo">
Clone the component repository:

```bash
WORK_DIR="/tmp/${REPO}-${MINOR_VERSION}"
rm -rf "${WORK_DIR}"
git clone "https://github.com/${FULL_REPO}" -b "${BRANCH}" "${WORK_DIR}"
cd "${WORK_DIR}"

echo "Cloned to ${WORK_DIR}"
```
</step>

<step name="verify_tekton_configs">
Verify .tekton directory configurations:

```bash
cd "${WORK_DIR}"

echo "=== .tekton directory contents ==="
ls -la .tekton/ 2>/dev/null || echo "No .tekton directory"

echo ""
echo "=== Checking branch references in .tekton ==="
grep -r "${BRANCH}" .tekton/ 2>/dev/null | head -10 || echo "No branch refs found"

echo ""
echo "=== Checking Dockerfile paths in .tekton ==="
grep -r "dockerfile" .tekton/ 2>/dev/null | head -10
```

**Verify:**
- Branch names are correct
- Dockerfile paths exist and are correct
</step>

<step name="update_dockerfiles">
Update Dockerfiles with correct base images and versions.

**Dockerfile locations:**
- `.konflux/dockerfiles/` - Main component Dockerfiles

```bash
cd "${WORK_DIR}"

echo "=== Dockerfile locations ==="
find . -name "*.Dockerfile" -o -name "Dockerfile*" 2>/dev/null | grep -v ".git" | head -20

echo ""
echo "=== Current base images ==="
grep -r "^FROM\|^ARG.*registry" .konflux/dockerfiles/ 2>/dev/null | head -20
```

**Updates needed:**

1. **Base Image SHA:** Update to latest released SHA from https://catalog.redhat.com/

```bash
# Example: Get latest UBI9 minimal SHA
echo "Check https://catalog.redhat.com/ for latest base image SHAs"
echo ""
echo "Common base images:"
echo "- registry.access.redhat.com/ubi9/ubi-minimal"
echo "- registry.access.redhat.com/ubi9/go-toolset"
```

2. **Version ARG:** Update VERSION to release version

```bash
# Check current VERSION values
grep -r "ARG VERSION" .konflux/dockerfiles/ 2>/dev/null
```

3. **RHEL Version:** For OSP 1.18+, use RHEL9 base images

```bash
# Check for RHEL8 vs RHEL9
grep -r "ubi8\|ubi9\|rhel8\|rhel9" .konflux/dockerfiles/ 2>/dev/null
```
</step>

<step name="special_cli_handling">
**For CLI component only:** Update PAC CLI dependency.

CLI uses PAC CLI image as a base for the `tkn-pac` binary:

```bash
if [ "$COMPONENT" = "cli" ]; then
  echo "=== CLI requires PAC dependency ==="
  echo ""
  echo "Check PAC CLI image SHA in Dockerfile:"
  grep -r "pac-cli\|PAC_BUILDER" .konflux/dockerfiles/ 2>/dev/null

  echo ""
  echo "IMPORTANT: PAC must be configured and built BEFORE CLI"
  echo "If PAC image is not available, CLI build will fail"

  # Check if PAC image exists
  echo ""
  echo "Checking PAC image availability..."
  skopeo inspect --no-tags \
    "docker://quay.io/redhat-user-workloads/tekton-ecosystem-tenant/${MINOR_VERSION//./-}/pac-cli-rhel9" 2>/dev/null | \
    jq '{digest: .Digest, created: .Created}' || echo "PAC image not found - configure PAC first!"
fi
```
</step>

<step name="update_rpms">
Check if RPM updates are needed (common for RHEL9 transitions):

```bash
cd "${WORK_DIR}"

echo "=== Current RPM installations in Dockerfiles ==="
grep -r "microdnf install\|dnf install\|yum install" .konflux/dockerfiles/ 2>/dev/null

echo ""
echo "If builds fail with RPM dependency errors like:"
echo "  'Could not depsolve transaction; package X requires Y'"
echo ""
echo "Update the RPM list or contact previous release captain"
```
</step>

<step name="add_patches">
Check if patches are needed:

```bash
cd "${WORK_DIR}"

echo "=== Current patches ==="
ls patches/ 2>/dev/null || echo "No patches directory"
find . -name "*.patch" 2>/dev/null

echo ""
echo "If patches are needed (from hack repo):"
echo "1. Check hack repo config/patches/${COMPONENT}/"
echo "2. Copy patches to this repo"
echo "3. Update Dockerfile to apply patches"
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
chore(release): configure for v${MINOR_VERSION}

- Update Dockerfile base images
- Update VERSION to ${MINOR_VERSION}
- Update for RHEL9 (if applicable)

Release: ${MINOR_VERSION}
EOF
)"

  # Push
  git push -u origin "release-config-${MINOR_VERSION}"

  # Create PR
  gh pr create \
    --base "${BRANCH}" \
    --head "release-config-${MINOR_VERSION}" \
    --title "chore(release): configure for v${MINOR_VERSION}" \
    --body "$(cat <<EOF
## Summary

Configure ${COMPONENT} for OpenShift Pipelines ${MINOR_VERSION} release.

## Changes

- Updated Dockerfile base images to latest SHAs
- Updated VERSION ARG
- RHEL9 compatibility updates (if applicable)

## Next Steps

1. Wait for CI to pass
2. Merge this PR
3. Run update-sources workflow (if forked component)

## Checklist

- [ ] Base images are latest released versions
- [ ] VERSION is set correctly
- [ ] CI passes
EOF
)"
else
  echo "No changes needed - Dockerfiles may already be updated"
fi
```
</step>

<step name="run_update_sources">
**For forked components only:** Run the update-sources workflow.

```bash
if [ "$TYPE" = "forked" ]; then
  echo "=== Running update-sources workflow ==="

  # Trigger the workflow
  gh workflow run "update-sources-${BRANCH}.yaml" \
    --repo "${FULL_REPO}" \
    --ref main

  echo ""
  echo "Workflow triggered. Monitor at:"
  echo "https://github.com/${FULL_REPO}/actions"

  # Wait a moment and get run ID
  sleep 5
  RUN_ID=$(gh run list --repo "${FULL_REPO}" \
    --workflow "update-sources-${BRANCH}.yaml" \
    --limit 1 --json databaseId --jq '.[0].databaseId')

  echo ""
  echo "Run ID: ${RUN_ID}"
  echo "Watch with: gh run watch ${RUN_ID} --repo ${FULL_REPO}"
else
  echo "Downstream component - no update-sources workflow needed"
fi
```
</step>

<step name="wait_for_ci">
Wait for CI to complete and merge:

```bash
echo "=== Waiting for CI ==="
echo ""
echo "1. Wait for any open PRs to pass CI"
echo "2. Merge PRs once CI is green"
echo "3. For forked components, wait for update-sources bot PR"
echo ""

# List open PRs
gh pr list --repo "${FULL_REPO}" --base "${BRANCH}" --state open \
  --json number,title,statusCheckRollup | jq '
  .[] | {
    number,
    title,
    checks: [.statusCheckRollup[]? | {name: .name, status: .status, conclusion: .conclusion}]
  }
'
```

**After update-sources completes (forked components):**
A bot PR will be created with upstream changes. Review and merge it.

```bash
# Find bot PR
gh pr list --repo "${FULL_REPO}" --base "${BRANCH}" --state open \
  --json number,title | jq '.[] | select(.title | startswith("[bot]"))'
```
</step>

<step name="verify_builds">
After merging, verify builds are triggered:

```bash
echo "=== Recent workflow runs ==="
gh run list --repo "${FULL_REPO}" --branch "${BRANCH}" --limit 5 \
  --json name,status,conclusion,createdAt

echo ""
echo "=== Check Konflux builds ==="
echo "Verify at: https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant"
echo ""
echo "Check for:"
echo "- Application: openshift-pipelines-${COMPONENT}-${MINOR_VERSION//./-}"
echo "- All component builds green"
echo "- Enterprise Contract passed"
```
</step>

<step name="generate_todos">
Generate todo items for this component:

```
TodoWrite with items:

## ${COMPONENT} Configuration for ${MINOR_VERSION}
- [x] Verify release branch exists
- [x] Merge hack-generated PRs (.tekton, .github)
- [x] Verify .tekton directory configurations
- [x] Update Dockerfiles (base images, VERSION)
- [x] Create configuration PR (if needed)
- [ ] Wait for CI to pass
- [ ] Merge configuration PR
- [ ] Run update-sources workflow (forked only)
- [ ] Wait for bot PR and merge
- [ ] Verify Konflux builds pass
- [ ] First image generated for ${COMPONENT}
```
</step>
</process>

<output>
A configured component ready for the release:
1. Hack-generated PRs merged
2. Dockerfiles updated with correct base images and versions
3. Configuration PR created and merged
4. update-sources workflow run (for forked components)
5. CI passing and builds triggered
</output>

<success_criteria>
- [ ] Release branch exists
- [ ] Hack-generated PRs merged
- [ ] Dockerfiles updated (base images, VERSION)
- [ ] .tekton configurations correct
- [ ] Configuration PR merged
- [ ] update-sources workflow completed (forked components)
- [ ] Bot PR merged (forked components)
- [ ] CI green on release branch
- [ ] Konflux builds triggered
- [ ] First image generated
</success_criteria>
