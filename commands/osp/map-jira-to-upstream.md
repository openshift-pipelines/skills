---
name: map-jira-to-upstream
description: Find upstream Tekton GitHub issues related to a Red Hat Jira issue
allowed-tools:
  - WebFetch
  - WebSearch
  - Bash
  - Read
  - Write
  - Glob
  - AskUserQuestion
  - Task
---

# Map Red Hat Jira to Upstream Tekton Issues

<objective>
Given a Red Hat Jira issue (issues.redhat.com), search for related upstream issues in the tektoncd GitHub organization.
This helps identify if issues have been reported/fixed upstream and facilitates backporting or collaboration.
</objective>

<execution_context>
The tektoncd organization on GitHub hosts the upstream Tekton projects:
- github.com/tektoncd/pipeline - Core pipeline functionality
- github.com/tektoncd/triggers - Event triggering
- github.com/tektoncd/cli - tkn CLI tool
- github.com/tektoncd/dashboard - Web UI
- github.com/tektoncd/operator - Kubernetes operator
- github.com/tektoncd/catalog - Reusable tasks and pipelines
- github.com/tektoncd/chains - Supply chain security
- github.com/tektoncd/results - Long-term result storage
- github.com/tektoncd/hub - Task/Pipeline hub

Red Hat Jira (issues.redhat.com) tracks OpenShift Pipelines issues under projects like:
- SRVKP (OpenShift Pipelines)
- GITOPSRVCE (GitOps)

**Authentication Requirements:**
- Red Hat Jira API requires a Personal Access Token (PAT)
- GitHub API works without auth for public repos but rate limits apply
</execution_context>

<process>
<step name="check_configuration">
**MANDATORY FIRST STEP**: Check for Jira authentication configuration.

1. Check for config file:
```bash
cat ~/.config/osp/config.json 2>/dev/null || echo "NOT_FOUND"
```

2. Check for environment variable:
```bash
echo "${JIRA_TOKEN:+SET}" || echo "NOT_SET"
```

3. **If neither exists**, inform the user and help them configure:

```
## Jira Authentication Required

To access issues.redhat.com, you need a Personal Access Token (PAT).

### Option 1: Environment Variable (Recommended for security)
Add to your shell profile (~/.bashrc, ~/.zshrc, etc.):
```bash
export JIRA_TOKEN="your-personal-access-token"
```

### Option 2: Config File
Run `/osp:configure` to set up authentication, or manually create:
```bash
mkdir -p ~/.config/osp
cat > ~/.config/osp/config.json << 'EOF'
{
  "jira": {
    "base_url": "https://issues.redhat.com",
    "token": "your-personal-access-token"
  }
}
EOF
chmod 600 ~/.config/osp/config.json
```

### How to get a Jira PAT:
1. Log in to https://issues.redhat.com
2. Click your profile icon → Personal Access Tokens
3. Create a new token with "Read" scope
4. Copy the token (it's only shown once!)
```

**Do not proceed until authentication is configured.**
</step>

<step name="get_jira_issue">
1. Get the Jira issue from the user:
   - Ask for the Jira issue key (e.g., SRVKP-1234) or full URL
   - Accept formats: SRVKP-1234, https://issues.redhat.com/browse/SRVKP-1234

2. Determine the token source:
   - If `JIRA_TOKEN` env var is set, use it
   - Otherwise read from `~/.config/osp/config.json`

3. Fetch the Jira issue via API:
```bash
# Using environment variable
curl -s -H "Authorization: Bearer ${JIRA_TOKEN}" \
  "https://issues.redhat.com/rest/api/2/issue/SRVKP-1234" | jq .

# Or using config file token
TOKEN=$(jq -r '.jira.token' ~/.config/osp/config.json)
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://issues.redhat.com/rest/api/2/issue/SRVKP-1234" | jq .
```

4. Extract from the response:
   - `fields.summary` - Issue title
   - `fields.description` - Full description
   - `fields.components` - Affected components
   - `fields.labels` - Labels
   - `fields.issuelinks` - Linked issues (may include upstream refs)
   - `fields.status.name` - Current status
   - `fields.customfield_*` - Custom fields (upstream links, etc.)
</step>

<step name="extract_search_terms">
From the Jira issue, extract key information for searching:

1. **Error messages** - Specific error strings mentioned
2. **Component names** - Which Tekton component is affected (pipeline, triggers, cli, etc.)
3. **Feature names** - Specific features like PipelineRun, TaskRun, Workspaces, Results
4. **Keywords** - Technical terms, API fields, CRD names
5. **Version info** - Tekton versions mentioned
6. **Existing upstream links** - Check if issue already references upstream

Build search queries combining:
- Component repo + error message
- Feature name + symptom description
- API field + unexpected behavior
</step>

<step name="search_upstream">
Search for related issues in tektoncd repositories:

1. **GitHub Search** - Use WebSearch with queries like:
   - `site:github.com/tektoncd "<error message>"`
   - `site:github.com/tektoncd/pipeline "<feature> issue"`
   - `repo:tektoncd/pipeline is:issue <keywords>`

2. **GitHub API** (if available via gh CLI):
```bash
gh search issues --repo tektoncd/pipeline "<search terms>" --limit 10
gh search issues --repo tektoncd/triggers "<search terms>" --limit 10
```

3. **Check specific repos** based on component:
   - Pipeline issues: github.com/tektoncd/pipeline/issues
   - Triggers issues: github.com/tektoncd/triggers/issues
   - CLI issues: github.com/tektoncd/cli/issues
   - Operator issues: github.com/tektoncd/operator/issues

4. For each potential match, fetch the issue to verify relevance:
   - Check if symptoms match
   - Check if affected versions overlap
   - Check if there's a fix or workaround
</step>

<step name="analyze_and_report">
Compile findings into a report:

1. **Related Upstream Issues**:
   For each relevant issue found:
   - Issue URL and title
   - Status (open/closed)
   - If closed, check if it's in a release version
   - Similarity assessment (how closely it matches)

2. **Potential Actions**:
   - Link to upstream issue if exact match
   - File new upstream issue if no match exists
   - Check if fix is available for backport
   - Reference upstream PR if fix exists

3. **Version Analysis**:
   - Which upstream version contains the fix (if any)
   - Which OpenShift Pipelines version includes that upstream version

4. Present findings clearly:
```
## Upstream Analysis for [JIRA-KEY]: [Title]

### Jira Summary
- **Status**: [Status]
- **Components**: [Components]
- **Description**: [Brief summary]

### Related Upstream Issues

| # | Repository | Issue | Title | Status | Relevance |
|---|------------|-------|-------|--------|-----------|
| 1 | tektoncd/pipeline | #1234 | [Title] | Open | High |
| 2 | tektoncd/triggers | #567 | [Title] | Closed | Medium |

### Details

#### tektoncd/pipeline#1234
- **Why related**: [Explanation]
- **Fix available**: Yes/No
- **Fixed in version**: v0.50.0

### Recommendations
1. [Primary recommendation]
2. [Secondary recommendation]
```
</step>

<step name="suggest_actions">
Based on the analysis, suggest next steps:

**If exact match found (closed)**:
- Identify the fix PR
- Check if backport is needed
- Provide backport instructions if applicable

**If exact match found (open)**:
- Suggest adding Red Hat Jira link to upstream issue
- Consider contributing a fix upstream
- Add upstream issue link to Jira

**If partial matches found**:
- Explain differences
- Suggest filing new upstream issue with reference to similar issues

**If no matches found**:
- Draft an upstream issue description
- Identify the correct tektoncd repo to file against
- Provide issue template with relevant details
</step>
</process>

<output>
A comprehensive report containing:
1. Summary of the Jira issue
2. List of related upstream Tekton issues with relevance assessment
3. Status of any fixes (available, backportable, etc.)
4. Recommended next steps for the user
</output>

<success_criteria>
- [ ] Jira authentication is verified before proceeding
- [ ] Jira issue details are successfully retrieved via API
- [ ] Relevant search terms are extracted
- [ ] Upstream tektoncd repos are searched thoroughly
- [ ] Related issues are identified and analyzed
- [ ] Clear recommendations are provided
- [ ] Links between downstream and upstream are documented
</success_criteria>
