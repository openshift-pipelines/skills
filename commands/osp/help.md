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

### Issue Tracking & Upstream
| Command | Description |
|---------|-------------|
| `/osp:map-jira-to-upstream` | Find upstream Tekton GitHub issues related to a Red Hat Jira issue |

### Release Management
| Command | Description |
|---------|-------------|
| `/osp:release-status` | Track release status from Jira version and generate todo list |

## Quick Start

1. **First time setup**: `/osp:configure` - Set up Jira authentication
2. **Create a Task**: `/osp:task` - Interactive task creation wizard
3. **Create a Pipeline**: `/osp:pipeline` - Build pipelines from tasks
4. **Debug issues**: `/osp:debug` - Analyze failed runs
5. **Map Jira to upstream**: `/osp:map-jira-to-upstream` - Cross-reference with tektoncd
6. **Track release**: `/osp:release-status` - Check Jira version status and generate todos

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
