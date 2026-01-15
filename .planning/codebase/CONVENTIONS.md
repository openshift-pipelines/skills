# Coding Conventions

**Analysis Date:** 2026-01-15

## Naming Patterns

**Files:**
- `kebab-case.md` for skill definitions (`map-jira-to-upstream.md`, `release-status.md`)
- `kebab-case.js` for JavaScript files (`install.js`)
- UPPERCASE for important files (`README.md`)

**Functions:**
- camelCase for all functions (`showBanner()`, `expandTilde()`, `parseArgs()`, `copyDirectory()`)
- No special prefix for async functions
- Descriptive verbs (`show`, `expand`, `parse`, `copy`, `prompt`)

**Variables:**
- camelCase for variables (`packageJson`, `targetDir`, `commandsSource`)
- UPPER_SNAKE_CASE for constants (`VERSION`, `NAMESPACE`)

**Types:**
- No TypeScript - plain JavaScript
- JSDoc not used

## Code Style

**Formatting:**
- 2-space indentation (`bin/install.js`)
- No trailing semicolons (modern JavaScript style)
- Single quotes for strings
- Template literals for multi-line strings and interpolation

**Example from `bin/install.js`:**
```javascript
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
}
```

**Linting:**
- None configured (no .eslintrc, .prettierrc)
- Style maintained through manual consistency

## Import Organization

**Order:**
1. Node.js built-ins (fs, path, os, readline)
2. No external packages (zero dependencies)

**Example from `bin/install.js`:**
```javascript
const fs = require('fs')
const path = require('path')
const os = require('os')
const readline = require('readline')
```

**Path Aliases:**
- None (no module bundler, no path mapping)

## Error Handling

**Patterns:**
- Check conditions before operations (`fs.existsSync()`)
- Console error messages with colored output
- `process.exit(1)` for fatal errors

**Example:**
```javascript
if (!fs.existsSync(commandsSource)) {
  console.error(`${colors.red}Error: Commands directory not found${colors.reset}`)
  process.exit(1)
}
```

## Logging

**Framework:**
- Console only (console.log, console.error)
- ANSI color codes for formatting

**Patterns:**
- Colored output for user feedback
- `console.log('')` for visual spacing
- Template literals for message formatting

## Comments

**When to Comment:**
- Single-line comments for code clarification
- No JSDoc for functions
- Comments used sparingly

**Skill Documentation:**
- YAML frontmatter for metadata
- XML tags for structure (`<objective>`, `<process>`, `<step>`)
- Markdown headings for hierarchy

## Function Design

**Size:**
- Functions kept focused (10-30 lines typical)
- Main function orchestrates flow

**Parameters:**
- Simple positional parameters
- No destructuring in parameters

**Return Values:**
- Explicit returns
- Boolean returns for conditions

## Module Design

**Exports:**
- Single-file modules (no exports, executed directly)
- CommonJS style (`require()`)

**Barrel Files:**
- Not used (flat structure)

## Skill Definition Conventions

**YAML Frontmatter:**
```yaml
---
name: skill-name
description: Brief description
allowed-tools:
  - Bash
  - Read
  - Write
---
```

**XML Structure:**
```xml
<objective>What the skill does</objective>
<execution_context>Background info</execution_context>
<process>
  <step name="step_name">Instructions</step>
</process>
<output>Expected output format</output>
<success_criteria>Checklist</success_criteria>
```

**Step Naming:**
- snake_case for step names (`check_configuration`, `gather_requirements`)
- Descriptive action verbs

**Bash Scripts:**
- `set -euo pipefail` for strict error handling
- Inline error checks with `|| echo "fallback"`
- `2>/dev/null` for optional error suppression

---

*Convention analysis: 2026-01-15*
*Update when patterns change*
