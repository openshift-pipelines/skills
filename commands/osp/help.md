---
name: help
description: Show available OpenShift Pipelines skills and usage guide
allowed-tools:
  - Read
  - Glob
---

# OpenShift Pipelines Skills Reference

<objective>
Display all available OpenShift Pipelines (OSP) skills with descriptions and usage examples.
</objective>

<process>
<step name="display_help">
Present the following command reference to the user in a clear, formatted manner:

## Available Commands

### Configuration
| Command | Description |
|---------|-------------|
| `/osp:configure` | Set up Jira authentication and other settings |
| `/osp:help` | Show this help message |

### Pipeline Development
| Command | Description |
|---------|-------------|
| `/osp:pipeline` | Create or modify Tekton Pipeline resources |
| `/osp:task` | Create or modify Tekton Task resources |

### Debugging & Troubleshooting
| Command | Description |
|---------|-------------|
| `/osp:debug` | Debug failed PipelineRuns or TaskRuns |
| `/osp:pr-pipeline-status` | Check PR pipeline status and diagnose Konflux failures |

### Issue Tracking & Upstream
| Command | Description |
|---------|-------------|
| `/osp:map-jira-to-upstream` | Find upstream Tekton GitHub issues related to a Red Hat Jira issue |

### Release Management
| Command | Description |
|---------|-------------|
| `/osp:release-status` | Track release status from Jira version and generate todo list |
| `/osp:release-checklist` | Generate component release checklist from Jira version |
| `/osp:component-status` | Check release readiness of a single component |
| `/osp:component-builds` | Check Konflux build status, monitor pipelines, verify image freshness |
| `/osp:konflux-image` | Extract image references (URL, digest) from Konflux pipeline results |
| `/osp:operator-release` | Run operator update workflows and generate index images |

### Minor Release Configuration (New)
| Command | Description |
|---------|-------------|
| `/osp:hack-config` | Configure hack repository for a new minor release |
| `/osp:component-config` | Configure a single component for a minor release |
| `/osp:operator-config` | Configure the operator for a minor release |
| `/osp:release-config` | Create Konflux release resources (RPA, RP, Release YAML) |
| `/osp:stage-release` | Execute stage release for OpenShift Pipelines |
| `/osp:prod-release` | Execute production release for OpenShift Pipelines |

## Quick Start

1. **First time setup**: `/osp:configure` - Set up Jira authentication
2. **Create a Task**: `/osp:task` - Interactive task creation wizard
3. **Create a Pipeline**: `/osp:pipeline` - Build pipelines from tasks
4. **Debug issues**: `/osp:debug` - Analyze failed runs
5. **Map Jira to upstream**: `/osp:map-jira-to-upstream` - Cross-reference with tektoncd
6. **Track release**: `/osp:release-status` - Check Jira version status and generate todos

## Common Workflows

### "My build is failing"
1. `/osp:pr-pipeline-status <repo> <pr>` — Check pipeline details and error patterns
2. `/osp:component-builds status` — Check all component build status
3. `/osp:registry-info` — Verify base images exist in target registry

### "Check release progress"
1. `/osp:release-status <version>` — Jira issue status with PR correlation
2. `/osp:component-builds freshness` — Image age check (72-hour threshold)

### "Trigger rebuild"
Konflux CEL filtering requires actual file changes (empty commits are ignored):
```dockerfile
# Rebuild trigger: 1.15.4 release 2026-01-20
```
Add this comment to `.konflux/dockerfiles/*.Dockerfile` and push to trigger rebuild.

### "Copy images for release"
1. `/osp:konflux-image snapshot <app>` — Get image digest from Snapshots API (recommended)
2. `/osp:registry-info` — Check which registry to use for release stage

## Troubleshooting Quick Reference

| Symptom | Skill | Likely Cause |
|---------|-------|--------------|
| "No runs" for component | `/osp:component-builds` | Empty commits don't trigger Konflux (use Dockerfile comment) |
| PR pipeline failing | `/osp:pr-pipeline-status` | Base image expired or Enterprise Contract failure |
| Konflux 401 error | `/osp:configure` | SSO cookie expired (8-24h lifetime) |
| "manifest unknown" | `/osp:registry-info` | Image purged from registry, use quay.io fallback |
| CVE "To Do" but code fixed | `/osp:release-status` | Jira-GitHub sync gap (verify in go.mod) |

## Release Workflow

For release captains managing OpenShift Pipelines releases:

### Minor Release Workflow (Full)

For new minor releases (e.g., 1.20.0):

```
/osp:hack-config → /osp:component-config (all) → /osp:operator-config
    → /osp:operator-release (devel) → QE testing
    → /osp:release-config → /osp:stage-release → /osp:prod-release
```

**Phase 1: Configuration**
1. `/osp:hack-config` - Configure hack repo for new version
2. `/osp:component-config` - Configure each component (run for each)
3. `/osp:operator-config` - Configure operator after all components

**Phase 2: Devel Build & Testing**
4. `/osp:operator-release` (devel) - Generate devel images
5. QE testing on devel build

**Phase 3: Release Configuration**
6. `/osp:release-config` - Create Konflux CRD (RPA, RP, Release YAML)

**Phase 4: Stage & Production**
7. `/osp:stage-release` - Execute stage release
8. QE validation on stage
9. `/osp:prod-release` - Execute production release

### Patch Release Workflow

For patch releases (e.g., 1.19.2):

### Phase 1: Analysis & Planning
1. **Start release**: `/osp:release-checklist` with Jira version URL
   - Analyzes all issues in the release
   - Identifies CVEs and checks fix status
   - Creates PRs for upstream tracking updates
   - Generates per-component checklist

2. **Check component**: `/osp:component-status <component> <version>`
   - Verify branch exists
   - Check Dockerfile updates
   - View CI/workflow status

### Phase 2: Component Updates
3. **Fix CVEs/Issues**: Follow the release-checklist guidance
   - Merge hack config PRs (upstream tracking)
   - Merge Konflux config PRs
   - Run update-sources workflows
   - Merge bot PRs with upstream changes
   - **Monitor on-push pipelines (including Enterprise Contract)**

4. **Diagnose pipeline failures**: `/osp:pr-pipeline-status <repo> <pr>`
   - Check PR pipeline status
   - Diagnose Konflux failures (requires SSO auth via `/osp:configure`)
   - Get actionable fix recommendations

### Phase 3: Operator & Index
4. **Operator release**: `/osp:operator-release`
   - Run operator-update-images workflow (devel/staging/production)
   - Run index-render-template workflow
   - Verify images in target registry

### Phase 4: Release Execution
5. **Track progress**: `/osp:release-status` with Jira version
   - Shows completion percentage
   - Lists blocking issues
   - Generates actionable todo list

**Release Flow (Patch):**
```
Component PRs → Konflux builds → operator-update-images (devel)
    → index-render-template → QE testing → staging → production
```

## Configuration

The `/osp:map-jira-to-upstream` command requires a Jira Personal Access Token.
Run `/osp:configure` to set this up, or set the `JIRA_TOKEN` environment variable.

## Updating Skills

To update to the latest version (clone method is most reliable):

```bash
# Clone, install, and clean up
git clone https://github.com/openshift-pipelines/skills.git /tmp/osp-skills
cd /tmp/osp-skills && node bin/install.js -g
cd - && rm -rf /tmp/osp-skills
```

Or if using npx (must clear cache first):
```bash
npm cache clean --force && npx github:openshift-pipelines/skills
```

**Important**: Restart Claude Code after updating to reload commands.

## Resources

- [Tekton Documentation](https://tekton.dev/docs/)
- [OpenShift Pipelines Documentation](https://docs.openshift.com/pipelines/)
- [Tekton Hub](https://hub.tekton.dev/)
- [OpenShift Pipelines Skills Repository](https://github.com/openshift-pipelines/skills)

</step>
</process>

<output>
The help reference displayed to the user with all available commands and usage information.
</output>
