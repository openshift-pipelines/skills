---
name: pr-pipeline-status
description: Check PR pipeline status and diagnose Konflux failures
allowed-tools:
  - Bash
  - Read
  - WebFetch
  - AskUserQuestion
---

# PR Pipeline Status

<objective>
Check the status of CI/CD pipelines on a pull request and diagnose failures. Supports GitHub Actions and Konflux pipelines with detailed error analysis.
</objective>

<execution_context>
**Supported Pipelines:**
- GitHub Actions workflows
- Konflux pipelines (requires SSO authentication)

**Authentication:**
- GitHub: `gh` CLI (required)
- Konflux: SSO cookie in `~/.config/osp/config.json` (optional, for detailed logs)

**Common Failure Patterns:**
- Base image not found (SHA doesn't exist in target registry)
- Enterprise Contract (EC) validation failures
- Build compilation errors
- Test failures
- Dependency resolution errors
</execution_context>

<process>
<step name="parse_input">
Parse the input to identify repository and PR number.

**Accepted formats:**
- `owner/repo #123` or `owner/repo 123`
- `https://github.com/owner/repo/pull/123`
- Just `123` (if in a git repo, use current repo)

```bash
# Extract repo and PR from various input formats
INPUT="$1"

if [[ "$INPUT" =~ github\.com/([^/]+/[^/]+)/pull/([0-9]+) ]]; then
  REPO="${BASH_REMATCH[1]}"
  PR_NUM="${BASH_REMATCH[2]}"
elif [[ "$INPUT" =~ ^([^/]+/[^/]+)[[:space:]#]+([0-9]+)$ ]]; then
  REPO="${BASH_REMATCH[1]}"
  PR_NUM="${BASH_REMATCH[2]}"
elif [[ "$INPUT" =~ ^[0-9]+$ ]]; then
  # Just PR number, get repo from git remote
  REPO=$(gh repo view --json nameWithOwner -q '.nameWithOwner' 2>/dev/null)
  PR_NUM="$INPUT"
fi

echo "Repository: $REPO"
echo "PR Number: $PR_NUM"
```
</step>

<step name="get_pr_checks">
Fetch all check runs for the PR:

```bash
REPO="$1"  # e.g., openshift-pipelines/tektoncd-cli
PR_NUM="$2"

# Get PR head SHA
HEAD_SHA=$(gh pr view "$PR_NUM" --repo "$REPO" --json headRefOid -q '.headRefOid')

# Get all check runs
gh api "repos/${REPO}/commits/${HEAD_SHA}/check-runs" \
  --jq '.check_runs[] | {
    name: .name,
    status: .status,
    conclusion: .conclusion,
    details_url: .details_url,
    started_at: .started_at,
    completed_at: .completed_at
  }'
```

Categorize results:
- **Passing**: conclusion = "success"
- **Failing**: conclusion = "failure"
- **Pending**: status = "in_progress" or "queued"
- **Skipped**: conclusion = "skipped"
</step>

<step name="display_summary">
Display a summary of all checks:

```markdown
## PR #{PR_NUM} Pipeline Status

**Repository:** {REPO}
**Head SHA:** {HEAD_SHA}

| Check | Status | Duration |
|-------|--------|----------|
| ✅ build | success | 5m 23s |
| ❌ Konflux tektoncd-cli-1-15-tkn-on-pull-request | failure | 12m 45s |
| ⏳ test | in_progress | 3m... |

**Summary:** 1 failing, 1 passing, 1 pending
```
</step>

<step name="identify_failing_checks">
For each failing check, identify the type and gather details:

```bash
# Get failing checks
gh api "repos/${REPO}/commits/${HEAD_SHA}/check-runs" \
  --jq '.check_runs[] | select(.conclusion == "failure") | {name, details_url}'
```

**Identify check type from name/URL:**
- Contains "Konflux" or "kflux" → Konflux pipeline
- Contains "actions" → GitHub Actions
- Other → External CI
</step>

<step name="diagnose_konflux_failure">
**If Konflux pipeline failed:**

1. **Extract pipeline run info from URL:**
```bash
# URL format: https://konflux-ui.apps.../ns/{namespace}/pipelinerun/{name}
DETAILS_URL="https://konflux-ui.apps.kflux-prd-rh02.0fk9.p1.openshiftapps.com/ns/tekton-ecosystem-tenant/pipelinerun/tektoncd-cli-1-15-tkn-on-pull-request-r7flh"

NAMESPACE=$(echo "$DETAILS_URL" | grep -oE 'ns/[^/]+' | cut -d'/' -f2)
PIPELINE_RUN=$(echo "$DETAILS_URL" | grep -oE 'pipelinerun/[^/]+' | cut -d'/' -f2)

echo "Namespace: $NAMESPACE"
echo "PipelineRun: $PIPELINE_RUN"
```

2. **Check for Konflux authentication:**
```bash
KONFLUX_COOKIE=$(jq -r '.konflux.cookie // empty' ~/.config/osp/config.json 2>/dev/null)
KONFLUX_URL=$(jq -r '.konflux.base_url // empty' ~/.config/osp/config.json 2>/dev/null)

if [ -z "$KONFLUX_COOKIE" ]; then
  echo "KONFLUX_AUTH_MISSING"
fi
```

3. **If no auth, prompt user to authenticate:**
```
════════════════════════════════════════
AUTHENTICATION REQUIRED: Konflux SSO
════════════════════════════════════════

To view detailed pipeline logs, I need Konflux authentication.

**Option 1: Quick manual check**
Open in browser: {DETAILS_URL}
Look for the failed task and error message.

**Option 2: Configure authentication**
Run: /osp:configure
Select: Konflux authentication

After authenticating, run this command again.
════════════════════════════════════════
```

Use AskUserQuestion:
- header: "Konflux Auth"
- question: "How would you like to proceed?"
- options:
  - "I'll check manually" - User will look at URL
  - "Help me configure auth" - Guide through /osp:configure
  - "I've already authenticated" - Retry with cookie

4. **If authenticated, fetch pipeline details:**
```bash
KONFLUX_API="${KONFLUX_URL}/api/k8s/apis/tekton.dev/v1/namespaces/${NAMESPACE}/pipelineruns/${PIPELINE_RUN}"

PIPELINE_DATA=$(curl -s \
  -H "Cookie: _oauth2_proxy=${KONFLUX_COOKIE}" \
  "$KONFLUX_API")

# Check if auth worked
if echo "$PIPELINE_DATA" | grep -q "Unauthorized\|login"; then
  echo "AUTH_EXPIRED"
else
  # Parse pipeline status
  echo "$PIPELINE_DATA" | jq '{
    status: .status.conditions[0].reason,
    message: .status.conditions[0].message,
    failed_tasks: [.status.taskRuns | to_entries[] | select(.value.status.conditions[0].reason == "Failed") | .key]
  }'
fi
```

5. **Fetch failed task logs:**
```bash
# For each failed task, get the logs
FAILED_TASK="tektoncd-cli-1-15-tkn-on-pull-request-r7flh-build"
TASK_API="${KONFLUX_URL}/api/k8s/apis/tekton.dev/v1/namespaces/${NAMESPACE}/taskruns/${FAILED_TASK}"

TASK_DATA=$(curl -s \
  -H "Cookie: _oauth2_proxy=${KONFLUX_COOKIE}" \
  "$TASK_API")

# Get pod name for logs
POD_NAME=$(echo "$TASK_DATA" | jq -r '.status.podName')

# Fetch logs (this may require different API)
# Or provide guidance to view in UI
```
</step>

<step name="analyze_common_failures">
**Analyze error patterns and provide actionable guidance:**

**Pattern 1: Base image not found**
```
Error: manifest unknown: manifest unknown
Error: failed to pull image "registry.redhat.io/ubi8/ubi@sha256:abc123..."
```

**Diagnosis:** The base image SHA doesn't exist in the target registry. This happens when:
- Using a SHA from quay.io that hasn't been released to registry.redhat.io
- Base image was updated but the old SHA was removed

**Fix:**
```bash
# Find current valid SHA for the base image
skopeo inspect docker://registry.redhat.io/ubi8/ubi:latest --no-tags | jq '.Digest'

# Update Dockerfile with new SHA
# Example: .konflux/dockerfiles/tkn.Dockerfile
```

---

**Pattern 2: Enterprise Contract (EC) failure**
```
Error: enterprise contract validation failed
Policy: release_policy/...
```

**Diagnosis:** The image failed Enterprise Contract policy checks. Common reasons:
- Missing required labels
- Unsigned image
- Policy violation

**Fix:**
```bash
# Check EC results in Konflux UI
# Look for specific policy failures
# Fix the policy violation in code/config
```

---

**Pattern 3: Build compilation error**
```
Error: cmd/main.go:15: undefined: SomeFunction
Error: go build failed
```

**Diagnosis:** Go/Node/etc. build failed due to code error.

**Fix:**
```bash
# Run build locally to reproduce
go build ./...
# or
npm run build
```

---

**Pattern 4: Dependency not found**
```
Error: go: module github.com/foo/bar: no matching versions
Error: npm ERR! 404 Not Found
```

**Diagnosis:** A dependency couldn't be resolved.

**Fix:**
```bash
# Update go.sum / package-lock.json
go mod tidy
# or
npm install
```
</step>

<step name="diagnose_github_actions_failure">
**If GitHub Actions failed:**

```bash
# Get workflow run ID from check run
RUN_ID=$(gh api "repos/${REPO}/commits/${HEAD_SHA}/check-runs" \
  --jq '.check_runs[] | select(.conclusion == "failure") | select(.app.slug == "github-actions") | .details_url' \
  | grep -oE 'runs/[0-9]+' | cut -d'/' -f2 | head -1)

if [ -n "$RUN_ID" ]; then
  # Get failed jobs
  gh run view "$RUN_ID" --repo "$REPO" --json jobs \
    --jq '.jobs[] | select(.conclusion == "failure") | {name, steps: [.steps[] | select(.conclusion == "failure")]}'

  # Get logs for failed job
  gh run view "$RUN_ID" --repo "$REPO" --log-failed
fi
```

Display failed step and error message.
</step>

<step name="provide_recommendations">
Based on the failure analysis, provide specific recommendations:

```markdown
## Diagnosis: {FAILURE_TYPE}

**Error:** {ERROR_MESSAGE}

### Root Cause
{EXPLANATION}

### Recommended Fix

1. {STEP_1}
2. {STEP_2}
3. {STEP_3}

### Commands to Run
```bash
{FIX_COMMANDS}
```

### After Fixing
- Push the fix to the PR branch
- Pipeline will re-run automatically
- Or manually re-trigger: `gh pr checks {PR_NUM} --repo {REPO} --watch`
```
</step>

<step name="offer_next_actions">
After diagnosis, offer next steps:

```
## Next Actions

1. **Fix the issue** - Apply the recommended fix
2. **Re-run pipeline** - Push fix or re-trigger manually
3. **Check related PRs** - See if other PRs have same issue
4. **Update base images** - If base image issue, run `/osp:release-checklist` to validate all images
```
</step>
</process>

<output>
- Pipeline status summary for the PR
- Detailed diagnosis of any failures
- Root cause analysis with error patterns
- Specific fix recommendations
- Commands to resolve the issue
</output>

<success_criteria>
- [ ] PR checks retrieved successfully
- [ ] Failing checks identified
- [ ] For Konflux failures: Auth handled (prompted or used)
- [ ] Error pattern matched and diagnosed
- [ ] Actionable fix recommendations provided
- [ ] User knows exact steps to resolve
</success_criteria>
