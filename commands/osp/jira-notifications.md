---
name: jira-notifications
description: Show Jira tickets with unanswered comments needing your reply, sorted by age
allowed-tools:
  - Bash
  - Read
---

# Jira Notifications

<objective>
Show tickets where someone else left the last comment and you haven't replied yet. Sorted by how long the comment has been waiting — oldest first. This is your "inbox" for Jira.
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
<step name="fetch_notifications">
Load config and run the notification check as a single script:

```bash
CONFIG="$HOME/.config/osp/config.json"
JIRA_EMAIL=$(cat "$CONFIG" | python3 -c "import json,sys; print(json.load(sys.stdin)['jira_cloud']['email'])")
JIRA_TOKEN=$(cat "$CONFIG" | python3 -c "import json,sys; print(json.load(sys.stdin)['jira_cloud']['token'])")
JIRA_BASE="https://redhat.atlassian.net"

# Fetch tickets updated in last 30 days that are assigned to user or user is watching
curl -s -u "$JIRA_EMAIL:$JIRA_TOKEN" \
  -H "Content-Type: application/json" \
  "$JIRA_BASE/rest/api/3/search/jql" \
  -d "{\"jql\": \"(assignee = currentUser() OR watcher = currentUser()) AND updated >= -30d AND statusCategory != Done ORDER BY updated DESC\", \"maxResults\": 50, \"fields\": [\"key\",\"summary\",\"status\",\"priority\",\"assignee\",\"updated\",\"comment\"]}" 2>/dev/null | python3 -c "
import json, sys
from datetime import datetime, timezone

d = json.load(sys.stdin)

def extract_text(node):
    if isinstance(node, dict):
        if node.get('type') == 'text': return node.get('text', '')
        if node.get('type') == 'inlineCard': return node.get('attrs', {}).get('url', '')
        return ''.join(extract_text(c) for c in node.get('content', []))
    if isinstance(node, list): return ''.join(extract_text(c) for c in node)
    return ''

needs_reply = []
now = datetime.now(timezone.utc)

for i in d.get('issues', []):
    f = i.get('fields', {})
    key = i['key']
    summary = f.get('summary', '')[:55]
    priority = f.get('priority', {}).get('name', '')
    a = f.get('assignee') or {}
    assignee_name = a.get('displayName', '')

    comments = f.get('comment', {}).get('comments', [])
    if not comments:
        continue

    last = comments[-1]
    author = last.get('author', {}).get('displayName', '')
    last_date = last.get('created', '')[:10]
    last_body = extract_text(last.get('body', {}))[:120]

    # Skip if you wrote the last comment
    if assignee_name and assignee_name in author:
        continue

    # Calculate days waiting
    try:
        cd = datetime.fromisoformat(last.get('created', '').replace('Z', '+00:00'))
        days = (now - cd).days
    except:
        days = 0

    needs_reply.append((days, key, priority, last_date, author[:20], last_body, summary))

needs_reply.sort(key=lambda x: -x[0])  # oldest first

if needs_reply:
    print(f'TICKETS NEEDING YOUR REPLY ({len(needs_reply)}):')
    print()
    for days, key, priority, date, author, body, summary in needs_reply:
        marker = '!!' if days > 14 else '!' if days > 7 else ' '
        print(f'{marker} {key:15s} | {days:3d}d waiting | {priority:10s} | {summary}')
        print(f'    [{date}] {author}: {body}')
        print()
else:
    print('No unanswered comments — inbox zero!')
"
```

Present the output directly. Do NOT re-fetch or re-process — just show what the script produced and note which ones are most urgent (oldest waiting time).
</step>
</process>
