# Sprint Status Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/osp:sprint-status`, a sprint health dashboard skill that fetches Jira Cloud data and renders an interactive browser-based companion UI for product owners.

**Architecture:** Skill Markdown file (`sprint-status.md`) orchestrates Jira Cloud API calls via curl/jq, computes metrics in bash, and injects a JSON payload into a self-contained HTML dashboard template (`sprint-dashboard.html`) opened in the browser.

**Tech Stack:** Bash/curl/jq (skill), HTML/CSS/JS (companion UI), Node.js (installer update), Vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-23-sprint-status-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `docs/definition-of-done.md` | Create | DoD checklist at Story/Feature/Epic levels, label signals, SLI/SLO targets (already created) |
| `commands/osp/sprint-status.md` | Create | Skill definition — auth, data fetching, metric computation, DoD compliance, JSON assembly, dashboard launch |
| `docs/templates/sprint-dashboard.html` | Create | Companion UI — receives JSON payload, renders all dashboard sections |
| `commands/osp/configure.md` | Modify | Add Jira Cloud auth section (email + API token, Basic auth verification) |
| `commands/osp/help.md` | Modify | Add sprint-status to command reference table |
| `bin/install.js` | Modify | Copy `docs/templates/` to `~/.claude/templates/osp/` during install |
| `.env.example` | Modify | Add `JIRA_CLOUD_EMAIL` and `JIRA_CLOUD_TOKEN` variables |
| `tests/install.test.js` | Modify | Add test for templates directory copying |

---

### Task 1: Update `.env.example` with Jira Cloud variables

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add Jira Cloud variables to .env.example**

Add after the existing `GITHUB_TOKEN` entry:

```
# Jira Cloud API Token (required for /osp:sprint-status)
# Create token at: https://id.atlassian.com/manage-profile/security/api-tokens
JIRA_CLOUD_EMAIL=
JIRA_CLOUD_TOKEN=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "chore: add Jira Cloud env vars to .env.example"
```

---

### Task 2: Update `configure.md` with Jira Cloud auth

**Files:**
- Modify: `commands/osp/configure.md:59-71` (prompt_configuration step)
- Modify: `commands/osp/configure.md:73-130` (configure_jira step — add Jira Cloud section after it)
- Modify: `commands/osp/configure.md:341-403` (verify_configuration step)
- Modify: `commands/osp/configure.md:406-423` (show_config step)

- [ ] **Step 1: Add Jira Cloud option to the configuration prompt**

In the `prompt_configuration` step (line 62), add a new bullet after the Jira authentication line:

```
- Jira Cloud authentication (required for `/osp:sprint-status` — redhat.atlassian.net)
```

- [ ] **Step 2: Add configure_jira_cloud step**

Add a new step after `</step>` on line 130 (end of `configure_jira` step):

```xml
<step name="configure_jira_cloud">
If configuring Jira Cloud:

1. Explain how to get a Jira Cloud API token:
```
## Getting a Jira Cloud API Token

**Direct link**: https://id.atlassian.com/manage-profile/security/api-tokens

Steps:
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a label (e.g., "Claude Skills")
4. Click "Create"
5. **Copy the token immediately** — it's only shown once!

You also need your Jira Cloud email address (your Red Hat email).
```

2. Ask for email and token via AskUserQuestion:

**Question 1**: What is your Jira Cloud email address? (e.g., user@redhat.com)
**Question 2**: Paste your Jira Cloud API token.

3. Save to config file:
```bash
mkdir -p ~/.config/osp
chmod 700 ~/.config/osp

# Read existing config or create new
if [ -f ~/.config/osp/config.json ]; then
  CONFIG=$(cat ~/.config/osp/config.json)
else
  CONFIG='{}'
fi

# Add jira_cloud section
echo "$CONFIG" | jq \
  --arg email "USER_EMAIL" \
  --arg token "USER_TOKEN" \
  '. + {jira_cloud: {base_url: "https://redhat.atlassian.net", email: $email, token: $token}}' \
  > ~/.config/osp/config.json

chmod 600 ~/.config/osp/config.json
```

Replace USER_EMAIL and USER_TOKEN with actual values using the Edit tool.

4. Verify the credential:
```bash
EMAIL=$(jq -r '.jira_cloud.email' ~/.config/osp/config.json)
TOKEN=$(jq -r '.jira_cloud.token' ~/.config/osp/config.json)
AUTH=$(echo -n "${EMAIL}:${TOKEN}" | base64)

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Basic ${AUTH}" \
  "https://redhat.atlassian.net/rest/api/3/myself")

if [ "$HTTP_CODE" = "200" ]; then
  DISPLAY_NAME=$(curl -s -H "Authorization: Basic ${AUTH}" \
    "https://redhat.atlassian.net/rest/api/3/myself" | jq -r '.displayName')
  echo "Jira Cloud: Connected as ${DISPLAY_NAME}"
else
  echo "Jira Cloud: Authentication failed (HTTP $HTTP_CODE)"
fi
```
</step>
```

- [ ] **Step 3: Add Jira Cloud to verify_configuration step**

In the `verify_configuration` step (after the existing Jira test around line 360), add:

```bash
# Test Jira Cloud access
if [ -f ~/.config/osp/config.json ]; then
  JC_EMAIL=$(jq -r '.jira_cloud.email // empty' ~/.config/osp/config.json)
  JC_TOKEN=$(jq -r '.jira_cloud.token // empty' ~/.config/osp/config.json)
  if [ -n "$JC_EMAIL" ] && [ -n "$JC_TOKEN" ]; then
    AUTH=$(echo -n "${JC_EMAIL}:${JC_TOKEN}" | base64)
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Basic ${AUTH}" \
      "https://redhat.atlassian.net/rest/api/3/myself")
    if [ "$HTTP_CODE" = "200" ]; then
      echo "Jira Cloud: Connected"
    else
      echo "Jira Cloud: Failed (HTTP $HTTP_CODE)"
    fi
  fi
fi
```

Add `Jira Cloud` row to the Configuration Status table.

- [ ] **Step 4: Add Jira Cloud to show_config step**

In the `show_config` step, add redaction for `jira_cloud.token`:

```bash
jq 'if .jira.token then .jira.token = "[REDACTED]" else . end |
    if (.jira_cloud // {}).token then .jira_cloud.token = "[REDACTED]" else . end |
    if .github.token then .github.token = "[REDACTED]" else . end' \
  ~/.config/osp/config.json
```

- [ ] **Step 5: Commit**

```bash
git add commands/osp/configure.md
git commit -m "feat(configure): add Jira Cloud authentication support

Adds jira_cloud config section with email + API token for Basic auth
against redhat.atlassian.net. Existing Jira Server auth preserved for
backward compatibility with release-status and other skills."
```

---

### Task 3: Update `bin/install.js` to copy templates

**Files:**
- Modify: `bin/install.js:140-172` (install function)
- Test: `tests/install.test.js`

- [ ] **Step 1: Write the test for template copying**

Add inside the existing `describe('copyDirectory', ...)` block in `tests/install.test.js` (after line 162, before the closing `})`):

```javascript
  it('copies HTML template files for companion UI', () => {
    const srcTemplates = path.join(srcDir, 'templates');
    fs.mkdirSync(srcTemplates);
    fs.writeFileSync(path.join(srcTemplates, 'sprint-dashboard.html'), '<html>test</html>');

    copyDirectory(srcDir, destDir);

    expect(fs.existsSync(path.join(destDir, 'templates', 'sprint-dashboard.html'))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, 'templates', 'sprint-dashboard.html'), 'utf8')).toBe('<html>test</html>');
  });
```

Note: Uses the existing `srcDir`, `destDir`, and `tempDir` variables from the `beforeEach`/`afterEach` hooks at lines 115-124.

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /Users/vibhavbobade/go/src/github.com/openshift-pipelines/skills && npm test
```

Expected: PASS (copyDirectory already works — this confirms templates copy works with the existing function)

- [ ] **Step 3: Update install function to copy templates**

In `bin/install.js`, modify the `install` function (after line 158 `copyDirectory(commandsSource, commandsDest);`):

```javascript
  // Copy templates if they exist
  const templatesSource = path.join(__dirname, '..', 'docs', 'templates');
  const templatesDest = path.join(targetDir, 'templates', NAMESPACE);

  if (fs.existsSync(templatesSource)) {
    console.log(`${colors.dim}Installing templates to: ${templatesDest}${colors.reset}`);
    copyDirectory(templatesSource, templatesDest);
  }
```

- [ ] **Step 4: Run tests to verify nothing broke**

```bash
cd /Users/vibhavbobade/go/src/github.com/openshift-pipelines/skills && npm test
```

Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add bin/install.js tests/install.test.js
git commit -m "feat(install): copy templates directory during installation

Copies docs/templates/ to ~/.claude/templates/osp/ so the sprint-status
companion UI HTML template is available at runtime."
```

---

### Task 4: Create the companion UI HTML template

**Files:**
- Create: `docs/templates/sprint-dashboard.html`

This is the largest task. The HTML file is self-contained with inline CSS and JS. All rendering uses safe DOM methods (`createElement`, `textContent`, `appendChild`) — never `innerHTML` — to prevent XSS.

- [ ] **Step 1: Create the HTML file with CSS and JS rendering engine**

Create `docs/templates/sprint-dashboard.html`. Key design decisions:

**CSS:**
- CSS custom properties for dark/light theming (`prefers-color-scheme`)
- Grid layout for summary cards
- Table styles, collapsible sections, color-coded alerts
- Bar chart via CSS flexbox (no charting library)
- Proximity dots for bug closure status

**JS rendering engine:**
- Helper function `$('tag', {class: '...', onClick: fn}, ...children)` creates DOM elements safely
- All text content set via `textContent` (safe from XSS)
- `link(key)` creates `<a>` elements linking to Jira Cloud browse URL
- Each dashboard section has its own render function returning a DOM element or null
- Empty states handled per section (returns message div instead of empty table)
- Collapsible sections via click handler toggling CSS classes

**Dashboard sections (12 total):**
1. `renderHeader()` — sprint name, team, dates
2. `renderSummaryCards()` — total/completed/code-review/blocked cards
3. `renderAlerts()` — expectation management warnings
4. `renderRoadmap()` — planned/unplanned/CVE bar, epic progress table
5. `renderVelocity()` — horizontal bar chart, rolling averages, trend
6. `renderDoD()` — DoD compliance bar (complete/at-risk/incomplete %), table of non-compliant issues with missing items
7. `renderCodeReview()` — SP redo recommendation table with totals
7. `renderBlocked()` — blocked issues with reasons
8. `renderBugs()` — high priority bugs with proximity dots
9. `renderCarryForward()` — worst offenders with sprint count, severity coloring
10. `renderFutureSprint()` — ranked priority list with type tags
11. `renderAssignees()` — collapsible per-assignee sections
12. `renderComponents()` — collapsible per-component sections

**Data injection point:**
The template contains `const DATA = {};` which the skill replaces with the actual JSON payload via `sed`.

The full HTML content should be approximately 350-400 lines covering all the above. Use the CSS color scheme from the spec (dark theme: navy/blue tones, light theme: clean whites).

- [ ] **Step 2: Verify HTML opens correctly in browser with empty DATA**

```bash
open /Users/vibhavbobade/go/src/github.com/openshift-pipelines/skills/docs/templates/sprint-dashboard.html
```

Expected: Page loads, shows "No data loaded."

- [ ] **Step 3: Test with sample JSON data**

Create a temp file that injects sample DATA matching the spec's JSON schema. Open in browser and visually verify all 12 sections render correctly:
- Summary cards show colored values
- Velocity bar chart renders with correct proportions
- Roadmap alignment bar shows three segments
- Tables are populated and sortable by sprint count
- Collapsible sections expand/collapse on click
- Issue keys are clickable links
- Dark/light theme works

- [ ] **Step 4: Commit**

```bash
git add docs/templates/sprint-dashboard.html
git commit -m "feat: add sprint dashboard companion UI template

Self-contained HTML/CSS/JS dashboard with dark/light theme, summary
cards, velocity chart, roadmap alignment bar, code review SP redo table,
blocked issues, bug proximity, carry-forward offenders, future sprint
priority, per-assignee and per-component collapsible breakdowns.
All rendering uses safe DOM methods (no innerHTML)."
```

---

### Task 5: Create the sprint-status skill

**Files:**
- Create: `commands/osp/sprint-status.md`

This is the core skill file. It follows the existing skill pattern (YAML frontmatter + objective/process/output/success_criteria).

- [ ] **Step 1: Create the skill file**

Create `commands/osp/sprint-status.md` with:

**Frontmatter:**
```yaml
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
```

**Objective:**
Provide a sprint health dashboard for product owners managing multiple components across team sprints. Fetches data from Jira Cloud (redhat.atlassian.net), computes velocity, blockers, carry-forwards, roadmap alignment, and future sprint prioritization, then renders an interactive browser-based dashboard.

**Execution context section covering:**
- Jira Cloud API endpoints and auth pattern (Basic auth, `email:api_token`)
- Project: SRVKP
- Team identification via sprint name pattern `Pipelines Sprint {TeamName} {N}`
- Sprint exclusion: names containing "Release" or "perf&scale"
- Custom field IDs table (Story Points, Original Story Points, Sprint, Blocked, Blocked Reason, Flagged)
- All workflow statuses
- Vulnerability issue type for CVE detection (id: 10172)
- Companion UI template path: `~/.claude/templates/osp/sprint-dashboard.html` with fallbacks

**Process steps:**

**Step 1 — auth_check:** Read `jira_cloud.email` and `jira_cloud.token` from `~/.config/osp/config.json`, fallback to `JIRA_CLOUD_EMAIL`/`JIRA_CLOUD_TOKEN` env vars. Build Basic auth header. Verify via `GET /rest/api/3/myself`. If fails, direct to `/osp:configure`.

**Step 2 — team_resolution:** Query all scrum boards for SRVKP (`GET /rest/agile/1.0/board?projectKeyOrId=SRVKP&type=scrum`). For each board, get active sprints. Filter by team name pattern, exclude Release/perf&scale. If team not provided as arg, present list and prompt via `AskUserQuestion`. Match team to sprint ID, name, dates, board ID.

**Step 3 — fetch_active_sprint_issues:** Paginate through `GET /rest/agile/1.0/sprint/{sprintId}/issue` with `maxResults=100`. Request fields: summary, status, priority, issuetype, assignee, components, labels, created, parent, customfield_10028, customfield_10977, customfield_10020, customfield_10517, customfield_10483, customfield_10021. Use `sleep 0.1` between pages.

**Step 4 — fetch_historical_sprints:** Get closed sprints from the board, filter by team name, take last 5. For each, fetch issues (include `parent` field for roadmap alignment trend computation) and compute committed/completed SPs. If zero closed sprints, skip velocity section.

**Step 5 — fetch_future_sprint:** Get future sprints from board, filter by team name, exclude "Ranked Issues" sprint. If none found, skip future sprint section.

**Step 6 — fetch_epic_progress:** Extract unique parent Epic keys from sprint issues. Batch-query children via JQL: `parent in (EPIC-1, ...) OR "Epic Link" in (EPIC-1, ...)`. Compute total and completed SPs per Epic.

**Step 7 — fetch_carry_forward_comments:** For issues with 3+ sprints matching team pattern in `customfield_10020`, fetch latest comment via `GET /rest/api/3/issue/{key}?fields=comment`. Extract last comment text.

**Step 8 — compute_metrics:** Use jq to compute all metrics:
1. Sprint summary: group by status, count + SPs per status, blocked count, noStoryPoints count
2. Adjusted velocity: Closed SPs, completion rate
3. Code Review SP redo: filter Code Review issues, suggest `ceil(sp * 0.5)` (min 1), flag re-estimated
4. Blocked issues: filter by customfield_10517 or customfield_10021, extract reason
5. High priority bugs: filter Bug + Critical/Blocker/Major, score proximity by status
6. Carry-forward: count team sprints in customfield_10020 per issue, sort desc, attach comments, assign severity (1-2 normal, 3-4 warning, 5+ critical)
7. Velocity trend: per-sprint committed/completed/carried, commitment accuracy per sprint (`completed/committed*100` as array), rolling averages, trend direction
8. Expectation management: over/under-commitment, carry-forward rate, code review bottleneck
9. Roadmap alignment: planned (has Epic parent) vs unplanned vs CVE, Epic progress, untracked count. **Also compute alignment trend** — for each of the last 5 historical sprints, classify their issues as planned/unplanned/CVE and compute the planned-work % to produce `alignmentTrend` array. This requires the historical sprint issues (already fetched in Step 4) to also have the `parent` field — ensure `parent` is included in the historical sprint issue fields.
10. DoD compliance: for each issue, check `labels` for DoD-related labels (`docs-pending`, `release-notes-pending`, `tests-pending`, `doc-req`, `release-notes-req`, `test-req`, `missing-docs`, `groomable`). Score each issue: Complete (no pending labels + Done status), At Risk (approaching Done with pending labels — Code Review/Dev Complete/On QA with pending labels), Incomplete (has pending/req labels in earlier statuses), N/A (Spike/Task/Sub-task). Aggregate counts/percentages. List at-risk and incomplete issues with which DoD items are missing.
11. Future sprint priority: sort by type/priority (Vulnerability > Bug-Blocker > Bug-Critical > ...)
12. Per-assignee: group by assignee, count/SPs/status breakdown (including Code Review issues pending count)/blocked/carry-forward per person
13. Per-component: group by component, count/SPs/status/blocked/carry-forward/bugs

Assemble into JSON schema from spec.

**Step 9 — render_dashboard:** Locate HTML template (check `~/.claude/templates/osp/`, fallback to `./docs/templates/`). Create temp file via `mktemp`, `chmod 600`. Replace `const DATA = {};` with actual JSON via `sed`. Open with `open` (macOS) or `xdg-open` (Linux).

**Step 10 — terminal_summary:** Print concise text summary: velocity, alerts, top 3 action items, key numbers, dashboard file path.

**Success criteria:** 16 checkboxes covering auth, discovery, pagination, velocity, expectations, roadmap, code review redo, blocked, bugs, carry-forward, future sprint priority, assignee/component breakdowns, companion UI, terminal summary, edge cases, Jira links.

- [ ] **Step 2: Verify the skill file has valid YAML frontmatter**

```bash
head -8 commands/osp/sprint-status.md
```

Expected: Valid YAML frontmatter with name, description, allowed-tools.

- [ ] **Step 3: Commit**

```bash
git add commands/osp/sprint-status.md
git commit -m "feat: add /osp:sprint-status skill

Sprint health dashboard for product owners managing multiple components.
Fetches Jira Cloud data, computes velocity, blockers, carry-forwards,
roadmap alignment, and future sprint prioritization. Renders browser-based
companion UI with per-assignee and per-component breakdowns."
```

---

### Task 6: Update help.md with sprint-status command

**Files:**
- Modify: `commands/osp/help.md:39-43` (Issue Tracking section)

- [ ] **Step 1: Add sprint-status to the help command reference**

In `commands/osp/help.md`, add a new section after "Issue Tracking & Upstream" (line 43):

```markdown
### Sprint Management
| Command | Description |
|---------|-------------|
| `/osp:sprint-status` | Sprint health dashboard — velocity, blockers, carry-forwards, roadmap alignment |
```

Also add to the Quick Start section (after line 71, the last numbered item):

```
7. **Sprint health**: `/osp:sprint-status` - Sprint dashboard for product owners
```

And add a Common Workflows entry (after the "Copy images for release" section, around line 93):

```markdown
### "Sprint health check"
1. `/osp:sprint-status <team>` — Full sprint health dashboard (velocity, blockers, carry-forwards, roadmap alignment)
```

- [ ] **Step 2: Commit**

```bash
git add commands/osp/help.md
git commit -m "docs(help): add /osp:sprint-status to command reference"
```

---

### Task 7: Integration test — run the skill manually

**Files:**
- None (manual verification)

- [ ] **Step 1: Verify Jira Cloud auth works**

```bash
JC_EMAIL=$(jq -r '.jira_cloud.email // empty' ~/.config/osp/config.json)
JC_TOKEN=$(jq -r '.jira_cloud.token // empty' ~/.config/osp/config.json)
AUTH=$(echo -n "${JC_EMAIL}:${JC_TOKEN}" | base64)
curl -s -H "Authorization: Basic ${AUTH}" "https://redhat.atlassian.net/rest/api/3/myself" | jq .displayName
```

Expected: Your display name.

- [ ] **Step 2: Test sprint discovery**

```bash
# Find Pioneers active sprint
BOARDS=$(curl -s -H "Authorization: Basic ${AUTH}" "https://redhat.atlassian.net/rest/agile/1.0/board?projectKeyOrId=SRVKP&type=scrum&maxResults=50" | jq -r '.values[].id')
for BOARD_ID in $BOARDS; do
  curl -s -H "Authorization: Basic ${AUTH}" "https://redhat.atlassian.net/rest/agile/1.0/board/${BOARD_ID}/sprint?state=active" | jq '.values[]? | select(.name | test("Pioneers"; "i")) | {id, name, endDate}'
done
```

Expected: Sprint ID and name for Pioneers.

- [ ] **Step 3: Test template location resolution**

```bash
ls ~/.claude/templates/osp/sprint-dashboard.html 2>/dev/null && echo "FOUND" || echo "NOT FOUND — run installer"
```

- [ ] **Step 4: Run the full skill**

```
/osp:sprint-status pioneers
```

Expected: Dashboard opens in browser with all sections populated. Terminal shows summary.

- [ ] **Step 5: Verify edge cases**

Run with a team that has no future sprint, verify "No future sprint found" appears.
Check that issues with null story points are counted in issue counts but show as 0 SP.

- [ ] **Step 6: Final commit if any fixes needed**

```bash
git add -A && git commit -m "fix: address integration test findings for sprint-status"
```
