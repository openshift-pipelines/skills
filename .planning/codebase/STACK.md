# Technology Stack

**Analysis Date:** 2026-01-19

## Languages

**Primary:**
- JavaScript (ES6+) - All application code (`bin/install.js`)
- Markdown - Skill definitions and documentation (`commands/osp/*.md`)

**Secondary:**
- YAML - Skill frontmatter configuration
- Bash - Shell scripts embedded in skill commands

## Runtime

**Environment:**
- Node.js >= 16.7.0 (specified in `package.json` engines field)
- No browser runtime (CLI tool only)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present (tracked in repository)

## Frameworks

**Core:**
- None (vanilla Node.js CLI with stdlib only)

**Testing:**
- Vitest ^1.0.0 - Unit testing framework (`vitest.config.js`)

**Build/Dev:**
- No build step required (pure JavaScript)
- No transpilation (CommonJS modules)

## Key Dependencies

**Critical:**
- None - Zero runtime dependencies

**Dev Dependencies:**
- vitest ^1.0.0 - Testing framework (`package.json`)

**Infrastructure (Node.js built-ins):**
- fs - File system operations
- path - Path manipulation
- os - OS utilities (homedir)
- readline - Interactive prompts

## Configuration

**Environment:**
- `JIRA_TOKEN` - Red Hat Jira authentication (`.env.example`)
- `GITHUB_TOKEN` - GitHub API authentication (optional)
- Config file: `~/.config/osp/config.json` (managed by `/osp:configure`)

**Build:**
- `vitest.config.js` - Test runner configuration
- `package.json` - Project metadata and scripts

## Platform Requirements

**Development:**
- macOS/Linux/Windows (any platform with Node.js)
- No external dependencies

**Production:**
- Distributed as npm package
- Installed via `npx openshift-pipelines-skills`
- Runs on user's Node.js installation
- Requires GitHub CLI (`gh`) for GitHub operations
- Requires `curl` and `jq` for API interactions

---

*Stack analysis: 2026-01-19*
*Update after major dependency changes*
