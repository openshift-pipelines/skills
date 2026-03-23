---
name: release-checklist
description: Generate and track component release checklist from Jira version
allowed-tools:
  - Bash
  - Read
  - Write
  - WebFetch
  - AskUserQuestion
  - TodoWrite
---

# Release Checklist Generator

<objective>
Generate a comprehensive release checklist by analyzing a Jira version. Maps Jira issues to downstream components, identifies what needs to be built/released, and tracks progress through the release process.

This skill is the starting point for any OpenShift Pipelines release (minor or patch).
</objective>

<execution_context>
**Jira Version URL Format:**
`https://issues.redhat.com/projects/SRVKP/versions/{versionId}`

**Component Mapping (Jira → Downstream Repo):**

| Jira Component | Downstream Repository | Type | Branch Pattern |
|----------------|----------------------|------|----------------|
| Pipeline | openshift-pipelines/tektoncd-pipeline | Forked | release-v{minor}.x |
| Triggers | openshift-pipelines/tektoncd-triggers | Forked | release-v{minor}.x |
| Chains | openshift-pipelines/tektoncd-chains | Forked | release-v{minor}.x |
| Results | openshift-pipelines/tektoncd-results | Forked | release-v{minor}.x |
| Tekton Hub | openshift-pipelines/tektoncd-hub | Forked | release-v{minor}.x |
| PAC | openshift-pipelines/pac-downstream | Forked | release-v{minor}.x |
| Tekton CLI | openshift-pipelines/tektoncd-cli | Forked | release-v{minor}.x |
| git-init | openshift-pipelines/tektoncd-git-clone | Forked | release-v{minor}.x |
| Operator | openshift-pipelines/operator | Forked | release-v{minor}.x |
| UI | openshift-pipelines/console-plugin | Downstream | release-v{minor}.x |
| Manual Approval Gate | openshift-pipelines/manual-approval-gate | Downstream | release-v{mag-version} |
| OPC | openshift-pipelines/opc | Downstream | release-v{minor}.x |
| Cache | openshift-pipelines/tekton-caches | Downstream | release-v{cache-version} |
| Pruner | openshift-pipelines/tektoncd-pruner | Downstream | release-v{pruner-version} |

**Note:** Some downstream components have their own versioning (MAG, Cache, Pruner). Check hack repo config for exact branch names.

**Release Types:**
- Minor release (e.g., 1.20.0): RHEA advisory, new branches, full component rebuild
- Patch release (e.g., 1.15.4): RHBA advisory, existing branches, targeted fixes

**Authentication:**
- Jira: Bearer token via `JIRA_TOKEN` env var or `~/.config/osp/config.json`
</execution_context>

<process>
<step name="check_configuration">
**MANDATORY FIRST STEP**: Verify Jira authentication.

```bash
# Check for token
TOKEN=$(jq -r '.jira.token' ~/.config/osp/config.json 2>/dev/null || echo "$JIRA_TOKEN")
if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "NO_TOKEN"
else
  echo "TOKEN_FOUND"
fi
```

**If NO_TOKEN**, direct user to `/osp:configure` first.
</step>

<step name="get_version_input">
Get the Jira version from the user if not provided.

Accept formats:
- Full URL: `https://issues.redhat.com/projects/SRVKP/versions/12453355`
- Version ID: `12453355`

Parse version ID from URL:
```bash
echo "https://issues.redhat.com/projects/SRVKP/versions/12453355" | grep -oE '[0-9]+$'
```
</step>

<step name="fetch_version_and_issues">
Fetch version metadata and all issues:

```bash
TOKEN=$(jq -r '.jira.token' ~/.config/osp/config.json 2>/dev/null || echo "$JIRA_TOKEN")
VERSION_ID="12453355"

# Get version info
VERSION_INFO=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://issues.redhat.com/rest/api/2/version/${VERSION_ID}")

VERSION_NAME=$(echo "$VERSION_INFO" | jq -r '.name')
RELEASED=$(echo "$VERSION_INFO" | jq -r '.released')

# Determine release type from version name
if echo "$VERSION_NAME" | grep -qE '\.[0-9]+\.[0-9]+$'; then
  # Has two dots after major (e.g., 1.15.4) = patch
  RELEASE_TYPE="patch"
  ADVISORY_TYPE="RHBA"
else
  RELEASE_TYPE="minor"
  ADVISORY_TYPE="RHEA"
fi

# Get all issues with pagination
ALL_ISSUES="[]"
START_AT=0
MAX_RESULTS=100
TOTAL=1

while [ $START_AT -lt $TOTAL ]; do
  RESPONSE=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
    "https://issues.redhat.com/rest/api/2/search?jql=fixVersion=${VERSION_ID}&maxResults=${MAX_RESULTS}&startAt=${START_AT}&fields=key,summary,status,issuetype,priority,components")

  TOTAL=$(echo "$RESPONSE" | jq '.total')
  FETCHED=$(echo "$RESPONSE" | jq '.issues | length')
  ALL_ISSUES=$(echo "$ALL_ISSUES" "$RESPONSE" | jq -s '.[0] + (.[1].issues // [])')

  START_AT=$((START_AT + FETCHED))
done

echo "$ALL_ISSUES" > /tmp/release-issues.json
echo "Fetched $(echo "$ALL_ISSUES" | jq 'length') issues for $VERSION_NAME"
```
</step>

<step name="fetch_hack_config">
Fetch component branch configuration from hack repo for accurate branch names:

```bash
# Clone hack repo for the release version to get branch configs
MINOR_VERSION="1.15"  # Extract from Jira version name
HACK_BRANCH="release-v${MINOR_VERSION}.x"

# Clone if not already present
if [ ! -d "/tmp/hack-${MINOR_VERSION}" ]; then
  git clone https://github.com/openshift-pipelines/hack -b "${HACK_BRANCH}" --depth=1 "/tmp/hack-${MINOR_VERSION}" 2>/dev/null
fi

# Read component configs to get actual branch names
for config in /tmp/hack-${MINOR_VERSION}/config/konflux/repos/*.yaml; do
  REPO_NAME=$(yq -r '.name' "$config")
  BRANCH_NAME=$(yq -r '.branches[0].name' "$config")
  echo "$REPO_NAME: $BRANCH_NAME"
done
```

This ensures we use the correct branch names even for components with custom versioning (MAG, Caches, Pruner).
</step>

<step name="analyze_issues">
Analyze issues to determine affected components and work status:

```bash
# Group by Jira component and status
cat /tmp/release-issues.json | jq '
  group_by(.fields.components[0].name // "Unassigned") |
  map({
    component: .[0].fields.components[0].name // "Unassigned",
    total: length,
    closed: [.[] | select(.fields.status.name | test("Closed|Verified|Release Pending"; "i"))] | length,
    in_progress: [.[] | select(.fields.status.name | test("In Progress|Code Review"; "i"))] | length,
    open: [.[] | select(.fields.status.name | test("To Do|New|Open"; "i"))] | length,
    types: (group_by(.fields.issuetype.name) | map({type: .[0].fields.issuetype.name, count: length})),
    open_issues: [.[] | select(.fields.status.name | test("To Do|New|Open|In Progress"; "i")) | {key: .key, summary: .fields.summary, status: .fields.status.name}]
  })
' > /tmp/component-analysis.json
```

Map Jira components to downstream repos and determine what needs work:

```bash
# Component mapping - Jira component name to downstream repo
declare -A JIRA_TO_REPO=(
  ["Pipeline"]="tektoncd-pipeline"
  ["Triggers"]="tektoncd-triggers"
  ["Chains"]="tektoncd-chains"
  ["Results"]="tektoncd-results"
  ["Tekton Hub"]="tektoncd-hub"
  ["PAC"]="pac-downstream"
  ["Tekton CLI"]="tektoncd-cli"
  ["git-init"]="tektoncd-git-clone"
  ["Operator"]="operator"
  ["UI"]="console-plugin"
  ["Manual Approval Gate"]="manual-approval-gate"
  ["OPC"]="opc"
  ["Cache"]="tekton-caches"
  ["Pruner"]="tektoncd-pruner"
)

# Repos that have upstream and need update-sources workflow
declare -A FORKED_REPOS=(
  ["tektoncd-pipeline"]=1
  ["tektoncd-triggers"]=1
  ["tektoncd-chains"]=1
  ["tektoncd-results"]=1
  ["tektoncd-hub"]=1
  ["pac-downstream"]=1
  ["tektoncd-cli"]=1
  ["tektoncd-git-clone"]=1
  ["operator"]=1
)

# Standard branch pattern: release-v{minor}.x
# Exception repos with custom version branches (check hack config)
declare -A CUSTOM_BRANCH_REPOS=(
  ["manual-approval-gate"]=1
  ["tekton-caches"]=1
  ["tektoncd-pruner"]=1
)
```
</step>

<step name="generate_checklist">
Generate a release checklist based on component analysis.

**For each affected component, the checklist includes:**

1. **Forked Components (with upstream)**:
   - [ ] Branch exists (`release-v{minor}.x`)
   - [ ] Hack-generated PRs merged (.tekton, .github)
   - [ ] Dockerfile updated (base images, versions)
   - [ ] Patches applied (if needed)
   - [ ] `update-sources-*` workflow run
   - [ ] CI green and merged
   - [ ] Image built in Konflux

2. **Pure Downstream Components**:
   - [ ] Branch exists (version-specific, e.g., `release-v0.6.0`)
   - [ ] Dockerfile updated
   - [ ] CI green and merged
   - [ ] Image built in Konflux

3. **Operator (special handling)**:
   - All above steps PLUS:
   - [ ] Component SHAs updated in `project.yaml`
   - [ ] Version fields configured
   - [ ] `operator-update-images` workflow run (devel)
   - [ ] Bundle image built
   - [ ] `index-render-template` workflow run (devel)
   - [ ] Index images built

4. **Release Execution**:
   - [ ] CORE release (stage)
   - [ ] CLI release (stage)
   - [ ] OPERATOR release (stage)
   - [ ] INDEX releases (stage, per OCP version)
   - [ ] CORE release (prod)
   - [ ] CLI release (prod)
   - [ ] OPERATOR release (prod)
   - [ ] INDEX releases (prod)
</step>

<step name="display_checklist">
Present the checklist in a clear format:

```markdown
# Release Checklist: {VERSION_NAME}

**Type:** {RELEASE_TYPE} ({ADVISORY_TYPE})
**Jira Version:** https://issues.redhat.com/projects/SRVKP/versions/{VERSION_ID}
**Total Issues:** {TOTAL} | Closed: {CLOSED} | In Progress: {IN_PROGRESS} | Open: {OPEN}

## Blocking Issues (Must Fix Before Release)

| Key | Summary | Component | Status |
|-----|---------|-----------|--------|
| SRVKP-XXXX | CVE-... | CLI | To Do |

## Component Checklist

### 1. tektoncd-pipeline
**Issues:** {N} ({closed} closed, {open} open)
**Repo:** https://github.com/openshift-pipelines/tektoncd-pipeline
**Branch:** release-v{minor}.x

- [ ] Dockerfile updated
- [ ] update-sources-release-v{minor}.x run
- [ ] CI green
- [ ] Image built

### 2. tektoncd-cli
**Issues:** {N} ({closed} closed, {open} open)
...

### N. operator (DO LAST)
**Issues:** {N}
**Depends on:** All component images

- [ ] All component SHAs in project.yaml
- [ ] operator-update-images (devel)
- [ ] Bundle image built
- [ ] index-render-template (devel)
- [ ] Index images built

## Release Execution

### Stage
- [ ] CORE release
- [ ] CLI release
- [ ] OPERATOR release
- [ ] INDEX releases (4.14, 4.15, 4.16, 4.17, 4.18, 4.19)

### Production
- [ ] CORE release
- [ ] CLI release
- [ ] OPERATOR release
- [ ] INDEX releases
```
</step>

<step name="analyze_cves">
**CVE Analysis with Upstream-First Cherry-Pick Detection**

**Important:** For forked components, fixes MUST come from upstream first:
- Upstream: tektoncd/{component} (e.g., tektoncd/cli)
- Downstream: openshift-pipelines/tektoncd-{component}
- Flow: Upstream fix → update-sources workflow → downstream

For each open Vulnerability issue in the release:

1. **Extract CVE details from Jira summary:**
```bash
# Parse CVE ID and affected package from summary
# Example: "CVE-2025-30204 openshift-pipelines-client: jwt-go allows excessive memory..."
CVE_ID=$(echo "$SUMMARY" | grep -oE 'CVE-[0-9]+-[0-9]+')
PACKAGE=$(echo "$SUMMARY" | grep -oE '(jwt|oauth2|crypto|x/[a-z]+)')
```

2. **Check current dependency versions in downstream release branch:**
```bash
# Clone the downstream component repo
REPO="openshift-pipelines/tektoncd-cli"
BRANCH="release-v1.15.x"

git clone "https://github.com/${REPO}" -b "${BRANCH}" --depth=1 /tmp/cve-check 2>/dev/null

# Extract dependency versions from go.mod
grep -E "(jwt|oauth2|crypto)" /tmp/cve-check/upstream/go.mod
```

3. **Look up CVE fix versions via web search:**
```
Search: "CVE-XXXX-XXXXX {package} fix version"
Extract: The version that fixes the vulnerability
```

4. **Compare and determine status:**
```bash
# If current_version >= fix_version: FIXED
# If current_version < fix_version: NEEDS_FIX
```

5. **For unfixed CVEs, check UPSTREAM for fix:**
```bash
# Check upstream repo (e.g., tektoncd/cli) main branch
UPSTREAM_REPO="tektoncd/cli"
git clone "https://github.com/${UPSTREAM_REPO}" --depth=1 /tmp/upstream-check 2>/dev/null

# Check if upstream main has the fix
grep "${PACKAGE}" /tmp/upstream-check/go.mod

# Search for PRs that updated the dependency upstream
gh search prs "${PACKAGE}" --repo "${UPSTREAM_REPO}" --state closed --merged --json number,title,mergedAt --limit 5

# Check upstream release tags
gh release list --repo "${UPSTREAM_REPO}" --limit 5
```

6. **Generate CVE status report:**
```markdown
## CVE Analysis

| CVE | Jira | Package | Fix Version | Downstream | Upstream Main | Status | Action |
|-----|------|---------|-------------|------------|---------------|--------|--------|
| CVE-2025-30204 | SRVKP-7344 | jwt-go | v4.5.2 | v4.5.2 | v4.5.1 | FIXED | Close Jira |
| CVE-2025-22869 | SRVKP-7198 | x/crypto | v0.35.0 | v0.35.0 | v0.33.0 | FIXED | Close Jira |
| CVE-2025-22868 | SRVKP-7201 | oauth2 | v0.27.0 | v0.19.0 | v0.32.0 | **NEEDS FIX** | Upstream cherry-pick |

### Upstream Cherry-Pick Flow (for forked components)

For CVEs marked NEEDS FIX:

**Step 1: Check upstream status**
- Is fix in upstream `main`? → Yes (e.g., oauth2 v0.32.0)
- Is fix in upstream release branch? → Check `release-vX.Y` branches

**Step 2: Cherry-pick to upstream release branch (if needed)**
```bash
# In upstream repo (tektoncd/cli)
# Cherry-pick the dependency update commit to release branch
# Or create PR to update dependency in release branch
```

**Step 3: Run update-sources downstream**
```bash
# After upstream release branch has fix
gh workflow run update-sources-release-v1.15.x.yaml \
  --repo openshift-pipelines/tektoncd-cli --ref main
```

### Recommended Actions

1. **Close fixed CVE Jiras** (dependency already updated downstream):
   - SRVKP-7344: Fixed (jwt-go v4.5.2 >= fix version)
   - SRVKP-7198: Fixed (x/crypto v0.35.0 >= fix version)

2. **Fix remaining CVEs via upstream-first flow:**
   - SRVKP-7201: oauth2 needs v0.27.0+, downstream has v0.19.0
     - Step A: Check if upstream has release with fix
     - Step B: If not, cherry-pick to upstream release branch
     - Step C: Run `update-sources` workflow downstream
     - Alternative: For urgent fixes, direct PR to downstream (rare)
```
</step>

<step name="identify_blockers">
Highlight any blocking issues that must be resolved before release:

1. **Open vulnerabilities (CVEs)** - Analyzed in previous step
2. **Unassigned issues** - Need owners
3. **Missing PRs** - Check if fixes have PRs created

For non-CVE open issues, search for related PRs:
```bash
gh search prs "SRVKP-XXXX" --owner openshift-pipelines --state all --limit 5 --json repository,number,title,state
```
</step>

<step name="generate_action_items">
**Generate actionable items using TodoWrite**

Based on the analysis, create a prioritized action list:

```
TodoWrite with items:

## Priority 1: Blocking CVEs (Must fix before release - UPSTREAM FIRST)
- [ ] SRVKP-7201: Check upstream tektoncd/cli for oauth2 v0.27.0+ release
- [ ] SRVKP-7201: If not available, cherry-pick or create PR in upstream release branch
- [ ] SRVKP-7201: After upstream fix, run update-sources workflow downstream

## Priority 2: Jira Hygiene (Can be done in parallel)
- [ ] Close SRVKP-7344: jwt-go CVE already fixed (v4.5.2 >= fix version)
- [ ] Close SRVKP-7198: x/crypto CVE already fixed (v0.35.0 >= fix version)

## Priority 3: Component Updates (Per component, after CVE fixes)
- [ ] CLI: Merge any pending PRs (base image updates, etc.)
- [ ] CLI: Run update-sources workflow to pull upstream changes
- [ ] CLI: Verify image builds in Konflux
- [ ] Hub: Verify image builds in Konflux
- [ ] Console-plugin: Verify image builds

## Priority 4: Operator (Do AFTER all component images are built)
- [ ] Update project.yaml with new component SHAs
- [ ] Run operator-update-images (devel)
- [ ] Run index-render-template (devel)
- [ ] Verify bundle and index images in Konflux

## Priority 5: Release Execution
- [ ] Stage: CORE release
- [ ] Stage: CLI release
- [ ] Stage: OPERATOR release
- [ ] Stage: INDEX releases (4.14-4.18)
- [ ] Prod: CORE release
- [ ] Prod: CLI release
- [ ] Prod: OPERATOR release
- [ ] Prod: INDEX releases
```

**Key Recommendations:**

1. **For fixed CVEs:** Close Jira tickets (dependency already at/above fix version)
2. **For unfixed CVEs (forked components):**
   - Check upstream `main` for fix
   - Cherry-pick to upstream release branch if not already there
   - Run `update-sources` workflow downstream after upstream has fix
3. **For unfixed CVEs (pure downstream):** Create direct PR to update dependency
4. **For Operator:** Wait until ALL component images are built before starting
</step>

<step name="validate_base_images">
**Validate Base Images in Dockerfiles (CRITICAL)**

Before merging PRs or triggering builds, verify that all base images referenced in Dockerfiles exist in their target registries. A common failure is referencing image SHAs that exist in Konflux (quay.io) but haven't been released to registry.redhat.io.

```bash
COMPONENT_REPO="openshift-pipelines/tektoncd-cli"
BRANCH="release-v1.15.x"

# Get Dockerfile content
DOCKERFILE=$(gh api "repos/${COMPONENT_REPO}/contents/.konflux/dockerfiles/tkn.Dockerfile?ref=${BRANCH}" --jq '.content' | base64 -d)

# Extract base image references with SHAs
echo "$DOCKERFILE" | grep -E "^ARG.*registry.*@sha256:" | while read line; do
  IMAGE=$(echo "$line" | sed -E 's/ARG [A-Z_]+=(.*)$/\1/')
  echo "Checking: $IMAGE"

  # Try to inspect the image
  if skopeo inspect "docker://${IMAGE}" --no-tags >/dev/null 2>&1; then
    echo "  ✅ Image exists"
  else
    echo "  ❌ Image NOT FOUND - needs to be updated!"
    echo "  Image: $IMAGE"
  fi
done
```

**Common base image issues:**

1. **PAC CLI image not released:**
   - CLI Dockerfile uses PAC CLI as base for `tkn-pac` binary
   - If PAC hasn't been released to registry.redhat.io, CLI build fails
   - Fix: Update PAC_BUILDER SHA to a released version, or release PAC first

2. **UBI base image outdated:**
   - UBI images get updated regularly
   - Old SHAs may be removed from registry
   - Fix: Update to latest UBI SHA from catalog.redhat.com

**To find valid base image SHAs:**
```bash
# Check Red Hat catalog for available images
# https://catalog.redhat.com/software/containers/search

# For UBI images:
skopeo inspect docker://registry.redhat.io/ubi8/ubi:latest | jq '.Digest'

# For component images, check previous working release:
gh api "repos/${COMPONENT_REPO}/contents/.konflux/dockerfiles/tkn.Dockerfile?ref=release-v1.15.x~1" \
  --jq '.content' | base64 -d | grep "ARG.*@sha256"
```

**If base image validation fails:**
1. Identify which image SHA is missing
2. Check if it's a component that needs to be released first (like PAC → CLI dependency)
3. Either revert to previous working SHA or wait for the dependency to be released
</step>

<step name="create_fix_prs">
**Create PRs to Fix CVEs (when upstream has fix available)**

For forked components where upstream has the fix in a newer release branch:

1. **Clone hack repo:**
```bash
MINOR_VERSION="1.15"
HACK_BRANCH="release-v${MINOR_VERSION}.x"
git clone https://github.com/openshift-pipelines/hack -b "${HACK_BRANCH}" --depth=1 /tmp/hack-fix
cd /tmp/hack-fix
```

2. **Create fix branch:**
```bash
git checkout -b fix-cve-{component}-{cve-id}
# e.g., git checkout -b fix-cve-cli-2025-22868
```

3. **Update component config to track newer upstream:**
```bash
# Edit config/konflux/repos/{component}.yaml
# Change: upstream: release-v0.37.1
# To:     upstream: release-v0.37.2
```

4. **Commit and push:**
```bash
git add config/konflux/repos/{component}.yaml
git commit -m "chore({component}): update upstream to {new-version}

Update {component} to track upstream {new-version} which includes:
- {CVE-ID} fix: {package} updated to {fix-version}

Fixes: {JIRA-KEY}"

git push -u origin fix-cve-{component}-{cve-id}
```

5. **Create PR:**
```bash
gh pr create --base "${HACK_BRANCH}" --head "fix-cve-{component}-{cve-id}" \
  --title "chore({component}): update upstream to {new-version}" \
  --body "$(cat <<'EOF'
## Summary

Update {component} to track upstream `{new-version}` which includes the fix for {CVE-ID}.

## Changes

- `config/konflux/repos/{component}.yaml`: Changed `upstream: {old-version}` → `upstream: {new-version}`

## CVE Details

| CVE | Package | Fix Version | Jira |
|-----|---------|-------------|------|
| {CVE-ID} | {package} | {fix-version} | [{JIRA-KEY}](https://issues.redhat.com/browse/{JIRA-KEY}) |

## Next Steps

After merge, run the `update-sources-{HACK_BRANCH}.yaml` workflow on `openshift-pipelines/{component}` to pull the updated upstream.

Fixes: {JIRA-KEY}
EOF
)"
```

6. **After hack PR is merged, merge the Konflux config PR in component repo:**

When the hack PR is merged, it triggers a workflow that creates a Konflux configuration PR in the component repo. This PR updates `.tekton/` pipeline configs to match the new upstream tracking.

```bash
# Find the Konflux config PR (created automatically after hack PR merge)
gh pr list --repo openshift-pipelines/{component} --state open \
  --json number,title,url | jq '.[] | select(.title | test("konflux configuration|hack.*update"; "i"))'

# Example PR title: "[bot:hack/openshift-pipelines-cli/release-v1.15.x] update konflux configuration"

# IMPORTANT: Merge this PR BEFORE running update-sources
gh pr merge {konflux_pr_number} --repo openshift-pipelines/{component} --squash
```

7. **After Konflux config PR is merged, trigger update-sources workflow:**
```bash
# Trigger the workflow
gh workflow run update-sources-${HACK_BRANCH}.yaml \
  --repo openshift-pipelines/{component} --ref main

# Monitor the workflow run
gh run list --repo openshift-pipelines/{component} \
  --workflow update-sources-${HACK_BRANCH}.yaml --limit 1

# Wait for completion and check status
gh run watch --repo openshift-pipelines/{component} {run_id}
```

8. **After workflow creates PR, merge it:**
```bash
# List open PRs from the update-sources workflow
gh pr list --repo openshift-pipelines/{component} --base ${HACK_BRANCH} --state open

# The bot PR should now point to the correct upstream (e.g., v0.37.2)
# Example: "[bot] Update release-v1.15.x from tektoncd/cli to 9df524b82e..."

# Review and merge the update PR
gh pr merge {pr_number} --repo openshift-pipelines/{component} --squash
```

9. **Monitor post-merge on-push workflows (CRITICAL):**

After merging the bot PR, Konflux triggers on-push pipelines that build images and run Enterprise Contract checks. **All workflows must pass before proceeding to operator update.**

```bash
COMPONENT_REPO="openshift-pipelines/tektoncd-cli"
BRANCH="release-v1.15.x"

# List recent pipeline runs triggered by the merge
# Check Konflux UI or use gh to monitor GitHub Actions if applicable
gh run list --repo "${COMPONENT_REPO}" --branch "${BRANCH}" --limit 5 \
  --json databaseId,name,status,conclusion,createdAt

# Wait for all runs to complete
gh run list --repo "${COMPONENT_REPO}" --branch "${BRANCH}" --status in_progress

# Verify all passed (no failures)
gh run list --repo "${COMPONENT_REPO}" --branch "${BRANCH}" --limit 5 \
  --json name,conclusion | jq '.[] | select(.conclusion == "failure")'
```

**Konflux Pipeline Checks:**
- `{component}-{version}-{image}-push` pipeline runs on merge
- Enterprise Contract (EC) validation must pass
- Images pushed to `quay.io/redhat-user-workloads/tekton-ecosystem-tenant/...`

**To verify in Konflux UI:**
1. Go to: https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant
2. Check Applications → `openshift-pipelines-cli-{version}` (or relevant app)
3. Verify all component builds are green
4. Check Enterprise Contract results

```bash
# Check if images were pushed to quay (after pipeline completes)
# Example for CLI tkn image:
skopeo inspect --no-tags docker://quay.io/redhat-user-workloads/tekton-ecosystem-tenant/1-15/tkn-rhel8 | jq '.Digest'
```

**Only proceed to operator update after ALL component pipelines pass.**
</step>

<step name="update_jiras">
**Update Jira Tickets for Fixed CVEs**

**Important:** For forked components, CVE fixes come through the update-sources workflow:
1. Hack config PR → points to upstream branch with fix
2. Konflux config PR → created in component repo (merge this first!)
3. `update-sources` workflow → creates bot PR in component repo
4. Bot PR merged → fix is in downstream

The **bot PR** (e.g., `[bot] Update release-v1.15.x from tektoncd/cli to ...`) is the one to link in Jira.

**Process:**

1. **Check if Jira has downstream PR links:**
```bash
TOKEN=$(jq -r '.jira.token' ~/.config/osp/config.json 2>/dev/null || echo "$JIRA_TOKEN")
JIRA_KEY="SRVKP-7201"

# Get remote links - look for openshift-pipelines PRs
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://issues.redhat.com/rest/api/2/issue/${JIRA_KEY}/remotelink" | \
  jq '.[].object | {url, title}' | grep -i "github.com/openshift-pipelines"
```

2. **Find the bot PR that brought in the fix:**

For forked components, find the update-sources bot PR:
```bash
COMPONENT_REPO="openshift-pipelines/tektoncd-cli"
BRANCH="release-v1.15.x"

# List recent bot PRs on the release branch
gh pr list --repo "${COMPONENT_REPO}" --base "${BRANCH}" --state merged \
  --json number,title,mergedAt,url | \
  jq '.[] | select(.title | startswith("[bot] Update")) | {number, title, mergedAt, url}'
```

3. **Add links to Jira:**

Link both the hack config PR and the component bot PR:
```bash
TOKEN=$(jq -r '.jira.token' ~/.config/osp/config.json 2>/dev/null || echo "$JIRA_TOKEN")
JIRA_KEY="SRVKP-7201"

# Add hack config PR link
HACK_PR_URL="https://github.com/openshift-pipelines/hack/pull/435"
curl -X POST -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  "https://issues.redhat.com/rest/api/2/issue/${JIRA_KEY}/remotelink" \
  -d "{\"object\": {\"url\": \"${HACK_PR_URL}\", \"title\": \"Hack PR: Update CLI to track upstream v0.37.2\"}}"

# Add component bot PR link (after update-sources runs)
BOT_PR_URL="https://github.com/openshift-pipelines/tektoncd-cli/pull/XXX"
curl -X POST -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  "https://issues.redhat.com/rest/api/2/issue/${JIRA_KEY}/remotelink" \
  -d "{\"object\": {\"url\": \"${BOT_PR_URL}\", \"title\": \"Bot PR: Update from upstream with CVE fix\"}}"
```

4. **Add comment and transition Jira:**
```bash
# Add comment explaining the fix flow
curl -X POST -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  "https://issues.redhat.com/rest/api/2/issue/${JIRA_KEY}/comment" \
  -d "{\"body\": \"Fixed via update-sources workflow.\\n\\n- Hack PR: ${HACK_PR_URL} (updated upstream tracking to v0.37.2)\\n- Konflux Config PR: ${KONFLUX_PR_URL} (updated pipeline config)\\n- Bot PR: ${BOT_PR_URL} (pulled upstream changes with oauth2 v0.27.0)\\n\\nCVE fixed by updating golang.org/x/oauth2 to v0.27.0\"}"

# Get available transitions
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://issues.redhat.com/rest/api/2/issue/${JIRA_KEY}/transitions" | jq '.transitions[] | {id, name}'

# Transition to Closed
curl -X POST -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  "https://issues.redhat.com/rest/api/2/issue/${JIRA_KEY}/transitions" \
  -d '{"transition": {"id": "{transition_id}"}}'
```

**Jira Update Checklist:**
```markdown
## Jira Updates Required

| Jira | CVE | Hack PR | Konflux PR | Bot PR | Has Links? | Status |
|------|-----|---------|------------|--------|------------|--------|
| SRVKP-7201 | oauth2 | hack#435 | cli#901 | cli#903 | ❌ | Update after bot PR merged |

## Flow Summary
1. ✅ Hack PR created (updates upstream tracking)
2. ✅ Hack PR merged
3. ✅ Konflux config PR created in component repo
4. ✅ Konflux config PR merged (MUST merge before update-sources!)
5. ✅ Run update-sources workflow
6. ⏳ Bot PR created with correct upstream
7. ⏳ Bot PR merged → fix in downstream
8. ⏳ Add PR links to Jira (hack PR + bot PR)
9. ⏳ Close Jira with comment
```
</step>

<step name="save_checklist">
Optionally save the checklist to a file for tracking:

```bash
# Save to local planning directory
CHECKLIST_FILE=".planning/releases/${VERSION_NAME}/checklist.md"
mkdir -p "$(dirname "$CHECKLIST_FILE")"
# Write the full checklist markdown to file
```

The TodoWrite items are immediately visible and trackable in Claude Code.
</step>
</process>

<output>
A comprehensive release checklist including:
1. Version summary with issue breakdown
2. **CVE analysis with fix status and cherry-pick recommendations**
3. Per-component checklist with specific steps
4. Blocking issues that must be resolved
5. Release execution steps (stage → prod)
6. **Prioritized action items via TodoWrite**
7. Links to relevant repositories, workflows, and Jira issues
8. **PRs created to fix CVEs** (when upstream has fix available)
9. **Workflow triggering** after PR merge
10. **Jira update guidance** (add PR links, close fixed CVEs)
</output>

<success_criteria>
- [ ] Jira version fetched successfully
- [ ] All issues retrieved and categorized
- [ ] Components mapped to downstream repos
- [ ] **CVE fix status determined (fixed vs needs fix)**
- [ ] **Upstream fix availability checked for unfixed CVEs**
- [ ] **Base images in Dockerfiles validated (exist in target registry)**
- [ ] Blocking issues identified with recommended actions
- [ ] Per-component checklist generated
- [ ] Release execution steps included
- [ ] **TodoWrite action items created**
- [ ] **PRs created for CVE fixes (when fix available upstream)**
- [ ] **Workflows triggered after PR merge**
- [ ] **On-push pipelines monitored (including Enterprise Contract)**
- [ ] **Jira tickets checked for PR links**
- [ ] **Guidance provided for updating/closing Jiras**
- [ ] Jira links provided for easy access
- [ ] Checklist is actionable and trackable
</success_criteria>
