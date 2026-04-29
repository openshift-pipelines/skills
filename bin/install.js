#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync } = require('child_process');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Load package info
const packageJson = require('../package.json');
const VERSION = packageJson.version;
const NAMESPACE = 'osp'; // OpenShift Pipelines

// Display banner
function showBanner() {
  console.log(`
${colors.cyan}${colors.bright}    ___  ____  ____
   / _ \\/ ___||  _ \\
  | | | \\___ \\| |_) |
  | |_| |___) |  __/
   \\___/|____/|_|    ${colors.reset}${colors.dim}v${VERSION}${colors.reset}

${colors.cyan}${colors.bright}  OpenShift Pipelines Skills${colors.reset}
${colors.dim}  AI-powered skills for Claude Code & Cursor${colors.reset}
`);
}

// Expand tilde in paths
function expandTilde(filePath) {
  if (filePath.startsWith('~/') || filePath === '~') {
    return filePath.replace('~', os.homedir());
  }
  return filePath;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    global: false,
    local: false,
    cursor: false,
    configDir: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--global' || arg === '-g') {
      options.global = true;
    } else if (arg === '--local' || arg === '-l') {
      options.local = true;
    } else if (arg === '--cursor') {
      options.cursor = true;
    } else if (arg === '--config-dir' || arg === '-c') {
      options.configDir = args[++i];
    } else if (arg.startsWith('--config-dir=')) {
      options.configDir = arg.split('=')[1];
    } else if (arg.startsWith('-c=')) {
      options.configDir = arg.split('=')[1];
    }
  }

  return options;
}

// Show help
function showHelp() {
  console.log(`
${colors.bright}Usage:${colors.reset} npx openshift-pipelines-skills [options]

${colors.bright}Options:${colors.reset}
  -g, --global              Install to ~/.claude/commands/${NAMESPACE}/ (Claude Code)
  -l, --local               Install to ./.claude/commands/${NAMESPACE}/ (Claude Code)
  --cursor                  Install to ./.cursor/rules/ (Cursor IDE)
  -c, --config-dir <path>   Install to custom directory
  -h, --help                Show this help message

${colors.bright}Examples:${colors.reset}
  npx openshift-pipelines-skills              # Interactive prompt
  npx openshift-pipelines-skills -g           # Install globally (Claude Code)
  npx openshift-pipelines-skills -l           # Install in current project (Claude Code)
  npx openshift-pipelines-skills --cursor     # Install for Cursor IDE
  npx openshift-pipelines-skills -c ~/custom  # Custom directory

${colors.bright}After Installation:${colors.reset}
  Claude Code: Use /${NAMESPACE}:help to see available commands
  Cursor:      Rules auto-activate based on context
`);
}

// Recursively copy directory
function copyDirectory(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Prompt user for installation location
async function promptLocation() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log(`${colors.bright}Where would you like to install the skills?${colors.reset}\n`);
    console.log(`  ${colors.cyan}1)${colors.reset} Claude Code — Global (${colors.dim}~/.claude/commands/${NAMESPACE}/${colors.reset}) ${colors.green}[recommended]${colors.reset}`);
    console.log(`  ${colors.cyan}2)${colors.reset} Claude Code — Local  (${colors.dim}./.claude/commands/${NAMESPACE}/${colors.reset})`);
    console.log(`  ${colors.cyan}3)${colors.reset} Cursor IDE   (${colors.dim}./.cursor/rules/${colors.reset})\n`);

    rl.question(`${colors.bright}Choice [1]:${colors.reset} `, (answer) => {
      rl.close();
      const choice = answer.trim() || '1';
      if (choice === '3') resolve('cursor');
      else if (choice === '2') resolve('local');
      else resolve('global');
    });
  });
}

// Convert Claude Code skill (.md) to Cursor rule (.mdc)
function convertToCursorRule(content, filename) {
  // Extract YAML frontmatter
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return content;

  const frontmatter = fmMatch[1];
  const body = fmMatch[2];

  // Parse description from frontmatter
  const descMatch = frontmatter.match(/description:\s*(.+)/);
  const description = descMatch ? descMatch[1].trim() : `OpenShift Pipelines: ${filename}`;

  // Build Cursor .mdc frontmatter
  return `---
description: ${description}
globs:
alwaysApply: false
---

${body}`;
}

// Install skills as Cursor rules
async function installCursor(cursorDir) {
  const commandsSource = path.join(__dirname, '..', 'commands', NAMESPACE);
  const rulesDir = path.join(cursorDir, 'rules');

  console.log(`\n${colors.bright}Installing Cursor rules to:${colors.reset} ${rulesDir}\n`);

  if (!fs.existsSync(commandsSource)) {
    console.error(`${colors.red}Error: Commands directory not found at ${commandsSource}${colors.reset}`);
    process.exit(1);
  }

  if (!fs.existsSync(rulesDir)) {
    fs.mkdirSync(rulesDir, { recursive: true });
  }

  const files = fs.readdirSync(commandsSource).filter(f => f.endsWith('.md'));
  let count = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(commandsSource, file), 'utf8');
    const ruleName = `${NAMESPACE}-${file.replace('.md', '')}.mdc`;
    const converted = convertToCursorRule(content, file.replace('.md', ''));
    fs.writeFileSync(path.join(rulesDir, ruleName), converted);
    count++;
  }

  console.log(`${colors.green}${colors.bright}Installation complete!${colors.reset}\n`);
  console.log(`${colors.bright}Installed ${count} Cursor rule(s):${colors.reset}`);

  for (const file of files) {
    const name = file.replace('.md', '');
    console.log(`  ${colors.cyan}${NAMESPACE}-${name}.mdc${colors.reset}`);
  }

  console.log(`\n${colors.dim}Rules are available as context in Cursor when editing files in this project.${colors.reset}`);
  console.log(`${colors.dim}Invoke them by asking Cursor about OpenShift Pipelines tasks.${colors.reset}\n`);
}

// Main installation function
async function install(targetDir) {
  const commandsSource = path.join(__dirname, '..', 'commands', NAMESPACE);
  const commandsDest = path.join(targetDir, 'commands', NAMESPACE);

  console.log(`\n${colors.bright}Installing to:${colors.reset} ${commandsDest}\n`);

  // Check if source exists
  if (!fs.existsSync(commandsSource)) {
    console.error(`${colors.red}Error: Commands directory not found at ${commandsSource}${colors.reset}`);
    process.exit(1);
  }

  // Create destination directory
  if (!fs.existsSync(commandsDest)) {
    fs.mkdirSync(commandsDest, { recursive: true });
  }

  // Copy commands
  copyDirectory(commandsSource, commandsDest);

  // Copy templates if they exist
  const templatesSource = path.join(__dirname, '..', 'docs', 'templates');
  const templatesDest = path.join(targetDir, 'templates', NAMESPACE);

  if (fs.existsSync(templatesSource)) {
    console.log(`${colors.dim}Installing templates to: ${templatesDest}${colors.reset}`);
    copyDirectory(templatesSource, templatesDest);
  }

  // Copy standalone scripts
  const scriptsSource = path.join(__dirname, '..');
  const scriptsDest = path.join(targetDir, 'bin', NAMESPACE);

  if (!fs.existsSync(scriptsDest)) {
    fs.mkdirSync(scriptsDest, { recursive: true });
  }

  const scripts = ['sprint-status.js', 'sprint-history.js'];
  for (const script of scripts) {
    const src = path.join(scriptsSource, 'bin', script);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(scriptsDest, script));
      console.log(`${colors.dim}Installed script: ${script}${colors.reset}`);
    }
  }

  // Build React dashboard if dashboard/ exists
  const dashboardDir = path.join(scriptsSource, 'dashboard');
  if (fs.existsSync(dashboardDir)) {
    const builtIndex = path.join(scriptsSource, 'docs', 'templates', 'built', 'index.html');

    if (!fs.existsSync(builtIndex)) {
      console.log(`\n${colors.cyan}Building React dashboard...${colors.reset}`);
      try {
        const dashboardNodeModules = path.join(dashboardDir, 'node_modules');
        if (!fs.existsSync(dashboardNodeModules)) {
          console.log(`${colors.dim}Installing dashboard dependencies...${colors.reset}`);
          execSync('npm install', { cwd: dashboardDir, stdio: 'pipe' });
        }
        execSync('npm run build', { cwd: dashboardDir, stdio: 'pipe' });
        console.log(`${colors.green}Dashboard built successfully${colors.reset}`);
      } catch (e) {
        console.log(`${colors.yellow}Dashboard build skipped: ${e.message}${colors.reset}`);
        console.log(`${colors.dim}You can build manually: cd dashboard && npm install && npm run build${colors.reset}`);
      }
    } else {
      console.log(`${colors.dim}Dashboard already built${colors.reset}`);
    }
  }

  // List installed commands
  const commands = fs.readdirSync(commandsDest)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''));

  console.log(`\n${colors.green}${colors.bright}Installation complete!${colors.reset}\n`);
  console.log(`${colors.bright}Installed ${commands.length} command(s):${colors.reset}`);

  for (const cmd of commands) {
    console.log(`  ${colors.cyan}/${NAMESPACE}:${cmd}${colors.reset}`);
  }

  console.log(`\n${colors.bright}Standalone scripts (no LLM tokens):${colors.reset}`);
  console.log(`  ${colors.cyan}node ${path.join(scriptsDest, 'sprint-status.js')} <team>${colors.reset}`);
  console.log(`  ${colors.cyan}node ${path.join(scriptsDest, 'sprint-history.js')} <team> <subcommand>${colors.reset}`);

  console.log(`\n${colors.dim}Run /${NAMESPACE}:help in Claude Code to get started.${colors.reset}\n`);
}

// Main entry point
async function main() {
  const options = parseArgs();

  showBanner();

  if (options.help) {
    showHelp();
    process.exit(0);
  }

  // Validate conflicting options
  const modeCount = [options.global, options.local, options.cursor].filter(Boolean).length;
  if (modeCount > 1) {
    console.error(`${colors.red}Error: Cannot specify multiple install targets (--global, --local, --cursor)${colors.reset}`);
    process.exit(1);
  }

  if (options.configDir && (options.local || options.cursor)) {
    console.error(`${colors.red}Error: Cannot specify --config-dir with --local or --cursor${colors.reset}`);
    process.exit(1);
  }

  if (options.cursor) {
    await installCursor(path.join(process.cwd(), '.cursor'));
    return;
  }

  let targetDir;

  if (options.configDir) {
    targetDir = expandTilde(options.configDir);
  } else if (options.global) {
    targetDir = path.join(os.homedir(), '.claude');
  } else if (options.local) {
    targetDir = path.join(process.cwd(), '.claude');
  } else {
    // Interactive mode
    const location = await promptLocation();
    if (location === 'cursor') {
      await installCursor(path.join(process.cwd(), '.cursor'));
      return;
    }
    targetDir = location === 'local'
      ? path.join(process.cwd(), '.claude')
      : path.join(os.homedir(), '.claude');
  }

  await install(targetDir);
}

// Run if executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    process.exit(1);
  });
}

// Export for testing
module.exports = {
  parseArgs,
  expandTilde,
  copyDirectory,
};
