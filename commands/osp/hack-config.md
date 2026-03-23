---
name: hack-config
description: Configure hack repository for a new minor release version
allowed-tools:
  - Bash
  - Read
  - Write
  - WebFetch
  - AskUserQuestion
  - TodoWrite
---

# Hack Repository Configuration

<objective>
Configure the openshift-pipelines/hack repository for a new minor release. This includes updating Konflux configurations, repository branch mappings, and applying resources to the Konflux cluster.

This is typically the first configuration step after branch creation for a new minor release.
</objective>

<execution_context>
**Prerequisites:**
- Release branches created on all forked components and hack repository (`release-v{minor}.x`)
- Access to openshift-pipelines GitHub org
- `oc` CLI authenticated to Konflux RH02 cluster

**Hack Repository:** https://github.com/openshift-pipelines/hack

**Key Directories:**
- `config/konflux/` - Konflux application and component definitions
- `config/konflux/repos/` - Per-repository branch and upstream mappings
- `.konflux/<version>/` - Generated Konflux resources (after merge)

**Reference:** See `docs/references/minor-release-guide.md` for full documentation.
</execution_context>

<process>
<step name="get_input">
Get the release version from user if not provided.

Use AskUserQuestion:
- header: "Version"
- question: "Which minor release version are you configuring? (e.g., 1.20, 1.21)"

Derive values:
```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"
PREVIOUS_BRANCH="release-v$((${MINOR_VERSION%.*}.${MINOR_VERSION#*.}-1)).x"  # e.g., release-v1.19.x
```
</step>

<step name="verify_branch">
Verify the hack release branch exists:

```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

# Check if branch exists
gh api "repos/openshift-pipelines/hack/branches/${BRANCH}" --jq '.name' 2>/dev/null || echo "NOT_FOUND"
```

**If branch doesn't exist:**
```
The hack release branch ${BRANCH} doesn't exist.

Create it from 'next' branch:
git clone https://github.com/openshift-pipelines/hack
cd hack
git checkout next
git checkout -b ${BRANCH}
git push origin ${BRANCH}

Then re-run this skill.
```
Exit if branch doesn't exist.
</step>

<step name="clone_repo">
Clone the hack repository with the release branch:

```bash
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

# Clone to temp directory
WORK_DIR="/tmp/hack-${MINOR_VERSION}"
rm -rf "${WORK_DIR}"
git clone https://github.com/openshift-pipelines/hack -b "${BRANCH}" "${WORK_DIR}"
cd "${WORK_DIR}"

echo "Cloned hack repo to ${WORK_DIR}"
```
</step>

<step name="list_current_config">
List current Konflux configurations to understand what needs updating:

```bash
cd "${WORK_DIR}"

echo "=== Current config/konflux files ==="
ls -la config/konflux/*.yaml

echo ""
echo "=== Current config/konflux/repos files ==="
ls -la config/konflux/repos/*.yaml

echo ""
echo "=== Sample config content (checking for 'next' references) ==="
grep -r "next" config/konflux/ --include="*.yaml" | head -20 || echo "No 'next' references found"
```
</step>

<step name="identify_changes">
Identify what needs to be changed:

1. **config/konflux/*.yaml files:** Change `next` to release version
2. **config/konflux/repos/*.yaml files:** Update branch mappings
3. **Check for new OCP versions:** May need new index files (e.g., `openshift-pipelines-index-4.20.yaml`)

```bash
cd "${WORK_DIR}"

echo "=== Files referencing 'next' ==="
grep -l "next" config/konflux/*.yaml 2>/dev/null || echo "None found"
grep -l "next" config/konflux/repos/*.yaml 2>/dev/null || echo "None found"

echo ""
echo "=== Current OCP index versions ==="
ls config/konflux/openshift-pipelines-index-*.yaml 2>/dev/null | sed 's/.*index-//' | sed 's/.yaml//'

echo ""
echo "=== Current branch mappings in repos ==="
for f in config/konflux/repos/*.yaml; do
  echo "--- $(basename $f) ---"
  grep -E "name:|upstream:" "$f" | head -4
done
```
</step>

<step name="update_konflux_configs">
Update the main Konflux configuration files.

**For each file in config/konflux/*.yaml:**
- Change version references from `next` to the release version (e.g., `1.20`)
- Update any branch references from `next` to `release-v{minor}.x`

```bash
cd "${WORK_DIR}"
MINOR_VERSION="1.20"

# Update all YAML files in config/konflux/
for file in config/konflux/*.yaml; do
  if [ -f "$file" ]; then
    echo "Updating $(basename $file)..."
    # Replace 'next' with version number in appropriate contexts
    sed -i.bak "s/version: next/version: ${MINOR_VERSION}/g" "$file"
    sed -i.bak "s/-next/-${MINOR_VERSION}/g" "$file"
    rm -f "${file}.bak"
  fi
done

# Show changes
git diff config/konflux/*.yaml | head -50
```

**Note:** Review the changes carefully - some `next` references may be intentional.
</step>

<step name="update_repo_configs">
Update the repository configuration files in `config/konflux/repos/`.

**Two cases to handle:**

### Case 1: Forked Components (with upstream)
Update branch name and upstream tracking:

```yaml
branches:
  - name: release-v1.20.x      # downstream branch
    upstream: release-v2.0.x   # upstream branch to track
    versions:
      - "1.20"
```

### Case 2: Downstream-only Components (MAG, Console Plugin, etc.)
Update branch name with component-specific version:

```yaml
branches:
  - name: release-v0.7.0       # component-specific version
    versions:
      - "1.20"
```

```bash
cd "${WORK_DIR}"
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

echo "=== Repos needing update ==="
echo ""
echo "Forked components (need upstream mapping):"
echo "- tektoncd-pipeline.yaml"
echo "- tektoncd-triggers.yaml"
echo "- tektoncd-chains.yaml"
echo "- tektoncd-results.yaml"
echo "- tektoncd-hub.yaml"
echo "- pac-downstream.yaml"
echo "- tektoncd-cli.yaml"
echo "- tektoncd-git-clone.yaml"
echo "- operator.yaml"
echo ""
echo "Downstream-only (component-specific versions):"
echo "- manual-approval-gate.yaml (check current MAG version)"
echo "- console-plugin.yaml (use ${BRANCH})"
echo "- tekton-caches.yaml (check current Cache version)"
echo "- tektoncd-pruner.yaml (check current Pruner version)"
echo "- opc.yaml (use ${BRANCH})"
```

For each repo file, read and update appropriately. Example for a forked component:

```bash
# Example: Update tektoncd-pipeline.yaml
cat > config/konflux/repos/tektoncd-pipeline.yaml << 'EOF'
name: tektoncd-pipeline
upstream: tektoncd/pipeline
components:
  - pipeline-controller
  - pipeline-webhook
  - pipeline-resolvers
  - pipeline-workingdirinit
  - pipeline-entrypoint
  - pipeline-nop
  - pipeline-events
  - pipeline-sidecarlogresults
branches:
  - name: release-v1.20.x
    upstream: release-v0.68.x  # CHECK: Get correct upstream release
    versions:
      - "1.20"
EOF
```
</step>

<step name="check_upstream_versions">
Determine the correct upstream versions to track.

For each forked component, check what upstream release branch to track:

```bash
# Check upstream releases for Pipeline
gh release list --repo tektoncd/pipeline --limit 5

# Check upstream releases for Triggers
gh release list --repo tektoncd/triggers --limit 5

# Check upstream releases for Chains
gh release list --repo tektoncd/chains --limit 5

# Check upstream releases for CLI
gh release list --repo tektoncd/cli --limit 5

# Check upstream releases for Results
gh release list --repo tektoncd/results --limit 5

# Check upstream releases for Hub
gh release list --repo tektoncd/hub --limit 5

# Check upstream releases for Operator
gh release list --repo tektoncd/operator --limit 5
```

**Mapping guidance:**
- OSP 1.18+ typically maps to Tekton Pipeline 0.65+
- OSP 1.19+ typically maps to Tekton Pipeline 0.67+
- OSP 1.20+ typically maps to Tekton Pipeline 0.68+

Consult with team or previous release for exact mappings.
</step>

<step name="check_ocp_versions">
Check if new OCP versions need to be added:

```bash
cd "${WORK_DIR}"

echo "=== Current OCP index files ==="
ls config/konflux/openshift-pipelines-index-*.yaml

echo ""
echo "If OCP 4.20 is now GA and not listed, create:"
echo "config/konflux/openshift-pipelines-index-4.20.yaml"
echo ""
echo "Use existing index file as template."
```

If new OCP version needs to be added:
```bash
# Example: Create 4.20 index file from 4.19 template
cp config/konflux/openshift-pipelines-index-4.19.yaml config/konflux/openshift-pipelines-index-4.20.yaml
sed -i 's/4.19/4.20/g' config/konflux/openshift-pipelines-index-4.20.yaml
```
</step>

<step name="update_workflows">
Ensure supported OCP versions are correct in workflow files:

```bash
cd "${WORK_DIR}"

# Check current OCP versions in workflows
grep -r "4\.\(14\|15\|16\|17\|18\|19\|20\)" .github/workflows/ || echo "Check workflow files manually"

# Example PR for reference:
# https://github.com/openshift-pipelines/hack/commit/b0d3b088c707eacdafe6faddcb48e92984c00e3f
```
</step>

<step name="review_changes">
Review all changes before committing:

```bash
cd "${WORK_DIR}"

echo "=== All changes ==="
git status

echo ""
echo "=== Diff summary ==="
git diff --stat

echo ""
echo "=== Detailed changes ==="
git diff
```

Use AskUserQuestion:
- header: "Review"
- question: "Changes look correct? Ready to create PR?"
- options: ["Create PR", "Show more details", "Cancel"]
</step>

<step name="create_pr">
Create and push the changes:

```bash
cd "${WORK_DIR}"
MINOR_VERSION="1.20"
BRANCH="release-v${MINOR_VERSION}.x"

# Create feature branch
git checkout -b "config-${MINOR_VERSION}"

# Stage all changes
git add -A

# Commit
git commit -m "$(cat <<'EOF'
chore: configure hack for release v{MINOR_VERSION}

- Update config/konflux files for version {MINOR_VERSION}
- Update config/konflux/repos branch mappings
- Set upstream tracking for forked components

Release: {MINOR_VERSION}
EOF
)"

# Push
git push -u origin "config-${MINOR_VERSION}"

# Create PR
gh pr create \
  --base "${BRANCH}" \
  --head "config-${MINOR_VERSION}" \
  --title "chore: configure hack for release v${MINOR_VERSION}" \
  --body "$(cat <<'EOF'
## Summary

Configure hack repository for OpenShift Pipelines ${MINOR_VERSION} release.

## Changes

- Updated `config/konflux/*.yaml` files for version ${MINOR_VERSION}
- Updated `config/konflux/repos/*.yaml` with branch mappings
- Set upstream tracking branches for forked components

## Next Steps

After merge:
1. GitHub Actions will generate `.konflux` configurations
2. GitHub Actions will create PRs on all component repos with `.tekton` and `.github` workflows
3. Apply `.konflux/<version>/` resources to Konflux cluster

## Checklist

- [ ] All repo configs have correct branch names
- [ ] Upstream versions are correct
- [ ] OCP index files are up to date
EOF
)"
```
</step>

<step name="post_merge">
After the PR is merged, GitHub Actions will:
1. Generate `.konflux` configurations in the hack repo
2. Create PRs on all component repos with `.tekton` and `.github` workflow configurations

**Wait for workflows to complete, then:**

```bash
# Check for generated PRs on component repos
for repo in tektoncd-pipeline tektoncd-triggers tektoncd-chains tektoncd-cli operator; do
  echo "=== openshift-pipelines/${repo} ==="
  gh pr list --repo "openshift-pipelines/${repo}" --state open --json number,title | \
    jq '.[] | select(.title | test("hack|konflux|tekton"; "i"))'
done
```
</step>

<step name="apply_konflux">
After merge and workflow completion, apply Konflux resources to the cluster:

```bash
MINOR_VERSION="1.20"
WORK_DIR="/tmp/hack-${MINOR_VERSION}"

# Pull latest changes (including generated .konflux directory)
cd "${WORK_DIR}"
git pull origin "release-v${MINOR_VERSION}.x"

# Navigate to generated Konflux resources
cd ".konflux/${MINOR_VERSION}"
ls -la

# Login to Konflux RH02 cluster
# oc login ... (user must be authenticated)

# Switch to tenant
oc project tekton-ecosystem-tenant

# Apply resources (CONTACT RELEASE CAPTAIN FIRST)
echo "Ready to apply resources. Contact Release Captain before proceeding."
echo ""
echo "Commands to run:"
echo "  oc create -f ."
echo ""
echo "Or apply specific files:"
ls *.yaml
```

**IMPORTANT:** Contact Release Captain before applying resources to the cluster.
</step>

<step name="generate_todos">
Generate todo items for tracking:

```
TodoWrite with items:

## Hack Configuration for ${MINOR_VERSION}
- [x] Clone hack repo with release branch
- [x] Update config/konflux/*.yaml files
- [x] Update config/konflux/repos/*.yaml branch mappings
- [x] Verify upstream version mappings
- [x] Check OCP version files
- [x] Create and merge PR
- [ ] Wait for GitHub Actions to generate configs
- [ ] Verify PRs created on component repos
- [ ] Apply .konflux resources to cluster (after Release Captain approval)
```
</step>
</process>

<output>
A configured hack repository PR with:
1. Updated Konflux configuration files
2. Updated repository branch mappings
3. Correct upstream version tracking
4. OCP index files (if new versions needed)

After merge, GitHub Actions generates:
- `.konflux/<version>/` resources in hack repo
- PRs on all component repos with `.tekton` and `.github` configurations
</output>

<success_criteria>
- [ ] Hack release branch exists
- [ ] config/konflux files updated for new version
- [ ] config/konflux/repos branch mappings updated
- [ ] Upstream versions correctly mapped
- [ ] OCP versions are current
- [ ] PR created and merged
- [ ] GitHub Actions completed successfully
- [ ] Component repos have generated PRs
- [ ] Konflux resources ready to apply
</success_criteria>
