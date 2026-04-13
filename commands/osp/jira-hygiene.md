---
name: jira-hygiene
description: Audit Jira ticket hygiene — stale status, missing fix versions, undefined priority, unanswered comments
allowed-tools:
  - Bash
  - Read
---

# Jira Hygiene Audit

<objective>
Audit open Jira tickets for hygiene issues: stale status that doesn't match actual work, missing fix versions, undefined priority, and unanswered comments. Outputs a structured report with specific actions needed.
</objective>

<execution_context>
**Jira Cloud API:**
- Base URL: `https://redhat.atlassian.net`
- Search API: `/rest/api/3/search/jql` (POST with JSON body)
- Auth: Basic auth with `email:api_token`

**Configuration:**
- Config file: `~/.config/osp/config.json` (jira_cloud section)
</execution_context>

<process>
<step name="load_config">
Load Jira credentials:
```bash
CONFIG="$HOME/.config/osp/config.json"
JIRA_EMAIL=$(cat "$CONFIG" | python3 -c "import json,sys; print(json.load(sys.stdin)['jira_cloud']['email'])")
JIRA_TOKEN=$(cat "$CONFIG" | python3 -c "import json,sys; print(json.load(sys.stdin)['jira_cloud']['token'])")
JIRA_AUTH=$(echo -n "$JIRA_EMAIL:$JIRA_TOKEN" | base64)
JIRA_BASE="https://redhat.atlassian.net"
```
</step>

<step name="fetch_and_audit">
Run a single script that fetches all assigned tickets and audits them. The argument is the assignee (defaults to `currentUser()`):

```bash
ASSIGNEE="${1:-currentUser()}"

curl -s -H "Authorization: Basic $JIRA_AUTH" \
  -H "Content-Type: application/json" \
  "$JIRA_BASE/rest/api/3/search/jql" \
  -d "{\"jql\": \"assignee = $ASSIGNEE AND statusCategory != Done ORDER BY priority ASC, updated ASC\", \"maxResults\": 50, \"fields\": [\"key\",\"summary\",\"status\",\"priority\",\"fixVersions\",\"updated\",\"labels\",\"issuetype\",\"comment\"]}" 2>/dev/null | python3 -c "
import json, sys
from datetime import datetime, timezone

d = json.load(sys.stdin)
issues = d.get('issues', [])
JIRA = 'https://redhat.atlassian.net/browse'

def link(key):
    return f'[{key}]({JIRA}/{key})'

def extract_text(node):
    if isinstance(node, dict):
        if node.get('type') == 'text': return node.get('text', '')
        return ''.join(extract_text(c) for c in node.get('content', []))
    if isinstance(node, list): return ''.join(extract_text(c) for c in node)
    return ''

no_fix_version = []
undefined_priority = []
stale_status = []
needs_reply = []
old_tickets = []

now = datetime.now(timezone.utc)

for i in issues:
    f = i.get('fields', {})
    key = i['key']
    summary = f.get('summary', '')[:60]
    status = f.get('status', {}).get('name', '')
    priority = f.get('priority', {}).get('name', '')
    fv = [v.get('name', '') for v in f.get('fixVersions', [])]
    updated = f.get('updated', '')[:10]
    itype = f.get('issuetype', {}).get('name', '')

    # Check fix version
    if not fv:
        no_fix_version.append(f'{link(key)} | {priority:10s} | {status:15s} | {summary}')

    # Check priority
    if priority == 'Undefined':
        undefined_priority.append(f'{link(key)} | {status:15s} | {summary}')

    # Check unanswered comments
    comments = f.get('comment', {}).get('comments', [])
    if comments:
        last = comments[-1]
        author = last.get('author', {}).get('displayName', '')
        last_date = last.get('created', '')[:10]
        last_body = extract_text(last.get('body', {}))[:100]
        # Check if assignee name appears in author (rough match)
        a = f.get('assignee') or {}
        assignee_name = a.get('displayName', 'NOMATCH')
        if assignee_name not in author:
            needs_reply.append(f'{link(key)} | {last_date} | {author[:20]:20s} | {last_body}')

    # Check staleness (not updated in 30+ days)
    if updated:
        try:
            up = datetime.fromisoformat(updated.replace('Z', '+00:00'))
            days = (now - up).days
            if days > 30:
                old_tickets.append(f'{link(key)} | {days:3d} days | {status:15s} | {summary}')
        except: pass

print(f'TOTAL OPEN TICKETS: {len(issues)}')
print()

if undefined_priority:
    print(f'UNDEFINED PRIORITY ({len(undefined_priority)}):')
    for t in undefined_priority: print(f'  {t}')
    print()

if no_fix_version:
    print(f'MISSING FIX VERSION ({len(no_fix_version)}):')
    for t in no_fix_version: print(f'  {t}')
    print()

if needs_reply:
    print(f'UNANSWERED COMMENTS ({len(needs_reply)}):')
    for t in needs_reply: print(f'  {t}')
    print()

if old_tickets:
    print(f'STALE TICKETS (>30 days no update) ({len(old_tickets)}):')
    for t in old_tickets: print(f'  {t}')
    print()

if not (undefined_priority or no_fix_version or needs_reply or old_tickets):
    print('All clean!')
"
```

Present the output to the user. Do NOT re-fetch or re-process the data — just format what the script produced.
</step>
</process>
