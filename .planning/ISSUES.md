# Project Issues Log

Enhancements discovered during execution. Not critical - address in future phases.

## Open Enhancements

### ISS-004: Document registry usage for different release stages in skills

- **Discovered:** Phase 2 Plan 3 (2026-01-19) — during PR #903 pipeline failure diagnosis
- **Context:** The PAC_BUILDER in tektoncd-cli Dockerfile was pointing to `registry.redhat.io` (prod) but that image was purged. Investigation revealed the registry flow:
  - `quay.io/openshift-pipeline/` — Dev/CI builds (publicly accessible, use for on-push)
  - `registry.stage.redhat.io/` — Stage releases
  - `registry.redhat.io/` — Production releases
- **Enhancement:** Add registry documentation to relevant skills:
  - `/osp:stage-release` — document registry.stage.redhat.io usage
  - `/osp:prod-release` — document registry.redhat.io usage
  - `/osp:component-builds` or new skill — document quay.io/openshift-pipeline for dev builds
  - Consider creating `/osp:registry-info` skill with registry lookup/verification
- **CLI PAC_BUILDER workflow:** The tkn CLI Dockerfile has a `PAC_BUILDER` ARG that references the PAC CLI image. This must be updated:
  - After prod release expires/before new release: revert to `quay.io/openshift-pipeline/pipelines-pipelines-as-code-cli-rhel8:1.15`
  - During stage release: update to `registry.stage.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel8@sha256:...`
  - During prod release: update to `registry.redhat.io/openshift-pipelines/pipelines-pipelines-as-code-cli-rhel8@sha256:...`
  - Skills should guide this update as part of release workflows
- **Dockerfile version updates on upstream sync:** When syncing upstream (e.g., tektoncd/cli), Dockerfiles need manual updates:
  - `TKN_VERSION` ARG must match the upstream VERSION file
  - Other version-related ARGs may need updating
  - The bot sync PRs don't automatically update Dockerfiles
  - Skills should remind/guide this as part of upstream sync workflow
  - Example: PR #903 synced upstream 0.37.2 but Dockerfile had TKN_VERSION=0.37.1 → needed PR #907 to fix
- **Priority:** Medium — prevents future confusion about which registry to use

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
