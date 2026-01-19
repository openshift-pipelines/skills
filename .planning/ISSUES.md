# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

### ISS-001: Create /osp:pr-pipeline-status skill to diagnose Konflux pipeline failures

- **Discovered:** Phase 1 Task 2 (2026-01-19)
- **Type:** Tooling / Automation
- **Description:** During release assessment, PR #903 shows Konflux pipeline failure but there's no way to programmatically diagnose why. The Konflux UI requires SSO authentication. Need a skill that can:
  1. Check PR pipeline status via `gh pr checks`
  2. Parse Konflux pipeline run URLs
  3. Provide guidance on common failure patterns (base image issues, EC failures, build errors)
  4. Optionally integrate with Konflux API if available
- **Impact:** Medium (blocks release workflow when pipelines fail)
- **Effort:** Medium
- **Suggested phase:** Phase 2 or Future (before next release)

### ISS-002: Register release-checklist skill in package.json

- **Discovered:** Phase 1 Task 2 (2026-01-19)
- **Type:** Configuration
- **Description:** The `/osp:release-checklist` skill file exists at `commands/osp/release-checklist.md` but is not registered in package.json, making it uninvokable. Need to add it to the skills configuration.
- **Impact:** Low (can execute manually)
- **Effort:** Quick
- **Suggested phase:** Phase 2

## Closed Enhancements

[Moved here when addressed]
