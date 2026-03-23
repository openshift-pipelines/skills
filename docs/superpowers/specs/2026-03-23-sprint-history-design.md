# Sprint History & Meilisearch Analytics Design

## Overview

Historical sprint analytics powered by Meilisearch. Each `/osp:sprint-status` run auto-indexes sprint data into a local Meilisearch instance (Docker). A new `/osp:sprint-history` skill queries the archive for trend analysis, issue lifecycle tracking, cross-sprint pattern detection, and team performance metrics — via terminal tables or a browser-based analytics dashboard.

## Architecture

```
/osp:sprint-status pioneers
    ├── Fetches live data from Jira Cloud (existing)
    ├── Renders dashboard (existing)
    └── Auto-indexes snapshot into Meilisearch (new)
         └── Docker: osp-meilisearch on localhost:7700

/osp:sprint-history pioneers [subcommand]
    ├── Queries Meilisearch for historical data
    ├── Terminal: quick stats and tables (velocity, issue, trends summary)
    └── Browser: analytics dashboard with trend charts (sprint-analytics.html)
```

## Meilisearch Setup

### Docker Container

- Image: `getmeili/meilisearch:latest`
- Container name: `osp-meilisearch`
- Port: `7700`
- Volume: `osp-meili-data:/meili_data` (persistent)
- Master key: auto-generated UUID on first run, stored in `~/.config/osp/config.json`

### Auto-Start Logic

On every `/osp:sprint-status` run, after rendering the dashboard:

1. Check if Docker is available: `command -v docker`
2. Check if container exists: `docker ps -a --filter name=osp-meilisearch --format '{{.Status}}'`
3. If not exists: create and start with `docker run -d --name osp-meilisearch -p 7700:7700 -v osp-meili-data:/meili_data -e MEILI_MASTER_KEY=${KEY} getmeili/meilisearch:latest`
4. If exists but stopped: `docker start osp-meilisearch`
5. If running: proceed to index
6. Wait for health: `curl -s http://localhost:7700/health` until `{"status":"available"}`

If Docker is not installed, skip indexing silently with a note: "Meilisearch indexing skipped — Docker not available."

### Configuration

Stored in `~/.config/osp/config.json`:

```json
{
  "meilisearch": {
    "url": "http://localhost:7700",
    "key": "auto-generated-uuid",
    "container": "osp-meilisearch"
  }
}
```

## Indexes

### `sprint-snapshots`

One document per sprint-status run. Captures aggregate metrics at a point in time.

```json
{
  "id": "pioneers-47963-1711180800",
  "team": "Pioneers",
  "sprintId": 47963,
  "sprintName": "Pipelines Sprint Pioneers 51",
  "snapshotDate": "2026-03-23T15:00:00Z",
  "sprintStartDate": "2026-03-17T12:34:40Z",
  "sprintEndDate": "2026-03-31T16:00:00Z",
  "totalIssues": 28,
  "totalSPs": 71,
  "completedSPs": 13,
  "completionPercent": 18,
  "blockedCount": 0,
  "blockedSPs": 0,
  "codeReviewCount": 9,
  "codeReviewSPs": 29,
  "carryForwardCount": 20,
  "carryForwardCriticalCount": 1,
  "dodCompletePercent": 14,
  "dodAtRiskPercent": 10,
  "healthScore": "yellow",
  "plannedPercent": 71,
  "unplannedPercent": 28,
  "cvePercent": 1,
  "velocityAvg3": null,
  "velocityAvg5": null,
  "assigneeCount": 9,
  "componentCount": 9
}
```

**Primary key:** `id`
**Filterable attributes:** `team`, `sprintId`, `sprintName`, `healthScore`, `snapshotDate`
**Sortable attributes:** `snapshotDate`, `completionPercent`, `totalSPs`

### `issue-snapshots`

One document per issue per sprint-status run. Captures the state of each issue at that point in time.

```json
{
  "id": "SRVKP-1801-47963-1711180800",
  "key": "SRVKP-1801",
  "summary": "Pipelines don't work with resource quota",
  "status": "Code Review",
  "previousStatus": null,
  "priority": "Critical",
  "type": "Bug",
  "assignee": "Vibhav Bobade",
  "components": ["Tekton Pipelines"],
  "storyPoints": 3,
  "originalStoryPoints": null,
  "sprintCount": 7,
  "blocked": false,
  "blockedReason": null,
  "dodScore": "incomplete",
  "dodMissing": ["docs-pending", "release-notes-pending", "tests-pending"],
  "labels": ["candidate-next", "docs-pending", "release-notes-pending", "tests-pending"],
  "team": "Pioneers",
  "sprintId": 47963,
  "sprintName": "Pipelines Sprint Pioneers 51",
  "snapshotDate": "2026-03-23T15:00:00Z",
  "epicKey": null,
  "epicSummary": null
}
```

**Primary key:** `id`
**Filterable attributes:** `team`, `key`, `status`, `priority`, `type`, `assignee`, `components`, `blocked`, `dodScore`, `sprintId`, `sprintName`, `snapshotDate`
**Sortable attributes:** `snapshotDate`, `sprintCount`, `storyPoints`
**Searchable attributes:** `key`, `summary`, `assignee`, `components`, `labels`

## Indexing Flow

After the sprint-status dashboard renders (new step added to sprint-status.md):

```bash
# Check Docker availability
if ! command -v docker &>/dev/null; then
  echo "Meilisearch indexing skipped — Docker not available"
  exit 0
fi

# Ensure Meilisearch is running
MEILI_KEY=$(jq -r '.meilisearch.key // empty' ~/.config/osp/config.json)
if [ -z "$MEILI_KEY" ]; then
  MEILI_KEY=$(python3 -c "import uuid; print(uuid.uuid4())")
  # Save to config...
fi

CONTAINER_STATUS=$(docker ps -a --filter name=osp-meilisearch --format '{{.Status}}' 2>/dev/null)
if [ -z "$CONTAINER_STATUS" ]; then
  docker run -d --name osp-meilisearch -p 7700:7700 \
    -v osp-meili-data:/meili_data \
    -e MEILI_MASTER_KEY="${MEILI_KEY}" \
    getmeili/meilisearch:latest
elif echo "$CONTAINER_STATUS" | grep -q "Exited"; then
  docker start osp-meilisearch
fi

# Wait for health (max 10s)
for i in $(seq 1 10); do
  curl -s http://localhost:7700/health | grep -q "available" && break
  sleep 1
done

MEILI_URL="http://localhost:7700"

# Create indexes if they don't exist
curl -s -X POST "${MEILI_URL}/indexes" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"uid": "sprint-snapshots", "primaryKey": "id"}'

curl -s -X POST "${MEILI_URL}/indexes" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"uid": "issue-snapshots", "primaryKey": "id"}'

# Configure filterable/sortable attributes
curl -s -X PUT "${MEILI_URL}/indexes/sprint-snapshots/settings" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "filterableAttributes": ["team", "sprintId", "sprintName", "healthScore", "snapshotDate"],
    "sortableAttributes": ["snapshotDate", "completionPercent", "totalSPs"]
  }'

curl -s -X PUT "${MEILI_URL}/indexes/issue-snapshots/settings" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "filterableAttributes": ["team", "key", "status", "priority", "type", "assignee", "components", "blocked", "dodScore", "sprintId", "sprintName", "snapshotDate"],
    "sortableAttributes": ["snapshotDate", "sprintCount", "storyPoints"],
    "searchableAttributes": ["key", "summary", "assignee", "components", "labels"]
  }'

# Build sprint snapshot document from DASHBOARD_DATA
SNAPSHOT_ID="${TEAM_NAME}-${SPRINT_ID}-$(date +%s)"
SPRINT_SNAPSHOT=$(echo "$DASHBOARD_DATA" | jq --arg id "$SNAPSHOT_ID" '{
  id: $id,
  team: .meta.team,
  sprintId: .meta.sprint.id,
  sprintName: .meta.sprint.name,
  snapshotDate: .meta.generatedAt,
  sprintStartDate: .meta.sprint.startDate,
  sprintEndDate: .meta.sprint.endDate,
  totalIssues: .summary.totalIssues,
  totalSPs: .summary.totalSPs,
  completedSPs: .velocity.current.completed,
  completionPercent: .completionPercent,
  blockedCount: .summary.blocked.count,
  blockedSPs: .summary.blocked.sp,
  codeReviewCount: (.summary.byStatus["Code Review"].count // 0),
  codeReviewSPs: (.summary.byStatus["Code Review"].sp // 0),
  carryForwardCount: (.carryForward | length),
  carryForwardCriticalCount: ([.carryForward[] | select(.severity == "critical")] | length),
  dodCompletePercent: .dod.complete.percent,
  dodAtRiskPercent: .dod.atRisk.percent,
  healthScore: .healthScore,
  plannedPercent: .roadmap.planned.percent,
  unplannedPercent: .roadmap.unplanned.percent,
  cvePercent: .roadmap.cve.percent,
  velocityAvg3: .velocity.avg3,
  velocityAvg5: .velocity.avg5,
  assigneeCount: (.assignees | keys | length),
  componentCount: (.components | keys | length)
}')

# Index sprint snapshot
curl -s -X POST "${MEILI_URL}/indexes/sprint-snapshots/documents" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d "[$SPRINT_SNAPSHOT]"

# Build and index issue snapshots
TIMESTAMP=$(date +%s)
ISSUE_SNAPSHOTS=$(echo "$DASHBOARD_DATA" | jq --arg ts "$TIMESTAMP" --arg team "$TEAM_NAME" --argjson sprintId "$SPRINT_ID" --arg sprintName "$SPRINT_NAME" '[
  .codeReview[], .blocked[], .highPriorityBugs[], .carryForward[],
  # Also need all issues — use the assignee breakdown to get full list
  (.assignees | to_entries[].value.issues[]? // empty)
] | unique_by(.key) | map({
  id: (.key + "-" + ($sprintId | tostring) + "-" + $ts),
  key: .key,
  summary: .summary,
  status: .status,
  priority: (.priority // "Normal"),
  type: (.type // "Story"),
  assignee: (.assignee // "Unassigned"),
  components: (.components // []),
  storyPoints: (.sp // .currentSP // 0),
  sprintCount: (.sprintCount // 1),
  blocked: (.blocked // false),
  dodScore: (.dodScore // .score // "unknown"),
  dodMissing: (.missing // []),
  team: $team,
  sprintId: $sprintId,
  sprintName: $sprintName,
  snapshotDate: (now | todate)
})')

curl -s -X POST "${MEILI_URL}/indexes/issue-snapshots/documents" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d "$ISSUE_SNAPSHOTS"

echo "Indexed sprint snapshot and $(echo "$ISSUE_SNAPSHOTS" | jq 'length') issue snapshots into Meilisearch"
```

## `/osp:sprint-history` Skill

### Invocation

```
/osp:sprint-history [team] [subcommand] [args]
```

### Subcommands

**`velocity`** — Velocity trend table (terminal)
```
/osp:sprint-history pioneers velocity
```
Output: table of last N sprints with committed, completed, carried, completion %.

**`issue <key>`** — Issue lifecycle across sprints (terminal)
```
/osp:sprint-history pioneers issue SRVKP-1801
```
Output: table showing the issue's status, SP, assignee, blocked state, and DoD score in each sprint it appeared in.

**`trends`** — Opens browser analytics dashboard
```
/osp:sprint-history pioneers trends
```
Opens `sprint-analytics.html` with full historical visualization.

**`search <query>`** — Full-text search across all historical issue data
```
/osp:sprint-history pioneers search "resource quota"
```
Output: matching issues with their sprint history.

**`compare <team2>`** — Compare two teams side by side (terminal)
```
/osp:sprint-history pioneers compare crookshank
```
Output: side-by-side velocity, completion rate, blocked rate, carry-forward rate.

**`index [sprint-id]`** — Manually index a specific sprint (for bootstrapping)
```
/osp:sprint-history pioneers index 47963
```
Fetches sprint data from Jira and indexes into Meilisearch.

### Data Fetching

All queries use Meilisearch REST API:
- Search: `POST /indexes/{index}/search`
- Filter: `POST /indexes/{index}/search` with `filter` parameter
- Documents: `GET /indexes/{index}/documents`

Auth: `Authorization: Bearer ${MEILI_KEY}` header on all requests.

## Analytics Dashboard (sprint-analytics.html)

### Technology

- Self-contained HTML/CSS/JS (same pattern as sprint-dashboard.html)
- **Chart.js CDN** for trend line charts (single external dependency, acceptable for analytics)
- Clean corporate design (Grafana-inspired grid layout)
- Dark/light theme support

### Layout

```
┌─────────────────────────────────────────────────────────┐
│  Sprint Analytics: Pioneers          Last 20 sprints    │
│  [Time range: 3m | 6m | 1y | All]                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌───────────────────────┐ ┌───────────────────────┐    │
│  │ Velocity Trend        │ │ Completion Rate       │    │
│  │ [line chart]          │ │ [line chart]          │    │
│  │ committed vs completed│ │ % over time           │    │
│  └───────────────────────┘ └───────────────────────┘    │
│                                                         │
│  ┌───────────────────────┐ ┌───────────────────────┐    │
│  │ Carry-Forward Rate    │ │ DoD Compliance Trend  │    │
│  │ [line chart]          │ │ [stacked area]        │    │
│  │ % carried per sprint  │ │ complete/risk/incompl │    │
│  └───────────────────────┘ └───────────────────────┘    │
│                                                         │
│  ┌───────────────────────┐ ┌───────────────────────┐    │
│  │ Blocked Issues Trend  │ │ Roadmap Alignment     │    │
│  │ [bar chart]           │ │ [stacked bar]         │    │
│  │ count per sprint      │ │ planned/unplanned/cve │    │
│  └───────────────────────┘ └───────────────────────┘    │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  CARRY-FORWARD HEATMAP                                  │
│                                                         │
│  Issues (rows) x Sprints (columns)                      │
│  Color = status in that sprint (green=done, red=blocked)│
│  Shows which issues persist across sprints              │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  COMPONENT HEALTH OVER TIME                             │
│                                                         │
│  [grouped bar chart per component]                      │
│  Shows blocked/carry-forward/completion per component   │
│  across sprints                                         │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ISSUE LIFECYCLE VIEWER                                 │
│                                                         │
│  [search bar: type issue key or text]                   │
│  Shows timeline of issue across sprints with status     │
│  changes, SP changes, assignee changes                  │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  ASSIGNEE WORKLOAD TRENDS                               │
│                                                         │
│  [stacked bar per assignee]                             │
│  SP allocation over time per person                     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Data Flow

1. Skill queries Meilisearch for sprint-snapshots and issue-snapshots filtered by team
2. Assembles JSON payload with all historical data
3. Injects into sprint-analytics.html (same pattern as sprint-dashboard.html)
4. Opens in browser

## Visual Overhaul for Existing Dashboard

The existing `sprint-dashboard.html` will also be updated to match the clean corporate look:
- Grafana-inspired card grid with subtle borders and shadows
- Professional color palette (muted blues, clean whites, accent colors only for status)
- Consistent typography hierarchy
- Better spacing and data density
- Status badges instead of colored text
- Progress bars instead of raw numbers where appropriate

## Files

| File | Action | Responsibility |
|------|--------|----------------|
| `commands/osp/sprint-history.md` | Create | History query skill with subcommands |
| `docs/templates/sprint-analytics.html` | Create | Analytics dashboard with Chart.js |
| `commands/osp/sprint-status.md` | Modify | Add auto-index step after dashboard render |
| `commands/osp/configure.md` | Modify | Add Meilisearch config section |
| `commands/osp/help.md` | Modify | Add sprint-history to command reference |
| `docs/templates/sprint-dashboard.html` | Modify | Visual overhaul — clean corporate design |

## Data Retention

All data kept forever. Meilisearch disk usage is minimal for sprint data (~1KB per sprint snapshot, ~500B per issue snapshot). Even with daily snapshots across 3 teams for 5 years, total data < 100MB.

## Success Criteria

- [ ] Meilisearch Docker container auto-starts on sprint-status run
- [ ] Sprint snapshots indexed with all aggregate metrics
- [ ] Issue snapshots indexed with full field data
- [ ] /osp:sprint-history velocity shows tabular velocity trend
- [ ] /osp:sprint-history issue tracks individual issue lifecycle
- [ ] /osp:sprint-history trends opens analytics dashboard
- [ ] /osp:sprint-history search performs full-text search
- [ ] /osp:sprint-history compare shows team comparison
- [ ] /osp:sprint-history index bootstraps historical data
- [ ] Analytics dashboard renders trend charts with Chart.js
- [ ] Carry-forward heatmap visualizes issue persistence
- [ ] Issue lifecycle viewer allows searching and tracking
- [ ] Time range selector filters chart data
- [ ] Existing sprint-dashboard.html visual quality improved
- [ ] Docker unavailable gracefully handled (skip indexing)
- [ ] Meilisearch key auto-generated and stored securely
