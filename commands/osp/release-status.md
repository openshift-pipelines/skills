---
name: release-status
description: Track release status and generate todo list from Jira version
allowed-tools:
  - Bash
  - Read
  - Write
  - WebFetch
  - WebSearch
  - AskUserQuestion
  - TodoWrite
---

# Release Status Tracker

<objective>
Track OpenShift Pipelines release status by fetching all issues from a Jira version, checking completion status (Jira status + GitHub PRs), and generating a summary report with actionable todo list.
</objective>

<execution_context>
**Jira API Endpoints:**
- Version details: `GET /rest/api/2/version/{versionId}`
- Issues for version: `GET /rest/api/2/search?jql=fixVersion={versionId}`
- Project versions: `GET /rest/api/2/project/{projectKey}/versions`

**GitHub Organizations to Check:**
- github.com/openshift-pipelines/* (operator, pipelines-as-code, etc.)
- github.com/tektoncd/* (pipeline, triggers, cli, operator, etc.)

**Issue Status Categories:**
- **Done**: Closed, Verified, Release Pending
- **In Progress**: In Progress, Code Review, Review
- **Pending**: To Do, New, Open, Blocked

**Authentication:**
- Jira: Bearer token via `JIRA_TOKEN` env var or `~/.config/osp/config.json`
- GitHub: `gh` CLI authentication
</execution_context>

<process>
<step name="check_configuration">
**MANDATORY FIRST STEP**: Verify authentication is configured.

1. Check Jira token:
```bash
# Check environment variable
echo "${JIRA_TOKEN:+SET}"

# Check config file
cat ~/.config/osp/config.json 2>/dev/null | jq -r '.jira.token // empty' | head -c 5
```

2. Check GitHub CLI:
```bash
gh auth status 2>&1 | head -3
```

**If Jira is not configured**, direct user to run `/osp:configure` first.
**If GitHub is not configured**, warn but continue (GitHub checks will be skipped).
</step>

<step name="get_version_input">
Get the Jira version from the user. Accept multiple formats:

1. **Full URL**: `https://issues.redhat.com/projects/SRVKP/versions/12453355`
2. **Version ID**: `12453355`
3. **Version name**: `Pipelines 1.15.4`

Use AskUserQuestion to get the version if not provided.

Parse the version ID from URL using:
```bash
# Extract version ID from URL
echo "https://issues.redhat.com/projects/SRVKP/versions/12453355" | grep -oE '[0-9]+$'
```

If a version name is provided, search for the ID:
```bash
TOKEN=$(jq -r '.jira.token' ~/.config/osp/config.json 2>/dev/null || echo "$JIRA_TOKEN")
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://issues.redhat.com/rest/api/2/project/SRVKP/versions" | \
  jq -r '.[] | select(.name | contains("1.15.4")) | {id, name}'
```
</step>

<step name="fetch_version_details">
Fetch the version metadata:

```bash
TOKEN=$(jq -r '.jira.token' ~/.config/osp/config.json 2>/dev/null || echo "$JIRA_TOKEN")
VERSION_ID="12453355"

curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://issues.redhat.com/rest/api/2/version/${VERSION_ID}" | jq .
```

Extract:
- `name`: Version name (e.g., "Pipelines 1.15.4")
- `released`: Whether version is released (true/false)
- `releaseDate`: Target release date (if set)
- `projectId`: Parent project ID
</step>

<step name="fetch_version_issues">
Fetch all issues for the version:

```bash
TOKEN=$(jq -r '.jira.token' ~/.config/osp/config.json 2>/dev/null || echo "$JIRA_TOKEN")
VERSION_ID="12453355"

# Fetch issues with relevant fields
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://issues.redhat.com/rest/api/2/search?jql=fixVersion=${VERSION_ID}&maxResults=200&fields=key,summary,status,issuetype,priority,assignee,components,issuelinks,description" | jq .
```

For each issue, extract:
- `key`: Issue key (SRVKP-1234)
- `fields.summary`: Issue title
- `fields.status.name`: Current status
- `fields.issuetype.name`: Bug, Story, Vulnerability, etc.
- `fields.priority.name`: Priority level
- `fields.assignee.displayName`: Assignee (or "Unassigned")
- `fields.components[].name`: Affected components
- `fields.description`: May contain GitHub PR links
- `fields.issuelinks`: Linked issues/PRs
</step>

<step name="categorize_issues">
Group issues by completion status:

```bash
# Parse and categorize issues
TOKEN=$(jq -r '.jira.token' ~/.config/osp/config.json 2>/dev/null || echo "$JIRA_TOKEN")

curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://issues.redhat.com/rest/api/2/search?jql=fixVersion=${VERSION_ID}&maxResults=200&fields=key,summary,status,issuetype,priority,assignee,components" | \
  jq '{
    total: .total,
    done: [.issues[] | select(.fields.status.name | test("Closed|Verified|Release Pending"; "i"))],
    in_progress: [.issues[] | select(.fields.status.name | test("In Progress|Code Review|Review"; "i"))],
    pending: [.issues[] | select(.fields.status.name | test("To Do|New|Open|Blocked"; "i"))]
  } | {
    total: .total,
    done_count: (.done | length),
    in_progress_count: (.in_progress | length),
    pending_count: (.pending | length),
    pending_issues: [.pending[] | {key: .key, summary: .fields.summary, status: .fields.status.name, type: .fields.issuetype.name, assignee: (.fields.assignee.displayName // "Unassigned")}]
  }'
```
</step>

<step name="check_github_prs">
For issues that are NOT done, search for related GitHub PRs:

```bash
# Search in openshift-pipelines org
gh search prs "SRVKP-1234" --owner openshift-pipelines --state all --limit 5 --json repository,number,title,state,mergedAt

# Search in tektoncd org
gh search prs "SRVKP-1234" --owner tektoncd --state all --limit 5 --json repository,number,title,state,mergedAt
```

For each pending issue:
1. Search both orgs for PRs mentioning the issue key
2. If PR found, record: repo, PR number, state (open/merged/closed)
3. If no PR found, mark as "No PR linked"

Compile PR status for each pending issue:
- **PR Merged**: Fix is complete, issue may need status update
- **PR Open**: In progress, needs review/merge
- **PR Draft**: Work in progress
- **No PR**: Needs attention - either PR not created or not linked
</step>

<step name="generate_report">
Generate a comprehensive markdown report:

```markdown
# Release Status: {VERSION_NAME}

## Summary
- **Version**: {VERSION_NAME} (ID: {VERSION_ID})
- **Release Status**: {Released/Unreleased}
- **Total Issues**: {TOTAL}

### Status Breakdown
| Status | Count | Percentage |
|--------|-------|------------|
| Closed | {N} | {%} |
| Verified | {N} | {%} |
| In Progress | {N} | {%} |
| To Do | {N} | {%} |

### By Type
| Type | Count |
|------|-------|
| Vulnerability | {N} |
| Bug | {N} |
| Story | {N} |

## Action Required ({N} issues)

### To Do / Pending
| Key | Summary | Type | Assignee | PR Status |
|-----|---------|------|----------|-----------|
| SRVKP-XXXX | {Summary} | {Type} | {Assignee} | {PR status} |

### In Progress
| Key | Summary | Assignee | PR Status |
|-----|---------|----------|-----------|
| SRVKP-XXXX | {Summary} | {Assignee} | {PR status} |

## Completed Issues ({N})

<details>
<summary>Click to expand completed issues</summary>

| Key | Summary | Type |
|-----|---------|------|
| SRVKP-XXXX | {Summary} | {Type} |

</details>

## Recommended Actions

Based on the analysis, the following actions are recommended:

1. **Unassigned Issues**: {list any unassigned pending issues}
2. **Missing PRs**: {list issues without linked PRs}
3. **Open PRs Needing Review**: {list PRs that need review/merge}
4. **Status Updates Needed**: {issues with merged PRs but not closed}
```
</step>

<step name="create_todo_list">
Use TodoWrite to create an actionable todo list for the release:

For each pending/in-progress issue, create a todo item:
- "Fix SRVKP-XXXX: {summary}" for To Do items
- "Review PR for SRVKP-XXXX" for items with open PRs
- "Create PR for SRVKP-XXXX" for items without PRs
- "Update status for SRVKP-XXXX (PR merged)" for merged but not closed

Example:
```
TodoWrite with items:
- [ ] Assign SRVKP-7480: Release OpenShift Pipelines Operator
- [ ] Create PR for SRVKP-7482: Performance regression testing
- [ ] Fix CVE SRVKP-7344: jwt-go memory allocation vulnerability
- [ ] Review PR for SRVKP-7201: golang.org/x/oauth2 vulnerability
```
</step>
</process>

<output>
A comprehensive release status report including:
1. Version summary with status breakdown
2. Detailed list of pending/in-progress issues with PR status
3. Collapsed list of completed issues
4. Recommended actions for release completion
5. Generated todo list for tracking remaining work
</output>

<success_criteria>
- [ ] Jira authentication is verified
- [ ] Version details are fetched successfully
- [ ] All issues for the version are retrieved
- [ ] Issues are categorized by status correctly
- [ ] GitHub PRs are searched for pending issues
- [ ] Summary report is generated with accurate counts
- [ ] Todo list is created with actionable items
- [ ] User can see clear path to release completion
</success_criteria>
