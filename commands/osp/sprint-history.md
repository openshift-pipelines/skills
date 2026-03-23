---
name: sprint-history
description: Historical sprint analytics — velocity trends, issue lifecycle, cross-sprint patterns via Meilisearch
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
  - Glob
  - Grep
---

# Sprint History Analytics

<objective>
Query historical sprint data from Meilisearch to analyze velocity trends, track issue lifecycle across sprints, compare team performance, and visualize cross-sprint patterns via terminal tables or browser-based analytics dashboard.
</objective>

<execution_context>
**Meilisearch Configuration:**
- URL: `http://localhost:7700` (default)
- Container: `osp-meilisearch` (Docker)
- Auth: Master key stored in `~/.config/osp/config.json`

**Indexes:**
- `sprint-snapshots`: One document per sprint-status run with aggregate metrics
- `issue-snapshots`: One document per issue per sprint-status run with full field data

**Meilisearch API Endpoints:**
- Search: `POST /indexes/{index}/search`
- Documents: `GET /indexes/{index}/documents`
- Health: `GET /health`

**Data Sources:**
- Auto-indexed by `/osp:sprint-status` after each run
- Manual indexing via `index` subcommand for historical bootstrapping
</execution_context>

<process>
<step name="check_meilisearch">
**MANDATORY FIRST STEP**: Verify Meilisearch is running and contains data.

1. Check if Docker is available:
```bash
if ! command -v docker &>/dev/null; then
  echo "ERROR: Docker is not installed. Meilisearch requires Docker."
  echo "Install Docker or run sprint-status to auto-setup Meilisearch."
  exit 1
fi
```

2. Check container status:
```bash
CONTAINER_STATUS=$(docker ps -a --filter name=osp-meilisearch --format '{{.Status}}' 2>/dev/null)

if [ -z "$CONTAINER_STATUS" ]; then
  echo "ERROR: Meilisearch container not found."
  echo "Run '/osp:sprint-status' first to auto-setup and index data."
  exit 1
elif echo "$CONTAINER_STATUS" | grep -q "Exited"; then
  echo "Starting Meilisearch container..."
  docker start osp-meilisearch
  sleep 2
fi
```

3. Check health:
```bash
for i in $(seq 1 5); do
  if curl -s http://localhost:7700/health | grep -q "available"; then
    echo "Meilisearch is healthy"
    break
  fi
  if [ $i -eq 5 ]; then
    echo "ERROR: Meilisearch not responding. Check Docker logs: docker logs osp-meilisearch"
    exit 1
  fi
  sleep 1
done
```

4. Load Meilisearch key from config:
```bash
MEILI_KEY=$(jq -r '.meilisearch.key // empty' ~/.config/osp/config.json 2>/dev/null)

if [ -z "$MEILI_KEY" ]; then
  echo "ERROR: Meilisearch key not found in ~/.config/osp/config.json"
  echo "Run '/osp:sprint-status' to initialize configuration."
  exit 1
fi

export MEILI_KEY
export MEILI_URL="http://localhost:7700"
```

5. Check if indexes contain data:
```bash
SPRINT_COUNT=$(curl -s -H "Authorization: Bearer ${MEILI_KEY}" \
  "${MEILI_URL}/indexes/sprint-snapshots/stats" | jq -r '.numberOfDocuments // 0')

if [ "$SPRINT_COUNT" -eq 0 ]; then
  echo "WARNING: No sprint data indexed yet."
  echo "Run '/osp:sprint-status <team>' to index current sprint data."
  echo "Use '/osp:sprint-history <team> index' to bootstrap historical data."
fi
```
</step>

<step name="parse_command">
Parse the team name and subcommand from arguments.

Expected format:
```
/osp:sprint-history <team> [subcommand] [args]
```

**Subcommands:**
- `velocity` — Show velocity trend table
- `issue <key>` — Show issue lifecycle across sprints
- `trends` — Open browser analytics dashboard
- `search <query>` — Full-text search across historical issues
- `compare <team2>` — Compare two teams side-by-side
- `index [sprint-id]` — Manually index a sprint from Jira
- (no subcommand) — Show help/summary

```bash
TEAM_NAME="${1:-}"
SUBCOMMAND="${2:-}"
ARG="${3:-}"

# Normalize team name to match Jira format
case "$TEAM_NAME" in
  pioneers|Pioneers) TEAM_NAME="Pioneers" ;;
  crookshank|CrookShank|Crookshank) TEAM_NAME="CrookShank" ;;
  *)
    if [ -z "$TEAM_NAME" ]; then
      echo "ERROR: Team name required."
      echo "Usage: /osp:sprint-history <team> [subcommand]"
      exit 1
    fi
    # Capitalize first letter
    TEAM_NAME="$(echo "$TEAM_NAME" | sed 's/^./\U&/')"
    ;;
esac
```

If no subcommand provided, show help:
```bash
if [ -z "$SUBCOMMAND" ]; then
  echo "Sprint History Analytics for ${TEAM_NAME}"
  echo ""
  echo "Available subcommands:"
  echo "  velocity              Show velocity trend over time"
  echo "  issue <key>           Track issue lifecycle across sprints"
  echo "  trends                Open analytics dashboard in browser"
  echo "  search <query>        Full-text search across issues"
  echo "  compare <team2>       Compare two teams side-by-side"
  echo "  index [sprint-id]     Manually index sprint from Jira"
  echo ""
  echo "Examples:"
  echo "  /osp:sprint-history pioneers velocity"
  echo "  /osp:sprint-history pioneers issue SRVKP-1801"
  echo "  /osp:sprint-history pioneers trends"
  echo "  /osp:sprint-history pioneers compare crookshank"
  exit 0
fi
```
</step>

<step name="velocity">
**Subcommand: `velocity`**

Query sprint-snapshots for the team, sorted by snapshotDate descending (most recent first).

```bash
VELOCITY_DATA=$(curl -s -X POST "${MEILI_URL}/indexes/sprint-snapshots/search" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"team = '${TEAM_NAME}'\",
    \"sort\": [\"snapshotDate:desc\"],
    \"limit\": 20
  }")

# Check if data exists
TOTAL=$(echo "$VELOCITY_DATA" | jq -r '.estimatedTotalHits // 0')
if [ "$TOTAL" -eq 0 ]; then
  echo "No sprint data found for ${TEAM_NAME}"
  echo "Run '/osp:sprint-status ${TEAM_NAME}' to index current sprint."
  exit 1
fi

# Format as terminal table
echo "Velocity Trend: ${TEAM_NAME} (Last 20 sprints)"
echo ""
printf "%-30s | %-9s | %-9s | %-7s | %-6s\n" "Sprint" "Committed" "Completed" "Carried" "Rate"
printf "%-30s-+-%-9s-+-%-9s-+-%-7s-+-%-6s\n" "------------------------------" "---------" "---------" "-------" "------"

echo "$VELOCITY_DATA" | jq -r '.hits[] |
  [
    .sprintName,
    (.totalSPs // 0),
    (.completedSPs // 0),
    (.carryForwardCount // 0),
    (if .totalSPs > 0 then ((.completedSPs / .totalSPs * 100) | floor) else 0 end)
  ] |
  @tsv' | while IFS=$'\t' read -r sprint committed completed carried rate; do
  printf "%-30s | %9s | %9s | %7s | %5s%%\n" "$sprint" "$committed" "$completed" "$carried" "$rate"
done

# Summary stats
echo ""
echo "Summary Statistics:"
AVG_COMMITTED=$(echo "$VELOCITY_DATA" | jq '[.hits[].totalSPs // 0] | add / length | floor')
AVG_COMPLETED=$(echo "$VELOCITY_DATA" | jq '[.hits[].completedSPs // 0] | add / length | floor')
AVG_RATE=$(echo "$VELOCITY_DATA" | jq '[.hits[] | if .totalSPs > 0 then (.completedSPs / .totalSPs * 100) else 0 end] | add / length | floor')

echo "  Average Committed: ${AVG_COMMITTED} SP/sprint"
echo "  Average Completed: ${AVG_COMPLETED} SP/sprint"
echo "  Average Completion Rate: ${AVG_RATE}%"
```
</step>

<step name="issue">
**Subcommand: `issue <key>`**

Query issue-snapshots filtered by issue key, sorted by snapshotDate ascending to show chronological journey.

```bash
ISSUE_KEY="$ARG"

if [ -z "$ISSUE_KEY" ]; then
  echo "ERROR: Issue key required."
  echo "Usage: /osp:sprint-history <team> issue <key>"
  echo "Example: /osp:sprint-history pioneers issue SRVKP-1801"
  exit 1
fi

# Query issue snapshots
ISSUE_DATA=$(curl -s -X POST "${MEILI_URL}/indexes/issue-snapshots/search" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"key = '${ISSUE_KEY}'\",
    \"sort\": [\"snapshotDate:asc\"],
    \"limit\": 100
  }")

TOTAL=$(echo "$ISSUE_DATA" | jq -r '.estimatedTotalHits // 0')
if [ "$TOTAL" -eq 0 ]; then
  echo "No historical data found for ${ISSUE_KEY}"
  echo "Issue may not have appeared in any indexed sprints."
  exit 1
fi

# Get issue summary from first snapshot
SUMMARY=$(echo "$ISSUE_DATA" | jq -r '.hits[0].summary // "N/A"')

echo "Issue Lifecycle: ${ISSUE_KEY}"
echo "Summary: ${SUMMARY}"
echo ""
printf "%-25s | %-15s | %-2s | %-15s | %-7s | %-10s\n" "Sprint" "Status" "SP" "Assignee" "Blocked" "DoD"
printf "%-25s-+-%-15s-+-%-2s-+-%-15s-+-%-7s-+-%-10s\n" "-------------------------" "---------------" "--" "---------------" "-------" "----------"

echo "$ISSUE_DATA" | jq -r '.hits[] |
  [
    .sprintName,
    .status,
    (.storyPoints // 0),
    (.assignee // "Unassigned"),
    (if .blocked then "Yes" else "No" end),
    .dodScore
  ] |
  @tsv' | while IFS=$'\t' read -r sprint status sp assignee blocked dod; do
  printf "%-25s | %-15s | %2s | %-15s | %-7s | %-10s\n" "$sprint" "$status" "$sp" "$assignee" "$blocked" "$dod"
done

# Summary
echo ""
SPRINT_COUNT=$(echo "$ISSUE_DATA" | jq -r '.hits | length')
FIRST_SPRINT=$(echo "$ISSUE_DATA" | jq -r '.hits[0].sprintName')
LAST_SPRINT=$(echo "$ISSUE_DATA" | jq -r '.hits[-1].sprintName')
LATEST_STATUS=$(echo "$ISSUE_DATA" | jq -r '.hits[-1].status')

echo "Journey Summary:"
echo "  First seen: ${FIRST_SPRINT}"
echo "  Last seen: ${LAST_SPRINT}"
echo "  Total sprints: ${SPRINT_COUNT}"
echo "  Current status: ${LATEST_STATUS}"
```
</step>

<step name="trends">
**Subcommand: `trends`**

Query all sprint-snapshots and issue-snapshots for the team, build JSON payload, and render analytics dashboard in browser.

```bash
# Fetch all sprint snapshots for the team
SPRINT_DATA=$(curl -s -X POST "${MEILI_URL}/indexes/sprint-snapshots/search" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"team = '${TEAM_NAME}'\",
    \"sort\": [\"snapshotDate:asc\"],
    \"limit\": 200
  }" | jq '.hits')

# Fetch all issue snapshots for the team
ISSUE_DATA=$(curl -s -X POST "${MEILI_URL}/indexes/issue-snapshots/search" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"filter\": \"team = '${TEAM_NAME}'\",
    \"limit\": 10000
  }" | jq '.hits')

# Check data availability
SPRINT_COUNT=$(echo "$SPRINT_DATA" | jq 'length')
if [ "$SPRINT_COUNT" -eq 0 ]; then
  echo "No sprint data available for ${TEAM_NAME}"
  echo "Run '/osp:sprint-status ${TEAM_NAME}' to index data."
  exit 1
fi

# Build analytics payload
ANALYTICS_PAYLOAD=$(jq -n \
  --argjson sprints "$SPRINT_DATA" \
  --argjson issues "$ISSUE_DATA" \
  --arg team "$TEAM_NAME" \
  '{
    team: $team,
    generatedAt: (now | todate),
    sprints: $sprints,
    issues: $issues,
    sprintCount: ($sprints | length),
    issueCount: ($issues | length)
  }')

# Create analytics dashboard HTML
ANALYTICS_HTML="/tmp/sprint-analytics-${TEAM_NAME}-$(date +%s).html"

cat > "$ANALYTICS_HTML" <<'ANALYTICS_EOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprint Analytics</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 20px;
    }

    .header {
      max-width: 1400px;
      margin: 0 auto 30px;
      padding: 20px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
    }

    .header h1 {
      font-size: 24px;
      color: #58a6ff;
      margin-bottom: 8px;
    }

    .header .meta {
      font-size: 14px;
      color: #8b949e;
    }

    .grid {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
      gap: 20px;
    }

    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 20px;
    }

    .card h2 {
      font-size: 16px;
      color: #58a6ff;
      margin-bottom: 15px;
      font-weight: 600;
    }

    .chart-container {
      position: relative;
      height: 300px;
    }

    .full-width {
      grid-column: 1 / -1;
    }

    .full-width .chart-container {
      height: 400px;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }

    .stat-box {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 15px;
      text-align: center;
    }

    .stat-box .value {
      font-size: 28px;
      font-weight: 700;
      color: #58a6ff;
      margin-bottom: 5px;
    }

    .stat-box .label {
      font-size: 12px;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .issue-search {
      margin-bottom: 20px;
    }

    .issue-search input {
      width: 100%;
      padding: 12px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #c9d1d9;
      font-size: 14px;
    }

    .issue-timeline {
      max-height: 400px;
      overflow-y: auto;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 15px;
    }

    .timeline-item {
      padding: 10px;
      border-left: 3px solid #30363d;
      margin-bottom: 15px;
      padding-left: 15px;
    }

    .timeline-item.complete { border-color: #238636; }
    .timeline-item.blocked { border-color: #da3633; }
    .timeline-item.progress { border-color: #58a6ff; }

    .timeline-sprint {
      font-size: 12px;
      color: #8b949e;
      margin-bottom: 5px;
    }

    .timeline-status {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 3px;
    }

    .timeline-details {
      font-size: 13px;
      color: #8b949e;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 id="teamName">Sprint Analytics</h1>
    <div class="meta">
      <span id="sprintRange"></span> •
      <span id="generatedAt"></span>
    </div>
  </div>

  <div class="grid">
    <!-- Stats Overview -->
    <div class="card full-width">
      <h2>Performance Overview</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="value" id="avgVelocity">--</div>
          <div class="label">Avg Velocity (SP)</div>
        </div>
        <div class="stat-box">
          <div class="value" id="avgCompletion">--</div>
          <div class="label">Avg Completion</div>
        </div>
        <div class="stat-box">
          <div class="value" id="avgCarryForward">--</div>
          <div class="label">Avg Carry Forward</div>
        </div>
        <div class="stat-box">
          <div class="value" id="avgBlockedRate">--</div>
          <div class="label">Avg Blocked Rate</div>
        </div>
      </div>
    </div>

    <!-- Velocity Trend -->
    <div class="card">
      <h2>Velocity Trend</h2>
      <div class="chart-container">
        <canvas id="velocityChart"></canvas>
      </div>
    </div>

    <!-- Completion Rate -->
    <div class="card">
      <h2>Completion Rate</h2>
      <div class="chart-container">
        <canvas id="completionChart"></canvas>
      </div>
    </div>

    <!-- Carry Forward Rate -->
    <div class="card">
      <h2>Carry Forward Rate</h2>
      <div class="chart-container">
        <canvas id="carryForwardChart"></canvas>
      </div>
    </div>

    <!-- DoD Compliance -->
    <div class="card">
      <h2>DoD Compliance Trend</h2>
      <div class="chart-container">
        <canvas id="dodChart"></canvas>
      </div>
    </div>

    <!-- Blocked Issues -->
    <div class="card">
      <h2>Blocked Issues Trend</h2>
      <div class="chart-container">
        <canvas id="blockedChart"></canvas>
      </div>
    </div>

    <!-- Roadmap Alignment -->
    <div class="card">
      <h2>Roadmap Alignment</h2>
      <div class="chart-container">
        <canvas id="roadmapChart"></canvas>
      </div>
    </div>

    <!-- Issue Lifecycle Viewer -->
    <div class="card full-width">
      <h2>Issue Lifecycle Viewer</h2>
      <div class="issue-search">
        <input type="text" id="issueSearch" placeholder="Search by issue key or summary...">
      </div>
      <div class="issue-timeline" id="issueTimeline"></div>
    </div>
  </div>

  <script>
    const ANALYTICS_DATA = /*INJECT_DATA*/;

    // Initialize dashboard
    document.getElementById('teamName').textContent = `Sprint Analytics: ${ANALYTICS_DATA.team}`;
    document.getElementById('generatedAt').textContent = `Generated: ${new Date(ANALYTICS_DATA.generatedAt).toLocaleString()}`;

    const sprints = ANALYTICS_DATA.sprints;
    const sprintLabels = sprints.map(s => s.sprintName.replace(/Pipelines Sprint /, ''));

    document.getElementById('sprintRange').textContent = `${sprints.length} sprints analyzed`;

    // Calculate stats
    const avgVelocity = Math.round(sprints.reduce((acc, s) => acc + (s.completedSPs || 0), 0) / sprints.length);
    const avgCompletion = Math.round(sprints.reduce((acc, s) => acc + (s.completionPercent || 0), 0) / sprints.length);
    const avgCarryForward = Math.round(sprints.reduce((acc, s) => acc + (s.carryForwardCount || 0), 0) / sprints.length);
    const avgBlockedRate = Math.round(sprints.reduce((acc, s) => acc + ((s.blockedCount / s.totalIssues * 100) || 0), 0) / sprints.length);

    document.getElementById('avgVelocity').textContent = avgVelocity;
    document.getElementById('avgCompletion').textContent = avgCompletion + '%';
    document.getElementById('avgCarryForward').textContent = avgCarryForward;
    document.getElementById('avgBlockedRate').textContent = avgBlockedRate + '%';

    // Chart defaults
    Chart.defaults.color = '#8b949e';
    Chart.defaults.borderColor = '#30363d';

    // Velocity Chart
    new Chart(document.getElementById('velocityChart'), {
      type: 'line',
      data: {
        labels: sprintLabels,
        datasets: [
          {
            label: 'Committed',
            data: sprints.map(s => s.totalSPs || 0),
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            tension: 0.3
          },
          {
            label: 'Completed',
            data: sprints.map(s => s.completedSPs || 0),
            borderColor: '#238636',
            backgroundColor: 'rgba(35, 134, 54, 0.1)',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Completion Rate Chart
    new Chart(document.getElementById('completionChart'), {
      type: 'line',
      data: {
        labels: sprintLabels,
        datasets: [{
          label: 'Completion %',
          data: sprints.map(s => s.completionPercent || 0),
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.2)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100 } },
        plugins: { legend: { display: false } }
      }
    });

    // Carry Forward Chart
    new Chart(document.getElementById('carryForwardChart'), {
      type: 'line',
      data: {
        labels: sprintLabels,
        datasets: [{
          label: 'Carry Forward Count',
          data: sprints.map(s => s.carryForwardCount || 0),
          borderColor: '#d29922',
          backgroundColor: 'rgba(210, 153, 34, 0.2)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });

    // DoD Compliance Chart
    new Chart(document.getElementById('dodChart'), {
      type: 'line',
      data: {
        labels: sprintLabels,
        datasets: [
          {
            label: 'Complete',
            data: sprints.map(s => s.dodCompletePercent || 0),
            borderColor: '#238636',
            backgroundColor: 'rgba(35, 134, 54, 0.2)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'At Risk',
            data: sprints.map(s => s.dodAtRiskPercent || 0),
            borderColor: '#d29922',
            backgroundColor: 'rgba(210, 153, 34, 0.2)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100, stacked: true } },
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Blocked Issues Chart
    new Chart(document.getElementById('blockedChart'), {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: [{
          label: 'Blocked Count',
          data: sprints.map(s => s.blockedCount || 0),
          backgroundColor: '#da3633'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });

    // Roadmap Alignment Chart
    new Chart(document.getElementById('roadmapChart'), {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: [
          {
            label: 'Planned',
            data: sprints.map(s => s.plannedPercent || 0),
            backgroundColor: '#238636'
          },
          {
            label: 'Unplanned',
            data: sprints.map(s => s.unplannedPercent || 0),
            backgroundColor: '#d29922'
          },
          {
            label: 'CVE',
            data: sprints.map(s => s.cvePercent || 0),
            backgroundColor: '#da3633'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, max: 100 }
        },
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Issue Lifecycle Viewer
    const issueSearch = document.getElementById('issueSearch');
    const issueTimeline = document.getElementById('issueTimeline');

    function renderMessage(msg) {
      const p = document.createElement('p');
      p.style.cssText = 'color: #8b949e; text-align: center; padding: 20px;';
      p.textContent = msg;
      issueTimeline.innerHTML = '';
      issueTimeline.appendChild(p);
    }

    function renderTimeline(issueKey, timeline, summary) {
      issueTimeline.innerHTML = '';

      const h3 = document.createElement('h3');
      h3.style.cssText = 'margin-bottom: 15px; color: #58a6ff;';
      h3.textContent = `${issueKey}: ${summary}`;
      issueTimeline.appendChild(h3);

      timeline.forEach(snapshot => {
        const statusClass = snapshot.status.match(/Done|Closed|Verified/) ? 'complete' :
                           snapshot.blocked ? 'blocked' : 'progress';

        const item = document.createElement('div');
        item.className = `timeline-item ${statusClass}`;

        const sprint = document.createElement('div');
        sprint.className = 'timeline-sprint';
        sprint.textContent = snapshot.sprintName;

        const status = document.createElement('div');
        status.className = 'timeline-status';
        status.textContent = snapshot.status;

        const details = document.createElement('div');
        details.className = 'timeline-details';
        details.textContent = `${snapshot.storyPoints || 0} SP • ${snapshot.assignee || 'Unassigned'} • DoD: ${snapshot.dodScore || 'unknown'}${snapshot.blocked ? ' • BLOCKED' : ''}`;

        item.appendChild(sprint);
        item.appendChild(status);
        item.appendChild(details);
        issueTimeline.appendChild(item);
      });
    }

    issueSearch.addEventListener('input', function() {
      const query = this.value.toLowerCase();
      if (query.length < 3) {
        renderMessage('Type at least 3 characters to search...');
        return;
      }

      // Find matching issues
      const matchingIssues = ANALYTICS_DATA.issues.filter(i =>
        i.key.toLowerCase().includes(query) ||
        i.summary.toLowerCase().includes(query)
      );

      if (matchingIssues.length === 0) {
        renderMessage('No issues found');
        return;
      }

      // Group by issue key
      const issueGroups = {};
      matchingIssues.forEach(issue => {
        if (!issueGroups[issue.key]) {
          issueGroups[issue.key] = [];
        }
        issueGroups[issue.key].push(issue);
      });

      // Render timeline for first matching issue
      const firstKey = Object.keys(issueGroups)[0];
      const timeline = issueGroups[firstKey].sort((a, b) =>
        new Date(a.snapshotDate) - new Date(b.snapshotDate)
      );

      renderTimeline(firstKey, timeline, timeline[0].summary);
    });

    renderMessage('Search for an issue to view its lifecycle...');
  </script>
</body>
</html>
ANALYTICS_EOF

# Inject data into HTML
sed -i.bak "s|/\\*INJECT_DATA\\*/|${ANALYTICS_PAYLOAD}|" "$ANALYTICS_HTML"
rm "${ANALYTICS_HTML}.bak"

echo "Opening analytics dashboard for ${TEAM_NAME}..."
open "$ANALYTICS_HTML"
```
</step>

<step name="search">
**Subcommand: `search <query>`**

Perform full-text search across all historical issue data.

```bash
SEARCH_QUERY="$ARG"

if [ -z "$SEARCH_QUERY" ]; then
  echo "ERROR: Search query required."
  echo "Usage: /osp:sprint-history <team> search <query>"
  echo "Example: /osp:sprint-history pioneers search 'resource quota'"
  exit 1
fi

# Search issue snapshots
SEARCH_RESULTS=$(curl -s -X POST "${MEILI_URL}/indexes/issue-snapshots/search" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"q\": \"${SEARCH_QUERY}\",
    \"filter\": \"team = '${TEAM_NAME}'\",
    \"limit\": 50
  }")

TOTAL=$(echo "$SEARCH_RESULTS" | jq -r '.estimatedTotalHits // 0')

if [ "$TOTAL" -eq 0 ]; then
  echo "No issues found matching: ${SEARCH_QUERY}"
  exit 0
fi

echo "Search Results for '${SEARCH_QUERY}' (${TOTAL} matches)"
echo ""

# Group results by issue key and show latest snapshot
echo "$SEARCH_RESULTS" | jq -r '
  .hits |
  group_by(.key) |
  map({
    key: .[0].key,
    summary: .[0].summary,
    latestStatus: (sort_by(.snapshotDate) | last | .status),
    latestSprint: (sort_by(.snapshotDate) | last | .sprintName),
    sprintCount: length
  }) |
  .[] |
  [.key, .summary[0:60], .latestStatus, .latestSprint, .sprintCount] |
  @tsv
' | while IFS=$'\t' read -r key summary status sprint count; do
  echo "[$key] $summary..."
  echo "  Latest: $status in $sprint (appeared in $count sprints)"
  echo ""
done
```
</step>

<step name="compare">
**Subcommand: `compare <team2>`**

Compare two teams side-by-side using aggregate metrics from sprint-snapshots.

```bash
TEAM2="$ARG"

if [ -z "$TEAM2" ]; then
  echo "ERROR: Second team name required."
  echo "Usage: /osp:sprint-history <team1> compare <team2>"
  echo "Example: /osp:sprint-history pioneers compare crookshank"
  exit 1
fi

# Normalize team2 name
case "$TEAM2" in
  pioneers|Pioneers) TEAM2="Pioneers" ;;
  crookshank|CrookShank|Crookshank) TEAM2="CrookShank" ;;
  *) TEAM2="$(echo "$TEAM2" | sed 's/^./\U&/')" ;;
esac

# Fetch data for both teams
TEAM1_DATA=$(curl -s -X POST "${MEILI_URL}/indexes/sprint-snapshots/search" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"filter\": \"team = '${TEAM_NAME}'\", \"limit\": 200}")

TEAM2_DATA=$(curl -s -X POST "${MEILI_URL}/indexes/sprint-snapshots/search" \
  -H "Authorization: Bearer ${MEILI_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"filter\": \"team = '${TEAM2}'\", \"limit\": 200}")

TEAM1_COUNT=$(echo "$TEAM1_DATA" | jq -r '.estimatedTotalHits // 0')
TEAM2_COUNT=$(echo "$TEAM2_DATA" | jq -r '.estimatedTotalHits // 0')

if [ "$TEAM1_COUNT" -eq 0 ] || [ "$TEAM2_COUNT" -eq 0 ]; then
  echo "ERROR: Insufficient data for comparison."
  echo "  ${TEAM_NAME}: ${TEAM1_COUNT} sprints"
  echo "  ${TEAM2}: ${TEAM2_COUNT} sprints"
  exit 1
fi

# Calculate metrics for team 1
TEAM1_AVG_VELOCITY=$(echo "$TEAM1_DATA" | jq '[.hits[].completedSPs // 0] | add / length | floor')
TEAM1_AVG_COMPLETION=$(echo "$TEAM1_DATA" | jq '[.hits[].completionPercent // 0] | add / length | floor')
TEAM1_AVG_BLOCKED=$(echo "$TEAM1_DATA" | jq '[.hits[] | ((.blockedCount / .totalIssues * 100) // 0)] | add / length | floor')
TEAM1_AVG_CARRY=$(echo "$TEAM1_DATA" | jq '[.hits[] | ((.carryForwardCount / .totalIssues * 100) // 0)] | add / length | floor')
TEAM1_AVG_DOD=$(echo "$TEAM1_DATA" | jq '[.hits[].dodCompletePercent // 0] | add / length | floor')

# Calculate metrics for team 2
TEAM2_AVG_VELOCITY=$(echo "$TEAM2_DATA" | jq '[.hits[].completedSPs // 0] | add / length | floor')
TEAM2_AVG_COMPLETION=$(echo "$TEAM2_DATA" | jq '[.hits[].completionPercent // 0] | add / length | floor')
TEAM2_AVG_BLOCKED=$(echo "$TEAM2_DATA" | jq '[.hits[] | ((.blockedCount / .totalIssues * 100) // 0)] | add / length | floor')
TEAM2_AVG_CARRY=$(echo "$TEAM2_DATA" | jq '[.hits[] | ((.carryForwardCount / .totalIssues * 100) // 0)] | add / length | floor')
TEAM2_AVG_DOD=$(echo "$TEAM2_DATA" | jq '[.hits[].dodCompletePercent // 0] | add / length | floor')

# Display comparison table
echo "Team Comparison: ${TEAM_NAME} vs ${TEAM2}"
echo ""
printf "%-30s | %-20s | %-20s\n" "Metric" "${TEAM_NAME} (avg)" "${TEAM2} (avg)"
printf "%-30s-+-%-20s-+-%-20s\n" "------------------------------" "--------------------" "--------------------"
printf "%-30s | %18s SP | %18s SP\n" "Velocity (SP/sprint)" "$TEAM1_AVG_VELOCITY" "$TEAM2_AVG_VELOCITY"
printf "%-30s | %19s%% | %19s%%\n" "Completion Rate" "$TEAM1_AVG_COMPLETION" "$TEAM2_AVG_COMPLETION"
printf "%-30s | %19s%% | %19s%%\n" "Blocked Rate" "$TEAM1_AVG_BLOCKED" "$TEAM2_AVG_BLOCKED"
printf "%-30s | %19s%% | %19s%%\n" "Carry-Forward Rate" "$TEAM1_AVG_CARRY" "$TEAM2_AVG_CARRY"
printf "%-30s | %19s%% | %19s%%\n" "DoD Compliance" "$TEAM1_AVG_DOD" "$TEAM2_AVG_DOD"

echo ""
echo "Data Range:"
echo "  ${TEAM_NAME}: ${TEAM1_COUNT} sprints indexed"
echo "  ${TEAM2}: ${TEAM2_COUNT} sprints indexed"
```
</step>

<step name="index">
**Subcommand: `index [sprint-id]`**

Manually index a specific sprint from Jira for historical bootstrapping.

```bash
SPRINT_ID="$ARG"

if [ -z "$SPRINT_ID" ]; then
  # If no sprint ID provided, ask user
  echo "Manual Sprint Indexing"
  echo ""
  echo "This will fetch sprint data from Jira and index into Meilisearch."
  echo "You need the sprint ID from Jira."
  echo ""
  echo "Example: /osp:sprint-history pioneers index 47963"
  exit 1
fi

echo "Indexing sprint ${SPRINT_ID} for ${TEAM_NAME}..."
echo ""

# Call sprint-status with indexing (reuse existing logic)
# This delegates to the sprint-status skill which already has Jira fetching + indexing
echo "Delegating to /osp:sprint-status for data fetching and indexing..."
echo "Note: This requires Jira authentication to be configured."
echo ""
echo "To index a sprint, run: /osp:sprint-status ${TEAM_NAME}"
echo "The sprint-status skill will automatically index data into Meilisearch."
echo ""
echo "For bulk historical indexing, run sprint-status multiple times with:"
echo "  - Different sprint IDs (if you can target specific sprints)"
echo "  - Or run it weekly to build history over time"
```

**Note**: Full implementation would require duplicating Jira fetch logic from sprint-status. For MVP, recommend running sprint-status to auto-index. Future enhancement: extract Jira fetch to shared module.
</step>
</process>

<output>
Terminal tables or browser analytics dashboard showing:
1. **Velocity trend**: Committed vs completed story points over time
2. **Issue lifecycle**: Individual issue journey across sprints
3. **Analytics dashboard**: Interactive charts with velocity, completion rate, DoD trends, blocked issues
4. **Search results**: Full-text search across historical issue data
5. **Team comparison**: Side-by-side metrics for two teams
6. **Indexing confirmation**: Manual sprint indexing status
</output>

<success_criteria>
- [ ] Meilisearch availability is verified before queries
- [ ] Docker container auto-starts if stopped
- [ ] Velocity command shows tabular trend with summary stats
- [ ] Issue command tracks individual issue across sprints
- [ ] Trends command opens interactive analytics dashboard
- [ ] Search command performs full-text search with grouped results
- [ ] Compare command shows side-by-side team metrics
- [ ] Index command provides guidance for manual indexing
- [ ] Analytics dashboard renders with Chart.js
- [ ] Issue lifecycle viewer allows searching and tracking
- [ ] All subcommands handle empty data gracefully
- [ ] Help is shown when no subcommand provided
</success_criteria>
