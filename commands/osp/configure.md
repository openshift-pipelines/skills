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
Set up authentication and configuration for OpenShift Pipelines skills, including Jira API access.
</objective>

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
```

Report what's already configured.
</step>

<step name="prompt_configuration">
Use AskUserQuestion to determine what the user wants to configure:

**Question**: What would you like to configure?
- Jira authentication (required for `/osp:map-jira-to-upstream`)
- GitHub authentication (optional, increases API rate limits)
- View current configuration
- Reset all configuration
</step>

<step name="configure_jira">
If configuring Jira:

1. Explain how to get a Personal Access Token:
```
## Getting a Jira Personal Access Token

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

3. Report results:
```
## Configuration Status

| Service | Status | Method |
|---------|--------|--------|
| Jira    | ✓ Connected | Environment variable |
| GitHub  | ✓ Connected | gh CLI |
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
