---
name: configure
description: Configure OpenShift Pipelines skills authentication and settings
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
---

# Configure OpenShift Pipelines Skills

<objective>
Set up authentication and configuration for OpenShift Pipelines skills, including Jira API access, GitHub, Konflux console, and OpenShift cluster access.
</objective>

<important_warning>
## ⚠️ Cookie Expiration — Read This First

**Konflux SSO cookies expire after 8-24 hours.** If you're starting a release session that will span multiple hours or days, refresh your cookie BEFORE starting.

**Signs your cookie has expired:**
- HTTP 401 or 403 errors from Konflux API
- "Cookie expired or invalid" messages
- Skill commands fail with authentication errors

**Quick fix:** Run `/osp:configure` → Select Konflux authentication

**Best practice for releases:**
1. Refresh cookie at the start of each work session
2. If you take a break > 4 hours, refresh before resuming
3. Keep browser logged into Konflux to extend session
</important_warning>

<process>
<step name="check_existing_config">
Check for existing configuration:

```bash
# Check config directory
ls -la ~/.config/osp/ 2>/dev/null || echo "No config directory"

# Check existing config
cat ~/.config/osp/config.json 2>/dev/null || echo "No config file"

# Check environment variables
echo "JIRA_TOKEN: ${JIRA_TOKEN:+[SET]}"
echo "GITHUB_TOKEN: ${GITHUB_TOKEN:+[SET]}"

# Check Konflux cookie
if [ -f ~/.config/osp/config.json ]; then
  jq -r 'if .konflux.cookie then "KONFLUX_COOKIE: [SET]" else "KONFLUX_COOKIE: [NOT SET]" end' ~/.config/osp/config.json 2>/dev/null
fi
```

Report what's already configured.
</step>

<step name="prompt_configuration">
Use AskUserQuestion to determine what the user wants to configure:

**Question**: What would you like to configure?
- Jira authentication (required for `/osp:release-status`, `/osp:map-jira-to-upstream`)
- GitHub authentication (optional, increases API rate limits)
- Konflux authentication (required for `/osp:konflux-image`, `/osp:component-builds`)
- OpenShift cluster authentication (required for deployment testing)
- View current configuration
- Reset all configuration

**Multiple selections allowed** — user may need to set up several services at once.
</step>

<step name="configure_jira">
If configuring Jira:

1. Explain how to get a Personal Access Token:
```
## Getting a Jira Personal Access Token

**Direct link**: https://issues.redhat.com/secure/ViewProfile.jspa?selectedTab=com.atlassian.pats.pats-plugin:jira-user-personal-access-tokens

Or navigate manually:
1. Log in to https://issues.redhat.com
2. Click your profile icon in the top right
3. Select "Personal Access Tokens"
4. Click "Create token"
5. Give it a name (e.g., "Claude Skills")
6. Set scope to "Read" (minimum required)
7. Click "Create"
8. **Copy the token immediately** - it's only shown once!
```

2. Ask how they want to store the token:

**Question**: How would you like to store your Jira token?
- **Environment variable** (Recommended) - Add to shell profile, most secure
- **Config file** - Store in ~/.config/osp/config.json

3. Based on choice:

**For environment variable:**
```
Add this to your ~/.bashrc, ~/.zshrc, or shell profile:

export JIRA_TOKEN="your-token-here"

Then run: source ~/.bashrc (or restart your terminal)
```

**For config file:**
```bash
mkdir -p ~/.config/osp
chmod 700 ~/.config/osp
```

Then prompt for the token and create the config:
```bash
cat > ~/.config/osp/config.json << 'EOF'
{
  "jira": {
    "base_url": "https://issues.redhat.com",
    "token": "TOKEN_PLACEHOLDER"
  }
}
EOF
chmod 600 ~/.config/osp/config.json
```

Replace TOKEN_PLACEHOLDER with the actual token using the Edit tool.
</step>

<step name="configure_konflux">
If configuring Konflux:

1. Explain the SSO authentication flow:
```
## Konflux Authentication (SSO Session Cookie)

Konflux uses Red Hat SSO. To access pipeline logs and details, you need to:
1. Log in via browser
2. Session cookie is automatically extracted
3. Cookie is saved for API access

**Why a cookie?** Konflux doesn't have a public API with token auth.
The cookie is stored in ~/.config/osp/config.json (outside any git repo).
```

2. **Automated method (recommended):** Run the auth helper script:
```bash
# This opens a browser, waits for you to log in, then extracts the cookie
node /path/to/skills/bin/konflux-auth.js

# Or if skills are installed globally:
node ~/.claude/commands/osp/../bin/konflux-auth.js
```

The script will:
- Open Chromium browser to Konflux URL
- Wait for you to complete SSO login
- Automatically extract the session cookie
- Save it to `~/.config/osp/config.json`

3. **Manual method (fallback):** If automated method fails:
```
## Step 1: Log in to Konflux

Open this URL in your browser:
https://konflux-ui.apps.kflux-prd-rh02.0fk9.p1.openshiftapps.com

Log in with your Red Hat SSO credentials.
```

```
## Step 2: Extract Session Cookie

After logging in:

**Chrome/Edge:**
1. Open DevTools (F12)
2. Go to Application → Cookies → konflux-ui.apps.kflux-prd-rh02...
3. Find the cookie named `__Host-konflux-ci-cookie`
4. Copy its value

**Firefox:**
1. Open DevTools (F12)
2. Go to Storage → Cookies
3. Find the session cookie
4. Copy its value
```

4. Save the cookie to config (manual method only):
```bash
mkdir -p ~/.config/osp
chmod 700 ~/.config/osp

# Read existing config or create new
if [ -f ~/.config/osp/config.json ]; then
  CONFIG=$(cat ~/.config/osp/config.json)
else
  CONFIG='{}'
fi

# Add konflux section (user provides cookie value)
echo "$CONFIG" | jq --arg cookie "USER_PROVIDED_COOKIE" \
  '. + {konflux: {base_url: "https://konflux-ui.apps.kflux-prd-rh02.0fk9.p1.openshiftapps.com", cookie: $cookie}}' \
  > ~/.config/osp/config.json

chmod 600 ~/.config/osp/config.json
```

5. Note about cookie expiration:
```
## Important Notes

- **Cookie expires**: SSO cookies typically expire after 8-24 hours
- **Re-authenticate when needed**: Run `/osp:configure` again if you get auth errors
- **Secure storage**: Cookie is stored in ~/.config/osp/ with 600 permissions
- **Not in git**: This directory is in your home folder, outside any git repository
```
</step>

<step name="configure_github">
If configuring GitHub (optional):

1. Explain benefits:
```
## GitHub Authentication (Optional)

A GitHub token increases API rate limits from 60 to 5000 requests/hour.
This is helpful when searching many upstream issues.

You can use the `gh` CLI authentication or a Personal Access Token.
```

2. Check if `gh` is authenticated:
```bash
gh auth status 2>&1 || echo "gh CLI not authenticated"
```

3. If not, offer options:
- Use `gh auth login` (interactive)
- Set `GITHUB_TOKEN` environment variable
- Add to config file
</step>

<step name="configure_cluster">
If configuring OpenShift cluster access (for deployment testing):

1. Explain what cluster auth is needed for:
```
## OpenShift Cluster Authentication

Cluster access via `oc` CLI is needed for:
- Dev release deployment testing (`/osp:deploy-dev`)
- Creating CatalogSource resources
- Verifying TektonConfig status
- Running test TaskRuns

This is separate from Konflux authentication — you need both for full release workflow.
```

2. Check current cluster status:
```bash
# Check if logged in
oc whoami 2>/dev/null && echo "Logged in" || echo "Not logged in"

# Show current context
oc whoami --show-context 2>/dev/null || echo "No context"

# Show server URL
oc whoami --show-server 2>/dev/null || echo "No server"
```

3. If not logged in, guide through login:
```
## Login Options

**Option 1: Web Console Token (Recommended)**
1. Go to your cluster's web console (e.g., https://console-openshift-console.apps.CLUSTER/)
2. Click your username → "Copy login command"
3. Click "Display Token"
4. Copy the `oc login` command and run it

**Option 2: Service Account Token**
If you have a service account token:
```bash
oc login --token=TOKEN --server=https://api.CLUSTER:6443
```

**Option 3: Username/Password**
```bash
oc login -u USERNAME -p PASSWORD https://api.CLUSTER:6443
```
```

4. Common clusters for release testing:
```
## Common Test Clusters

| Purpose | Cluster | Login URL |
|---------|---------|-----------|
| Dev testing | ROSA cluster | https://console-openshift-console.apps.XXX.openshiftapps.com |
| Stage validation | Internal cluster | (varies by team) |

**Note:** ROSA clusters may have different auth methods (OIDC, htpasswd).
Check with your cluster admin for the correct login method.
```

5. Verify access after login:
```bash
# Verify connectivity
oc get nodes --no-headers 2>/dev/null | wc -l | xargs echo "Nodes:"

# Check for openshift-pipelines namespace
oc get ns openshift-pipelines 2>/dev/null && echo "OpenShift Pipelines namespace exists" || echo "OpenShift Pipelines not installed"

# Check for TektonConfig if pipelines installed
oc get tektonconfig config -o jsonpath='{.status.version}' 2>/dev/null && echo " (current version)" || echo "No TektonConfig found"
```

6. Cluster auth persistence:
```
## Session Persistence

`oc` login creates a kubeconfig context that persists until:
- Token expires (varies by cluster config, typically 24h)
- You explicitly log out (`oc logout`)
- You switch to a different context

**Multi-cluster tip:** Use named contexts to switch between clusters:
```bash
# List contexts
oc config get-contexts

# Switch context
oc config use-context MY_CONTEXT
```
```
</step>

<step name="verify_configuration">
Test the configuration:

1. **Test Jira access:**
```bash
# Using env var
if [ -n "$JIRA_TOKEN" ]; then
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${JIRA_TOKEN}" \
    "https://issues.redhat.com/rest/api/2/myself"
fi

# Using config file
if [ -f ~/.config/osp/config.json ]; then
  TOKEN=$(jq -r '.jira.token' ~/.config/osp/config.json)
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer ${TOKEN}" \
    "https://issues.redhat.com/rest/api/2/myself"
fi
```

Expected: `200` for success, `401` for invalid token, `403` for insufficient permissions.

2. **Test GitHub access:**
```bash
gh api user --jq '.login' 2>/dev/null || echo "Not authenticated"
```

3. **Test Konflux access:**
```bash
if [ -f ~/.config/osp/config.json ]; then
  KONFLUX_COOKIE=$(jq -r '.konflux.cookie // empty' ~/.config/osp/config.json)
  KONFLUX_URL=$(jq -r '.konflux.base_url // empty' ~/.config/osp/config.json)

  if [ -n "$KONFLUX_COOKIE" ] && [ -n "$KONFLUX_URL" ]; then
    # Try to access API with cookie
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Cookie: _oauth2_proxy=${KONFLUX_COOKIE}" \
      "${KONFLUX_URL}/api/v1/namespaces")

    if [ "$HTTP_CODE" = "200" ]; then
      echo "Konflux: Connected"
    elif [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
      echo "Konflux: Cookie expired - re-run /osp:configure"
    else
      echo "Konflux: Error (HTTP $HTTP_CODE)"
    fi
  else
    echo "Konflux: Not configured"
  fi
fi
```

4. Report results:
```
## Configuration Status

| Service  | Status | Method |
|----------|--------|--------|
| Jira     | ✓ Connected | Environment variable |
| GitHub   | ✓ Connected | gh CLI |
| Konflux  | ✓ Connected | SSO Cookie |
```
</step>

<step name="show_config">
If user chose to view configuration:

```bash
echo "=== Environment Variables ==="
echo "JIRA_TOKEN: ${JIRA_TOKEN:+[SET - hidden]}"
echo "GITHUB_TOKEN: ${GITHUB_TOKEN:+[SET - hidden]}"
echo ""
echo "=== Config File ==="
if [ -f ~/.config/osp/config.json ]; then
  # Show config with token redacted
  jq 'if .jira.token then .jira.token = "[REDACTED]" else . end |
      if .github.token then .github.token = "[REDACTED]" else . end' \
    ~/.config/osp/config.json
else
  echo "No config file found"
fi
```
</step>

<step name="reset_config">
If user chose to reset:

```bash
# Confirm before deleting
rm -i ~/.config/osp/config.json
```

Remind them to also unset environment variables if used:
```bash
unset JIRA_TOKEN
unset GITHUB_TOKEN
# And remove from shell profile
```
</step>
</process>

<output>
Configuration is set up and verified, with clear status of what's configured and working.
</output>

<success_criteria>
- [ ] User understands the configuration options
- [ ] Chosen authentication method is set up
- [ ] Configuration is tested and verified working
- [ ] Sensitive tokens are stored securely (600 permissions or env vars)
</success_criteria>
