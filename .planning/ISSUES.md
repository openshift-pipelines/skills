# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

### ISS-003: Create /osp:wait-for-builds skill for Konflux pipeline monitoring

- **Discovered:** Phase 2 Task 1 (2026-01-19) — during Konflux rebuild trigger execution
- **Priority:** Medium (needed for 02-03 verification plan)
- **Description:**
  - Wait-and-check skill that monitors Konflux on-push pipelines after triggering rebuilds
  - Polls every 15 minutes to check pipeline status
  - Continues until all pipelines complete (pass or fail) or 3-hour timeout
  - Reports final status of all monitored components
- **Use case:** After triggering rebuilds on multiple components, need automated way to wait for all builds to complete before proceeding to release
- **Suggested implementation:**
  - Accept list of repo/branch pairs to monitor
  - Use `gh api` to check pipeline runs on each repo
  - Track pending, running, success, failure states
  - Exit with summary when all complete or timeout reached

## Closed Enhancements

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
