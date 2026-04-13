---
name: weekly-prep
description: Generate weekly meeting template from Jira — bugs, CVEs, epics, action items
allowed-tools:
  - Bash
  - Read
---

# Weekly Meeting Prep

<objective>
Generate a pre-filled weekly meeting template by fetching open bugs, CVEs, and epics from Jira. The argument selects the component filter: `core` (default, pipelines controller/reconciler/API only), `all` (everything), or a specific component name.
</objective>

<execution_context>
**Jira Cloud API:**
- Base URL: `https://redhat.atlassian.net`
- Search API: `/rest/api/3/search/jql` (POST with JSON body)
- Auth: Basic auth with `email:api_token`

**Configuration:**
- Config file: `~/.config/osp/config.json` (jira_cloud section)

**Component Filters:**
- `core`: Exclude console-plugin, hub-ui, PAC multi-cluster, dashboard, UI-specific bugs
- `all`: No filter
</execution_context>

<process>
<step name="fetch_data">
Load config and run the data collection as a single script. Pass the component filter as `$1` (default: `core`):

```bash
CONFIG="$HOME/.config/osp/config.json"
JIRA_EMAIL=$(cat "$CONFIG" | python3 -c "import json,sys; print(json.load(sys.stdin)['jira_cloud']['email'])")
JIRA_TOKEN=$(cat "$CONFIG" | python3 -c "import json,sys; print(json.load(sys.stdin)['jira_cloud']['token'])")
JIRA_BASE="https://redhat.atlassian.net"
FILTER="${1:-core}"

python3 -c "
import json, sys, urllib.request, base64

email = '$JIRA_EMAIL'
token = '$JIRA_TOKEN'
base = '$JIRA_BASE'
filt = '$FILTER'
auth = base64.b64encode(f'{email}:{token}'.encode()).decode()
headers = {'Authorization': f'Basic {auth}', 'Content-Type': 'application/json'}
JIRA_BROWSE = f'{base}/browse'

def api(jql, max_results=30):
    data = json.dumps({'jql': jql, 'maxResults': max_results, 'fields': ['key','summary','status','priority','assignee','fixVersions','issuetype']}).encode()
    req = urllib.request.Request(f'{base}/rest/api/3/search/jql', data=data, headers=headers)
    return json.loads(urllib.request.urlopen(req).read())

def link(key):
    return f'[{key}]({JIRA_BROWSE}/{key})'

def fmt(issue):
    f = issue['fields']
    a = f.get('assignee')
    assignee = a['displayName'].split()[0] if a else 'Unassigned'
    fv = ','.join(v['name'] for v in f.get('fixVersions', [])) or '-'
    return f'{link(issue[\"key\"]):15s} | {f[\"status\"][\"name\"]:15s} | {assignee:12s} | {fv:20s} | {f[\"summary\"][:55]}'

# Core filter: exclude console, hub-ui, PAC-specific, dashboard
core_exclude = 'AND summary !~ \"console\" AND summary !~ \"hub-ui\" AND summary !~ \"ANSI\" AND summary !~ \"log viewer\" AND summary !~ \"Overview page\"' if filt == 'core' else ''

# 1. Bugs (Critical + Major)
print('1. BUGS (Critical + Major)')
print('=' * 80)
bugs = api(f'project = SRVKP AND type = Bug AND statusCategory != Done AND priority in (Blocker, Critical, Major) {core_exclude} ORDER BY priority ASC, updated DESC')
for p in ['Blocker', 'Critical', 'Major']:
    items = [i for i in bugs.get('issues', []) if i['fields']['priority']['name'] == p]
    if items:
        print(f'\n{p.upper()}:')
        for i in items:
            print(f'  {fmt(i)}')
print()

# 2. CVEs
print('2. CVEs')
print('=' * 80)
cve_filter = 'AND (summary ~ \"pipelines-client\" OR summary ~ \"pipelines-controller\" OR summary ~ \"pipelines-webhook\" OR summary ~ \"pipelines-entrypoint\" OR summary ~ \"pipelines-resolvers\")' if filt == 'core' else ''
cves = api(f'project = SRVKP AND summary ~ \"CVE\" {cve_filter} AND statusCategory != Done ORDER BY priority ASC, created DESC')
for i in cves.get('issues', []):
    print(f'  {fmt(i)}')
if not cves.get('issues'):
    print('  None')
print()

# 3. Epics/Features in progress
print('3. EPICS & FEATURES (In Progress)')
print('=' * 80)
epics = api(f'project = SRVKP AND type in (Epic, Feature) AND status in (\"In Progress\", \"Code Review\", \"New\") AND assignee = currentUser() {core_exclude} ORDER BY priority ASC')
for i in epics.get('issues', []):
    print(f'  {fmt(i)}')
if not epics.get('issues'):
    print('  None')
print()

print('4. OPEN DISCUSSION')
print('=' * 80)
print('  (add topics here)')
print()
print('5. ACTION ITEMS')
print('=' * 80)
print('  (add items here)')
"
```

Present the output as the meeting template. Do NOT re-query Jira — just format what the script produced.
</step>
</process>
