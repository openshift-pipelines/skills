# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

_None currently open._

## Closed Enhancements

### ISS-003: Create /osp:wait-for-builds skill for Konflux pipeline monitoring

- **Discovered:** Phase 2 Task 1 (2026-01-19) — during Konflux rebuild trigger execution
- **Resolved:** Phase 2 Plan 2 (2026-01-19)
- **Resolution:** Implemented as `/osp:component-builds` skill with three modes:
  - `status`: One-shot pipeline status check for all 11 components
  - `watch`: Poll every 15 minutes until complete (3hr timeout)
  - `freshness`: Verify images are fresh (<72h since last commit)
- Skill file: `commands/osp/component-builds.md`
- Covers all ISS-003 requirements plus freshness checking

### ISS-001: Create /osp:pr-pipeline-status skill to diagnose Konflux pipeline failures

- **Discovered:** Phase 1 Task 2 (2026-01-19)
- **Resolved:** Phase 1 (2026-01-19)
- **Resolution:** Created `commands/osp/pr-pipeline-status.md` skill with:
  - PR check status via `gh pr checks`
  - Konflux pipeline URL parsing
  - SSO authentication flow (prompts user to configure via `/osp:configure`)
  - Common failure pattern diagnosis (base images, EC, build errors)
  - Actionable fix recommendations
- Updated `/osp:configure` to support Konflux SSO cookie storage

### ISS-002: Register release-checklist skill in package.json

- **Discovered:** Phase 1 Task 2 (2026-01-19)
- **Resolved:** Phase 1 (2026-01-19)
- **Resolution:** Not needed - install script auto-discovers all `.md` files in `commands/osp/`. The skill file already exists and will be available after reinstall (`node bin/install.js -g`).
