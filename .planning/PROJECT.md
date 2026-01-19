# OpenShift Pipelines 1.15.4 Patch Release

## What This Is

Execute the OpenShift Pipelines 1.15.4 patch release from start to finish. This involves assessing the Jira version, resolving blocking issues (CVEs, upstream dependencies, build failures), and executing the release through stage and production using existing Claude Code skills.

## Core Value

**Ship 1.15.4 with all blocking CVEs and issues resolved.** The release has a tight deadline with known blockers that must be cleared before stage release can proceed.

## Requirements

### Validated

- ✓ Skills distribution system working — existing (`bin/install.js`)
- ✓ `/osp:release-status` skill — fetches Jira issues, categorizes by status
- ✓ `/osp:release-checklist` skill — maps components, analyzes CVEs, generates checklists
- ✓ `/osp:stage-release` skill — executes CORE → CLI → OPERATOR → INDEX stage releases
- ✓ `/osp:prod-release` skill — executes production releases with prerequisites
- ✓ `/osp:configure` skill — manages Jira/GitHub authentication
- ✓ Component mapping to downstream repos — documented in release-checklist.md

### Active

- [ ] Assess 1.15.4 release state — get Jira version status, identify all issues
- [ ] Resolve blocking CVEs — check upstream fixes, run update-sources workflows
- [ ] Resolve upstream dependency issues — cherry-pick or update tracking as needed
- [ ] Fix build/CI issues — Konflux pipeline problems, base image availability
- [ ] Execute stage release — CORE → CLI → OPERATOR → INDEX
- [ ] Execute production release — after QE validation

### Out of Scope

- New skill development — use existing skills only
- Other release versions — only 1.15.4
- Skills infrastructure improvements — focus on release execution

## Context

**Jira Version:** https://issues.redhat.com/projects/SRVKP/versions/12453355

**Known Blockers:**
1. **CVEs needing fixes** — Security vulnerabilities in dependencies (e.g., jwt-go, oauth2, x/crypto)
2. **Upstream changes pending** — Waiting on tektoncd/* upstream PRs or releases
3. **Build/CI issues** — Konflux pipelines, base image availability, Enterprise Contract checks

**Release Type:** Patch release (RHBA advisory)

**Branch Pattern:** `release-v1.15.x`

**Authentication Required:**
- Jira: `JIRA_TOKEN` or `~/.config/osp/config.json`
- GitHub: `gh` CLI authenticated
- Konflux: `oc` CLI authenticated to RH02 cluster

**Existing Skills Available:**
- `/osp:release-status` — Track release progress
- `/osp:release-checklist` — Generate comprehensive checklist with CVE analysis
- `/osp:stage-release` — Execute stage release
- `/osp:prod-release` — Execute production release
- `/osp:configure` — Set up authentication

## Constraints

- **Timeline**: Urgent — tight deadline for this patch release
- **Dependencies**: Upstream tektoncd/* repos must have fixes before downstream can pull
- **Build System**: Konflux-based CI/CD, requires working pipelines
- **Registry**: Images must be available in target registries (stage → prod)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use existing skills only | Skills already cover release workflow; no time for new development | — Pending |
| Upstream-first CVE fixes | Forked components must get fixes from upstream via update-sources | — Pending |

---
*Last updated: 2026-01-19 after initialization*
