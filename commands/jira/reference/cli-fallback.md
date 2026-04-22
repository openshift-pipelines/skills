# Jira CLI (`acli`) Reference

This document provides the correct Atlassian CLI (`acli`) command syntax for Jira operations.

## Automatic Fallback Strategy

All Jira skills use an **automatic fallback approach**:

1. **Primary**: Try MCP Jira server first (always preferred)
2. **Detect**: Auto-detect MCP failure within 2-3 seconds
3. **Fallback**: Automatically use `acli` if MCP unavailable

**MCP failure indicators:**
- "Tool rejected: User rejected MCP"
- "MCP server does not exist"  
- Connection timeouts

**Result**: Seamless experience - skills work regardless of MCP availability

## Authentication

**Use your own Red Hat Jira email** in `--email` and **keep your API token out of this repo** (examples use `~/.jira.d/token`; change the path if you store the token elsewhere).

### One-Time Setup

1. **Generate API token** (only if you don't have one):
   - Visit: https://id.atlassian.com/manage-profile/security/api-tokens
   - Click "Create API token"
   - Copy the token (you won't see it again!)

2. **Store token locally** (only if not already stored):
   ```bash
   echo "YOUR_API_TOKEN" > ~/.jira.d/token
   chmod 600 ~/.jira.d/token
   ```

### Authenticate

Safe to run multiple times (uses existing token):

```bash
acli jira auth login \
  --site "https://issues.redhat.com" \
  --email "YOUR_REDHAT_ID@redhat.com" \
  --token < ~/.jira.d/token
```

### Verify Authentication

```bash
acli jira me
```

Expected output:
```
✓ Authentication successful
  Welcome, <your Jira display name>
```

---

## Issue Creation

### Command: `acli jira workitem create`

**⚠️ Important:** Use `workitem create`, NOT `issue create`

### Basic Syntax

```bash
acli jira workitem create \
  --project "<PROJECT_KEY>" \
  --type "<ISSUE_TYPE>" \
  --summary "<SUMMARY>" \
  --description "<DESCRIPTION>" \
  [OPTIONS]
```

### Common Options

| Flag | Description | Example |
|------|-------------|---------|
| `--project` | Project key (always "SRVKP") | `--project "SRVKP"` |
| `--type` | Issue type | `--type "Epic"` |
| `--summary` | Issue summary/title | `--summary "Epic title"` |
| `--description` | Inline description | `--description "text..."` |
| `--description-file` | Description from file | `--description-file "/tmp/desc.txt"` |
| `--label` | Labels (comma-separated) | `--label "ai-generated-jira"` |
| `--parent` | Parent issue key | `--parent "SRVKP-12345"` |
| `--assignee` | Assignee email or '@me' | `--assignee "@me"` |
| `--json` | Output JSON | `--json` |

### Examples

**Create Epic:**
```bash
acli jira workitem create \
  --project "SRVKP" \
  --type "Epic" \
  --summary "Recursive Image Manifest signing" \
  --description "Enable automatic signing..." \
  --label "ai-generated-jira" \
  --json
```

**Create Epic with Parent Feature:**
```bash
acli jira workitem create \
  --project "SRVKP" \
  --type "Epic" \
  --summary "Epic title" \
  --description "Epic description" \
  --parent "SRVKP-11632" \
  --label "ai-generated-jira" \
  --json
```

**Note:** The `--parent` flag creates proper parent-child relationships in Jira:
- Stories → parent is Epic
- Epics → parent is Feature
- Do NOT use custom fields for parent linking

**Create Feature:**
```bash
acli jira workitem create \
  --project "SRVKP" \
  --type "Feature" \
  --summary "Feature title" \
  --description "$(cat <<'EOF'
Strategic objective paragraph explaining the feature.

h2. Strategic Outcomes

* Outcome 1
* Outcome 2

h2. Timeline

* Target: Q3 2026
EOF
)" \
  --label "ai-generated-jira" \
  --json
```

**Create Story:**
```bash
acli jira workitem create \
  --project "SRVKP" \
  --type "Story" \
  --summary "User story title" \
  --description "$(cat <<'EOF'
As a user, I want to achieve X, so that I can gain value Y.

h2. Acceptance Criteria

* Test that behavior 1 works
* Verify that behavior 2 works
EOF
)" \
  --label "ai-generated-jira" \
  --json
```

**Create Story with Parent Epic:**
```bash
acli jira workitem create \
  --project "SRVKP" \
  --type "Story" \
  --summary "User story title" \
  --description "$(cat <<'EOF'
As a user, I want to achieve X, so that I can gain value Y.

h2. Acceptance Criteria

* Test that behavior 1 works
* Verify that behavior 2 works
EOF
)" \
  --parent "SRVKP-11633" \
  --label "ai-generated-jira" \
  --json
```

**Important:** 
- Use `--parent` flag with Epic key, NOT custom fields
- Use `$(cat <<'EOF' ... EOF)` for inline multi-line descriptions

**Create Bug:**
```bash
acli jira workitem create \
  --project "SRVKP" \
  --type "Bug" \
  --summary "Bug title" \
  --description "Problem description..." \
  --label "ai-generated-jira" \
  --json
```

**Create Task:**
```bash
acli jira workitem create \
  --project "SRVKP" \
  --type "Task" \
  --summary "Task title" \
  --description "Task description..." \
  --label "ai-generated-jira" \
  --json
```

---

## Issue Search

### Command: `acli jira workitem search`

### Basic Syntax

```bash
acli jira workitem search \
  --jql '<JQL_QUERY>' \
  --fields "key,summary,status,..." \
  [OPTIONS]
```

### Common Options

| Flag | Description | Example |
|------|-------------|---------|
| `--jql` | JQL query string | `--jql 'project = SRVKP'` |
| `--fields` | Fields to return | `--fields "key,summary,status"` |
| `--json` | Output JSON | `--json` |

### Examples

**Search for Epics:**
```bash
acli jira workitem search \
  --jql 'project = SRVKP AND issuetype = Epic' \
  --fields "key,summary,status" \
  --json
```

**Search for Epics with Keywords:**
```bash
acli jira workitem search \
  --jql 'project = SRVKP AND issuetype = Epic AND summary ~ chains' \
  --fields "key,summary,status" \
  --json
```

**Search for Features:**
```bash
acli jira workitem search \
  --jql 'project = SRVKP AND issuetype = Feature' \
  --fields "key,summary,status" \
  --json
```

**Search for Features with Keywords:**
```bash
acli jira workitem search \
  --jql 'project = SRVKP AND issuetype = Feature AND (summary ~ chains OR summary ~ signing)' \
  --fields "key,summary,status" \
  --json
```

**Search by Fix Version:**
```bash
acli jira workitem search \
  --jql 'project = SRVKP AND fixVersion = "1.15"' \
  --fields "key,summary,status,fixVersions" \
  --json
```

**Search by Status:**
```bash
acli jira workitem search \
  --jql 'project = SRVKP AND status = "In Progress"' \
  --fields "key,summary,status,assignee" \
  --json
```

---

## JQL Query Syntax

### Basic Operators

| Operator | Usage | Example |
|----------|-------|---------|
| `=` | Equals | `project = SRVKP` |
| `!=` | Not equals | `status != Closed` |
| `~` | Contains (text search) | `summary ~ chains` |
| `IN` | In list | `status IN (New, "To Do")` |
| `AND` | Logical AND | `project = SRVKP AND issuetype = Epic` |
| `OR` | Logical OR | `summary ~ chains OR summary ~ signing` |

### Common JQL Fields

| Field | Description | Example Values |
|-------|-------------|----------------|
| `project` | Project key | `SRVKP` |
| `issuetype` | Issue type | `Epic`, `Feature`, `Story`, `Task`, `Bug` |
| `status` | Issue status | `New`, `In Progress`, `Closed` |
| `summary` | Issue summary | Any text |
| `fixVersion` | Fix version | `"1.15"`, `"1.16"` |
| `assignee` | Assigned user | Email or username |
| `labels` | Issue labels | `ai-generated-jira` |
| `parent` | Parent issue | `SRVKP-12345` |

### JQL Examples for SRVKP

**All epics:**
```jql
project = SRVKP AND issuetype = Epic
```

**Epics with keyword "chains":**
```jql
project = SRVKP AND issuetype = Epic AND summary ~ chains
```

**Features related to signing:**
```jql
project = SRVKP AND issuetype = Feature AND (summary ~ signing OR summary ~ security)
```

**All open issues in version 1.15:**
```jql
project = SRVKP AND fixVersion = "1.15" AND status != Closed
```

**Multiple keyword search (OR):**
```jql
project = SRVKP AND issuetype = Epic AND (summary ~ recursive OR summary ~ image OR summary ~ manifest OR summary ~ signing)
```

---

## Important Notes

### Description Formatting

**For Wiki Markup (headings, lists, etc.), use here-doc:**

```bash
# Use $(cat <<'EOF' ... EOF) for multi-line descriptions
acli jira workitem create \
  --project "SRVKP" \
  --type "Epic" \
  --summary "Epic title" \
  --description "$(cat <<'EOF'
h2. Epic Objective
Enable automatic signing...

h2. Acceptance Criteria
# Criterion 1
# Criterion 2
EOF
)" \
  --label "ai-generated-jira" \
  --json
```

**For simple text, inline description works:**

```bash
# Inline for simple text
acli jira workitem create \
  --project "SRVKP" \
  --type "Task" \
  --summary "Update documentation" \
  --description "Update the README with new instructions" \
  --label "ai-generated-jira" \
  --json
```

**Important:** 
- Use `$(cat <<'EOF' ... EOF)` for multi-line wiki markup
- No temp files needed - all inline
- Single quotes around `'EOF'` prevent variable expansion

### Output Parsing

**Always use `--json` flag for programmatic parsing:**

```bash
acli jira workitem create ... --json

# Extracts the issue key:
acli jira workitem create ... --json | jq -r '.key'
# Output: SRVKP-11632
```

### Quoting Rules

- **Project and Type:** Always quote: `--project "SRVKP"`, `--type "Epic"`
- **Summary:** Quote if contains spaces: `--summary "Epic title"`
- **JQL:** Always quote: `--jql 'project = SRVKP'`

---

## Common Patterns

### Pattern: Create Epic with Parent Feature

```bash
# 1. Search for parent Feature
PARENT_KEY=$(acli jira workitem search \
  --jql 'project = SRVKP AND issuetype = Feature AND summary ~ chains' \
  --fields "key" \
  --json | jq -r '.[0].key')

# 2. Create Epic under parent
acli jira workitem create \
  --project "SRVKP" \
  --type "Epic" \
  --summary "Epic title" \
  --description "Epic description" \
  --parent "$PARENT_KEY" \
  --label "ai-generated-jira" \
  --json
```

### Pattern: Duplicate Detection

```bash
# 1. Search for similar epics
acli jira workitem search \
  --jql 'project = SRVKP AND issuetype = Epic AND summary ~ chains' \
  --fields "key,summary,status" \
  --json

# 2. Review results before creating new epic
```

### Pattern: Create Feature then Epic

```bash
# 1. Create Feature
FEATURE=$(acli jira workitem create \
  --project "SRVKP" \
  --type "Feature" \
  --summary "Tekton Chains Signing Enhancements" \
  --description "$(cat <<'EOF'
Expand Tekton Chains signing capabilities.

h2. Strategic Outcomes
* SLSA Level 3 compliance
* Multi-arch support

h2. Timeline
* Target: Q3-Q4 2026
EOF
)" \
  --label "ai-generated-jira" \
  --json)

FEATURE_KEY=$(echo "$FEATURE" | jq -r '.key')

# 2. Create Epic under Feature
acli jira workitem create \
  --project "SRVKP" \
  --type "Epic" \
  --summary "Recursive Image Manifest signing" \
  --description "$(cat <<'EOF'
h2. Epic Objective
Enable automatic recursive signing.

h2. Acceptance Criteria
# Chains detects all manifests
# All manifests are signed
EOF
)" \
  --parent "$FEATURE_KEY" \
  --label "ai-generated-jira" \
  --json
```

---

## Troubleshooting

### Error: "unknown flag: --project"

**Problem:** Using old `acli jira issue create` command

**Solution:** Use `acli jira workitem create` instead

### Error: "failed to parse JQL"

**Problem:** JQL syntax error or unquoted query

**Solution:** 
- Always quote JQL: `--jql 'project = SRVKP'`
- Use single quotes for JQL with spaces

### Error: "authentication required"

**Problem:** Not authenticated

**Solution:**
```bash
acli jira auth login \
  --site "https://issues.redhat.com" \
  --email "YOUR_REDHAT_ID@redhat.com" \
  --token < ~/.jira.d/token
```

### Description Not Formatted

**Problem:** Wiki markup not rendering

**Solution:** Use `--description-file` instead of inline `--description`

---

## Help Commands

```bash
# General help
acli jira --help

# Workitem help
acli jira workitem --help

# Create help
acli jira workitem create --help

# Search help
acli jira workitem search --help
```
