# Architecture

**Analysis Date:** 2026-01-15

## Pattern Overview

**Overall:** Skill/Plugin Distribution System for Claude Code IDE

**Key Characteristics:**
- Declarative skill definitions in Markdown with YAML frontmatter
- Zero-dependency Node.js installer
- Stateless, file-based operation
- Plugin architecture - each skill is completely independent

## Layers

**Installation Layer (`bin/install.js`):**
- Purpose: Distribute skill files to Claude Code's command directory
- Contains: CLI argument parsing, file copying, user prompts
- Depends on: Node.js built-ins only (fs, path, os, readline)
- Used by: Users via npx or direct Node.js execution

**Skill Definition Layer (`commands/osp/*.md`):**
- Purpose: Define executable skill behavior for Claude Code
- Contains: YAML metadata, XML-structured process steps, tool declarations
- Depends on: Claude Code's skill execution engine
- Used by: Claude Code when user invokes `/osp:{skill-name}`

**Configuration Layer (external):**
- Purpose: Store authentication credentials
- Contains: `~/.config/osp/config.json`, environment variables
- Depends on: User setup via `/osp:configure`
- Used by: Skills requiring Jira/GitHub API access

## Data Flow

**Skill Installation:**

1. User runs: `npx github:openshift-pipelines/skills`
2. `bin/install.js` parses CLI arguments (`-g`, `-l`, `-c`)
3. User selects installation location (global/local/custom)
4. Installer copies `commands/osp/` to target directory
5. Claude Code picks up skills on restart

**Skill Execution:**

1. User types `/osp:{skill-name}` in Claude Code
2. Claude loads skill markdown from `~/.claude/commands/osp/`
3. Parser reads YAML frontmatter (`allowed-tools`, `description`)
4. Execution engine processes `<process>` steps sequentially
5. Each `<step>` uses declared tools (Bash, Read, Write, WebFetch, etc.)
6. Output section defines expected result format
7. Success criteria validated

**State Management:**
- Stateless - each skill invocation is independent
- Configuration persisted in `~/.config/osp/config.json`
- No in-memory state between invocations

## Key Abstractions

**Skill:**
- Purpose: Encapsulate a domain-specific workflow
- Examples: `commands/osp/task.md`, `commands/osp/pipeline.md`, `commands/osp/debug.md`
- Pattern: Markdown document with declarative execution instructions

**Step:**
- Purpose: Single unit of work within a skill process
- Examples: `<step name="gather_requirements">`, `<step name="check_configuration">`
- Pattern: Named XML element containing instructions and tool invocations

**Tool Declaration:**
- Purpose: Authorize which Claude tools a skill can use
- Examples: `Bash`, `Read`, `Write`, `WebFetch`, `AskUserQuestion`
- Pattern: YAML list in frontmatter (`allowed-tools:`)

## Entry Points

**Installation Entry:**
- Location: `bin/install.js`
- Triggers: `npx openshift-pipelines-skills` or `node bin/install.js`
- Responsibilities: Parse args, prompt user, copy files

**Skill Entry Points:**
- Location: `commands/osp/{skill-name}.md`
- Triggers: User types `/osp:{skill-name}` in Claude Code
- Skills available:
  - `/osp:help` → `commands/osp/help.md`
  - `/osp:configure` → `commands/osp/configure.md`
  - `/osp:task` → `commands/osp/task.md`
  - `/osp:pipeline` → `commands/osp/pipeline.md`
  - `/osp:debug` → `commands/osp/debug.md`
  - `/osp:map-jira-to-upstream` → `commands/osp/map-jira-to-upstream.md`
  - `/osp:release-status` → `commands/osp/release-status.md`

## Error Handling

**Strategy:** Validation at boundaries, graceful degradation

**Patterns:**
- Installation: `fs.existsSync()` checks before file operations (`bin/install.js`)
- Skills: Authentication verification as mandatory first step
- API calls: HTTP status code checks (200 success, 401 auth failure)
- Bash scripts: `set -euo pipefail` pattern in generated scripts (`commands/osp/task.md`)

## Cross-Cutting Concerns

**Logging:**
- ANSI colored console output (`bin/install.js` colors object)
- Markdown-formatted responses in skills

**Validation:**
- Config file existence checks
- Environment variable presence checks
- API endpoint verification before proceeding

**Authentication:**
- Multi-source: Environment variables preferred, config file fallback
- Graceful degradation: GitHub optional, skills work without it (with warnings)

---

*Architecture analysis: 2026-01-15*
*Update when major patterns change*
