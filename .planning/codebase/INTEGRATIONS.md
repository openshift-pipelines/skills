# External Integrations

**Analysis Date:** 2026-01-15

## APIs & External Services

**Red Hat Jira API:**
- Issues.redhat.com - OpenShift Pipelines issue tracking
  - SDK/Client: Native `curl` with Bearer token authentication
  - Auth: `JIRA_TOKEN` env var or `~/.config/osp/config.json`
  - Endpoints used:
    - `GET /rest/api/2/issue/{key}` - Fetch issue details (`commands/osp/map-jira-to-upstream.md`)
    - `GET /rest/api/2/version/{versionId}` - Fetch version info (`commands/osp/release-status.md`)
    - `GET /rest/api/2/search?jql=fixVersion={versionId}` - List issues (`commands/osp/release-status.md`)
    - `GET /rest/api/2/project/{projectKey}/versions` - List versions (`commands/osp/release-status.md`)
    - `GET /rest/api/2/myself` - Verify authentication (`commands/osp/configure.md`)

**GitHub API:**
- github.com/tektoncd/* - Upstream Tekton repositories
- github.com/openshift-pipelines/* - OpenShift-specific repos
  - SDK/Client: `gh` CLI tool
  - Auth: OAuth via `gh auth login` or `GITHUB_TOKEN` env var
  - Commands used:
    - `gh search prs` - Search pull requests
    - `gh search issues` - Search issues
    - `gh auth status` - Check authentication
    - `gh api user` - Verify token

## Data Storage

**Databases:**
- None - File-based state only

**File Storage:**
- Local filesystem - Configuration and skill files
  - `~/.config/osp/config.json` - Credentials (600 permissions)
  - `~/.claude/commands/osp/` - Global skill installation
  - `./.claude/commands/osp/` - Local/project-level skills

**Caching:**
- None - Stateless operation

## Authentication & Identity

**Auth Provider:**
- Jira: Personal Access Token (PAT)
  - Token storage: Environment variable (preferred) or config file
  - Required scopes: Read access to issues
  - Validation: HTTP 200 from `/rest/api/2/myself`

**OAuth Integrations:**
- GitHub: OAuth via `gh` CLI
  - Credentials: Managed by gh CLI
  - Scopes: `repo` for public repo access

## Monitoring & Observability

**Error Tracking:**
- None - Console output only

**Analytics:**
- None

**Logs:**
- Console stdout/stderr - ANSI colored output via `bin/install.js`

## CI/CD & Deployment

**Hosting:**
- GitHub repository (github.com/openshift-pipelines/skills)
- Published via npm/npx

**CI Pipeline:**
- None configured (no `.github/workflows/` directory)

## Environment Configuration

**Development:**
- Required env vars: None (skills work without auth for basic functionality)
- Optional env vars: `JIRA_TOKEN`, `GITHUB_TOKEN`
- Secrets location: `~/.config/osp/config.json` (gitignored pattern)

**Production:**
- Same as development - CLI tool runs locally

## Webhooks & Callbacks

**Incoming:**
- None - This is a CLI tool, not a web service

**Outgoing:**
- None

## External Systems Interaction

**Tekton/OpenShift:**
- Tekton Hub (hub.tekton.dev) - Reference for reusable tasks
- OpenShift/Kubernetes clusters - Via `kubectl`, `oc`, `tkn` commands
- ClusterTasks - Built-in tasks like `git-clone`

**GitHub Organizations Monitored:**
- tektoncd/pipeline - Core pipeline functionality
- tektoncd/triggers - Event triggering
- tektoncd/cli - tkn CLI tool
- tektoncd/dashboard - Web UI
- tektoncd/operator - Kubernetes operator
- tektoncd/catalog - Reusable tasks and pipelines
- tektoncd/chains - Supply chain security
- tektoncd/results - Long-term result storage
- tektoncd/hub - Task/Pipeline hub

---

*Integration audit: 2026-01-15*
*Update when adding/removing external services*
