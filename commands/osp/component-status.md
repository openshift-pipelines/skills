---
name: component-status
description: Check release readiness status of a single component
allowed-tools:
  - Bash
  - Read
  - WebFetch
  - AskUserQuestion
---

# Component Status Checker

<objective>
Check the release readiness of a specific OpenShift Pipelines component. Verifies branch existence, Dockerfile updates, CI status, and image build status for a given release version.

Use this to diagnose issues with individual components during a release.
</objective>

<execution_context>
**Supported Components:**

| Component | Repository | Type | Has Upstream | Branch Pattern |
|-----------|------------|------|--------------|----------------|
| pipeline | openshift-pipelines/tektoncd-pipeline | Forked | tektoncd/pipeline | release-v{minor}.x |
| triggers | openshift-pipelines/tektoncd-triggers | Forked | tektoncd/triggers | release-v{minor}.x |
| chains | openshift-pipelines/tektoncd-chains | Forked | tektoncd/chains | release-v{minor}.x |
| results | openshift-pipelines/tektoncd-results | Forked | tektoncd/results | release-v{minor}.x |
| hub | openshift-pipelines/tektoncd-hub | Forked | tektoncd/hub | release-v{minor}.x |
| pac | openshift-pipelines/pac-downstream | Forked | - | release-v{minor}.x |
| cli | openshift-pipelines/tektoncd-cli | Forked | tektoncd/cli | release-v{minor}.x |
| git-init | openshift-pipelines/tektoncd-git-clone | Forked | tektoncd-catalog/git-clone | release-v{minor}.x |
| operator | openshift-pipelines/operator | Forked | tektoncd/operator | release-v{minor}.x |
| console-plugin | openshift-pipelines/console-plugin | Downstream | - | release-v{minor}.x |
| manual-approval-gate | openshift-pipelines/manual-approval-gate | Downstream | - | release-v{mag-version} |
| opc | openshift-pipelines/opc | Downstream | - | release-v{minor}.x |
| caches | openshift-pipelines/tekton-caches | Downstream | - | release-v{cache-version} |
| pruner | openshift-pipelines/tektoncd-pruner | Downstream | - | release-v{pruner-version} |

**Note:** Some downstream components (MAG, Caches, Pruner) have component-specific version branches. Check hack repo `config/konflux/repos/` for exact branch names per release.

**Branch Naming:**
- Forked components: `release-v{minor}.x` (e.g., `release-v1.15.x`)
- Downstream-only: Version-specific (e.g., `release-v0.6.0` for MAG)

**Requirements:**
- GitHub CLI (`gh`) authenticated
- Access to openshift-pipelines GitHub org
</execution_context>

<process>
<step name="get_input">
Get component name and version from user if not provided.

Use AskUserQuestion if needed:
- header: "Component"
- question: "Which component do you want to check?"
- options: ["pipeline", "triggers", "chains", "cli", "operator", "hub", "pac", "console-plugin"]

Get version:
- header: "Version"
- question: "Which release version? (e.g., 1.15, 1.19, 1.20)"
</step>

<step name="resolve_component">
Map component name to repository details:

```bash
COMPONENT="cli"
VERSION="1.15"

# Component to repo mapping
# Note: For components with custom version branches, check hack repo config
case "$COMPONENT" in
  pipeline) REPO="tektoncd-pipeline"; BRANCH="release-v${VERSION}.x"; TYPE="forked" ;;
  triggers) REPO="tektoncd-triggers"; BRANCH="release-v${VERSION}.x"; TYPE="forked" ;;
  chains) REPO="tektoncd-chains"; BRANCH="release-v${VERSION}.x"; TYPE="forked" ;;
  results) REPO="tektoncd-results"; BRANCH="release-v${VERSION}.x"; TYPE="forked" ;;
  hub) REPO="tektoncd-hub"; BRANCH="release-v${VERSION}.x"; TYPE="forked" ;;
  pac) REPO="pac-downstream"; BRANCH="release-v${VERSION}.x"; TYPE="forked" ;;
  cli) REPO="tektoncd-cli"; BRANCH="release-v${VERSION}.x"; TYPE="forked" ;;
  git-init) REPO="tektoncd-git-clone"; BRANCH="release-v${VERSION}.x"; TYPE="forked" ;;
  operator) REPO="operator"; BRANCH="release-v${VERSION}.x"; TYPE="forked" ;;
  console-plugin) REPO="console-plugin"; BRANCH="release-v${VERSION}.x"; TYPE="downstream" ;;
  manual-approval-gate) REPO="manual-approval-gate"; BRANCH="CUSTOM"; TYPE="downstream" ;;
  opc) REPO="opc"; BRANCH="release-v${VERSION}.x"; TYPE="downstream" ;;
  caches) REPO="tekton-caches"; BRANCH="CUSTOM"; TYPE="downstream" ;;
  pruner) REPO="tektoncd-pruner"; BRANCH="CUSTOM"; TYPE="downstream" ;;
  *) echo "Unknown component: $COMPONENT"; exit 1 ;;
esac

# For CUSTOM branches, fetch from hack repo config
if [ "$BRANCH" = "CUSTOM" ]; then
  echo "Component $COMPONENT has custom versioning. Check hack repo config/konflux/repos/${REPO}.yaml for exact branch."
  # Could fetch from hack repo if cloned locally
fi

ORG="openshift-pipelines"
FULL_REPO="${ORG}/${REPO}"
```
</step>

<step name="check_branch">
Verify the release branch exists:

```bash
# Check if branch exists
BRANCH_EXISTS=$(gh api "repos/${FULL_REPO}/branches/${BRANCH}" --jq '.name' 2>/dev/null || echo "NOT_FOUND")

if [ "$BRANCH_EXISTS" = "NOT_FOUND" ]; then
  echo "BRANCH: NOT FOUND"
  # List available release branches
  echo "Available branches:"
  gh api "repos/${FULL_REPO}/branches" --jq '.[].name | select(startswith("release-"))' | head -10
else
  echo "BRANCH: EXISTS ($BRANCH)"
  # Get last commit info
  gh api "repos/${FULL_REPO}/branches/${BRANCH}" --jq '{
    name: .name,
    last_commit: .commit.sha[0:7],
    last_commit_date: .commit.commit.committer.date,
    protected: .protected
  }'
fi
```
</step>

<step name="check_dockerfile">
Check if Dockerfile has been updated for this release:

```bash
# Get Dockerfile locations (typically in .konflux/dockerfiles/)
DOCKERFILE_PATH=".konflux/dockerfiles"

# Check if the path exists and get recent changes
gh api "repos/${FULL_REPO}/contents/${DOCKERFILE_PATH}?ref=${BRANCH}" --jq '.[].name' 2>/dev/null || echo "No .konflux/dockerfiles found"

# Get recent commits to Dockerfile
gh api "repos/${FULL_REPO}/commits?sha=${BRANCH}&path=${DOCKERFILE_PATH}&per_page=5" --jq '
  .[:3] | map({
    sha: .sha[0:7],
    date: .commit.committer.date,
    message: .commit.message | split("\n")[0]
  })
' 2>/dev/null || echo "[]"
```
</step>

<step name="check_ci_status">
Check CI/workflow status:

```bash
# Get recent workflow runs
gh run list --repo "${FULL_REPO}" --branch "${BRANCH}" --limit 5 --json name,status,conclusion,createdAt,headSha | jq '
  map({
    workflow: .name,
    status: .status,
    conclusion: .conclusion,
    created: .createdAt,
    sha: .headSha[0:7]
  })
'

# Check for update-sources workflow specifically (for forked components)
if [ "$TYPE" = "forked" ]; then
  echo "Update-sources workflow runs:"
  gh run list --repo "${FULL_REPO}" --branch "${BRANCH}" --workflow "update-sources-${BRANCH}.yaml" --limit 3 --json status,conclusion,createdAt 2>/dev/null || echo "No update-sources workflow found"
fi
```
</step>

<step name="check_prs">
Check for open PRs related to this release:

```bash
# Open PRs on the release branch
echo "Open PRs targeting ${BRANCH}:"
gh pr list --repo "${FULL_REPO}" --base "${BRANCH}" --state open --json number,title,author,createdAt | jq '
  map({
    number: .number,
    title: .title,
    author: .author.login,
    created: .createdAt
  })
'

# Recently merged PRs
echo "Recently merged PRs:"
gh pr list --repo "${FULL_REPO}" --base "${BRANCH}" --state merged --limit 5 --json number,title,mergedAt | jq '
  map({
    number: .number,
    title: .title,
    merged: .mergedAt
  })
'
```
</step>

<step name="check_konflux">
Check Konflux build status (if accessible):

```bash
# Note: Konflux API access requires specific authentication
# This step provides guidance on manual verification

echo "To check Konflux build status:"
echo "1. Log in to Konflux RH02: https://console-openshift-console.apps.kflux-prd-rh02.0fk9.p1.openshiftapps.com"
echo "2. Switch to: tekton-ecosystem-tenant"
echo "3. Check Applications → openshift-pipelines-core-${VERSION//./-} (or cli/operator)"
echo "4. Verify component builds are green"

# Alternative: Check quay.io for recent image pushes
echo ""
echo "Recent images at quay.io/redhat-user-workloads/tekton-ecosystem-tenant:"
# This would require quay API access
```
</step>

<step name="generate_report">
Generate a status report for the component:

```markdown
# Component Status: {COMPONENT}

**Repository:** https://github.com/{FULL_REPO}
**Branch:** {BRANCH}
**Type:** {TYPE}

## Status Summary

| Check | Status | Details |
|-------|--------|---------|
| Branch Exists | {YES/NO} | {branch name or missing} |
| Dockerfile Updated | {YES/NO/UNKNOWN} | Last update: {date} |
| CI Status | {PASSING/FAILING/RUNNING} | {workflow status} |
| Open PRs | {count} | {PR numbers} |
| Image Built | {YES/NO/UNKNOWN} | Check Konflux |

## Recent Activity

### Commits (last 5)
{commit list}

### PRs (recently merged)
{PR list}

### Workflow Runs
{workflow list}

## Recommended Actions

{Based on status, suggest next steps}

- If branch missing: Create branch from previous release
- If Dockerfile outdated: Update base images and versions
- If CI failing: Check workflow logs
- If no recent update-sources: Run the workflow
```
</step>

<step name="suggest_actions">
Based on status, suggest next actions:

**If branch doesn't exist:**
```
The release branch needs to be created:
git clone https://github.com/{FULL_REPO}
git checkout release-v{previous}.x
git checkout -b release-v{VERSION}.x
git push origin release-v{VERSION}.x
```

**If Dockerfile needs update:**
```
Update Dockerfiles in .konflux/dockerfiles/:
- Update base image SHA (check https://catalog.redhat.com)
- Update VERSION ARG to {VERSION}
- Check for FIPS requirements
```

**If CI is failing:**
```
Check workflow logs:
gh run view --repo {FULL_REPO} {run_id} --log
```

**If update-sources hasn't run:**
```
Trigger the workflow:
gh workflow run update-sources-{BRANCH}.yaml --repo {FULL_REPO} --ref main
```
</step>
</process>

<output>
A detailed status report for the component including:
1. Branch and repository information
2. Dockerfile update status
3. CI/workflow status
4. Open and merged PRs
5. Recommended next actions
</output>

<success_criteria>
- [ ] Component resolved to correct repository
- [ ] Branch existence verified
- [ ] Dockerfile status checked
- [ ] CI status retrieved
- [ ] PR status shown
- [ ] Clear recommendations provided
</success_criteria>
