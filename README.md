# Claude Skills for OpenShift Pipelines

A collection of [Claude Code](https://claude.ai/claude-code) skills for OpenShift Pipelines and Tekton development workflows. Includes a **sprint health dashboard** with React UI, Meilisearch-powered historical analytics, and standalone scripts that run without LLM tokens.

## Installation

### Install from GitHub (Recommended)

```bash
# Interactive installation (prompts for global/local)
npx github:openshift-pipelines/skills

# Install globally
npx github:openshift-pipelines/skills -- -g

# Install locally in current project
npx github:openshift-pipelines/skills -- -l
```

### Manual Installation

```bash
git clone https://github.com/openshift-pipelines/skills.git
cd skills
node bin/install.js -g
```

### Build the React Dashboard

```bash
cd dashboard
npm install
npm run build    # Outputs to docs/templates/built/index.html
```

## Sprint Status Dashboard

The flagship feature — a comprehensive sprint health dashboard for product owners managing multiple components and teams.

### Quick Start (No LLM Tokens)

```bash
# Run the sprint dashboard for a team
node bin/sprint-status.js pioneers

# Query historical sprint data
node bin/sprint-history.js pioneers velocity
node bin/sprint-history.js pioneers trends
node bin/sprint-history.js pioneers issue SRVKP-1801
node bin/sprint-history.js pioneers search "resource quota"
node bin/sprint-history.js pioneers compare crookshank
```

### Via Claude Code Skills

```
/osp:sprint-status pioneers
/osp:sprint-history pioneers trends
```

### What It Does

`sprint-status` fetches live data from Jira Cloud, computes 13 metrics, renders an interactive React dashboard in your browser, and auto-indexes everything into Meilisearch for historical tracking.

**Dashboard Features:**
- **Tab-based layout** — Overview (single screen), Issues, Velocity, DoD, Roadmap, People, Components, Trends
- **PO View / Assignee View** — toggle to filter the entire dashboard to one person
- **Sprint health score** — green/yellow/red badge with completion percentage
- **Days remaining** — progress bar with day count and SP completion
- **Actionable insights** — smart recommendations: who needs help, what's at risk, sprint reality check with descope candidates
- **Global filter** — search across all tables by issue key, assignee, or component

**Metrics Computed:**
| Metric | Description |
|--------|-------------|
| Sprint Summary | Issues/SPs by status, blocked count, no-SP count |
| Velocity Trend | Committed vs completed with rolling averages |
| Committed vs Done Gap | The SP gap across sprints for expectation management |
| Code Review SP Redo | Suggest reduced SPs for issues stuck in review |
| Blocked Issues | Flag-blocked + stale-blocked (no activity for 3+ days) |
| High Priority Bugs | Closure proximity with dot indicators |
| Carry-Forward Analysis | Issues persisting across sprints, worst offenders |
| DoD Compliance | Per-issue tracking via Jira labels (docs/tests/release-notes pending) |
| Roadmap Alignment | Planned vs unplanned vs CVE work |
| Future Sprint Priority | Ranked list: Vulnerabilities > Bugs > Stories |
| Per-Assignee Breakdown | Workload, status, blocked, carry-forward per person |
| Per-Component Breakdown | Same metrics grouped by component with issue listing |
| Multi-Sprint Trends | 8 trend charts from Meilisearch historical data |

**Charts (Recharts):**
- Donut charts: status distribution, SP allocation, DoD compliance, roadmap alignment
- Bar charts: SP by status, committed vs done gap, blocked trend, component/assignee workload
- Line charts: completion rate, carry-forward trend, DoD trend, code review bottleneck
- Health score timeline: colored circles across sprints

### Meilisearch Integration

Sprint data is automatically indexed into a local Meilisearch instance (Docker) on every run. On first run, the tool auto-backfills all closed sprints from Jira history.

```bash
# Meilisearch starts automatically via Docker
# Container: osp-meilisearch on port 7700
# Volume: osp-meili-data (persistent)
# No manual setup needed
```

**Two indexes:**
- `sprint-snapshots` — aggregate metrics per sprint (velocity, completion, blocked, DoD, roadmap)
- `issue-snapshots` — per-issue state per sprint (status, SP, assignee, DoD score)

### Blocked Issue Detection

Issues are flagged as blocked via three signals:
1. **Jira Blocked field** (`customfield_10517`)
2. **Jira Flagged/impediment** (`customfield_10021`)
3. **Stale detection** — no comments or updates for 3+ days on non-closed issues

### Definition of Done (DoD)

DoD compliance is tracked per issue using Jira labels:

| Label | Meaning |
|-------|---------|
| `docs-pending` | Documentation not provided |
| `release-notes-pending` | Release notes not written |
| `tests-pending` | Tests not written |
| `doc-req` | Documentation required |
| `missing-docs` | Reached QA without docs |

Full DoD checklists at Story/Feature/Epic levels are in `docs/definition-of-done.md`.

## All Available Commands

| Command | Description |
|---------|-------------|
| `/osp:help` | Show available commands and usage guide |
| `/osp:configure` | Set up Jira, Jira Cloud, GitHub, Konflux, and Meilisearch settings |
| `/osp:sprint-status` | Sprint health dashboard with React UI |
| `/osp:sprint-history` | Historical sprint analytics via Meilisearch |
| `/osp:pipeline` | Create or modify Tekton Pipeline resources |
| `/osp:task` | Create or modify Tekton Task resources |
| `/osp:debug` | Debug failed PipelineRuns or TaskRuns |
| `/osp:map-jira-to-upstream` | Find upstream Tekton GitHub issues for a Jira issue |
| `/osp:backlog-triage` | Deep LLM-powered backlog triage against upstream tektoncd repos |
| `/osp:release-status` | Track release status from Jira version |
| `/osp:release-checklist` | Generate component release checklist |
| `/osp:component-status` | Check release readiness of a component |
| `/osp:component-builds` | Check Konflux build status and image freshness |
| `/osp:konflux-image` | Extract image references from Konflux pipelines |
| `/osp:operator-release` | Run operator update workflows |
| `/osp:hack-config` | Configure hack repo for minor release |
| `/osp:component-config` | Configure a component for minor release |
| `/osp:operator-config` | Configure operator for minor release |
| `/osp:release-config` | Create Konflux release resources |
| `/osp:stage-release` | Execute stage release |
| `/osp:prod-release` | Execute production release |
| `/osp:pr-pipeline-status` | Check PR pipeline status |

### Standalone Scripts

| Script | Description |
|--------|-------------|
| `node bin/sprint-status.js <team>` | Full sprint dashboard (no LLM tokens) |
| `node bin/sprint-history.js <team> <subcommand>` | Historical analytics (no LLM tokens) |
| `python3 bin/fetch-backlog.py --config <toml>` | Fetch Jira backlog issues for triage |
| `python3 bin/gen-backlog-report.py --config <toml>` | Generate HTML report from triage analysis |
| `node bin/install.js` | Install skills to Claude Code |

## Configuration

### Jira Cloud Authentication (for sprint-status)

```bash
# Via environment variables
export JIRA_CLOUD_EMAIL="user@redhat.com"
export JIRA_CLOUD_TOKEN="your-api-token"

# Or via config file (run /osp:configure)
# Stored in ~/.config/osp/config.json under jira_cloud
```

Token: https://id.atlassian.com/manage-profile/security/api-tokens

### Jira Server Authentication (for release-status, map-jira-to-upstream)

```bash
export JIRA_TOKEN="your-personal-access-token"
```

Token: https://issues.redhat.com/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens

### GitHub Authentication (Optional)

```bash
gh auth login    # Recommended
# Or: export GITHUB_TOKEN="your-token"
```

## Project Structure

```
.
├── bin/
│   ├── install.js              # npx installer
│   ├── sprint-status.js        # Standalone sprint dashboard (1,200 lines)
│   ├── sprint-history.js       # Standalone history queries
│   └── konflux-auth.js         # Konflux SSO cookie extraction
├── commands/osp/               # Claude Code skills (22 files)
│   ├── sprint-status.md        # Sprint health dashboard skill
│   ├── sprint-history.md       # Historical analytics skill
│   ├── configure.md            # Auth setup (Jira, Jira Cloud, Konflux, Meilisearch)
│   ├── help.md                 # Command reference
│   └── ...                     # Pipeline, task, debug, release skills
├── dashboard/                  # React + Vite + Tailwind app
│   ├── src/
│   │   ├── components/         # 17 React components
│   │   ├── lib/types.ts        # TypeScript types
│   │   └── App.tsx             # Tab-based layout with PO/Assignee views
│   ├── package.json
│   └── vite.config.ts          # Builds to single HTML file
├── docs/
│   ├── definition-of-done.md   # Story/Feature/Epic DoD checklists
│   ├── templates/
│   │   ├── built/index.html    # React build output (single file)
│   │   ├── sprint-dashboard.html   # Legacy HTML dashboard
│   │   └── sprint-analytics.html   # Chart.js analytics dashboard
│   ├── superpowers/specs/      # Design specifications
│   └── references/             # Release process documentation
├── tests/
│   └── install.test.js         # Vitest tests (22 passing)
├── package.json
└── vitest.config.js
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Skills | Markdown with YAML frontmatter (Claude Code skill format) |
| Dashboard | React 19 + TypeScript + Tailwind CSS + Recharts |
| Build | Vite 5 + vite-plugin-singlefile (outputs single HTML) |
| Data | Jira Cloud REST API (Agile + Platform v3) |
| Search | Meilisearch (Docker, auto-managed) |
| Scripts | Node.js (built-in modules only, no npm dependencies) |
| Tests | Vitest |

## Updating

```bash
# Clone and install (recommended)
git clone https://github.com/openshift-pipelines/skills.git /tmp/osp-skills
cd /tmp/osp-skills && node bin/install.js -g
cd dashboard && npm install && npm run build
cd - && rm -rf /tmp/osp-skills
```

Restart Claude Code after updating to reload slash commands.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add or modify skills in `commands/osp/`
4. For dashboard changes: `cd dashboard && npm run dev` for hot reload
5. Run tests: `npm test`
6. Submit a pull request

## Resources

- [Tekton Documentation](https://tekton.dev/docs/)
- [OpenShift Pipelines Documentation](https://docs.openshift.com/pipelines/)
- [Tekton Hub](https://hub.tekton.dev/)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Red Hat Jira Cloud](https://redhat.atlassian.net)
- [Meilisearch Documentation](https://www.meilisearch.com/docs)

## License

Apache-2.0
