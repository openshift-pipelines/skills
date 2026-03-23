---
name: sprint-status
description: Sprint health dashboard — velocity, blockers, carry-forwards, roadmap alignment, future sprint prioritization
allowed-tools:
  - Bash
  - Read
  - Write
  - WebFetch
  - AskUserQuestion
  - Glob
  - Grep
---

# Sprint Status Dashboard

<objective>
Generate a comprehensive sprint health dashboard for product owners managing SRVKP team sprints. Fetches Jira Cloud data, computes velocity trends, identifies blockers and carry-forwards, assesses roadmap alignment and DoD compliance, and renders an interactive browser-based dashboard with per-assignee and per-component breakdowns.
</objective>

<execution_context>
**Jira Cloud API:**
- Base URL: `https://redhat.atlassian.net`
- Auth: Basic auth with `email:api_token` base64 encoded
- Agile API: `/rest/agile/1.0/` (boards, sprints, sprint issues)
- Platform API: `/rest/api/3/` (issue details, search, comments)
- Pagination: `maxResults=100` (Jira Cloud Agile API limit), use `startAt` for pagination
- Rate limiting: Insert `sleep 0.1` between API calls

**Project Configuration:**
- Project key: `SRVKP`
- Team identification: Sprint name pattern `Pipelines Sprint {TeamName} {N}` (e.g., Pioneers, CrookShank)
- Excluded sprints: Containing "Release" or "perf&scale"
- Board discovery: Query all scrum boards for SRVKP dynamically (no hardcoded board ID)

**Custom Field IDs:**
| Field Name | Field ID | Usage |
|---|---|---|
| Story Points | customfield_10028 | Current SP estimate |
| Original Story Points | customfield_10977 | Pre-redo estimate |
| Sprint | customfield_10020 | Array of sprint objects (for carry-forward count) |
| Blocked | customfield_10517 | Blocked flag |
| Blocked Reason | customfield_10483 | Why blocked |
| Flagged | customfield_10021 | Impediment flag |

**Workflow Statuses:**
New, Planning, To Do, In Progress, Code Review, Dev Complete, On QA, Testing, Verified, Release Pending, Closed

**Issue Types:**
Feature, Epic, Story, Bug, Task, Sub-task, Outcome, Vulnerability (id: 10172), Weakness, Service Request, Spike

**DoD Compliance Labels:**
- Pending: `docs-pending`, `release-notes-pending`, `tests-pending`
- Required: `doc-req`, `release-notes-req`, `test-req`
- Violations: `missing-docs`, `groomable`

**Template Path:**
Primary: `~/.claude/templates/osp/sprint-dashboard.html`
Fallback: `./docs/templates/sprint-dashboard.html`

**Authentication:**
- Config file: `~/.config/osp/config.json` under `jira_cloud` key
- Env vars: `JIRA_CLOUD_EMAIL` and `JIRA_CLOUD_TOKEN`
- Format: `{ "jira_cloud": { "email": "user@redhat.com", "token": "ATATT3x..." } }`
</execution_context>

<process>
<step name="auth_check">
**MANDATORY FIRST STEP**: Verify Jira Cloud authentication is configured.

```bash
# Check config file first
CONFIG_FILE="$HOME/.config/osp/config.json"
if [ -f "$CONFIG_FILE" ]; then
  JIRA_EMAIL=$(jq -r '.jira_cloud.email // empty' "$CONFIG_FILE")
  JIRA_TOKEN=$(jq -r '.jira_cloud.token // empty' "$CONFIG_FILE")
fi

# Fallback to environment variables
JIRA_EMAIL="${JIRA_EMAIL:-$JIRA_CLOUD_EMAIL}"
JIRA_TOKEN="${JIRA_TOKEN:-$JIRA_CLOUD_TOKEN}"

if [ -z "$JIRA_EMAIL" ] || [ -z "$JIRA_TOKEN" ]; then
  echo "ERROR: Jira Cloud credentials not configured."
  echo "Please run /osp:configure to set up Jira Cloud authentication."
  exit 1
fi

# Build Basic auth header
AUTH_HEADER="Authorization: Basic $(echo -n "${JIRA_EMAIL}:${JIRA_TOKEN}" | base64)"

# Verify credentials
VERIFY_RESPONSE=$(curl -s -w "\n%{http_code}" -H "$AUTH_HEADER" \
  "https://redhat.atlassian.net/rest/api/3/myself")

HTTP_CODE=$(echo "$VERIFY_RESPONSE" | tail -1)
if [ "$HTTP_CODE" != "200" ]; then
  echo "ERROR: Jira Cloud authentication failed (HTTP $HTTP_CODE)."
  echo "Please run /osp:configure to update your credentials."
  exit 1
fi

echo "Jira Cloud authentication verified."
```

If authentication fails, direct user to `/osp:configure`.
</step>

<step name="team_resolution">
Discover team sprints and resolve team name (from argument or prompt user).

```bash
# Query all scrum boards for SRVKP
BOARDS_RESPONSE=$(curl -s -H "$AUTH_HEADER" \
  "https://redhat.atlassian.net/rest/agile/1.0/board?projectKeyOrId=SRVKP&type=scrum")

echo "$BOARDS_RESPONSE" | jq '.values[] | {id: .id, name: .name}' > /tmp/srvkp_boards.json

# For each board, get active sprints
ACTIVE_SPRINTS="[]"
for BOARD_ID in $(echo "$BOARDS_RESPONSE" | jq -r '.values[].id'); do
  sleep 0.1  # Rate limiting

  SPRINTS_RESPONSE=$(curl -s -H "$AUTH_HEADER" \
    "https://redhat.atlassian.net/rest/agile/1.0/board/${BOARD_ID}/sprint?state=active")

  # Filter by team name pattern, exclude Release/perf&scale
  TEAM_SPRINTS=$(echo "$SPRINTS_RESPONSE" | jq --arg bid "$BOARD_ID" '
    .values[] |
    select(.name | test("Pipelines Sprint \\w+ \\d+")) |
    select(.name | test("Release|perf&scale") | not) |
    . + {boardId: ($bid | tonumber)}
  ')

  ACTIVE_SPRINTS=$(echo "$ACTIVE_SPRINTS" "$TEAM_SPRINTS" | jq -s '.[0] + [.[1]]')
done

# Extract unique team names
TEAMS=$(echo "$ACTIVE_SPRINTS" | jq -r '.[].name' | grep -oE 'Pipelines Sprint \w+' | sed 's/Pipelines Sprint //' | sort -u)

# If team name provided as arg, use it; otherwise prompt
if [ -z "$TEAM_NAME" ]; then
  # Use AskUserQuestion to select team
  echo "Available teams with active sprints:"
  echo "$TEAMS" | nl
  # Prompt user for team selection
fi

# Match to sprint ID, name, dates, board ID
SPRINT_INFO=$(echo "$ACTIVE_SPRINTS" | jq --arg team "$TEAM_NAME" '
  .[] | select(.name | contains($team)) |
  {id: .id, name: .name, startDate: .startDate, endDate: .endDate, boardId: .boardId}
' | head -1)

SPRINT_ID=$(echo "$SPRINT_INFO" | jq -r '.id')
SPRINT_NAME=$(echo "$SPRINT_INFO" | jq -r '.name')
BOARD_ID=$(echo "$SPRINT_INFO" | jq -r '.boardId')

echo "Selected sprint: $SPRINT_NAME (ID: $SPRINT_ID, Board: $BOARD_ID)"
```

If no team name provided, use AskUserQuestion to prompt from available teams.
</step>

<step name="fetch_active_sprint_issues">
Fetch all issues in the active sprint with pagination.

```bash
# Paginate through all sprint issues (maxResults=100 limit)
ALL_ISSUES="[]"
START_AT=0
MAX_RESULTS=100
TOTAL=1

while [ $START_AT -lt $TOTAL ]; do
  sleep 0.1  # Rate limiting

  RESPONSE=$(curl -s -H "$AUTH_HEADER" \
    "https://redhat.atlassian.net/rest/agile/1.0/sprint/${SPRINT_ID}/issue?maxResults=${MAX_RESULTS}&startAt=${START_AT}&fields=summary,status,priority,issuetype,assignee,components,labels,created,parent,customfield_10028,customfield_10977,customfield_10020,customfield_10517,customfield_10483,customfield_10021")

  TOTAL=$(echo "$RESPONSE" | jq '.total')
  FETCHED=$(echo "$RESPONSE" | jq '.issues | length')
  ALL_ISSUES=$(echo "$ALL_ISSUES" "$RESPONSE" | jq -s '.[0] + (.[1].issues // [])')

  START_AT=$((START_AT + FETCHED))

  if [ $TOTAL -gt $MAX_RESULTS ]; then
    echo "Fetched $START_AT of $TOTAL issues..." >&2
  fi
done

echo "$ALL_ISSUES" > /tmp/sprint_issues.json
echo "Total issues fetched: $(echo "$ALL_ISSUES" | jq 'length')" >&2
```

Fields extracted:
- summary, status, priority, issuetype, assignee, components, labels, created
- parent (Epic link for roadmap alignment)
- customfield_10028 (Story Points), customfield_10977 (Original Story Points)
- customfield_10020 (Sprint array for carry-forward count)
- customfield_10517 (Blocked), customfield_10483 (Blocked Reason), customfield_10021 (Flagged)
</step>

<step name="fetch_historical_sprints">
Fetch last 5 closed sprints for velocity trend analysis.

```bash
# Get closed sprints from board
CLOSED_SPRINTS_RESPONSE=$(curl -s -H "$AUTH_HEADER" \
  "https://redhat.atlassian.net/rest/agile/1.0/board/${BOARD_ID}/sprint?state=closed&maxResults=50")

# Filter by team name, take last 5
TEAM_CLOSED_SPRINTS=$(echo "$CLOSED_SPRINTS_RESPONSE" | jq --arg team "$TEAM_NAME" '
  [.values[] | select(.name | contains($team))] | sort_by(.endDate) | reverse | .[0:5]
')

HISTORICAL_DATA="[]"

for HIST_SPRINT_ID in $(echo "$TEAM_CLOSED_SPRINTS" | jq -r '.[].id'); do
  sleep 0.1  # Rate limiting

  # Fetch issues for historical sprint
  HIST_ISSUES_RESPONSE=$(curl -s -H "$AUTH_HEADER" \
    "https://redhat.atlassian.net/rest/agile/1.0/sprint/${HIST_SPRINT_ID}/issue?maxResults=100&fields=status,customfield_10028,customfield_10020,parent")

  HIST_ISSUES=$(echo "$HIST_ISSUES_RESPONSE" | jq '.issues')

  # Compute committed/completed SPs
  SPRINT_NAME=$(echo "$TEAM_CLOSED_SPRINTS" | jq -r --arg id "$HIST_SPRINT_ID" '.[] | select(.id == ($id | tonumber)) | .name')

  COMMITTED_SP=$(echo "$HIST_ISSUES" | jq '[.[] | .fields.customfield_10028 // 0] | add')
  COMPLETED_SP=$(echo "$HIST_ISSUES" | jq '[.[] | select(.fields.status.name | test("Closed|Verified|Release Pending")) | .fields.customfield_10028 // 0] | add')

  # Count carried forward (issues with multiple sprints in customfield_10020 matching team pattern)
  CARRIED_SP=$(echo "$HIST_ISSUES" | jq --arg team "$TEAM_NAME" '[
    .[] |
    select(.fields.status.name | test("Closed|Verified|Release Pending") | not) |
    select(.fields.customfield_10020 // [] | map(.name) | map(select(. | test("Pipelines Sprint " + $team))) | length > 1) |
    .fields.customfield_10028 // 0
  ] | add // 0')

  HIST_ENTRY=$(jq -n --arg name "$SPRINT_NAME" --argjson comm "$COMMITTED_SP" --argjson comp "$COMPLETED_SP" --argjson carr "$CARRIED_SP" '{
    sprint: $name, committed: $comm, completed: $comp, carried: $carr
  }')

  HISTORICAL_DATA=$(echo "$HISTORICAL_DATA" "$HIST_ENTRY" | jq -s '.[0] + [.[1]]')
done

# Skip if zero committed SPs (no meaningful data)
HISTORICAL_DATA=$(echo "$HISTORICAL_DATA" | jq '[.[] | select(.committed > 0)]')

echo "$HISTORICAL_DATA" > /tmp/historical_sprints.json
echo "Historical sprints fetched: $(echo "$HISTORICAL_DATA" | jq 'length')" >&2
```

If fewer than 5 closed sprints exist, use all available. If zero exist, skip velocity trend section.
</step>

<step name="fetch_future_sprint">
Fetch future sprint issues for prioritization recommendations.

```bash
# Get future sprints from board
FUTURE_SPRINTS_RESPONSE=$(curl -s -H "$AUTH_HEADER" \
  "https://redhat.atlassian.net/rest/agile/1.0/board/${BOARD_ID}/sprint?state=future")

# Filter by team name, exclude "Ranked Issues"
TEAM_FUTURE_SPRINT=$(echo "$FUTURE_SPRINTS_RESPONSE" | jq --arg team "$TEAM_NAME" '
  .values[] |
  select(.name | contains($team)) |
  select(.name | contains("Ranked Issues") | not)
' | head -1)

FUTURE_SPRINT_ID=$(echo "$TEAM_FUTURE_SPRINT" | jq -r '.id // empty')

if [ -n "$FUTURE_SPRINT_ID" ]; then
  sleep 0.1  # Rate limiting

  FUTURE_ISSUES_RESPONSE=$(curl -s -H "$AUTH_HEADER" \
    "https://redhat.atlassian.net/rest/agile/1.0/sprint/${FUTURE_SPRINT_ID}/issue?maxResults=100&fields=summary,priority,issuetype,customfield_10028")

  echo "$FUTURE_ISSUES_RESPONSE" | jq '.issues' > /tmp/future_sprint_issues.json

  FUTURE_SPRINT_NAME=$(echo "$TEAM_FUTURE_SPRINT" | jq -r '.name')
  echo "Future sprint: $FUTURE_SPRINT_NAME" >&2
else
  echo "[]" > /tmp/future_sprint_issues.json
  echo "No future sprint found" >&2
fi
```

If no future sprint exists, omit Future Sprint Prioritization section from dashboard.
</step>

<step name="fetch_epic_progress">
Batch-query all children of linked Epics for roadmap alignment.

```bash
# Extract unique parent Epic keys from sprint issues
EPIC_KEYS=$(jq -r '[.[].fields.parent.key // empty] | unique | join(",")' /tmp/sprint_issues.json)

if [ -n "$EPIC_KEYS" ]; then
  sleep 0.1  # Rate limiting

  # Batch JQL query: check both parent and Epic Link (classic)
  JQL="parent in (${EPIC_KEYS}) OR \"Epic Link\" in (${EPIC_KEYS})"
  ENCODED_JQL=$(echo "$JQL" | jq -sRr @uri)

  EPIC_CHILDREN_RESPONSE=$(curl -s -H "$AUTH_HEADER" \
    "https://redhat.atlassian.net/rest/api/3/search?jql=${ENCODED_JQL}&maxResults=500&fields=status,customfield_10028,parent")

  EPIC_CHILDREN=$(echo "$EPIC_CHILDREN_RESPONSE" | jq '.issues')

  # Compute total/completed SPs per Epic
  EPIC_PROGRESS=$(echo "$EPIC_CHILDREN" | jq --argjson epics "$(jq '[.[].fields.parent] | unique_by(.key)' /tmp/sprint_issues.json)" '[
    $epics[] |
    . as $epic |
    {
      key: $epic.key,
      summary: $epic.fields.summary,
      totalSP: ([$EPIC_CHILDREN[] | select(.fields.parent.key == $epic.key) | .fields.customfield_10028 // 0] | add // 0),
      completedSP: ([$EPIC_CHILDREN[] | select(.fields.parent.key == $epic.key) | select(.fields.status.name == "Closed") | .fields.customfield_10028 // 0] | add // 0)
    }
  ]')

  echo "$EPIC_PROGRESS" > /tmp/epic_progress.json
else
  echo "[]" > /tmp/epic_progress.json
  echo "No Epics linked" >&2
fi
```

Uses single batched JQL query instead of per-epic queries to minimize API calls.
</step>

<step name="fetch_carry_forward_comments">
For issues with 3+ team sprints, fetch latest comment individually.

```bash
# Identify carry-forward candidates (3+ sprints matching team pattern)
CARRY_FORWARD_KEYS=$(jq -r --arg team "$TEAM_NAME" '
  [.[] |
   select(.fields.status.name | test("Closed|Verified|Release Pending") | not) |
   select((.fields.customfield_10020 // [] | map(.name) | map(select(. | test("Pipelines Sprint " + $team))) | length) >= 3) |
   .key
  ] | .[]
' /tmp/sprint_issues.json)

# Fetch latest comment for each
for ISSUE_KEY in $CARRY_FORWARD_KEYS; do
  sleep 0.1  # Rate limiting

  COMMENT_RESPONSE=$(curl -s -H "$AUTH_HEADER" \
    "https://redhat.atlassian.net/rest/api/3/issue/${ISSUE_KEY}?fields=comment")

  LATEST_COMMENT=$(echo "$COMMENT_RESPONSE" | jq -r '.fields.comment.comments[-1].body // "No comment"')

  echo "$ISSUE_KEY|$LATEST_COMMENT" >> /tmp/carry_forward_comments.txt
done
```

Comments fetched individually only for carry-forward candidates to avoid payload bloat in bulk query.
</step>

<step name="compute_metrics">
Compute all 13 metrics using jq from fetched data.

```bash
# Load all data
SPRINT_ISSUES=$(cat /tmp/sprint_issues.json)
HISTORICAL=$(cat /tmp/historical_sprints.json)
FUTURE_ISSUES=$(cat /tmp/future_sprint_issues.json)
EPIC_PROGRESS=$(cat /tmp/epic_progress.json)

# 1. Sprint Summary
SUMMARY=$(echo "$SPRINT_ISSUES" | jq '{
  totalIssues: length,
  totalSPs: ([.[].fields.customfield_10028 // 0] | add),
  byStatus: (group_by(.fields.status.name) | map({
    (.[0].fields.status.name): {count: length, sp: ([.[].fields.customfield_10028 // 0] | add)}
  }) | add),
  blocked: {
    count: ([.[] | select(.fields.customfield_10517 == true or (.fields.customfield_10021 // [] | length > 0))] | length),
    sp: ([.[] | select(.fields.customfield_10517 == true or (.fields.customfield_10021 // [] | length > 0)) | .fields.customfield_10028 // 0] | add)
  },
  noStoryPoints: ([.[] | select(.fields.customfield_10028 == null)] | length)
}')

# 2. Adjusted Velocity
VELOCITY=$(echo "$SPRINT_ISSUES" | jq '{
  current: {
    committed: ([.[].fields.customfield_10028 // 0] | add),
    completed: ([.[] | select(.fields.status.name | test("Closed")) | .fields.customfield_10028 // 0] | add)
  }
}')

# 3. Code Review SP Redo
CODE_REVIEW_REDO=$(echo "$SPRINT_ISSUES" | jq '[
  .[] |
  select(.fields.status.name == "Code Review") |
  {
    key: .key,
    summary: .fields.summary,
    currentSP: .fields.customfield_10028,
    originalSP: .fields.customfield_10977,
    suggestedSP: (if (.fields.customfield_10028 // 0) <= 2 then 1 else ((.fields.customfield_10028 * 0.5) | ceil) end),
    assignee: (.fields.assignee.displayName // "Unassigned"),
    alreadyReestimated: (.fields.customfield_10028 != .fields.customfield_10977)
  }
]')

# 4. Blocked Issues
BLOCKED=$(echo "$SPRINT_ISSUES" | jq '[
  .[] |
  select(.fields.customfield_10517 == true or (.fields.customfield_10021 // [] | length > 0)) |
  {
    key: .key,
    summary: .fields.summary,
    priority: .fields.priority.name,
    reason: (.fields.customfield_10483 // "No reason provided"),
    assignee: (.fields.assignee.displayName // "Unassigned")
  }
]')

# 5. High Priority Bugs
HIGH_PRIORITY_BUGS=$(echo "$SPRINT_ISSUES" | jq '[
  .[] |
  select(.fields.issuetype.name == "Bug") |
  select(.fields.priority.name | test("Critical|Blocker|Major")) |
  {
    key: .key,
    summary: .fields.summary,
    priority: .fields.priority.name,
    status: .fields.status.name,
    proximity: (
      if (.fields.status.name | test("Code Review|Dev Complete|On QA|Testing|Verified")) then "near"
      elif (.fields.status.name == "In Progress") then "mid"
      elif (.fields.status.name | test("To Do|New|Planning")) then "far"
      elif (.fields.status.name == "Closed") then "done"
      else "unknown"
      end
    )
  }
]')

# 6. Carry-Forward Analysis
CARRY_FORWARD=$(echo "$SPRINT_ISSUES" | jq --arg team "$TEAM_NAME" '[
  .[] |
  select(.fields.status.name | test("Closed|Verified|Release Pending") | not) |
  . + {sprintCount: ((.fields.customfield_10020 // [] | map(.name) | map(select(. | test("Pipelines Sprint " + $team))) | length))} |
  select(.sprintCount > 0) |
  {
    key: .key,
    summary: .fields.summary,
    sprintCount: .sprintCount,
    status: .fields.status.name,
    severity: (
      if .sprintCount >= 5 then "critical"
      elif .sprintCount >= 3 then "warning"
      else "normal"
      end
    ),
    latestComment: ""  # Will be populated from comments file
  }
] | sort_by(.sprintCount) | reverse')

# Merge comments into carry-forward data
if [ -f /tmp/carry_forward_comments.txt ]; then
  while IFS='|' read -r key comment; do
    CARRY_FORWARD=$(echo "$CARRY_FORWARD" | jq --arg k "$key" --arg c "$comment" '
      map(if .key == $k then . + {latestComment: $c} else . end)
    ')
  done < /tmp/carry_forward_comments.txt
fi

# 7. Velocity Trend
VELOCITY_EXTENDED=$(echo "$HISTORICAL" "$VELOCITY" | jq -s '
  {
    current: .[1].current,
    history: .[0],
    avg3: (if (.[0] | length) >= 3 then ([.[0][-3:] | .[].completed] | add / 3) else null end),
    avg5: (if (.[0] | length) >= 5 then ([.[0] | .[].completed] | add / 5) else null end),
    trend: (
      if (.[0] | length) >= 3 then
        (if ([.[0][-3:] | .[].completed] | add / 3) > ([.[0][-2:] | .[].completed] | add / 2) then "improving"
         elif ([.[0][-3:] | .[].completed] | add / 3) < ([.[0][-2:] | .[].completed] | add / 2) then "declining"
         else "stable" end)
      else "insufficient_data"
      end
    ),
    commitmentAccuracy: [.[0][] | if .committed > 0 then ((.completed / .committed) * 100 | round) else 0 end]
  }
')

# 8. Expectation Management
EXPECTATIONS=$(echo "$VELOCITY_EXTENDED" | jq '
  {
    overCommitted: {
      flag: (if .avg3 != null and .current.committed > .avg3 then true else false end),
      committed: .current.committed,
      avgVelocity: .avg3,
      delta: (if .avg3 != null then (.current.committed - .avg3) else 0 end)
    },
    underCommitted: {
      flag: (if .avg3 != null and .current.committed < (.avg3 * 0.7) then true else false end)
    },
    carryForwardRate: ([.history[] | if .committed > 0 then ((.carried / .committed) * 100 | round) else 0 end]),
    codeReviewBottleneck: {
      flag: false,  # Will compute separately
      percent: 0
    }
  }
')

# Compute Code Review bottleneck
CR_SP=$(echo "$SPRINT_ISSUES" | jq '[.[] | select(.fields.status.name == "Code Review") | .fields.customfield_10028 // 0] | add // 0')
TOTAL_SP=$(echo "$SUMMARY" | jq '.totalSPs')
CR_PERCENT=$(echo "$CR_SP $TOTAL_SP" | awk '{if ($2 > 0) print ($1 / $2) * 100; else print 0}')
EXPECTATIONS=$(echo "$EXPECTATIONS" | jq --argjson crp "$CR_PERCENT" '
  .codeReviewBottleneck = {flag: ($crp > 30), percent: ($crp | round)}
')

# 9. Roadmap Alignment
ROADMAP=$(echo "$SPRINT_ISSUES" | jq --argjson epics "$EPIC_PROGRESS" '
  {
    planned: {
      count: ([.[] | select(.fields.parent != null)] | length),
      sp: ([.[] | select(.fields.parent != null) | .fields.customfield_10028 // 0] | add),
      percent: (if length > 0 then (([.[] | select(.fields.parent != null)] | length) / length * 100 | round) else 0 end)
    },
    unplanned: {
      count: ([.[] | select(.fields.parent == null) | select(.fields.issuetype.name != "Vulnerability")] | length),
      sp: ([.[] | select(.fields.parent == null) | select(.fields.issuetype.name != "Vulnerability") | .fields.customfield_10028 // 0] | add),
      percent: (if length > 0 then (([.[] | select(.fields.parent == null) | select(.fields.issuetype.name != "Vulnerability")] | length) / length * 100 | round) else 0 end)
    },
    cve: {
      count: ([.[] | select(.fields.issuetype.name == "Vulnerability")] | length),
      sp: ([.[] | select(.fields.issuetype.name == "Vulnerability") | .fields.customfield_10028 // 0] | add),
      percent: (if length > 0 then (([.[] | select(.fields.issuetype.name == "Vulnerability")] | length) / length * 100 | round) else 0 end)
    },
    epics: $epics,
    alignmentTrend: [],  # Would need historical epic data
    untrackedCount: ([.[] | select(.fields.parent == null)] | length)
  }
')

# 10. DoD Compliance
DOD=$(echo "$SPRINT_ISSUES" | jq '[
  .[] |
  {
    key: .key,
    summary: .fields.summary,
    status: .fields.status.name,
    labels: .fields.labels,
    score: (
      if (.fields.labels | any(test("docs-pending|release-notes-pending|tests-pending"))) and (.fields.status.name | test("Code Review|Dev Complete|On QA")) then "atRisk"
      elif (.fields.labels | any(test("pending|req|missing"))) then "incomplete"
      elif (.fields.status.name | test("Closed|Verified|Release Pending")) and (.fields.labels | any(test("pending|req|missing")) | not) then "complete"
      elif (.fields.issuetype.name | test("Spike|Task|Sub-task")) then "na"
      else "incomplete"
      end
    ),
    missing: [.fields.labels[] | select(test("pending|req|missing"))]
  }
] | {
  complete: {count: ([.[] | select(.score == "complete")] | length), percent: (if length > 0 then (([.[] | select(.score == "complete")] | length) / length * 100 | round) else 0 end)},
  atRisk: {count: ([.[] | select(.score == "atRisk")] | length), percent: (if length > 0 then (([.[] | select(.score == "atRisk")] | length) / length * 100 | round) else 0 end)},
  incomplete: {count: ([.[] | select(.score == "incomplete")] | length), percent: (if length > 0 then (([.[] | select(.score == "incomplete")] | length) / length * 100 | round) else 0 end)},
  na: {count: ([.[] | select(.score == "na")] | length), percent: (if length > 0 then (([.[] | select(.score == "na")] | length) / length * 100 | round) else 0 end)},
  issues: [.[] | select(.score == "atRisk" or .score == "incomplete")]
}')

# 11. Future Sprint Prioritization
FUTURE_PRIORITY=$(echo "$FUTURE_ISSUES" | jq '[
  .[] |
  . + {
    rank: (
      if .fields.issuetype.name == "Vulnerability" then 1
      elif .fields.issuetype.name == "Bug" and .fields.priority.name == "Blocker" then 2
      elif .fields.issuetype.name == "Bug" and .fields.priority.name == "Critical" then 3
      elif .fields.issuetype.name == "Bug" and .fields.priority.name == "Major" then 4
      else 5
      end
    )
  } |
  {
    rank: .rank,
    key: .key,
    summary: .fields.summary,
    type: .fields.issuetype.name,
    priority: .fields.priority.name
  }
] | sort_by(.rank)')

# 12. Per-Assignee Breakdown
ASSIGNEES=$(echo "$SPRINT_ISSUES" | jq 'group_by(.fields.assignee.displayName // "Unassigned") | map({
  (.[0].fields.assignee.displayName // "Unassigned"): {
    totalIssues: length,
    totalSP: ([.[].fields.customfield_10028 // 0] | add),
    byStatus: (group_by(.fields.status.name) | map({(.[0].fields.status.name): {count: length, sp: ([.[].fields.customfield_10028 // 0] | add)}}) | add),
    blocked: ([.[] | select(.fields.customfield_10517 == true or (.fields.customfield_10021 // [] | length > 0))] | length),
    carryForwardCount: 0,  # Would compute from sprint count
    issues: [.[] | {key: .key, summary: .fields.summary, status: .fields.status.name, sp: .fields.customfield_10028}]
  }
}) | add')

# 13. Per-Component Breakdown
COMPONENTS=$(echo "$SPRINT_ISSUES" | jq '
  # Flatten components (issues can have multiple components)
  [.[] | . as $issue | (.fields.components // [{name: "Unassigned"}])[] | . + {issue: $issue}] |
  group_by(.name) |
  map({
    (.[ 0].name): {
      totalIssues: length,
      totalSP: ([.[].issue.fields.customfield_10028 // 0] | add),
      byStatus: (group_by(.issue.fields.status.name) | map({(.[0].issue.fields.status.name): {count: length, sp: ([.[].issue.fields.customfield_10028 // 0] | add)}}) | add),
      blocked: ([.[] | select(.issue.fields.customfield_10517 == true or (.issue.fields.customfield_10021 // [] | length > 0))] | length),
      carryForward: [],
      highPriorityBugs: ([.[] | select(.issue.fields.issuetype.name == "Bug" and (.issue.fields.priority.name | test("Critical|Blocker|Major")))] | length)
    }
  }) | add
')

# Assemble final JSON payload
DASHBOARD_DATA=$(jq -n \
  --arg team "$TEAM_NAME" \
  --argjson sprint "$SPRINT_INFO" \
  --arg generated "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson summary "$SUMMARY" \
  --argjson velocity "$VELOCITY_EXTENDED" \
  --argjson expectations "$EXPECTATIONS" \
  --argjson roadmap "$ROADMAP" \
  --argjson dod "$DOD" \
  --argjson codeReview "$CODE_REVIEW_REDO" \
  --argjson blocked "$BLOCKED" \
  --argjson highPriorityBugs "$HIGH_PRIORITY_BUGS" \
  --argjson carryForward "$CARRY_FORWARD" \
  --argjson futureSprint "$FUTURE_PRIORITY" \
  --arg futureSprintName "${FUTURE_SPRINT_NAME:-}" \
  --argjson assignees "$ASSIGNEES" \
  --argjson components "$COMPONENTS" \
  '{
    meta: {
      team: $team,
      sprint: $sprint,
      generatedAt: $generated,
      jiraBaseUrl: "https://redhat.atlassian.net"
    },
    summary: $summary,
    velocity: $velocity,
    expectations: $expectations,
    roadmap: $roadmap,
    dod: $dod,
    codeReview: $codeReview,
    blocked: $blocked,
    highPriorityBugs: $highPriorityBugs,
    carryForward: $carryForward,
    futureSprint: {name: $futureSprintName, issues: $futureSprint},
    assignees: $assignees,
    components: $components
  }')

echo "$DASHBOARD_DATA" > /tmp/dashboard_data.json
```

All 13 metrics computed: sprint summary, velocity, code review redo, blocked, high priority bugs, carry-forward, velocity trend, expectation management, roadmap alignment, DoD compliance, future sprint priority, per-assignee, per-component.
</step>

<step name="render_dashboard">
Locate HTML template, inject JSON, write to temp file, and open in browser.

```bash
# Locate template
TEMPLATE_PATH=""
if [ -f "$HOME/.claude/templates/osp/sprint-dashboard.html" ]; then
  TEMPLATE_PATH="$HOME/.claude/templates/osp/sprint-dashboard.html"
elif [ -f "./docs/templates/sprint-dashboard.html" ]; then
  TEMPLATE_PATH="./docs/templates/sprint-dashboard.html"
else
  echo "ERROR: Dashboard template not found."
  echo "Expected locations:"
  echo "  - $HOME/.claude/templates/osp/sprint-dashboard.html"
  echo "  - ./docs/templates/sprint-dashboard.html"
  exit 1
fi

# Create temp file with secure permissions
TEMP_FILE=$(mktemp /tmp/sprint-dashboard-${TEAM_NAME}-$(date +%s).html)
chmod 600 "$TEMP_FILE"

# Read template and inject data
DASHBOARD_JSON=$(cat /tmp/dashboard_data.json)

# Replace `const DATA = {};` with actual JSON
sed "s|const DATA = {};|const DATA = ${DASHBOARD_JSON};|" "$TEMPLATE_PATH" > "$TEMP_FILE"

echo "Dashboard written to: $TEMP_FILE"

# Open in browser
if command -v open &> /dev/null; then
  # macOS
  open "$TEMP_FILE"
elif command -v xdg-open &> /dev/null; then
  # Linux
  xdg-open "$TEMP_FILE"
else
  echo "Unable to open browser automatically. Open manually: $TEMP_FILE"
fi
```

Template located via primary path (`~/.claude/templates/osp/`) with fallback to repo path. Temp file secured with chmod 600. JSON injected via sed replacement. Browser opened with platform-specific command.
</step>

<step name="terminal_summary">
Print concise text summary to terminal for quick reference.

```bash
# Extract key metrics from JSON
DASHBOARD_JSON=$(cat /tmp/dashboard_data.json)

TOTAL_ISSUES=$(echo "$DASHBOARD_JSON" | jq -r '.summary.totalIssues')
TOTAL_SP=$(echo "$DASHBOARD_JSON" | jq -r '.summary.totalSPs')
COMPLETED_SP=$(echo "$DASHBOARD_JSON" | jq -r '.velocity.current.completed')
COMMITTED_SP=$(echo "$DASHBOARD_JSON" | jq -r '.velocity.current.committed')
COMPLETION_RATE=$(echo "$COMPLETED_SP $COMMITTED_SP" | awk '{if ($2 > 0) print int(($1 / $2) * 100); else print 0}')
BLOCKED_COUNT=$(echo "$DASHBOARD_JSON" | jq -r '.summary.blocked.count')
NO_SP_COUNT=$(echo "$DASHBOARD_JSON" | jq -r '.summary.noStoryPoints')
AVG_VELOCITY=$(echo "$DASHBOARD_JSON" | jq -r '.velocity.avg3 // "N/A"')
OVER_COMMITTED=$(echo "$DASHBOARD_JSON" | jq -r '.expectations.overCommitted.flag')
CR_BOTTLENECK=$(echo "$DASHBOARD_JSON" | jq -r '.expectations.codeReviewBottleneck.flag')
DOD_COMPLETE=$(echo "$DASHBOARD_JSON" | jq -r '.dod.complete.percent')
DOD_AT_RISK=$(echo "$DASHBOARD_JSON" | jq -r '.dod.atRisk.percent')
CARRY_FORWARD_CRITICAL=$(echo "$DASHBOARD_JSON" | jq '[.carryForward[] | select(.severity == "critical")] | length')

echo ""
echo "========================================="
echo "  Sprint Status: $SPRINT_NAME"
echo "========================================="
echo ""
echo "Sprint Summary:"
echo "  Total Issues: $TOTAL_ISSUES"
echo "  Total Story Points: $TOTAL_SP"
echo "  Completed: $COMPLETED_SP SP ($COMPLETION_RATE%)"
echo "  Blocked: $BLOCKED_COUNT issues"
echo "  No Story Points: $NO_SP_COUNT issues"
echo ""
echo "Velocity:"
echo "  3-Sprint Avg: $AVG_VELOCITY SP"
echo "  Current Committed: $COMMITTED_SP SP"
echo ""
echo "Alerts:"
if [ "$OVER_COMMITTED" = "true" ]; then
  echo "  ⚠️  Over-committed (above avg velocity)"
fi
if [ "$CR_BOTTLENECK" = "true" ]; then
  echo "  ⚠️  Code Review bottleneck (>30% of SPs)"
fi
if [ "$CARRY_FORWARD_CRITICAL" -gt 0 ]; then
  echo "  ⚠️  $CARRY_FORWARD_CRITICAL critical carry-forward issues (5+ sprints)"
fi
if [ "$BLOCKED_COUNT" -gt 0 ]; then
  echo "  ⚠️  $BLOCKED_COUNT blocked issues"
fi
echo ""
echo "DoD Compliance:"
echo "  Complete: $DOD_COMPLETE%"
echo "  At Risk: $DOD_AT_RISK%"
echo ""
echo "Top 3 Action Items:"
echo "  1. Review blocked issues and resolve blockers"
echo "  2. Re-estimate Code Review issues for next sprint"
echo "  3. Address carry-forward worst offenders (latest comments in dashboard)"
echo ""
echo "Dashboard: $TEMP_FILE"
echo "========================================="
```

Terminal summary displays key numbers, alerts, DoD compliance, top 3 action items, and dashboard file path.
</step>
</process>

<output>
A comprehensive sprint health dashboard including:
1. Browser-based interactive dashboard with all 13 metrics
2. Terminal summary with key findings and alerts
3. Velocity trend analysis over last 5 sprints
4. Blocker and carry-forward tracking with latest comments
5. Roadmap alignment and Epic progress
6. DoD compliance per issue
7. Code Review SP redo recommendations
8. Future sprint prioritization
9. Per-assignee and per-component breakdowns
</output>

<success_criteria>
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
- [ ] DoD compliance tracked per issue using label signals (docs-pending, tests-pending, release-notes-pending)
- [ ] DoD compliance summary shown in dashboard (complete/at-risk/incomplete)
- [ ] Per-assignee breakdown available for all metrics
- [ ] Per-component breakdown available for all metrics
- [ ] Companion UI renders in browser with all sections and empty states
- [ ] Terminal summary outputs key findings
- [ ] Issue keys link to Jira Cloud
- [ ] Null story points handled gracefully (treated as 0, flagged)
</success_criteria>
