# Architecture

**Analysis Date:** 2026-01-19

## Pattern Overview

**Overall:** Skills Distribution & Installation System (Plugin Architecture)

**Key Characteristics:**
- Single responsibility: Install Claude Code skills for OpenShift Pipelines
- Stateless CLI installer with file copy operations
- Markdown-based skill definitions (not programmatic)
- Configuration-driven (environment variables + config file)

## Layers

**Installation Layer:**
- Purpose: Bootstrap skills into user's Claude Code environment
- Contains: CLI argument parsing, file copying, interactive prompts
- Location: `bin/install.js`
- Depends on: Node.js stdlib only
- Used by: npx installation command

**Skill Definition Layer:**
- Purpose: Define AI-guided workflows for OpenShift Pipelines operations
- Contains: Markdown files with YAML frontmatter and structured XML instructions
- Location: `commands/osp/*.md`
- Depends on: Claude Code runtime
- Used by: Claude Code when user invokes `/osp:*` commands

**Configuration Layer:**
- Purpose: Manage authentication and settings
- Contains: Token storage, config file management
- Location: `~/.config/osp/config.json`, environment variables
- Depends on: User setup
- Used by: Skills that access external APIs

## Data Flow

**Installation Flow:**
```
User runs: npx openshift-pipelines-skills
    ↓
bin/install.js: main()
    ├→ parseArgs() [process CLI flags]
    ├→ showBanner() [display UI]
    ├→ promptLocation() [interactive mode]
    ├→ expandTilde() [normalize path]
    └→ install(targetDir)
        ├→ copyDirectory(src/commands/osp, dest/commands/osp)
        └→ Display installed skills list
```

**Skill Execution Flow (Claude Code runtime):**
```
User runs: /osp:<skill-name>
    ↓
Claude loads commands/osp/<skill>.md
    ├→ Parse YAML frontmatter (allowed-tools, name, description)
    ├→ Execute <process><step> instructions
    ├→ Use tools: Bash, WebFetch, AskUserQuestion, etc.
    └→ Return formatted results
```

**State Management:**
- File-based: Config stored at `~/.config/osp/config.json`
- Environment-based: Tokens in `JIRA_TOKEN`, `GITHUB_TOKEN`
- No persistent in-memory state
- Each skill execution is independent

## Key Abstractions

**Skill:**
- Purpose: Self-contained workflow definition
- Examples: `commands/osp/configure.md`, `commands/osp/release-status.md`
- Pattern: Markdown + YAML frontmatter + XML-structured instructions

**Installer Functions:**
- Purpose: Utilities for installation process
- Examples: `parseArgs()`, `expandTilde()`, `copyDirectory()`
- Pattern: Pure functions exported via CommonJS

**Configuration:**
- Purpose: Centralized settings and credentials
- Examples: Jira token, GitHub token, base URLs
- Pattern: JSON file with nested structure + environment variables

## Entry Points

**CLI Entry:**
- Location: `bin/install.js`
- Triggers: User runs `npx openshift-pipelines-skills`
- Responsibilities: Parse args, copy files, display UI

**Skill Commands (10 skills):**
- Location: `commands/osp/*.md`
- Triggers: User runs `/osp:<skill>` in Claude Code
- Responsibilities: Execute domain-specific workflows

## Error Handling

**Strategy:** Throw errors with descriptive messages, catch at entry point

**Patterns:**
- Installer: `console.error()` with colored output, `process.exit(1)`
- Skills: Rely on Claude Code error handling
- Validation: Early exit on invalid arguments

## Cross-Cutting Concerns

**Logging:**
- Console output with ANSI color codes
- No structured logging (simple CLI tool)

**Validation:**
- CLI argument validation in `parseArgs()`
- Skills validate prerequisites (tokens, tools) within their process steps

**Authentication:**
- Environment variables: `JIRA_TOKEN`, `GITHUB_TOKEN`
- Config file: `~/.config/osp/config.json`
- Skills check auth before API calls

---

*Architecture analysis: 2026-01-19*
*Update when major patterns change*
