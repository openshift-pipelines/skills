# Sprint Status Skill Design

## Overview

`/osp:sprint-status` is a sprint health dashboard skill for product owners managing multiple components across team sprints in the SRVKP Jira Cloud project. It provides velocity analysis, blocker tracking, carry-forward detection, roadmap alignment, and future sprint prioritization — rendered in a browser-based companion UI.

## Architecture: Skill + Companion HTML Template (Approach B)

Two files:
- `commands/osp/sprint-status.md` — skill definition (orchestration, data fetching, metric computation)
- `docs/templates/sprint-dashboard.html` — self-contained HTML/CSS/JS dashboard template

The skill fetches data via Jira Cloud REST API (curl + jq), computes all metrics in bash, assembles a JSON payload, injects it into the HTML template, writes to a temp file, and opens it in the browser. A terminal summary is also output for quick reference.

## Target Environment

- **Jira Cloud**: `https://redhat.atlassian.net`
- **Project**: SRVKP
- **Auth**: Basic auth (email + API token), stored in `~/.config/osp/config.json` under `jira_cloud`
- **Teams**: Identified by sprint name pattern `Pipelines Sprint {TeamName} {N}` (e.g., Pioneers, CrookShank)
- **Excluded sprints**: Release, Perf&Scale
- **Platform**: macOS (uses `open` for browser launch; Linux `xdg-open` fallback included)

## Invocation

```
/osp:sprint-status [team-name]
```

If `team-name` is omitted, the skill discovers all active team sprints and prompts the user to choose.

## Configuration

### Jira Cloud Auth

The config uses a new `jira_cloud` key alongside the existing `jira` key. Existing skills (`release-status`, `map-jira-to-upstream`, `release-checklist`) continue to read from the `jira` key with Bearer auth against `issues.redhat.com`. The `sprint-status` skill reads exclusively from `jira_cloud`.

```json
{
  "jira": {
    "base_url": "https://issues.redhat.com",
    "token": "existing-bearer-token"
  },
  "jira_cloud": {
    "base_url": "https://redhat.atlassian.net",
    "email": "user@redhat.com",
    "token": "ATATT3x..."
  }
}
```

Auth header for Jira Cloud: `Authorization: Basic $(echo -n "${EMAIL}:${TOKEN}" | base64)`

Token creation: https://id.atlassian.com/manage-profile/security/api-tokens

The `/osp:configure` skill is updated to add a Jira Cloud section. It verifies the credential via `GET /rest/api/3/myself` against `redhat.atlassian.net` with Basic auth. The existing Jira Server verification (Bearer auth against `issues.redhat.com`) remains unchanged.

### No Board ID Required

The skill discovers boards dynamically via `GET /rest/agile/1.0/board?projectKeyOrId=SRVKP&type=scrum` and finds the active sprint matching the team name.

## Data Fetching

### Step 1: Sprint Discovery

```
GET /rest/agile/1.0/board?projectKeyOrId=SRVKP&type=scrum
```

For each scrum board, get active sprints:

```
GET /rest/agile/1.0/board/{boardId}/sprint?state=active
```

Filter sprints by team name match in sprint name (case-insensitive). Skip sprints containing "Release" or "perf&scale".

### Step 2: Active Sprint Issues

```
GET /rest/agile/1.0/sprint/{sprintId}/issue?maxResults=100&startAt=0
```

Jira Cloud Agile API caps at `maxResults=100`. Paginate using `startAt` until `startAt >= total`. Fields requested:

| Field | ID | Purpose |
|---|---|---|
| summary | summary | Issue title |
| status | status | Workflow status |
| priority | priority | Issue priority |
| issuetype | issuetype | Bug, Story, Vulnerability, etc. |
| assignee | assignee | Who's working on it |
| components | components | Tekton Pipelines, UI, etc. |
| labels | labels | Additional categorization |
| created | created | Issue creation date |
| Story Points | customfield_10028 | Current story point estimate |
| Original Story Points | customfield_10977 | Original estimate before redo |
| Sprint | customfield_10020 | All sprints as objects (carry-forward count) |
| Blocked | customfield_10517 | Whether issue is blocked |
| Blocked Reason | customfield_10483 | Why it's blocked |
| Flagged | customfield_10021 | Impediment flag |
| parent | parent | Parent Epic link (roadmap alignment) |

**Note on Sprint field**: `customfield_10020` returns an array of sprint objects (`{id, name, state, ...}`), not strings. Extract `.name` from each and count only those matching the team pattern `Pipelines Sprint {TeamName} *` to get carry-forward count for this team.

**Note on comments**: Comments are NOT fetched in the bulk sprint issue query (to avoid payload bloat). Instead, comments are fetched individually only for carry-forward candidates (issues in 3+ sprints) via `GET /rest/api/3/issue/{issueKey}?fields=comment`. Extract the last element of `fields.comment.comments[]`.

**Note on story points**: Issues with null `customfield_10028` are treated as 0 SP for all aggregations. They are counted in issue counts but excluded from SP-based calculations (completion rate, velocity). The terminal summary flags the count of issues with no story points as "X issues have no story points — consider estimating."

### Step 3: Historical Sprints (Velocity Trend)

```
GET /rest/agile/1.0/board/{boardId}/sprint?state=closed&maxResults=50
```

Filter by team name, take last 5 closed sprints. For each, fetch issues and compute completed vs committed SPs.

**"Committed SPs" definition**: Total SPs of all issues in the sprint at query time (what `GET /sprint/{id}/issue` returns). This includes issues added mid-sprint. This is a pragmatic approximation — Jira Cloud does not expose a "committed at sprint start" snapshot via the Agile REST API without using the undocumented Greenhopper endpoint.

**Edge case**: If fewer than 5 closed sprints exist, use all available. If zero closed sprints exist (new team), skip the velocity trend section entirely and display "Insufficient data for velocity trend — need at least 1 closed sprint" in both the dashboard and terminal summary.

### Step 4: Future Sprint (Prioritization)

```
GET /rest/agile/1.0/board/{boardId}/sprint?state=future
```

Filter by team name. Fetch issues for prioritization recommendations.

**Edge case**: If no future sprint exists, omit the Future Sprint Prioritization section from the dashboard and note "No future sprint found" in the terminal summary.

### Step 5: Epic Progress (Roadmap Alignment)

For each unique parent Epic found in sprint issues, batch-query all children:

```
GET /rest/api/3/search?jql="Epic Link" in (EPIC-1, EPIC-2, ...) OR parent in (EPIC-1, EPIC-2, ...)&fields=status,customfield_10028,parent,customfield_10014
```

This uses a single batched JQL query instead of per-epic queries to minimize API calls. The query checks both `parent` (next-gen hierarchy) and `"Epic Link"` (classic) to handle whichever relationship model SRVKP uses.

Compute total SPs and completed SPs (status = Closed) across all Epic children.

### API Rate Limiting

Jira Cloud rate limits vary but are typically ~100 requests/minute for basic tier. The skill inserts a `sleep 0.1` (100ms) between API calls to avoid rate limiting. Total estimated API calls: ~15-25 (board discovery + sprint queries + paginated issue fetches + 1 epic batch query).

## Computed Metrics

### Sprint Summary (Aggregate)

- Total issues and SPs in sprint
- Breakdown by status: New, Planning, To Do, In Progress, Code Review, Dev Complete, On QA, Testing, Verified, Release Pending, Closed
- Blocked count and SPs (from `customfield_10517` or `customfield_10021`)

### Adjusted Velocity

- Raw velocity = SPs of Closed issues
- Code Review SPs excluded (incomplete work)
- Completion rate = completed SPs / committed SPs * 100

### Story Point Redo Recommendations

For each issue in Code Review status with non-null story points:
- Show current SP (`customfield_10028`) and original SP (`customfield_10977`)
- Suggest reduced SP for next sprint:
  - If current_sp <= 2: suggest 1
  - Otherwise: `ceil(current_sp * 0.5)`
- Flag if already re-estimated (current != original) with note "Already re-estimated from {original}"
- Issues in Code Review with null SP: flag as "No estimate — needs story points"

### Blocked Issues

- Filter by `customfield_10517` (Blocked) or `customfield_10021` (Flagged)
- Show blocked reason from `customfield_10483`
- Exact count and SP total for this sprint
- **Empty state**: If zero blocked issues, display "No blocked issues" in the dashboard section (section still visible as positive signal)

### High Priority Bug Closure Proximity

Filter: `issuetype = Bug` AND `priority in (Critical, Blocker, Major)`

Proximity scoring:
- Code Review / Dev Complete / On QA / Testing / Verified = near (green)
- In Progress = mid (yellow)
- To Do / New / Planning = far (red)
- Closed = done

**Empty state**: If no high priority bugs, display "No high priority bugs in this sprint."

### Carry-Forward Analysis

For each incomplete issue:
- Count sprint objects in `customfield_10020` where sprint name matches `Pipelines Sprint {TeamName} *` = number of sprints carried through for this team
- Sort by sprint count descending (worst offenders first)
- For issues with 3+ sprints: fetch latest comment as the "why" explanation
- Color coding:
  - 1-2 sprints = no highlight (normal)
  - 3-4 sprints = yellow (warning)
  - 5+ sprints = red (critical)

### Velocity Trend (Sprint-to-Sprint)

Over last 5 closed sprints (or fewer if not enough history):
- Committed SPs, completed SPs, carry-over SPs per sprint
- 3-sprint rolling average velocity (if >= 3 sprints available)
- 5-sprint rolling average velocity (if all 5 available)
- Velocity delta from previous sprint
- Commitment accuracy per sprint (completed / committed * 100)
- Trend direction: improving / declining / stable (based on last 3 sprints)

### Expectation Management Signals

- **Over-commitment**: current committed SPs > 3-sprint avg velocity
- **Under-commitment**: current committed SPs < 70% of avg velocity
- **Carry-forward rate trend**: % of SPs carried forward per sprint over last 5
- **Code Review bottleneck**: Code Review SPs > 30% of committed SPs

### Roadmap Alignment

- **Planned work**: issues with a parent Epic = roadmap work (count + SPs + %)
- **Unplanned work**: issues with no parent Epic (count + SPs + %)
- **CVE/Security**: Vulnerability issue type (counted separately regardless of Epic)
- **Epic progress**: for each linked Epic, show completed SPs vs total SPs
- **Alignment trend**: planned-work % across last 5 sprints (computed from historical sprint data)
- **Untracked warning**: flag count of issues with no Epic link

### Future Sprint Prioritization

Recommended priority order for future sprint issues:
1. Vulnerabilities (CVE) — any priority
2. Bugs — Blocker priority
3. Bugs — Critical priority
4. Bugs — Major priority
5. Stories/Features — by priority
6. Remaining — by priority

Output as a rank-ordered list (read-only, no Jira writes).

## Per-Component Breakdown

All metrics above are also computed per component (`components` field):
- Tekton Pipelines, Tekton Triggers, Tekton CLI, Tekton Results, Hub, PAC, UI, QA, Manual Approval Gate, OPC, etc.
- Issues with no component grouped as "Unassigned"

Aggregate summary at the top of the dashboard, per-component breakdown in collapsible sections below.

## Companion UI (sprint-dashboard.html)

### Technology

- Single self-contained HTML file
- Inline CSS and JS (no external dependencies, no charting libraries)
- CSS custom properties for dark/light theming
- Responsive layout

### Data Flow

1. Skill computes all metrics and builds JSON payload (auth credentials MUST NOT be included)
2. HTML template read from skill install directory
3. JSON injected into HTML via `<script>const DATA = {...}</script>`, written to temp file
4. Temp file created via `mktemp` with `chmod 600` permissions
5. Browser opened: `open` (macOS) or `xdg-open` (Linux)

The temp file path: `/tmp/sprint-dashboard-{team}-{timestamp}.html`

### JSON Payload Schema

```json
{
  "meta": {
    "team": "Pioneers",
    "sprint": { "id": 47963, "name": "Pipelines Sprint Pioneers 51", "startDate": "...", "endDate": "..." },
    "generatedAt": "2026-03-23T15:00:00Z",
    "jiraBaseUrl": "https://redhat.atlassian.net"
  },
  "summary": {
    "totalIssues": 24,
    "totalSPs": 65,
    "byStatus": { "Closed": { "count": 12, "sp": 30 }, "Code Review": { "count": 5, "sp": 16 }, "..." : {} },
    "blocked": { "count": 3, "sp": 8 },
    "noStoryPoints": 4
  },
  "velocity": {
    "current": { "committed": 65, "completed": 30 },
    "history": [
      { "sprint": "Pioneers 47", "committed": 50, "completed": 38, "carried": 12 },
      "..."
    ],
    "avg3": 41,
    "avg5": 39,
    "trend": "stable",
    "commitmentAccuracy": [ 76, 81, 73, 90, 46 ]
  },
  "expectations": {
    "overCommitted": { "flag": true, "committed": 65, "avgVelocity": 41, "delta": 24 },
    "underCommitted": { "flag": false },
    "carryForwardRate": [ 15, 18, 22, 10, 28 ],
    "codeReviewBottleneck": { "flag": true, "percent": 25 }
  },
  "roadmap": {
    "planned": { "count": 17, "sp": 47, "percent": 72 },
    "unplanned": { "count": 5, "sp": 12, "percent": 18 },
    "cve": { "count": 2, "sp": 6, "percent": 10 },
    "epics": [
      { "key": "SRVKP-XXX", "summary": "Multi-cluster support", "completedSP": 12, "totalSP": 20 },
      "..."
    ],
    "alignmentTrend": [ 80, 65, 71, 72 ],
    "untrackedCount": 4
  },
  "codeReview": [
    { "key": "SRVKP-10871", "summary": "...", "currentSP": 5, "originalSP": 3, "suggestedSP": 3, "assignee": "Aditya Shinde", "alreadyReestimated": true },
    "..."
  ],
  "blocked": [
    { "key": "SRVKP-XXXX", "summary": "...", "priority": "Critical", "reason": "Waiting on upstream merge", "assignee": "..." },
    "..."
  ],
  "highPriorityBugs": [
    { "key": "SRVKP-1801", "summary": "...", "priority": "Critical", "status": "Code Review", "proximity": "near" },
    "..."
  ],
  "carryForward": [
    { "key": "SRVKP-1801", "summary": "...", "sprintCount": 7, "status": "Code Review", "latestComment": "Draft PR upstream", "severity": "critical" },
    "..."
  ],
  "futureSprint": {
    "name": "Pipelines Sprint Pioneers 52",
    "issues": [
      { "rank": 1, "key": "SRVKP-XXXX", "summary": "...", "type": "Vulnerability", "priority": "Critical" },
      "..."
    ]
  },
  "components": {
    "Tekton Pipelines": {
      "totalIssues": 8, "totalSP": 22,
      "byStatus": { "..." : {} },
      "blocked": [],
      "carryForward": [],
      "highPriorityBugs": []
    },
    "...": {}
  }
}
```

### Dashboard Layout (top to bottom)

1. **Header**: Sprint name, team, start/end dates
2. **Summary Cards**: Total issues/SPs, Completed, Code Review, Blocked (color-coded)
3. **Expectation Alerts**: Over/under-commitment warnings, bottleneck flags
4. **Roadmap Alignment**: Planned vs unplanned bar, Epic progress list, alignment trend, untracked warnings
5. **Velocity Trend**: Horizontal bar chart (5 sprints), bars split by completed/carried/dropped, 3-sprint rolling avg line, commitment accuracy %
6. **Code Review SP Redo**: Table of Code Review issues with current/original/suggested SPs
7. **Blocked Issues**: Table with issue key, priority, blocked reason
8. **High Priority Bugs**: Table with closure proximity indicators (colored dots)
9. **Carry-Forward Worst Offenders**: Table sorted by sprint count, with latest comment
10. **Future Sprint Priority**: Rank-ordered recommendation list
11. **Per-Component Breakdown**: Collapsible sections, each containing status breakdown, blocked, carry-forwards, bugs

### Empty States

Each dashboard section handles missing data gracefully:
- **Velocity Trend**: "Insufficient data" message if < 1 closed sprint
- **Blocked Issues**: "No blocked issues" (positive signal, section remains visible)
- **High Priority Bugs**: "No high priority bugs in this sprint"
- **Future Sprint**: Section omitted if no future sprint exists
- **Carry-Forward**: "No carry-forward issues" if all issues are in their first sprint

### Interactivity

- Issue keys are clickable links to `https://redhat.atlassian.net/browse/{key}`
- Component sections are collapsible (expand/collapse)
- No other interactivity (read-only dashboard)

## Skill Process Steps

```yaml
---
name: sprint-status
description: Sprint health dashboard — velocity, blockers, carry-forwards, roadmap alignment, future sprint prioritization
allowed-tools:
  - Read
  - Write
  - Bash
  - WebFetch
  - AskUserQuestion
  - Glob
  - Grep
---
```

1. **Auth check**: Verify `jira_cloud.email` and `jira_cloud.token` in `~/.config/osp/config.json`. If missing, guide to `/osp:configure`.
2. **Team resolution**: If team name provided as arg, use it. Otherwise, discover all active team sprints and prompt via `AskUserQuestion`.
3. **Sprint discovery**: Query scrum boards for SRVKP, find active sprint matching team name in sprint name pattern. Skip sprints containing "Release" or "perf&scale".
4. **Data fetch**: Get all sprint issues with required fields. Paginate with `maxResults=100`. Insert `sleep 0.1` between API calls.
5. **Historical fetch**: Get last 5 closed sprints for the team, fetch their issues for velocity trend.
6. **Future sprint fetch**: Get future sprint issues for prioritization. Skip if none found.
7. **Epic fetch**: Batch-query all children of linked Epics in a single JQL query for roadmap alignment.
8. **Comment fetch**: For carry-forward candidates (3+ sprints), fetch latest comment individually.
9. **Compute metrics**: All analysis from the Computed Metrics section. Treat null SPs as 0.
10. **Build JSON payload**: Assemble everything into the structured JSON schema defined above. Never include auth credentials.
11. **Render dashboard**: Read HTML template, inject JSON, write to temp file with `chmod 600`, open in browser.
12. **Terminal summary**: Output key findings — sprint health score, top 3 action items, critical alerts.

## Changes to Existing Files

### commands/osp/configure.md

- Add Jira Cloud auth section (email + API token via Basic auth)
- Verify credential via `GET /rest/api/3/myself` against `redhat.atlassian.net` with Basic auth
- Store in `jira_cloud` key in config.json (separate from existing `jira` key)
- Token creation link: `https://id.atlassian.com/manage-profile/security/api-tokens`
- Existing Jira Server auth (`jira` key, Bearer token, `issues.redhat.com`) remains unchanged for backward compatibility with other skills

### bin/install.js

- Update to also copy `docs/templates/` to `~/.claude/templates/osp/` (sibling to `~/.claude/commands/osp/`)
- The skill locates the template at runtime via `~/.claude/templates/osp/sprint-dashboard.html`

### .env.example

- Add `JIRA_CLOUD_TOKEN` and `JIRA_CLOUD_EMAIL` variables with Jira Cloud reference
- Keep existing `JIRA_TOKEN` for backward compatibility

## Jira Cloud API Reference

- Base: `https://redhat.atlassian.net`
- Agile API: `/rest/agile/1.0/` (boards, sprints, sprint issues)
- Platform API: `/rest/api/3/` (issue details, search, changelog, fields)
- Auth: Basic auth with `email:api_token` base64 encoded
- Pagination: `startAt` + `maxResults` parameters, check `total` in response
- Rate limits: ~100 requests/minute; skill uses 100ms delay between calls

## Workflow Statuses (SRVKP)

New, Planning, To Do, In Progress, Code Review, Dev Complete, On QA, Testing, Verified, Release Pending, Closed

## Issue Types (SRVKP)

Feature, Epic, Story, Bug, Task, Sub-task, Outcome, Vulnerability, Weakness, Service Request, Spike

## Key Custom Fields

| Field Name | Field ID | Usage |
|---|---|---|
| Story Points | customfield_10028 | Current SP estimate |
| Original story points | customfield_10977 | Pre-redo estimate |
| Sprint | customfield_10020 | Array of sprint objects (carry-forward count) |
| Blocked | customfield_10517 | Blocked flag |
| Blocked Reason | customfield_10483 | Why blocked |
| Flagged | customfield_10021 | Impediment flag |
| sprint_count | customfield_10975 | Sprint count (exists but not populated — skill computes from Sprint field) |
| Release Blocker | customfield_10847 | Release blocker flag |

## Success Criteria

- [ ] Skill authenticates with Jira Cloud and discovers team sprints without hardcoded board ID
- [ ] All active sprint issues fetched with correct fields, paginated correctly
- [ ] Velocity trend computed over last 5 closed sprints with commitment accuracy
- [ ] Expectation management signals surfaced (over/under-commitment, bottleneck)
- [ ] Roadmap alignment computed (planned vs unplanned %, Epic progress)
- [ ] Code Review issues flagged with SP redo suggestions
- [ ] Blocked issues listed with reasons
- [ ] High priority bugs shown with closure proximity
- [ ] Carry-forward worst offenders listed with sprint count and latest comment
- [ ] Future sprint issues ranked by priority (Vulnerabilities > Bugs > Stories)
- [ ] Per-component breakdown available for all metrics
- [ ] Companion UI renders in browser with all sections and empty states
- [ ] Terminal summary outputs key findings
- [ ] Issue keys link to Jira Cloud
- [ ] Null story points handled gracefully (treated as 0, flagged)
- [ ] Existing skills unaffected (jira key preserved for backward compatibility)
- [ ] Temp files secured (chmod 600, no credentials in payload)
