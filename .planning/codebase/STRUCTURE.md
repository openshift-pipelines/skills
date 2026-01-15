# Codebase Structure

**Analysis Date:** 2026-01-15

## Directory Layout

```
openshift-pipelines-skills/
├── bin/                    # CLI executable
│   └── install.js         # NPX installer script
├── commands/              # Skill definitions
│   └── osp/              # OpenShift Pipelines namespace
│       ├── configure.md  # Auth setup skill
│       ├── debug.md      # Pipeline debugging skill
│       ├── help.md       # Help reference skill
│       ├── map-jira-to-upstream.md  # Jira-GitHub mapping
│       ├── pipeline.md   # Pipeline creation skill
│       ├── release-status.md  # Release tracking skill
│       └── task.md       # Task creation skill
├── .gitignore            # Git exclusions
├── package.json          # NPM metadata
└── README.md             # User documentation
```

## Directory Purposes

**bin/**
- Purpose: Executable entry points for npm/npx
- Contains: `install.js` - Interactive CLI installer
- Key files: `install.js` (175 lines) - Main entry point
- Subdirectories: None

**commands/osp/**
- Purpose: Skill definitions for Claude Code
- Contains: Markdown files with YAML frontmatter
- Key files:
  - `help.md` - Command reference (93 lines)
  - `configure.md` - Authentication setup (186 lines)
  - `task.md` - Tekton Task creation (165 lines)
  - `pipeline.md` - Tekton Pipeline creation (135 lines)
  - `debug.md` - Run failure debugging (152 lines)
  - `map-jira-to-upstream.md` - Jira-GitHub linking (258 lines)
  - `release-status.md` - Release tracking (274 lines)
- Subdirectories: None (flat structure)

## Key File Locations

**Entry Points:**
- `bin/install.js` - NPX/npm installation entry

**Configuration:**
- `package.json` - Project metadata, bin entry, engines requirement
- `.gitignore` - Excludes node_modules, .env, IDE files, coverage

**Core Logic:**
- `bin/install.js` - All installation logic (file copying, prompts)
- `commands/osp/*.md` - Skill execution instructions

**Testing:**
- None configured (test script outputs error)

**Documentation:**
- `README.md` - Installation guide, usage examples, troubleshooting

## Naming Conventions

**Files:**
- `kebab-case.md` - Skill definition files
- `kebab-case.js` - JavaScript source files
- `UPPERCASE.md` - Important project files (README)

**Directories:**
- Lowercase for all directories
- Plural for collections: `commands/`

**Special Patterns:**
- `{skill-name}.md` - One file per skill
- YAML frontmatter required in all skill files

## Where to Add New Code

**New Skill:**
- Primary code: `commands/osp/{skill-name}.md`
- Required sections: YAML frontmatter, `<objective>`, `<process>`, `<output>`
- Update: `commands/osp/help.md` with new command entry

**New Installation Feature:**
- Implementation: `bin/install.js`
- Pattern: Add function, call from `main()`

**New Namespace:**
- Directory: `commands/{namespace}/`
- Structure: Same as `osp/` (help.md, configure.md, etc.)

**Utilities:**
- Current: All logic in `bin/install.js` (monolithic)
- If extracted: `lib/` or `src/utils/` (not yet created)

## Special Directories

**commands/**
- Purpose: Source files for Claude Code skills
- Source: Copied by `bin/install.js` during installation
- Destination: `~/.claude/commands/` (global) or `./.claude/commands/` (local)
- Committed: Yes (source of truth)

**Generated Directories (not in repo):**
- `~/.claude/commands/osp/` - Installed skill files
- `~/.config/osp/` - User configuration
- `node_modules/` - npm dependencies (none currently)
- `coverage/` - Test coverage reports (if tests added)

---

*Structure analysis: 2026-01-15*
*Update when directory structure changes*
