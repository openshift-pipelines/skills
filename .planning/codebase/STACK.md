# Technology Stack

**Analysis Date:** 2026-01-15

## Languages

**Primary:**
- JavaScript (ES6+) - CLI installer and all application logic (`bin/install.js`)
- Markdown - Skill definitions with YAML frontmatter (`commands/osp/*.md`)

**Secondary:**
- YAML - Configuration examples and output templates (embedded in markdown files)
- Bash - Script examples within skill definitions

## Runtime

**Environment:**
- Node.js >= 16.7.0 (specified in `package.json` engines field)
- No browser runtime (CLI tool only)

**Package Manager:**
- npm (no specific version requirement)
- Lockfile: Not tracked (`package-lock.json` commented out in `.gitignore`)

## Frameworks

**Core:**
- None - Pure Node.js CLI application with no frameworks

**Testing:**
- None configured (`package.json` test script: `echo "Error: no test specified" && exit 1`)

**Build/Dev:**
- None - No build step required, runs directly with Node.js
- No TypeScript compilation

## Key Dependencies

**Critical:**
- No external npm dependencies (zero production dependencies in `package.json`)

**Infrastructure:**
- Node.js built-ins only: `fs`, `path`, `os`, `readline`

**Runtime CLI Tools (not npm packages):**
- `curl` - HTTP requests to Jira API
- `jq` - JSON parsing and manipulation
- `gh` - GitHub CLI for API access (optional)
- `tkn` - Tekton CLI for pipeline operations
- `kubectl`/`oc` - Kubernetes/OpenShift CLI

## Configuration

**Environment:**
- `JIRA_TOKEN` - Jira Personal Access Token
- `GITHUB_TOKEN` - GitHub token (optional, `gh` CLI preferred)
- Config file: `~/.config/osp/config.json`

**Build:**
- No build configuration files
- `package.json` - Project metadata only

## Platform Requirements

**Development:**
- Any platform with Node.js >= 16.7.0
- macOS, Linux, Windows supported
- No external service dependencies for installation

**Production:**
- Distributed as npm package
- Installed via `npx github:openshift-pipelines/skills` or git clone
- Runs in Claude Code IDE environment

---

*Stack analysis: 2026-01-15*
*Update after major dependency changes*
