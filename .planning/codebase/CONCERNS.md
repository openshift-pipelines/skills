# Codebase Concerns

**Analysis Date:** 2026-01-15

## Tech Debt

**No automated tests:**
- Issue: Test script outputs error and exits (`package.json` line 14)
- File: `package.json`
- Why: Early-stage project, manual testing via Claude Code
- Impact: No regression detection, harder to refactor safely
- Fix approach: Add Vitest or Jest with unit tests for `bin/install.js`

**Monolithic installer:**
- Issue: All logic in single 175-line file with no separation
- File: `bin/install.js`
- Why: Simple enough for initial implementation
- Impact: Harder to test individual functions, harder to extend
- Fix approach: Extract to `lib/` with separate modules (args, files, prompts)

## Known Bugs

**No known bugs at this time.**

The codebase is new (4 commits) and relatively simple.

## Security Considerations

**Token storage in config file:**
- Risk: Jira PAT stored in `~/.config/osp/config.json` could be read by other processes
- Files: `commands/osp/configure.md`, `commands/osp/map-jira-to-upstream.md`
- Current mitigation: File permissions set to 600 (`chmod 600`)
- Recommendations: Prefer environment variables; document security best practices

**Token handling in bash scripts:**
- Risk: Token could appear in process list or command history
- Files: `commands/osp/release-status.md`, `commands/osp/map-jira-to-upstream.md`
- Current mitigation: Token passed via variable, not command line argument
- Recommendations: Consider using stdin for sensitive data

## Performance Bottlenecks

**Jira API pagination limit:**
- Problem: Hard-coded `maxResults=200` may miss issues in large releases
- Files: `commands/osp/release-status.md` lines 113, 136
- Measurement: Works for typical releases (<200 issues)
- Cause: Single API call without pagination handling
- Improvement path: Implement pagination loop when `total > maxResults`

## Fragile Areas

**No fragile areas identified.**

The skill-based architecture is inherently resilient:
- Each skill is independent
- No shared state between invocations
- File-based operation with explicit checks

## Scaling Limits

**GitHub API rate limits:**
- Current capacity: 60 requests/hour (unauthenticated), 5000/hour (authenticated)
- Limit: Heavy usage of `/osp:release-status` with many issues
- Symptoms at limit: API returns 403, searches fail
- Scaling path: Encourage `gh auth login` for authenticated access

**Jira API limits:**
- Current capacity: Not documented in Red Hat Jira
- Limit: Unknown, enterprise Jira typically generous
- Symptoms at limit: 429 rate limit responses
- Scaling path: Add retry logic with exponential backoff

## Dependencies at Risk

**No npm dependencies to risk.**

The project has zero production dependencies, only Node.js built-ins.

**Runtime tool dependencies:**
- `jq` - Widely available, stable
- `gh` - GitHub-maintained, active development
- `curl` - Universal availability
- `tkn`/`kubectl` - Required for Tekton work anyway

## Missing Critical Features

**No .env.example file:**
- Problem: Users must discover required environment variables from docs
- Current workaround: Variables documented in README and skill files
- Blocks: Quick setup for new users
- Implementation complexity: Low (create `.env.example` with comments)

**No CI/CD pipeline:**
- Problem: No automated validation on PRs
- Files: No `.github/workflows/` directory
- Current workaround: Manual testing before merge
- Blocks: Safe contribution from external developers
- Implementation complexity: Low (basic GitHub Actions workflow)

## Test Coverage Gaps

**Entire codebase untested:**
- What's not tested: All of `bin/install.js`, skill YAML parsing
- Risk: Regressions go unnoticed until user reports
- Priority: Medium (simple codebase, low change frequency)
- Difficulty to test: Low for installer, medium for skill validation

**Specific gaps:**
- `parseArgs()` - Argument parsing edge cases
- `expandTilde()` - Path expansion on Windows
- `copyDirectory()` - Permission issues, symbolic links
- Skill frontmatter - Invalid YAML handling

## Documentation Gaps

**Token acquisition steps:**
- Problem: Steps to create Jira PAT reference UI that may change
- Files: `commands/osp/configure.md` lines 54-68
- Risk: Instructions become outdated
- Fix: Add direct link to Jira PAT creation page

## Observations

**Clean codebase overall:**
- No TODO/FIXME/HACK comments in source code
- Template placeholders in skills are intentional examples
- Consistent style throughout
- Good documentation in README and skill files

---

*Concerns audit: 2026-01-15*
*Update as issues are fixed or new ones discovered*
