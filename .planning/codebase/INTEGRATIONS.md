# External Integrations

**Analysis Date:** 2026-01-19

## APIs & External Services

**Red Hat Jira API:**
- Service: Red Hat Jira (issues.redhat.com)
- Endpoint Base: `https://issues.redhat.com/rest/api/2/`
- Used By:
  - `/osp:release-status` - `commands/osp/release-status.md`
  - `/osp:release-checklist` - `commands/osp/release-checklist.md`
  - `/osp:map-jira-to-upstream` - `commands/osp/map-jira-to-upstream.md`
  - `/osp:configure` - `commands/osp/configure.md`
- Authentication: Bearer token via `JIRA_TOKEN` env var or `~/.config/osp/config.json`
- Key Endpoints:
  - `GET /rest/api/2/version/{versionId}` - Fetch version details
  - `GET /rest/api/2/search?jql=fixVersion={versionId}` - Fetch issues for version
  - `GET /rest/api/2/project/{projectKey}/versions` - List project versions
  - `GET /rest/api/2/myself` - Test authentication
- Projects: SRVKP (OpenShift Pipelines)

**GitHub API:**
- Service: GitHub (github.com)
- Organizations:
  - `github.com/openshift-pipelines/*` - OpenShift Pipelines repositories
  - `github.com/tektoncd/*` - Upstream Tekton projects
- Used By:
  - `/osp:map-jira-to-upstream` - Maps Jira issues to GitHub issues
  - `/osp:release-status` - Searches for related PRs
  - `/osp:operator-release` - Operator update workflows
  - `/osp:component-status` - Component status verification
- Authentication: GitHub CLI (`gh`) authentication or `GITHUB_TOKEN` env var
- Features: PR search, issue linking, workflow execution

## Third-Party Tools & CLI

**GitHub CLI (gh):**
- Used for GitHub API access and workflow management
- Commands: `gh search prs`, `gh auth status`, `gh api`, `gh workflow run`
- Required for: GitHub operations in skills

**Kubernetes/OpenShift CLI Tools:**
- `tkn` (Tekton CLI) - Pipeline/TaskRun management
  - Commands: `tkn pipelinerun list`, `tkn taskrun list`, `tkn pipeline describe`
- `kubectl/oc` - Kubernetes cluster management
  - Commands: Pod inspection, events, resource status
- Used by: `/osp:debug` skill

**Other CLI Tools:**
- `curl` - HTTP requests to APIs
- `jq` - JSON parsing and transformation
- `skopeo` - Container image inspection (for Konflux builds)

## External Services & Platforms

**Tekton Ecosystem:**
- Tekton Documentation: https://tekton.dev/docs/
- Tekton Hub: https://hub.tekton.dev/
- Tekton API Versions: v1 (preferred) and v1beta1

**Konflux CI/CD:**
- Component builds and image generation
- Registry: `quay.io/redhat-user-workloads/tekton-ecosystem-tenant/`
- Console: https://console.redhat.com/application-pipeline/workspaces/tekton-ecosystem-tenant

**OpenShift/Kubernetes:**
- Skills deploy/debug Tekton resources in clusters
- Uses: Pipeline, Task, PipelineRun, TaskRun resources

## Data Storage

**Databases:**
- Not applicable (no database used)

**File Storage:**
- Local config: `~/.config/osp/config.json`
- Temp files: `/tmp/release-issues.json` (during release operations)

**Caching:**
- Not applicable

## Authentication & Identity

**Auth Provider:**
- Manual token-based authentication
- No OAuth flows

**Token Sources:**
- Environment variables: `JIRA_TOKEN`, `GITHUB_TOKEN`
- Config file: `~/.config/osp/config.json`

**Token Verification:**
- `/osp:configure` validates tokens against APIs
- Skills check auth before making API calls

## Monitoring & Observability

**Error Tracking:**
- Not applicable (CLI tool with console output)

**Analytics:**
- Not applicable

**Logs:**
- Console output only

## CI/CD & Deployment

**Hosting:**
- Distributed as npm package
- Registry: npmjs.com

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`)
- Runs tests on Node.js 18.x and 20.x
- Validates skill YAML frontmatter

## Environment Configuration

**Development:**
- Required env vars: None (tokens optional for development)
- Secrets location: `.env.local` (gitignored)

**Production (User Environment):**
- Required: `JIRA_TOKEN` for Jira operations
- Optional: `GITHUB_TOKEN` (can use `gh` auth instead)
- Config: `~/.config/osp/config.json` with 600 permissions

## Webhooks & Callbacks

**Incoming:**
- Not applicable

**Outgoing:**
- Not applicable

## Integration Points Summary

| Service | Purpose | Authentication | Skills Using |
|---------|---------|----------------|--------------|
| Red Hat Jira | Issue tracking, release management | JIRA_TOKEN | release-status, release-checklist, map-jira-to-upstream |
| GitHub API | Upstream issue mapping, PR tracking | gh CLI or GITHUB_TOKEN | map-jira-to-upstream, component-status, operator-release |
| Tekton APIs | Pipeline/Task management | Cluster credentials | pipeline, task, debug |
| Konflux | Component builds verification | Cluster credentials | operator-release |

---

*Integration audit: 2026-01-19*
*Update when adding/removing external services*
