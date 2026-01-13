#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

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
${colors.cyan}${colors.bright}╔══════════════════════════════════════════════════════════════╗
║           OpenShift Pipelines Skills for Claude Code          ║
║                         v${VERSION}                               ║
╚══════════════════════════════════════════════════════════════╝${colors.reset}

${colors.dim}Claude Code skills for OpenShift Pipelines development workflows${colors.reset}
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
  -g, --global              Install to ~/.claude/commands/${NAMESPACE}/
  -l, --local               Install to ./.claude/commands/${NAMESPACE}/
  -c, --config-dir <path>   Install to custom directory
  -h, --help                Show this help message

${colors.bright}Examples:${colors.reset}
  npx openshift-pipelines-skills              # Interactive prompt
  npx openshift-pipelines-skills -g           # Install globally
  npx openshift-pipelines-skills -l           # Install in current project
  npx openshift-pipelines-skills -c ~/custom  # Custom directory

${colors.bright}After Installation:${colors.reset}
  Use /${NAMESPACE}:help in Claude Code to see available commands
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
    console.log(`  ${colors.cyan}1)${colors.reset} Global (${colors.dim}~/.claude/commands/${NAMESPACE}/${colors.reset}) ${colors.green}[recommended]${colors.reset}`);
    console.log(`  ${colors.cyan}2)${colors.reset} Local  (${colors.dim}./.claude/commands/${NAMESPACE}/${colors.reset})\n`);

    rl.question(`${colors.bright}Choice [1]:${colors.reset} `, (answer) => {
      rl.close();
      const choice = answer.trim() || '1';
      resolve(choice === '2' ? 'local' : 'global');
    });
  });
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

  // List installed commands
  const commands = fs.readdirSync(commandsDest)
    .filter(f => f.endsWith('.md'))
    .map(f => f.replace('.md', ''));

  console.log(`${colors.green}${colors.bright}Installation complete!${colors.reset}\n`);
  console.log(`${colors.bright}Installed ${commands.length} command(s):${colors.reset}`);

  for (const cmd of commands) {
    console.log(`  ${colors.cyan}/${NAMESPACE}:${cmd}${colors.reset}`);
  }

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
  if (options.global && options.local) {
    console.error(`${colors.red}Error: Cannot specify both --global and --local${colors.reset}`);
    process.exit(1);
  }

  if (options.configDir && options.local) {
    console.error(`${colors.red}Error: Cannot specify both --config-dir and --local${colors.reset}`);
    process.exit(1);
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
    targetDir = location === 'local'
      ? path.join(process.cwd(), '.claude')
      : path.join(os.homedir(), '.claude');
  }

  await install(targetDir);
}

main().catch((err) => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
