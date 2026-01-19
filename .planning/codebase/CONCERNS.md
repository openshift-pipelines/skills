# Codebase Concerns

**Analysis Date:** 2026-01-19

## Tech Debt

**Installer lacks error handling for file operations:**
- Issue: `copyDirectory()` function has no try-catch for file operation failures
- Files: `bin/install.js` (lines 100-117)
- Why: Initial implementation focused on happy path
- Impact: Crashes with cryptic errors on permission denied, disk full, etc.
- Fix approach: Add try-catch around `fs.copyFileSync()` and `fs.mkdirSync()` calls

**No validation of destination directory writability:**
- Issue: Installer doesn't check if target directory is writable before attempting installation
- Files: `bin/install.js` (install function)
- Why: Assumed user has appropriate permissions
- Impact: Fails late in process instead of early
- Fix approach: Add pre-flight check with `fs.accessSync(dir, fs.constants.W_OK)`

## Known Bugs

**None identified** - Codebase is relatively clean

## Security Considerations

**Token storage recommendations need hardening:**
- Risk: Config file (`~/.config/osp/config.json`) stores tokens in plaintext
- Files: `commands/osp/configure.md` (lines 95-99)
- Current mitigation: chmod 600 on config file
- Recommendations: Emphasize environment variables as preferred method; add warning about not committing config files

**API credentials in shell variables:**
- Risk: Tokens passed via environment variables could be exposed in shell history
- Files: Multiple skill files reference `JIRA_TOKEN` and `GITHUB_TOKEN`
- Current mitigation: Standard env var practices
- Recommendations: Add guidance on using `read -s` for interactive token entry

## Performance Bottlenecks

**API pagination inconsistency:**
- Problem: Different MAX_RESULTS values across skills (100 vs 200)
- Files: `commands/osp/release-status.md` (MAX_RESULTS=200), `commands/osp/release-checklist.md` (MAX_RESULTS=100)
- Measurement: Could affect large releases (>1000 issues)
- Cause: Skills developed independently
- Improvement path: Standardize pagination handling, add timeout handling

## Fragile Areas

**Large monolithic skill files:**
- Files: `commands/osp/release-checklist.md` (837 lines), `commands/osp/operator-release.md` (440 lines)
- Why fragile: Complex multi-step workflows in single files
- Common failures: Users may miss steps, hard to maintain
- Safe modification: Consider breaking into focused sub-skills with clear prerequisites
- Test coverage: No automated testing (integration-tested by users)

**Hardcoded URLs and organization names:**
- Files: Multiple skill files
  - `commands/osp/configure.md:53` - Hardcoded `https://issues.redhat.com`
  - `commands/osp/release-status.md:26-28` - Hardcoded GitHub orgs
  - `commands/osp/component-status.md:206` - Hardcoded Konflux console URL
- Why fragile: Cannot adapt for different Jira instances or organizations
- Safe modification: Consider making URLs configurable via config file

## Scaling Limits

**Jira API pagination:**
- Current capacity: Fetches up to MAX_RESULTS per request (100-200)
- Limit: Very large releases (>1000 issues) may timeout or be slow
- Symptoms at limit: Incomplete results, long wait times
- Scaling path: Add progress indicators, increase timeouts, optimize queries

## Dependencies at Risk

**Node.js version requirement outdated:**
- Risk: Requires Node.js >= 16.7.0 (from 2021), should be >= 18.0.0 (current LTS)
- Files: `package.json` (engines field)
- Impact: May use deprecated features, missing security updates
- Migration plan: Update engines to `"node": ">=18.0.0"`

**Vitest version range:**
- Risk: `"vitest": "^1.0.0"` allows up to major version 2
- Files: `package.json` (devDependencies)
- Impact: Breaking changes could affect CI
- Migration plan: Consider pinning to specific minor version

## Missing Critical Features

**No prerequisite validation in skills:**
- Problem: Skills don't validate required tools (jq, gh, curl) before execution
- Files: All skill files in `commands/osp/`
- Current workaround: Users discover missing tools via error messages
- Blocks: Smooth first-time user experience
- Implementation complexity: Low (add shell checks at start of process)

**No automated config validation during install:**
- Problem: Installation succeeds even without required tokens
- Files: `bin/install.js`
- Current workaround: Users must manually run `/osp:configure`
- Blocks: Immediate usability after install
- Implementation complexity: Medium (add optional post-install configuration)

## Test Coverage Gaps

**Installer error scenarios not tested:**
- What's not tested: Permission denied, disk full, invalid source directory
- Files: `tests/install.test.js`
- Risk: Error handling code never exercised
- Priority: Medium
- Difficulty to test: Low (mock fs operations)

**Skill frontmatter validation limited:**
- What's not tested: Only CI checks YAML syntax, not semantic correctness
- Files: `.github/workflows/ci.yml`
- Risk: Invalid allowed-tools lists, missing required fields
- Priority: Low
- Difficulty to test: Medium (would need custom validation script)

## Documentation Gaps

**Complex workflows lack visual diagrams:**
- Problem: Multi-step release processes described only in text
- Files: `commands/osp/release-checklist.md`, `commands/osp/operator-release.md`
- Risk: Users may misunderstand step dependencies
- Fix: Add ASCII flowcharts or Mermaid diagrams

**Placeholder patterns inconsistent:**
- Problem: Different placeholder styles (`{PLACEHOLDER}`, `${VARIABLE}`, `SRVKP-XXXX`)
- Files: Multiple skill files
- Risk: User confusion about what needs manual substitution
- Fix: Standardize on one pattern, document clearly

---

*Concerns audit: 2026-01-19*
*Update as issues are fixed or new ones discovered*
