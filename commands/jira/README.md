# Jira Issue Management Skills

Skills for creating and managing Jira issues in the **SRVKP (OpenShift Pipelines)** project.

## What This Does

Provides a unified `/jira:create <type>` interface that:

- Routes to type-specific sub-skills (bug, epic, feature, story, task)
- Auto-suggests components from summary keywords
- Enforces SRVKP project restriction (rejects all other projects)
- Always previews before creating — no auto-create, ever
- Falls back to `acli` CLI automatically when MCP is unavailable

## Skills

| Skill | Invocation | Purpose |
|-------|-----------|---------|
| `SKILL.md` | `/jira:create <type>` | Dispatcher — routes to sub-skills |
| `create-bug/SKILL.md` | `/jira:create bug` | Bug reports with reproduction steps |
| `create-epic/SKILL.md` | `/jira:create epic` | Epics with scope and acceptance criteria |
| `create-feature/SKILL.md` | `/jira:create feature` | Strategic features spanning multiple quarters |
| `create-story/SKILL.md` | `/jira:create story` | User stories with acceptance criteria |
| `create-task/SKILL.md` | `/jira:create task` | Technical/operational tasks |

Shared conventions (safety rules, component mappings, confirmation flow, MCP→CLI fallback) live in [`_common.md`](_common.md).

## Prerequisites

### MCP Atlassian Jira Server (primary path)

Configure the Atlassian MCP server in Cursor:

1. Open **Cursor Settings → MCP**
2. Confirm the Atlassian Jira server is enabled, connected, and lists Jira tools
3. MCP must be authenticated with a valid Jira account that has create permissions in SRVKP

### `acli` — Atlassian CLI (automatic fallback)

`acli` is used automatically when MCP is unavailable. Install it once:

```bash
# macOS (Homebrew)
brew install atlassian/acli/acli

# Or download from the official site:
# https://bobswift.atlassian.net/wiki/spaces/ACLI/overview
```

Verify the install:

```bash
acli jira --version
```

**Authenticate `acli` (one-time setup):**

```bash
# 1. Generate an API token at:
#    https://id.atlassian.com/manage-profile/security/api-tokens

# 2. Store the token locally (keep it out of this repo)
echo "YOUR_API_TOKEN" > ~/.jira.d/token
chmod 600 ~/.jira.d/token

# 3. Authenticate (safe to re-run)
acli jira auth login \
  --site "https://issues.redhat.com" \
  --email "YOUR_REDHAT_ID@redhat.com" \
  --token < ~/.jira.d/token

# 4. Verify
acli jira me
# Expected: ✓ Authentication successful
```

> **Why `acli` and not `jrc`?**
> This skill set uses `acli` (Atlassian CLI by Bob Swift) because its `workitem create/search`
> commands map directly to the Jira REST API fields used by the MCP server, making the
> MCP→CLI fallback payload-identical. If your environment uses `jrc` (jayrat CLI), update
> the commands in [`reference/cli-fallback.md`](reference/cli-fallback.md) to use `jrc` syntax.

## How to Test

1. **MCP path**: Run `/jira:create bug "Test bug [do not create]"` with MCP configured.
   Confirm a full preview is shown and you are asked `Create this bug? (yes/no)` before
   any issue is created. Answer `no` to abort without side effects.

2. **CLI fallback path**: Temporarily disable the MCP Atlassian server in Cursor Settings,
   then run the same command. Confirm the skill detects the MCP failure and falls back to
   `acli jira workitem create ...` with the identical payload.

3. **SRVKP enforcement**: Run `/jira:create bug OCPBUGS "test"`.
   Confirm the skill rejects the request with a clear error message.

4. **Component auto-suggestion**: Run `/jira:create task "Update tkn CLI documentation"`.
   Confirm component **Tekton Cli** is suggested based on the keyword `tkn`.

## File Layout

```
commands/jira/
├── README.md                ← this file
├── SKILL.md                 ← dispatcher skill
├── _common.md               ← shared: safety rules, components, confirmation, fallback
├── create-bug/SKILL.md
├── create-epic/SKILL.md
├── create-feature/SKILL.md
├── create-story/SKILL.md
├── create-task/SKILL.md
└── reference/
    └── cli-fallback.md      ← acli command reference and examples
```
