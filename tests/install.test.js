// Vitest globals (describe, it, expect, etc.) are injected by vitest.config.js
const { parseArgs, expandTilde, copyDirectory } = require('../bin/install.js')
const fs = require('fs')
const path = require('path')
const os = require('os')

describe('parseArgs', () => {
  const originalArgv = process.argv

  afterEach(() => {
    process.argv = originalArgv
  })

  it('returns default options when no args provided', () => {
    process.argv = ['node', 'install.js']
    const options = parseArgs()
    expect(options).toEqual({
      global: false,
      local: false,
      configDir: null,
      help: false,
    })
  })

  it('parses --help flag', () => {
    process.argv = ['node', 'install.js', '--help']
    expect(parseArgs().help).toBe(true)
  })

  it('parses -h flag', () => {
    process.argv = ['node', 'install.js', '-h']
    expect(parseArgs().help).toBe(true)
  })

  it('parses --global flag', () => {
    process.argv = ['node', 'install.js', '--global']
    expect(parseArgs().global).toBe(true)
  })

  it('parses -g flag', () => {
    process.argv = ['node', 'install.js', '-g']
    expect(parseArgs().global).toBe(true)
  })

  it('parses --local flag', () => {
    process.argv = ['node', 'install.js', '--local']
    expect(parseArgs().local).toBe(true)
  })

  it('parses -l flag', () => {
    process.argv = ['node', 'install.js', '-l']
    expect(parseArgs().local).toBe(true)
  })

  it('parses --config-dir with separate value', () => {
    process.argv = ['node', 'install.js', '--config-dir', '/custom/path']
    expect(parseArgs().configDir).toBe('/custom/path')
  })

  it('parses -c with separate value', () => {
    process.argv = ['node', 'install.js', '-c', '/custom/path']
    expect(parseArgs().configDir).toBe('/custom/path')
  })

  it('parses --config-dir= with inline value', () => {
    process.argv = ['node', 'install.js', '--config-dir=/custom/path']
    expect(parseArgs().configDir).toBe('/custom/path')
  })

  it('parses -c= with inline value', () => {
    process.argv = ['node', 'install.js', '-c=/custom/path']
    expect(parseArgs().configDir).toBe('/custom/path')
  })

  it('parses multiple flags together', () => {
    process.argv = ['node', 'install.js', '-g', '-h']
    const options = parseArgs()
    expect(options.global).toBe(true)
    expect(options.help).toBe(true)
  })
})

describe('expandTilde', () => {
  it('expands ~ at the start of path', () => {
    const result = expandTilde('~/test/path')
    expect(result).toBe(path.join(os.homedir(), 'test/path'))
  })

  it('expands standalone ~', () => {
    const result = expandTilde('~')
    expect(result).toBe(os.homedir())
  })

  it('does not expand ~ in the middle of path', () => {
    const result = expandTilde('/path/to/~/something')
    expect(result).toBe('/path/to/~/something')
  })

  it('returns absolute paths unchanged', () => {
    const result = expandTilde('/absolute/path')
    expect(result).toBe('/absolute/path')
  })

  it('returns relative paths unchanged', () => {
    const result = expandTilde('relative/path')
    expect(result).toBe('relative/path')
  })
})

describe('copyDirectory', () => {
  let tempDir
  let srcDir
  let destDir

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
    fs.writeFileSync(path.join(srcDir, 'test.txt'), 'hello')

    copyDirectory(srcDir, destDir)

    expect(fs.existsSync(path.join(destDir, 'test.txt'))).toBe(true)
    expect(fs.readFileSync(path.join(destDir, 'test.txt'), 'utf8')).toBe('hello')
  })

  it('creates destination directory if it does not exist', () => {
    fs.writeFileSync(path.join(srcDir, 'test.txt'), 'hello')

    copyDirectory(srcDir, destDir)

    expect(fs.existsSync(destDir)).toBe(true)
  })

  it('copies nested directories recursively', () => {
    const nestedDir = path.join(srcDir, 'nested')
    fs.mkdirSync(nestedDir)
    fs.writeFileSync(path.join(nestedDir, 'deep.txt'), 'deep content')

    copyDirectory(srcDir, destDir)

    expect(fs.existsSync(path.join(destDir, 'nested', 'deep.txt'))).toBe(true)
    expect(fs.readFileSync(path.join(destDir, 'nested', 'deep.txt'), 'utf8')).toBe('deep content')
  })

  it('copies multiple files', () => {
    fs.writeFileSync(path.join(srcDir, 'file1.md'), 'content1')
    fs.writeFileSync(path.join(srcDir, 'file2.md'), 'content2')

    copyDirectory(srcDir, destDir)

    expect(fs.existsSync(path.join(destDir, 'file1.md'))).toBe(true)
    expect(fs.existsSync(path.join(destDir, 'file2.md'))).toBe(true)
  })

  it('copies HTML template files for companion UI', () => {
    const srcTemplates = path.join(srcDir, 'templates');
    fs.mkdirSync(srcTemplates);
    fs.writeFileSync(path.join(srcTemplates, 'sprint-dashboard.html'), '<html>test</html>');

    copyDirectory(srcDir, destDir);

    expect(fs.existsSync(path.join(destDir, 'templates', 'sprint-dashboard.html'))).toBe(true);
    expect(fs.readFileSync(path.join(destDir, 'templates', 'sprint-dashboard.html'), 'utf8')).toBe('<html>test</html>');
  })
})
