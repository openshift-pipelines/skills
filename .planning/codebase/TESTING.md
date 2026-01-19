# Testing Patterns

**Analysis Date:** 2026-01-19

## Test Framework

**Runner:**
- Vitest 1.0.x
- Config: `vitest.config.js` in project root

**Assertion Library:**
- Vitest built-in expect
- Matchers: toBe, toEqual, toBeNull, toBeTruthy, toBeFalsy

**Run Commands:**
```bash
npm test                              # Run all tests
npm run test:watch                    # Watch mode (vitest)
npm test -- path/to/file.test.js     # Single file
```

## Test File Organization

**Location:**
- Separate `tests/` directory
- Pattern: `[module-name].test.js`

**Naming:**
- `install.test.js` - Tests for `bin/install.js`

**Structure:**
```
skills/
├── bin/
│   └── install.js
└── tests/
    └── install.test.js
```

## Test Structure

**Suite Organization:**
```javascript
const { parseArgs, expandTilde, copyDirectory } = require('../bin/install.js')
const fs = require('fs')
const path = require('path')
const os = require('os')

describe('parseArgs', () => {
  let originalArgv

  beforeEach(() => {
    originalArgv = process.argv
  })

  afterEach(() => {
    process.argv = originalArgv
  })

  it('returns default options when no args provided', () => {
    process.argv = ['node', 'install.js']
    const result = parseArgs()
    expect(result.help).toBeFalsy()
    expect(result.global).toBeFalsy()
  })

  it('parses --help flag', () => {
    process.argv = ['node', 'install.js', '--help']
    const result = parseArgs()
    expect(result.help).toBeTruthy()
  })
})
```

**Patterns:**
- Use `beforeEach` for per-test setup
- Use `afterEach` to restore mocked state
- One assertion focus per test
- Descriptive test names with `it('should...')`

## Mocking

**Framework:**
- Manual mocking (no vi.mock in current tests)
- process.argv manipulation for CLI tests

**Patterns:**
```javascript
// Save and restore process.argv
let originalArgv
beforeEach(() => {
  originalArgv = process.argv
})
afterEach(() => {
  process.argv = originalArgv
})
```

**What to Mock:**
- process.argv for CLI argument tests
- Temporary directories for file operations

**What NOT to Mock:**
- Pure functions (test directly)
- File system in integration tests (use temp dirs)

## Fixtures and Factories

**Test Data:**
```javascript
// Temp directory setup for file tests
let tempDir, srcDir, destDir

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'))
  srcDir = path.join(tempDir, 'src')
  destDir = path.join(tempDir, 'dest')
  fs.mkdirSync(srcDir)
})

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true })
})
```

**Location:**
- Inline in test file (no separate fixtures directory)

## Coverage

**Requirements:**
- No enforced coverage target
- Focus on critical paths (installer functions)

**Configuration:**
- Not explicitly configured

**View Coverage:**
```bash
npm test -- --coverage    # If configured
```

## Test Types

**Unit Tests:**
- `parseArgs()` - CLI argument parsing (11 test cases)
- `expandTilde()` - Path expansion (5 test cases)
- `copyDirectory()` - Directory copying (4 test cases)

**Integration Tests:**
- `copyDirectory()` tests use real file system with temp directories

**E2E Tests:**
- Not implemented
- Skills are integration-tested by users in Claude Code

## Common Patterns

**Async Testing:**
```javascript
// Not currently used (all functions are synchronous)
```

**Error Testing:**
```javascript
it('returns null for paths without tilde', () => {
  const result = expandTilde('/absolute/path')
  expect(result).toBe('/absolute/path')
})
```

**File System Testing:**
```javascript
describe('copyDirectory', () => {
  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'install-test-'))
    srcDir = path.join(tempDir, 'src')
    destDir = path.join(tempDir, 'dest')
    fs.mkdirSync(srcDir)
  })

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true })
  })

  it('copies files from source to destination', () => {
    fs.writeFileSync(path.join(srcDir, 'test.txt'), 'content')
    copyDirectory(srcDir, destDir)
    expect(fs.existsSync(path.join(destDir, 'test.txt'))).toBeTruthy()
  })
})
```

**Snapshot Testing:**
- Not used in this codebase

## CI Integration

**GitHub Actions (`.github/workflows/ci.yml`):**
- Runs on Node.js 18.x and 20.x
- Triggers on push and pull request
- Steps: checkout, setup-node, npm ci, npm test
- Also validates YAML frontmatter in skill files

---

*Testing analysis: 2026-01-19*
*Update when test patterns change*
