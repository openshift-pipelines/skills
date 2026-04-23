---
name: backlog-triage
description: Deep LLM-powered Jira backlog triage against upstream tektoncd repositories. Fetches backlog from Jira, investigates each issue against upstream git/GitHub activity, and generates an interactive HTML report.
allowed-tools:
  - Bash
  - Read
  - Write
  - WebFetch
  - AskUserQuestion
  - Task
---

# Backlog Triage

<objective>
Analyze the SRVKP Jira backlog by investigating each issue against upstream tektoncd repositories.
Determine which issues are still relevant, have been addressed upstream, or should be closed.
Generate an interactive HTML report with recommendations, evidence, and suggested comments.
</objective>

<execution_context>

## Architecture

This skill uses the **agent pattern**: the LLM reads each issue, decides what to investigate, and uses tools (`git log`, `gh`) to pull exactly the evidence it needs. No pre-truncated context dumps — the agent can go deep on specific PRs, commits, and issues.

## Prerequisites

- `jrc` (jayrat CLI) — for Jira API access. Config in `~/.config/jayrat/config.yaml`
- `gh` (GitHub CLI) — for searching upstream GitHub issues/PRs
- Local clones of tektoncd repos (fetched during the workflow)

## Project Configuration

The skill reads `backlog-triage.toml` from the current working directory. If it doesn't exist, create one:

```toml
[project]
name = "OpenShift Pipelines"
jira_project = "SRVKP"
jira_base = "https://issues.redhat.com/browse"

[versions]
current = ["1.19", "1.20", "1.21"]
development = ["1.22"]
eol = ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6", "1.7", "1.8", "1.9", "1.10", "1.11", "1.12", "1.13", "1.14", "1.15", "1.16", "1.17", "1.18"]
eol_ocp = ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "4.9", "4.10", "4.11", "4.12", "4.13"]

[upstream]
org = "tektoncd"
repos_dir = "~/src/tektoncd"

[upstream.component_map]
"Tekton Pipelines" = "pipeline"
"Pipelines as Code" = "pipelines-as-code"
"Tekton Triggers" = "triggers"
"Tekton Chains" = "chains"
"Tekton Results" = "results"
"Tekton CLI" = "cli"
"Operator" = "operator"
"Tekton Ecosystem" = "catalog"
"UI" = "dashboard"
"Tekton Hub" = "hub"
```

## Working Directory

All data files (backlog JSON, analysis JSON, HTML report) are stored in a temporary working directory:

```
/tmp/backlog-triage-{project}/
├── backlog.json              # Fetched Jira issues
├── analysis.json             # Per-issue analysis results
└── report.html               # Interactive HTML report
```

## Workflow

### Phase 1: Fetch Backlog

Run the fetch script to download all backlog issues from Jira:

```bash
SKILL_DIR="$(claude skill path osp:backlog-triage)"
python3 "$SKILL_DIR/../../../bin/fetch-backlog.py" --config backlog-triage.toml
```

Or if `SKILL_DIR` is not available, locate the script relative to the skills repo:

```bash
# Find the skills repo
SKILLS_REPO="$(dirname "$(dirname "$(dirname "$(readlink -f "$(which claude)" 2>/dev/null || echo "$CLAUDE_SKILLS_DIR")")")")"
python3 "${SKILLS_REPO}/bin/fetch-backlog.py" --config backlog-triage.toml
```

The script:
- Uses `jrc` to paginate through all unresolved, no-sprint issues
- Fetches full details (description, comments) for each issue
- Saves to `/tmp/backlog-triage-{project}/backlog.json` with checkpoint/resume support
- Concurrency: 8 workers (configurable via `--workers`)

### Phase 2: Clone/Update Upstream Repos

Ensure local clones of upstream repos exist and are up-to-date:

```bash
REPOS_DIR=$(python3 -c "import tomllib; print(tomllib.load(open('backlog-triage.toml','rb'))['upstream']['repos_dir'])" | sed "s|~|$HOME|")
ORG=$(python3 -c "import tomllib; print(tomllib.load(open('backlog-triage.toml','rb'))['upstream']['org'])")

mkdir -p "$REPOS_DIR"

for repo in pipeline triggers chains results cli operator pipelines-as-code catalog dashboard hub; do
    if [ -d "$REPOS_DIR/$repo" ]; then
        git -C "$REPOS_DIR/$repo" fetch --all --quiet 2>/dev/null
        echo "Updated $repo"
    else
        echo "Cloning $ORG/$repo..."
        git clone --quiet "https://github.com/$ORG/$repo.git" "$REPOS_DIR/$repo"
        echo "Cloned $repo"
    fi
done
```

### Phase 3: Analyze Issues (Agent-Based)

Load issues from the backlog JSON, then investigate each one. Process in batches of ~20, grouped by component for efficient upstream searches.

For each issue:

1. **Read the issue** — summary, description, comments, labels, components, priority, age
2. **Quick classify** if obvious:
   - CVE for EOL version (e.g., `[pipelines-1.14]` in title) → CLOSE
   - Empty issue (no description, no comments, 1+ year old) → REVIEW_TO_CLOSE
   - Blocker/Critical with recent activity → HIGH_PRIORITY
3. **Investigate upstream** for non-obvious cases:

```bash
# Search commits in the relevant repo
git -C "$REPOS_DIR/{repo}" log --oneline --all --grep="{keyword}" | head -20

# Search merged PRs on GitHub
gh pr list -R tektoncd/{repo} --state merged --search "{keyword}" --limit 10 --json number,title,mergedAt,url

# Search closed issues on GitHub
gh issue list -R tektoncd/{repo} --state closed --search "{keyword}" --limit 10 --json number,title,closedAt,url

# Read a specific PR for details
gh pr view {number} -R tektoncd/{repo} --json title,body,mergedAt,files
```

4. **Classify** with recommendation, score, confidence, reason, evidence, and suggested comment

#### Per-Issue Output Format

```json
{
  "key": "SRVKP-1234",
  "recommendation": "CLOSE",
  "relevance_score": 10,
  "confidence": "high",
  "reason": "This CVE tracks a vulnerability in pipelines-1.14 which is EOL. The issue has no activity since 2024.",
  "tags": ["eol-version", "security"],
  "upstream_evidence": "tektoncd/pipeline#1234 merged 2025-03-15",
  "suggested_comment": "Closing: pipelines-1.14 is EOL. If this affects a supported version, please file a new issue."
}
```

#### Recommendation Guidelines

| Recommendation | Score | Criteria |
|---|---|---|
| **CLOSE** | 0-20 | EOL version, confirmed fixed upstream, duplicate, obsolete |
| **REVIEW_TO_CLOSE** | 21-35 | Likely irrelevant but needs human confirmation |
| **NEEDS_TRIAGE** | 36-50 | Ambiguous, can't determine without more context |
| **KEEP** | 51-75 | Still relevant, valid bug/feature, ongoing work |
| **HIGH_PRIORITY** | 76-100 | Blocker, customer-facing, security, active work needed |

#### Checkpoint & Resume

Save analysis results incrementally to `/tmp/backlog-triage-{project}/analysis.json`. When resuming, skip already-analyzed issue keys.

### Phase 4: Generate Report

Run the report generator:

```bash
python3 "${SKILLS_REPO}/bin/gen-backlog-report.py" --config backlog-triage.toml
```

This produces a self-contained dark-themed HTML report with:
- Summary cards (counts per recommendation)
- Sticky filter bar (recommendation, search, component, confidence)
- Component sections sorted by cleanup potential
- Per-issue cards with key (linked to Jira), badges, LLM reason, upstream evidence, suggested comment, tags
- Auto-opens sections with CLOSE or HIGH_PRIORITY items

Open the report in the default browser:

```bash
# Cross-platform: works on Linux (xdg-open), macOS (open), and WSL
if command -v xdg-open &>/dev/null; then
    xdg-open /tmp/backlog-triage-{project}/report.html
elif command -v open &>/dev/null; then
    open /tmp/backlog-triage-{project}/report.html
else
    echo "Report ready: /tmp/backlog-triage-{project}/report.html"
fi
```

### Parallelization with Subagents

For large backlogs (1000+ issues), dispatch batches to parallel subagents:

1. Split unanalyzed issues into batches of ~100, grouped by component
2. Each subagent receives issues + access to git/gh tools
3. Each writes results to a separate temp file
4. Orchestrator merges results, deduplicates, saves checkpoint

Subagent task template:
```
You are analyzing Jira backlog issues for {project_name} ({jira_project}).
Upstream repos are in {repos_dir}/{repo}.

Current supported versions: {current_versions}. EOL: {eol_versions}.

For each issue, investigate using `git log --grep` and `gh pr/issue list` commands,
then classify. Write results as a JSON array to {output_file}.

Issues to analyze:
{issues_json}
```

</execution_context>

<examples>

**Full pipeline:**
```
User: "triage the SRVKP backlog"
→ Checks if backlog.json exists and is recent (runs fetch if not)
→ Updates upstream repos
→ Loads issues, investigates each against upstream
→ Writes analysis.json with per-issue reasoning
→ Generates interactive HTML report
→ Opens in browser
```

**Single component:**
```
User: "triage backlog for Pipelines as Code"
→ Filters to PaC component issues
→ Focuses investigation on tektoncd/pipelines-as-code
→ Produces component-specific analysis and report
```

**Close candidates only:**
```
User: "find backlog issues we can close"
→ Pre-filters to old issues, EOL versions, no-description
→ Investigates each against upstream
→ Produces close-focused report with suggested comments
```

</examples>
