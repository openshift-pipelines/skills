# Claude Skills for OpenShift Pipelines

A collection of [Claude Code](https://claude.ai/claude-code) skills for OpenShift Pipelines and Tekton development workflows.

## Installation

### Install from GitHub (Recommended)

No npm publish required - install directly from the GitHub repository:

```bash
# Interactive installation (prompts for global/local)
npx github:openshift-pipelines/skills

# Install globally
npx github:openshift-pipelines/skills -- -g

# Install locally in current project
npx github:openshift-pipelines/skills -- -l
```

### Install from npm (if published)

```bash
npx openshift-pipelines-skills
npx openshift-pipelines-skills -g    # Global
npx openshift-pipelines-skills -l    # Local
```

### Manual Installation

```bash
git clone https://github.com/openshift-pipelines/skills.git
cd skills
node bin/install.js -g    # Or -l for local
```

Or copy files directly:

```bash
git clone https://github.com/openshift-pipelines/skills.git
cp -r skills/commands/osp ~/.claude/commands/
```

### Non-Interactive Installation (CI/Docker)

```bash
# Global installation without prompts
npx github:openshift-pipelines/skills -- --global

# With explicit config directory (useful in containers)
CLAUDE_CONFIG_DIR=/home/user/.claude npx github:openshift-pipelines/skills -- --global
```

## Updating

When the repository is updated with new skills or improvements, update your local installation using one of these methods:

### Method 1: Clone and Install (Recommended)

The most reliable way to get the latest version:

```bash
# Clone fresh (or pull if you already have it)
git clone https://github.com/openshift-pipelines/skills.git /tmp/osp-skills
cd /tmp/osp-skills

# Install globally
node bin/install.js -g

# Clean up
cd - && rm -rf /tmp/osp-skills
```

Or if you keep a local clone:

```bash
cd /path/to/skills
git pull origin main
node bin/install.js -g
```

### Method 2: npx with Cache Clear

npx caches packages, so you must clear the cache to get updates:

```bash
# Clear npx cache and reinstall
npx cache clean --force && npx github:openshift-pipelines/skills

# Or use npm cache
npm cache clean --force && npx github:openshift-pipelines/skills
```

### Method 3: Direct File Copy

If you have the repo cloned:

```bash
cd /path/to/skills
git pull origin main
cp -r commands/osp ~/.claude/commands/
```

### After Updating

**Important**: Restart Claude Code after updating to reload the slash commands. The new commands won't be available until you restart.

To verify the update:
```bash
ls -la ~/.claude/commands/osp/
```

## Available Commands

After installation, the following commands are available in Claude Code:

| Command | Description |
|---------|-------------|
| `/osp:help` | Show available commands and usage guide |
| `/osp:configure` | Set up Jira authentication and settings |
| `/osp:pipeline` | Create or modify Tekton Pipeline resources |
| `/osp:task` | Create or modify Tekton Task resources |
| `/osp:debug` | Debug failed PipelineRuns or TaskRuns |
| `/osp:map-jira-to-upstream` | Find upstream Tekton GitHub issues related to a Red Hat Jira issue |

## Configuration

### Jira Authentication

The `/osp:map-jira-to-upstream` command requires access to Red Hat Jira (issues.redhat.com).

**Option 1: Environment Variable (Recommended)**

Add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
export JIRA_TOKEN="your-personal-access-token"
```

**Option 2: Config File**

Run `/osp:configure` in Claude Code, or manually create:

```bash
mkdir -p ~/.config/osp
cat > ~/.config/osp/config.json << 'EOF'
{
  "jira": {
    "base_url": "https://issues.redhat.com",
    "token": "your-personal-access-token"
  }
}
EOF
chmod 600 ~/.config/osp/config.json
```

**Getting a Jira Personal Access Token:**

1. Log in to https://issues.redhat.com
2. Click your profile icon → **Personal Access Tokens**
3. Click **Create token**
4. Name it (e.g., "Claude Skills") and set scope to **Read**
5. Copy the token immediately (shown only once)

### GitHub Authentication (Optional)

For higher API rate limits when searching upstream issues:

```bash
# Using gh CLI (recommended)
gh auth login

# Or set environment variable
export GITHUB_TOKEN="your-github-token"
```

## Usage Examples

### Map a Jira Issue to Upstream

```
/osp:map-jira-to-upstream

> Enter Jira issue: SRVKP-1234
```

This will:
1. Fetch the Jira issue details via API
2. Extract keywords, error messages, and components
3. Search tektoncd GitHub repositories
4. Report related upstream issues with recommendations

### Create a Tekton Task

```
/osp:task
```

Interactive wizard to create a properly structured Tekton Task YAML.

### Debug a Failed Pipeline

```
/osp:debug
```

Systematic analysis of PipelineRun/TaskRun failures with remediation suggestions.

## Project Structure

```
.
├── bin/
│   └── install.js              # npx installer script
├── commands/
│   └── osp/                    # OpenShift Pipelines namespace
│       ├── help.md             # /osp:help
│       ├── configure.md        # /osp:configure
│       ├── pipeline.md         # /osp:pipeline
│       ├── task.md             # /osp:task
│       ├── debug.md            # /osp:debug
│       └── map-jira-to-upstream.md  # /osp:map-jira-to-upstream
├── package.json
├── .gitignore
└── README.md
```

## Adding New Skills

Create a new `.md` file in `commands/osp/` following this template:

```markdown
---
name: skill-name
description: Brief description of the skill
allowed-tools:
  - Read
  - Write
  - Bash
  - AskUserQuestion
  - WebFetch
  - WebSearch
---

# Skill Title

<objective>
What this skill accomplishes
</objective>

<execution_context>
Background information and context for the skill
</execution_context>

<process>
<step name="step_name">
Step instructions...
</step>
</process>

<output>
Expected output description
</output>

<success_criteria>
- [ ] Criteria 1
- [ ] Criteria 2
</success_criteria>
```

### Available Tools for Skills

| Tool | Description |
|------|-------------|
| `Read` | Read files from the filesystem |
| `Write` | Create or overwrite files |
| `Edit` | Make targeted edits to files |
| `Bash` | Execute shell commands |
| `Glob` | Find files by pattern |
| `Grep` | Search file contents |
| `WebFetch` | Fetch and analyze web pages |
| `WebSearch` | Search the web |
| `AskUserQuestion` | Prompt user for input |
| `Task` | Spawn sub-agents for complex tasks |

## Troubleshooting

### Commands not appearing after installation

1. Restart Claude Code to reload slash commands
2. Verify files exist:
   ```bash
   ls ~/.claude/commands/osp/  # For global install
   ls .claude/commands/osp/    # For local install
   ```

### Jira authentication failing

1. Verify your token is valid:
   ```bash
   curl -s -H "Authorization: Bearer ${JIRA_TOKEN}" \
     "https://issues.redhat.com/rest/api/2/myself" | jq .displayName
   ```
2. Ensure the token has "Read" scope
3. Check if the token has expired

### Permission issues

If using Claude Code's permission system, ensure these are allowed in `.claude/settings.json`:
- `curl` for API calls
- `jq` for JSON parsing
- `gh` for GitHub CLI (optional)

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Add or modify skills in `commands/osp/`
4. Test your changes locally:
   ```bash
   node bin/install.js -l
   ```
5. Submit a pull request

## Resources

- [Tekton Documentation](https://tekton.dev/docs/)
- [OpenShift Pipelines Documentation](https://docs.openshift.com/pipelines/)
- [Tekton Hub](https://hub.tekton.dev/)
- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [Red Hat Jira](https://issues.redhat.com)
- [tektoncd GitHub Organization](https://github.com/tektoncd)

## License

Apache-2.0
