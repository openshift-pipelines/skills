# Coding Conventions

**Analysis Date:** 2026-01-19

## Naming Patterns

**Files:**
- kebab-case for markdown files (`map-jira-to-upstream.md`, `release-status.md`)
- camelCase for JavaScript files (`install.js`)
- .test.js suffix for test files (`install.test.js`)

**Functions:**
- camelCase for all functions (`parseArgs`, `expandTilde`, `copyDirectory`)
- Descriptive verb-based names (`showBanner`, `showHelp`, `promptLocation`)
- No async prefix (async functions named same as sync)

**Variables:**
- camelCase for variables (`targetDir`, `configDir`, `options`)
- SCREAMING_SNAKE_CASE for constants (`VERSION`, `NAMESPACE`)
- No underscore prefix for private members

**Types:**
- No TypeScript (pure JavaScript)
- JSDoc comments not used

## Code Style

**Formatting:**
- 2-space indentation (consistent throughout)
- Single quotes for string literals
- Template literals (backticks) for multiline strings
- Semicolons required at end of statements

**Linting:**
- No ESLint or Prettier configured
- Code style maintained through convention and review
- Run: N/A (no linting scripts)

## Import Organization

**Order:**
1. Node.js built-in modules (`fs`, `path`, `os`, `readline`)
2. Local modules (`../package.json`)

**Grouping:**
- No blank lines between imports
- Alphabetical order not enforced

**Path Style:**
- CommonJS: `require()` / `module.exports`
- Relative paths for local imports

## Error Handling

**Patterns:**
- Console.error with colored output for user-facing errors
- Process.exit(1) for fatal errors
- Early return on validation failures

**Error Types:**
- String messages with template literals
- ANSI color codes for visibility: `${colors.red}Error: ...${colors.reset}`

## Logging

**Framework:**
- Console.log for normal output
- Console.error for errors
- ANSI color codes via `colors` object

**Patterns:**
- Colored output for CLI feedback
- No structured logging
- No log levels

## Comments

**When to Comment:**
- Section headers for code organization (`// ANSI color codes`, `// Load package info`)
- Brief inline comments for non-obvious logic

**JSDoc/TSDoc:**
- Not used in this codebase

**TODO Comments:**
- Pattern: `// TODO: description`
- None currently present in codebase

## Function Design

**Size:**
- Functions kept reasonably short (under 50 lines)
- Main function orchestrates flow

**Parameters:**
- Minimal parameters (1-3 per function)
- Object destructuring not used

**Return Values:**
- Explicit returns
- Some functions return void (side effects only)

## Module Design

**Exports:**
- Named exports at end of file:
  ```javascript
  module.exports = {
    parseArgs,
    expandTilde,
    copyDirectory,
  };
  ```
- Export only what's needed for testing

**Barrel Files:**
- Not used (single entry point)

## Skill Definition Conventions

**YAML Frontmatter:**
```yaml
---
name: skill-name
description: Human-readable description
allowed-tools:
  - Bash
  - Read
  - WebFetch
  - AskUserQuestion
---
```

**Document Structure:**
```markdown
# Title

<objective>
What this skill accomplishes
</objective>

<execution_context>
Background and prerequisites
</execution_context>

<process>
<step name="step_name">
Instructions with code examples
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

**Code Blocks in Skills:**
- Use triple backticks with language identifier
- Bash for shell commands
- Variable placeholders: `${VARIABLE}` or `{PLACEHOLDER}`

---

*Convention analysis: 2026-01-19*
*Update when patterns change*
