#!/usr/bin/env node

/**
 * Konflux SSO Authentication Helper
 *
 * Opens a browser for Red Hat SSO login, waits for successful authentication,
 * then extracts and saves the session cookie for API access.
 *
 * Usage: node bin/konflux-auth.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const KONFLUX_URL = 'https://konflux-ui.apps.kflux-prd-rh02.0fk9.p1.openshiftapps.com';
const CONFIG_PATH = path.join(os.homedir(), '.config', 'osp', 'config.json');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
};

async function main() {
  console.log(`
${colors.cyan}${colors.bright}════════════════════════════════════════════════════════════════
                    Konflux SSO Authentication
════════════════════════════════════════════════════════════════${colors.reset}
`);

  // Try to load playwright
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    console.log(`${colors.yellow}Installing Playwright (one-time setup)...${colors.reset}\n`);

    try {
      // Use execFileSync for safety (no shell injection)
      execFileSync('npm', ['install', 'playwright'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });
      // Install browser
      execFileSync('npx', ['playwright', 'install', 'chromium'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });
      playwright = require('playwright');
    } catch (installError) {
      console.error(`${colors.red}Failed to install Playwright: ${installError.message}${colors.reset}`);
      console.log(`\nAlternative: Run /osp:configure and manually extract the cookie.`);
      process.exit(1);
    }
  }

  console.log(`${colors.bright}Opening browser for Red Hat SSO login...${colors.reset}`);
  console.log(`${colors.yellow}Please log in with your Red Hat credentials.${colors.reset}\n`);

  const browser = await playwright.chromium.launch({
    headless: false,  // Show browser so user can log in
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null  // Use full window size
  });

  const page = await context.newPage();

  try {
    // Navigate to Konflux
    await page.goto(KONFLUX_URL, { waitUntil: 'networkidle' });

    console.log(`${colors.cyan}Waiting for you to complete SSO login...${colors.reset}`);
    console.log(`${colors.yellow}(The browser will close automatically after successful login)${colors.reset}\n`);

    // Wait for redirect back to Konflux after SSO login
    // The URL should contain the Konflux domain without SSO redirect
    await page.waitForURL(`${KONFLUX_URL}/**`, {
      timeout: 300000  // 5 minute timeout for login
    });

    // Give it a moment to fully load and set cookies
    await page.waitForTimeout(2000);

    // Extract cookies
    const cookies = await context.cookies();

    // Find the Konflux session cookie
    const authCookie = cookies.find(c =>
      c.name === '__Host-konflux-ci-cookie' ||
      c.name === '_oauth2_proxy' ||
      c.name === '_oauth_proxy' ||
      c.name.includes('konflux') ||
      c.name.includes('oauth')
    );

    if (!authCookie) {
      // Try to find any session-like cookie
      const sessionCookie = cookies.find(c =>
        c.name.includes('session') ||
        c.name.includes('auth') ||
        c.name.includes('token')
      );

      if (sessionCookie) {
        console.log(`${colors.yellow}Found session cookie: ${sessionCookie.name}${colors.reset}`);
        await saveCookie(sessionCookie.name, sessionCookie.value);
      } else {
        console.log(`${colors.yellow}Available cookies:${colors.reset}`);
        cookies.forEach(c => console.log(`  - ${c.name}`));
        throw new Error('Could not find authentication cookie');
      }
    } else {
      await saveCookie(authCookie.name, authCookie.value);
    }

    console.log(`\n${colors.green}${colors.bright}Authentication successful!${colors.reset}`);
    console.log(`Cookie saved to: ${CONFIG_PATH}\n`);

  } catch (error) {
    if (error.message.includes('timeout')) {
      console.error(`\n${colors.red}Login timed out. Please try again.${colors.reset}`);
    } else {
      console.error(`\n${colors.red}Error: ${error.message}${colors.reset}`);
    }
    process.exit(1);
  } finally {
    await browser.close();
  }
}

async function saveCookie(cookieName, cookieValue) {
  // Ensure config directory exists
  const configDir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  // Load existing config or create new
  let config = {};
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (e) {
      console.log(`${colors.yellow}Creating new config file${colors.reset}`);
    }
  }

  // Add/update Konflux section
  config.konflux = {
    base_url: KONFLUX_URL,
    cookie_name: cookieName,
    cookie: cookieValue,
    updated_at: new Date().toISOString()
  };

  // Save config
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), { mode: 0o600 });
}

// Run
main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
