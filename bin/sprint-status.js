#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ANSI color codes (same as install.js)
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

// Config
function loadConfig() {
  const configFile = path.join(os.homedir(), '.config', 'osp', 'config.json');

  if (!fs.existsSync(configFile)) {
    throw new Error(`Config file not found: ${configFile}\nPlease run /osp:configure to set up Jira Cloud authentication.`);
  }

  const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));

  const email = config.jira_cloud?.email || process.env.JIRA_CLOUD_EMAIL;
  const token = config.jira_cloud?.token || process.env.JIRA_CLOUD_TOKEN;

  if (!email || !token) {
    throw new Error('Jira Cloud credentials not configured.\nPlease run /osp:configure to set up authentication.');
  }

  return {
    email,
    token,
    auth: Buffer.from(`${email}:${token}`).toString('base64'),
    meilisearch: config.meilisearch || {}
  };
}

// Jira API helper
function jiraGet(apiPath, auth) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'redhat.atlassian.net',
      path: apiPath,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Jira API error: HTTP ${res.statusCode}`));
        } else {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse Jira response: ${e.message}`));
          }
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Fetch PR links for a batch of issue keys from Jira dev-status API
async function fetchPrLinks(issueKeys, auth) {
  const prMap = {};
  for (const key of issueKeys) {
    try {
      await sleep(100);
      const data = await jiraGet(
        `/rest/dev-status/1.0/issue/detail?issueId=${key}&applicationType=GitHub&dataType=pullrequest`,
        auth
      );
      const prs = (data.detail || [])
        .flatMap(d => d.pullRequests || [])
        .map(pr => ({ url: pr.url, status: pr.status, name: pr.name }))
        .filter(pr => pr.url);
      if (prs.length > 0) prMap[key] = prs;
    } catch (_) {
      // dev-status API may need issue ID (numeric), try via search
      try {
        const searchResult = await jiraGet(
          `/rest/api/3/issue/${key}?fields=id`,
          auth
        );
        const issueId = searchResult.id;
        if (issueId) {
          const data = await jiraGet(
            `/rest/dev-status/1.0/issue/detail?issueId=${issueId}&applicationType=GitHub&dataType=pullrequest`,
            auth
          );
          const prs = (data.detail || [])
            .flatMap(d => d.pullRequests || [])
            .map(pr => ({ url: pr.url, status: pr.status, name: pr.name }))
            .filter(pr => pr.url);
          if (prs.length > 0) prMap[key] = prs;
        }
      } catch (_) { /* skip */ }
    }
  }
  return prMap;
}

// HTTP helper for Meilisearch
function httpRequest(method, url, headers, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          resolve({});
        }
      });
    });

    req.on('error', () => resolve({})); // Silent fail for Meilisearch
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Sleep helper for rate limiting
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Verify Jira credentials
async function verifyAuth(auth) {
  const response = await jiraGet('/rest/api/3/myself', auth);
  console.log(`${colors.green}Jira Cloud authentication verified.${colors.reset}`);
  return response;
}

// Discover team sprints
async function discoverTeamSprints(auth) {
  const boardsResponse = await jiraGet('/rest/agile/1.0/board?projectKeyOrId=SRVKP&type=scrum', auth);

  const activeSprints = [];

  for (const board of boardsResponse.values || []) {
    await sleep(100); // Rate limiting

    const sprintsResponse = await jiraGet(`/rest/agile/1.0/board/${board.id}/sprint?state=active`, auth);

    for (const sprint of sprintsResponse.values || []) {
      // Filter by team name pattern, exclude Release/perf&scale
      if (sprint.name.match(/Pipelines Sprint \w+ \d+/) &&
          !sprint.name.match(/Release|perf&scale/)) {
        activeSprints.push({
          ...sprint,
          boardId: board.id
        });
      }
    }
  }

  return activeSprints;
}

// Paginated fetch of sprint issues
async function fetchAllSprintIssues(sprintId, auth) {
  const fields = [
    'summary', 'status', 'priority', 'issuetype', 'assignee', 'components',
    'labels', 'created', 'parent',
    'customfield_10028', // Story Points
    'customfield_10977', // Original Story Points
    'customfield_10020', // Sprint array
    'customfield_10517', // Blocked
    'customfield_10483', // Blocked Reason
    'customfield_10021', // Flagged
    'updated',           // Last updated timestamp
    'comment'            // Comments (for staleness detection)
  ].join(',');

  let allIssues = [];
  let startAt = 0;
  const maxResults = 100;
  let total = 1;

  while (startAt < total) {
    await sleep(100); // Rate limiting

    const response = await jiraGet(
      `/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=${maxResults}&startAt=${startAt}&fields=${fields}`,
      auth
    );

    total = response.total || 0;
    allIssues = allIssues.concat(response.issues || []);
    startAt += response.issues?.length || 0;

    if (total > maxResults) {
      console.log(`${colors.dim}Fetched ${startAt} of ${total} issues...${colors.reset}`);
    }
  }

  console.log(`${colors.green}Total issues fetched: ${allIssues.length}${colors.reset}`);
  return allIssues;
}

// Fetch historical sprints for velocity
async function fetchHistoricalSprints(boardId, teamName, auth) {
  const closedSprintsResponse = await jiraGet(
    `/rest/agile/1.0/board/${boardId}/sprint?state=closed&maxResults=50`,
    auth
  );

  // Filter by team name, sort by endDate, take last 5
  const teamClosedSprints = (closedSprintsResponse.values || [])
    .filter(s => s.name.includes(teamName))
    .sort((a, b) => new Date(b.endDate) - new Date(a.endDate))
    .slice(0, 5);

  const historicalData = [];

  for (const sprint of teamClosedSprints) {
    await sleep(100); // Rate limiting

    const histIssues = await jiraGet(
      `/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=100&fields=status,customfield_10028,customfield_10020,parent`,
      auth
    );

    const issues = histIssues.issues || [];

    const committedSP = issues.reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0);
    const completedSP = issues
      .filter(i => ['Closed', 'Verified', 'Release Pending'].includes(i.fields.status.name))
      .reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0);

    // Count carried forward (issues with multiple sprints matching team pattern)
    const carriedSP = issues
      .filter(i => !['Closed', 'Verified', 'Release Pending'].includes(i.fields.status.name))
      .filter(i => {
        const sprints = i.fields.customfield_10020 || [];
        const teamSprints = sprints.filter(s => s.name && s.name.includes(`Pipelines Sprint ${teamName}`));
        return teamSprints.length > 1;
      })
      .reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0);

    if (committedSP > 0) {
      historicalData.push({
        sprint: sprint.name,
        committed: committedSP,
        completed: completedSP,
        carried: carriedSP
      });
    }
  }

  console.log(`${colors.green}Historical sprints fetched: ${historicalData.length}${colors.reset}`);
  return historicalData;
}

// Fetch future sprint
async function fetchFutureSprint(boardId, teamName, auth) {
  const futureSprintsResponse = await jiraGet(
    `/rest/agile/1.0/board/${boardId}/sprint?state=future`,
    auth
  );

  const teamFutureSprint = (futureSprintsResponse.values || [])
    .filter(s => s.name.includes(teamName))
    .filter(s => !s.name.includes('Ranked Issues'))[0];

  if (!teamFutureSprint) {
    console.log(`${colors.dim}No future sprint found${colors.reset}`);
    return { name: '', issues: [] };
  }

  await sleep(100); // Rate limiting

  const futureIssuesResponse = await jiraGet(
    `/rest/agile/1.0/sprint/${teamFutureSprint.id}/issue?maxResults=100&fields=summary,priority,issuetype,customfield_10028`,
    auth
  );

  console.log(`${colors.green}Future sprint: ${teamFutureSprint.name}${colors.reset}`);
  return {
    name: teamFutureSprint.name,
    issues: futureIssuesResponse.issues || []
  };
}

// Fetch Epic progress
async function fetchEpicProgress(issues, auth) {
  const epicKeys = [...new Set(issues
    .map(i => i.fields.parent?.key)
    .filter(k => k))];

  if (epicKeys.length === 0) {
    console.log(`${colors.dim}No Epics linked${colors.reset}`);
    return [];
  }

  await sleep(100); // Rate limiting

  const jql = `parent in (${epicKeys.join(',')})`;
  const encodedJql = encodeURIComponent(jql);

  let epicChildrenResponse;
  try {
    epicChildrenResponse = await jiraGet(
      `/rest/api/3/search?jql=${encodedJql}&maxResults=500&fields=status,customfield_10028,parent`,
      auth
    );
  } catch (e) {
    console.log(`${colors.dim}Epic progress fetch skipped: ${e.message}${colors.reset}`);
    return [];
  }

  const epicChildren = epicChildrenResponse.issues || [];

  // Compute total/completed SPs per Epic
  const epicProgress = epicKeys.map(epicKey => {
    const epic = issues.find(i => i.fields.parent?.key === epicKey)?.fields.parent;
    const children = epicChildren.filter(i => i.fields.parent?.key === epicKey);

    const totalSP = children.reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0);
    const completedSP = children
      .filter(i => i.fields.status.name === 'Closed')
      .reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0);

    return {
      key: epicKey,
      summary: epic?.fields?.summary || '',
      totalSP,
      completedSP
    };
  });

  return epicProgress;
}

// Compute all metrics
function computeMetrics(issues, historicalSprints, futureSprint, epicProgress, teamName, sprintInfo) {
  // 1. Sprint Summary
  const statusGroups = {};
  issues.forEach(i => {
    const status = i.fields.status.name;
    if (!statusGroups[status]) statusGroups[status] = { count: 0, sp: 0 };
    statusGroups[status].count++;
    statusGroups[status].sp += i.fields.customfield_10028 || 0;
  });

  const summary = {
    totalIssues: issues.length,
    totalSPs: issues.reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0),
    byStatus: statusGroups,
    blocked: { count: 0, sp: 0 }, // Will be computed after blocked detection below
    noStoryPoints: issues.filter(i => !i.fields.customfield_10028).length
  };

  // 2. Velocity
  const completedSP = issues
    .filter(i => i.fields.status.name === 'Closed')
    .reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0);

  const velocity = {
    current: {
      committed: summary.totalSPs,
      completed: completedSP
    }
  };

  // 3. Code Review SP Redo
  const codeReview = issues
    .filter(i => i.fields.status.name === 'Code Review')
    .map(i => {
      const currentSP = i.fields.customfield_10028 || 0;
      const originalSP = i.fields.customfield_10977 || currentSP;
      const suggestedSP = currentSP <= 2 ? 1 : Math.ceil(currentSP * 0.5);

      return {
        key: i.key,
        summary: i.fields.summary,
        currentSP,
        originalSP,
        suggestedSP,
        assignee: i.fields.assignee?.displayName || 'Unassigned',
        alreadyReestimated: currentSP !== originalSP
      };
    });

  // 4. Blocked Issues (flag-blocked + stale-blocked)
  const currentTime = Date.now();
  const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

  const isFlagBlocked = (i) =>
    i.fields.customfield_10517 === true || (i.fields.customfield_10021 || []).length > 0;

  const isStaleBlocked = (i) => {
    // Only check non-closed, non-done issues
    if (/Closed|Verified|Release Pending|Done/i.test(i.fields.status?.name || '')) return false;
    // Check last comment date
    const comments = i.fields.comment?.comments || [];
    const lastComment = comments.length > 0 ? comments[comments.length - 1] : null;
    const lastCommentDate = lastComment ? new Date(lastComment.created).getTime() : 0;
    // Check last updated date
    const updatedDate = i.fields.updated ? new Date(i.fields.updated).getTime() : 0;
    // Stale if neither comment nor update in last 3 days
    const lastActivity = Math.max(lastCommentDate, updatedDate);
    return lastActivity > 0 && (currentTime - lastActivity) > THREE_DAYS_MS;
  };

  const blocked = issues
    .filter(i => isFlagBlocked(i) || isStaleBlocked(i))
    .map(i => {
      const flagged = isFlagBlocked(i);
      const stale = isStaleBlocked(i);
      const lastUpdated = i.fields.updated ? new Date(i.fields.updated) : null;
      const daysSinceUpdate = lastUpdated ? Math.floor((currentTime - lastUpdated.getTime()) / (24 * 60 * 60 * 1000)) : null;

      let reason = i.fields.customfield_10483 || '';
      if (flagged && !reason) reason = 'Flagged as blocked';
      if (stale && !flagged) reason = `No activity for ${daysSinceUpdate} days`;
      if (stale && flagged) reason = `${reason} (also stale: ${daysSinceUpdate} days)`;

      return {
        key: i.key,
        summary: i.fields.summary,
        priority: i.fields.priority.name,
        reason,
        assignee: i.fields.assignee?.displayName || 'Unassigned',
        blockedType: flagged ? (stale ? 'flagged+stale' : 'flagged') : 'stale'
      };
    });

  // Update summary blocked count now that we have the full list
  summary.blocked = {
    count: blocked.length,
    sp: issues
      .filter(i => isFlagBlocked(i) || isStaleBlocked(i))
      .reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0)
  };

  // 5. High Priority Bugs
  const highPriorityBugs = issues
    .filter(i => i.fields.issuetype.name === 'Bug')
    .filter(i => ['Critical', 'Blocker', 'Major'].includes(i.fields.priority.name))
    .map(i => {
      const status = i.fields.status.name;
      let proximity = 'unknown';
      if (['Code Review', 'Dev Complete', 'On QA', 'Testing', 'Verified'].includes(status)) proximity = 'near';
      else if (status === 'In Progress') proximity = 'mid';
      else if (['To Do', 'New', 'Planning'].includes(status)) proximity = 'far';
      else if (status === 'Closed') proximity = 'done';

      return {
        key: i.key,
        summary: i.fields.summary,
        priority: i.fields.priority.name,
        status,
        proximity
      };
    });

  // 6. Carry-Forward Analysis
  const carryForward = issues
    .filter(i => !['Closed', 'Verified', 'Release Pending'].includes(i.fields.status.name))
    .map(i => {
      const sprints = i.fields.customfield_10020 || [];
      const teamSprints = sprints.filter(s => s.name && s.name.includes(`Pipelines Sprint ${teamName}`));
      const sprintCount = teamSprints.length;

      let severity = 'normal';
      if (sprintCount >= 5) severity = 'critical';
      else if (sprintCount >= 3) severity = 'warning';

      return {
        key: i.key,
        summary: i.fields.summary,
        sprintCount,
        status: i.fields.status.name,
        severity,
        latestComment: ''
      };
    })
    .filter(i => i.sprintCount > 0)
    .sort((a, b) => b.sprintCount - a.sprintCount);

  // 7. Velocity Trend
  const avg3 = historicalSprints.length >= 3
    ? historicalSprints.slice(0, 3).reduce((sum, s) => sum + s.completed, 0) / 3
    : null;

  const avg5 = historicalSprints.length >= 5
    ? historicalSprints.reduce((sum, s) => sum + s.completed, 0) / 5
    : null;

  let trend = 'insufficient_data';
  if (historicalSprints.length >= 3) {
    const recent2avg = historicalSprints.slice(0, 2).reduce((sum, s) => sum + s.completed, 0) / 2;
    if (avg3 > recent2avg) trend = 'improving';
    else if (avg3 < recent2avg) trend = 'declining';
    else trend = 'stable';
  }

  const commitmentAccuracy = historicalSprints.map(s =>
    s.committed > 0 ? Math.round((s.completed / s.committed) * 100) : 0
  );

  const velocityExtended = {
    current: velocity.current,
    history: historicalSprints,
    avg3,
    avg5,
    trend,
    commitmentAccuracy
  };

  // 8. Expectation Management
  const crSP = issues
    .filter(i => i.fields.status.name === 'Code Review')
    .reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0);

  const crPercent = summary.totalSPs > 0 ? Math.round((crSP / summary.totalSPs) * 100) : 0;

  const expectations = {
    overCommitted: {
      flag: avg3 !== null && velocity.current.committed > avg3,
      committed: velocity.current.committed,
      avgVelocity: avg3,
      delta: avg3 !== null ? velocity.current.committed - avg3 : 0
    },
    underCommitted: {
      flag: avg3 !== null && velocity.current.committed < avg3 * 0.7
    },
    carryForwardRate: historicalSprints.map(s =>
      s.committed > 0 ? Math.round((s.carried / s.committed) * 100) : 0
    ),
    codeReviewBottleneck: {
      flag: crPercent > 30,
      percent: crPercent
    }
  };

  // 9. Roadmap Alignment
  const planned = issues.filter(i => i.fields.parent);
  const unplanned = issues.filter(i => !i.fields.parent && i.fields.issuetype.name !== 'Vulnerability');
  const cve = issues.filter(i => i.fields.issuetype.name === 'Vulnerability');

  const roadmap = {
    planned: {
      count: planned.length,
      sp: planned.reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0),
      percent: issues.length > 0 ? Math.round((planned.length / issues.length) * 100) : 0
    },
    unplanned: {
      count: unplanned.length,
      sp: unplanned.reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0),
      percent: issues.length > 0 ? Math.round((unplanned.length / issues.length) * 100) : 0
    },
    cve: {
      count: cve.length,
      sp: cve.reduce((sum, i) => sum + (i.fields.customfield_10028 || 0), 0),
      percent: issues.length > 0 ? Math.round((cve.length / issues.length) * 100) : 0
    },
    epics: epicProgress,
    alignmentTrend: [],
    untrackedCount: issues.filter(i => !i.fields.parent).length
  };

  // 10. DoD Compliance
  const dodIssues = issues.map(i => {
    const labels = i.fields.labels || [];
    const status = i.fields.status.name;
    const type = i.fields.issuetype.name;

    let score = 'incomplete';
    if (labels.some(l => ['docs-pending', 'release-notes-pending', 'tests-pending'].includes(l)) &&
        ['Code Review', 'Dev Complete', 'On QA'].includes(status)) {
      score = 'atRisk';
    } else if (['Closed', 'Verified', 'Release Pending'].includes(status) &&
               !labels.some(l => l.includes('pending') || l.includes('req') || l.includes('missing'))) {
      score = 'complete';
    } else if (['Spike', 'Task', 'Sub-task'].includes(type)) {
      score = 'na';
    }

    return {
      key: i.key,
      summary: i.fields.summary,
      status,
      labels,
      score,
      missing: labels.filter(l => l.includes('pending') || l.includes('req') || l.includes('missing'))
    };
  });

  const dod = {
    complete: {
      count: dodIssues.filter(i => i.score === 'complete').length,
      percent: issues.length > 0 ? Math.round((dodIssues.filter(i => i.score === 'complete').length / issues.length) * 100) : 0
    },
    atRisk: {
      count: dodIssues.filter(i => i.score === 'atRisk').length,
      percent: issues.length > 0 ? Math.round((dodIssues.filter(i => i.score === 'atRisk').length / issues.length) * 100) : 0
    },
    incomplete: {
      count: dodIssues.filter(i => i.score === 'incomplete').length,
      percent: issues.length > 0 ? Math.round((dodIssues.filter(i => i.score === 'incomplete').length / issues.length) * 100) : 0
    },
    na: {
      count: dodIssues.filter(i => i.score === 'na').length,
      percent: issues.length > 0 ? Math.round((dodIssues.filter(i => i.score === 'na').length / issues.length) * 100) : 0
    },
    issues: dodIssues.filter(i => i.score === 'atRisk' || i.score === 'incomplete')
  };

  // 11. Future Sprint Prioritization
  const futurePriority = (futureSprint.issues || []).map(i => {
    const type = i.fields.issuetype.name;
    const priority = i.fields.priority.name;

    let rank = 5;
    if (type === 'Vulnerability') rank = 1;
    else if (type === 'Bug' && priority === 'Blocker') rank = 2;
    else if (type === 'Bug' && priority === 'Critical') rank = 3;
    else if (type === 'Bug' && priority === 'Major') rank = 4;

    return {
      rank,
      key: i.key,
      summary: i.fields.summary,
      type,
      priority
    };
  }).sort((a, b) => a.rank - b.rank);

  // 12. Per-Assignee Breakdown
  const assigneeGroups = {};
  issues.forEach(i => {
    const assignee = i.fields.assignee?.displayName || 'Unassigned';
    if (!assigneeGroups[assignee]) {
      assigneeGroups[assignee] = {
        totalIssues: 0,
        totalSP: 0,
        byStatus: {},
        blocked: 0,
        carryForwardCount: 0,
        issues: []
      };
    }

    const group = assigneeGroups[assignee];
    group.totalIssues++;
    group.totalSP += i.fields.customfield_10028 || 0;

    const status = i.fields.status.name;
    if (!group.byStatus[status]) group.byStatus[status] = { count: 0, sp: 0 };
    group.byStatus[status].count++;
    group.byStatus[status].sp += i.fields.customfield_10028 || 0;

    if (i.fields.customfield_10517 === true || (i.fields.customfield_10021 || []).length > 0) {
      group.blocked++;
    }

    group.issues.push({
      key: i.key,
      summary: i.fields.summary,
      status,
      sp: i.fields.customfield_10028 || 0
    });
  });

  // 13. Per-Component Breakdown
  const componentGroups = {};
  issues.forEach(i => {
    const components = i.fields.components?.length > 0
      ? i.fields.components
      : [{ name: 'Unassigned' }];

    components.forEach(comp => {
      const name = comp.name;
      if (!componentGroups[name]) {
        componentGroups[name] = {
          totalIssues: 0,
          totalSP: 0,
          byStatus: {},
          blocked: 0,
          carryForward: [],
          highPriorityBugs: 0,
          issues: []
        };
      }

      const group = componentGroups[name];
      group.totalIssues++;
      group.totalSP += i.fields.customfield_10028 || 0;

      const status = i.fields.status.name;
      if (!group.byStatus[status]) group.byStatus[status] = { count: 0, sp: 0 };
      group.byStatus[status].count++;
      group.byStatus[status].sp += i.fields.customfield_10028 || 0;

      if (i.fields.customfield_10517 === true || (i.fields.customfield_10021 || []).length > 0) {
        group.blocked++;
      }

      if (i.fields.issuetype.name === 'Bug' && ['Critical', 'Blocker', 'Major'].includes(i.fields.priority.name)) {
        group.highPriorityBugs++;
      }

      group.issues.push({
        key: i.key,
        summary: i.fields.summary,
        status,
        sp: i.fields.customfield_10028 || 0,
        priority: i.fields.priority.name
      });
    });
  });

  // Compute sprint days and health
  const now = Date.now();
  const endDate = new Date(sprintInfo.endDate).getTime();
  const startDate = new Date(sprintInfo.startDate).getTime();

  const daysRemaining = Math.floor((endDate - now) / 86400000);
  const sprintDuration = Math.floor((endDate - startDate) / 86400000);
  const sprintDay = sprintDuration - daysRemaining;

  const completionPercent = summary.totalSPs > 0 ? Math.round((completedSP / summary.totalSPs) * 100) : 0;
  const blockedPercent = summary.totalIssues > 0 ? Math.round((summary.blocked.count / summary.totalIssues) * 100) : 0;

  let healthScore = 'red';
  if (completionPercent >= 70 && blockedPercent < 10) healthScore = 'green';
  else if (completionPercent >= 50 || blockedPercent < 20) healthScore = 'yellow';

  return {
    meta: {
      team: teamName,
      sprint: sprintInfo,
      generatedAt: new Date().toISOString(),
      jiraBaseUrl: 'https://redhat.atlassian.net',
    },
    daysRemaining,
    sprintDuration,
    sprintDay,
    completionPercent,
    healthScore,
    summary,
    velocity: velocityExtended,
    expectations,
    roadmap,
    dod,
    codeReview,
    blocked,
    highPriorityBugs,
    carryForward,
    futureSprint: {
      name: futureSprint.name,
      issues: futurePriority
    },
    assignees: assigneeGroups,
    components: componentGroups
  };
}

// Render dashboard
function renderDashboard(data, teamName) {
  // Locate template
  const templatePaths = [
    // React build (preferred)
    path.join(__dirname, '..', 'docs', 'templates', 'built', 'index.html'),
    path.join(process.cwd(), 'docs', 'templates', 'built', 'index.html'),
    path.join(os.homedir(), '.claude', 'templates', 'osp', 'built', 'index.html'),
    // Fallback to old template
    path.join(os.homedir(), '.claude', 'templates', 'osp', 'sprint-dashboard.html'),
    path.join(process.cwd(), 'docs', 'templates', 'sprint-dashboard.html'),
    path.join(__dirname, '..', 'docs', 'templates', 'sprint-dashboard.html')
  ];

  let templatePath = null;
  for (const p of templatePaths) {
    if (fs.existsSync(p)) {
      templatePath = p;
      break;
    }
  }

  if (!templatePath) {
    throw new Error(`Dashboard template not found. Expected locations:\n${templatePaths.join('\n')}`);
  }

  // Read template
  const template = fs.readFileSync(templatePath, 'utf8');

  // Inject data
  // Try React template injection first, fall back to old template
  let output;
  if (template.includes('window.__DASHBOARD_DATA__')) {
    output = template.replace('window.__DASHBOARD_DATA__ = {};', `window.__DASHBOARD_DATA__ = ${JSON.stringify(data)};`);
  } else {
    output = template.replace('const DATA = {};', `const DATA = ${JSON.stringify(data)};`);
  }

  // Write to temp file
  const tempFile = path.join(os.tmpdir(), `sprint-dashboard-${teamName}-${Date.now()}.html`);
  fs.writeFileSync(tempFile, output, { mode: 0o600 });

  console.log(`${colors.green}Dashboard written to: ${tempFile}${colors.reset}`);

  // Open in browser
  try {
    if (process.platform === 'darwin') {
      execSync(`open "${tempFile}"`);
    } else if (process.platform === 'linux') {
      execSync(`xdg-open "${tempFile}"`);
    } else {
      console.log(`${colors.yellow}Unable to open browser automatically. Open manually: ${tempFile}${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.yellow}Unable to open browser. Open manually: ${tempFile}${colors.reset}`);
  }

  return tempFile;
}

// Fetch historical snapshots from Meilisearch for trends
async function fetchHistoricalSnapshots(teamName, config) {
  try {
    const meiliKey = config.meilisearch?.key;
    if (!meiliKey) return { sprintSnapshots: [], issueSnapshots: [] };

    // Check if Meilisearch is reachable
    const health = await httpRequest('GET', 'http://localhost:7700/health', {}, null);
    if (!health || health.status !== 'available') return { sprintSnapshots: [], issueSnapshots: [] };

    const headers = {
      'Authorization': `Bearer ${meiliKey}`,
      'Content-Type': 'application/json'
    };

    // Fetch sprint snapshots
    const sprintResult = await httpRequest('POST', 'http://localhost:7700/indexes/sprint-snapshots/search', headers, {
      filter: `team = "${teamName}"`,
      sort: ['snapshotDate:asc'],
      limit: 50
    });

    // Fetch issue snapshots (latest per issue)
    const issueResult = await httpRequest('POST', 'http://localhost:7700/indexes/issue-snapshots/search', headers, {
      filter: `team = "${teamName}"`,
      sort: ['snapshotDate:desc'],
      limit: 500
    });

    return {
      sprintSnapshots: sprintResult?.hits || [],
      issueSnapshots: issueResult?.hits || []
    };
  } catch (e) {
    return { sprintSnapshots: [], issueSnapshots: [] };
  }
}

// Auto-backfill historical sprints into Meilisearch on first run
async function backfillIfNeeded(teamName, auth, meiliKey) {
  if (!meiliKey) return;

  const headers = {
    'Authorization': `Bearer ${meiliKey}`,
    'Content-Type': 'application/json'
  };

  // Check how many snapshots exist for this team
  let existingCount = 0;
  try {
    const result = await httpRequest('POST', 'http://localhost:7700/indexes/sprint-snapshots/search', headers, {
      filter: `team = "${teamName}"`,
      limit: 1
    });
    existingCount = result?.estimatedTotalHits || result?.hits?.length || 0;
  } catch (e) {
    // Index might not have filterable attributes yet
    existingCount = 0;
  }

  if (existingCount >= 2) {
    return; // Already has history, skip backfill
  }

  console.log(`${colors.cyan}First run detected — backfilling historical sprints for ${teamName}...${colors.reset}`);

  // Fetch all closed sprints for this team across all boards
  const boardsResponse = await jiraGet('/rest/agile/1.0/board?projectKeyOrId=SRVKP&type=scrum', auth);
  let allClosed = [];
  const seenIds = new Set();

  for (const board of boardsResponse.values || []) {
    try {
      let startAt = 0;
      let total = 1;
      while (startAt < total) {
        const resp = await jiraGet(`/rest/agile/1.0/board/${board.id}/sprint?state=closed&maxResults=50&startAt=${startAt}`, auth);
        total = resp.total || 0;
        const matching = (resp.values || []).filter(s =>
          new RegExp(teamName, 'i').test(s.name) && !seenIds.has(s.id)
        );
        matching.forEach(s => { seenIds.add(s.id); allClosed.push(s); });
        startAt += 50;
        await sleep(100);
      }
    } catch (e) { /* skip boards that error */ }
  }

  allClosed.sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
  console.log(`${colors.green}Found ${allClosed.length} closed sprints to backfill${colors.reset}`);

  const pendingLabels = ['docs-pending', 'release-notes-pending', 'tests-pending'];
  const issueFields = 'summary,status,priority,issuetype,assignee,components,labels,customfield_10028,customfield_10020,customfield_10517,customfield_10021,customfield_10483,parent';

  for (let i = 0; i < allClosed.length; i++) {
    const sprint = allClosed[i];
    console.log(`${colors.dim}  [${i + 1}/${allClosed.length}] ${sprint.name}${colors.reset}`);

    try {
      // Fetch issues
      let issues = [];
      let startAt = 0;
      let total = 1;
      while (startAt < total) {
        const resp = await jiraGet(`/rest/agile/1.0/sprint/${sprint.id}/issue?maxResults=100&startAt=${startAt}&fields=${issueFields}`, auth);
        total = resp.total || 0;
        issues.push(...(resp.issues || []));
        startAt += 100;
        await sleep(100);
      }

      // Compute metrics
      const totalIssues = issues.length;
      const totalSPs = issues.reduce((s, i) => s + (i.fields.customfield_10028 || 0), 0);
      const completedSPs = issues.filter(i => /Closed|Verified|Release Pending/i.test(i.fields.status?.name || '')).reduce((s, i) => s + (i.fields.customfield_10028 || 0), 0);
      const completionPercent = totalSPs > 0 ? Math.round((completedSPs / totalSPs) * 100) : 0;
      const blockedCount = issues.filter(i => i.fields.customfield_10517 === true || (i.fields.customfield_10021 || []).length > 0).length;
      const blockedSPs = issues.filter(i => i.fields.customfield_10517 === true || (i.fields.customfield_10021 || []).length > 0).reduce((s, i) => s + (i.fields.customfield_10028 || 0), 0);
      const crIssues = issues.filter(i => i.fields.status?.name === 'Code Review');
      const codeReviewSPs = crIssues.reduce((s, i) => s + (i.fields.customfield_10028 || 0), 0);
      const cfIssues = issues.filter(i => !/Closed|Verified|Release Pending/i.test(i.fields.status?.name || ''));
      const carryForwardCount = cfIssues.length;
      const carryForwardCriticalCount = cfIssues.filter(i => {
        const sprints = (i.fields.customfield_10020 || []).filter(s => new RegExp(teamName, 'i').test(s.name || ''));
        return sprints.length >= 5;
      }).length;

      const dodComplete = issues.filter(i => {
        const labels = i.fields.labels || [];
        return !labels.some(l => pendingLabels.some(p => l.includes(p))) && /Closed|Verified|Release Pending/i.test(i.fields.status?.name || '');
      }).length;
      const dodCompletePercent = totalIssues > 0 ? Math.round((dodComplete / totalIssues) * 100) : 0;
      const dodAtRisk = issues.filter(i => {
        const labels = i.fields.labels || [];
        return labels.some(l => pendingLabels.some(p => l.includes(p))) && /Code Review|Dev Complete|On QA/i.test(i.fields.status?.name || '');
      }).length;
      const dodAtRiskPercent = totalIssues > 0 ? Math.round((dodAtRisk / totalIssues) * 100) : 0;

      const planned = issues.filter(i => i.fields.parent != null);
      const vulns = issues.filter(i => i.fields.issuetype?.name === 'Vulnerability');
      const unplanned = issues.filter(i => i.fields.parent == null && i.fields.issuetype?.name !== 'Vulnerability');
      const plannedPercent = totalIssues > 0 ? Math.round((planned.length / totalIssues) * 100) : 0;
      const unplannedPercent = totalIssues > 0 ? Math.round((unplanned.length / totalIssues) * 100) : 0;
      const cvePercent = totalIssues > 0 ? Math.round((vulns.length / totalIssues) * 100) : 0;

      const blockedPercent = totalIssues > 0 ? Math.round((blockedCount / totalIssues) * 100) : 0;
      let healthScore = 'red';
      if (completionPercent >= 70 && blockedPercent < 10) healthScore = 'green';
      else if (completionPercent >= 50 || blockedPercent < 20) healthScore = 'yellow';

      const ts = Math.floor(new Date(sprint.endDate || sprint.completeDate || Date.now()).getTime() / 1000);

      const snapshot = {
        id: `${teamName}-${sprint.id}-${ts}`,
        team: teamName, sprintId: sprint.id, sprintName: sprint.name,
        snapshotDate: sprint.endDate || sprint.completeDate || new Date().toISOString(),
        sprintStartDate: sprint.startDate, sprintEndDate: sprint.endDate,
        totalIssues, totalSPs, completedSPs, completionPercent,
        blockedCount, blockedSPs, codeReviewCount: crIssues.length, codeReviewSPs,
        carryForwardCount, carryForwardCriticalCount,
        dodCompletePercent, dodAtRiskPercent, healthScore,
        plannedPercent, unplannedPercent, cvePercent,
        assigneeCount: new Set(issues.map(i => i.fields.assignee?.displayName).filter(Boolean)).size,
        componentCount: new Set(issues.flatMap(i => (i.fields.components || []).map(c => c.name))).size,
      };

      await httpRequest('POST', 'http://localhost:7700/indexes/sprint-snapshots/documents', headers, [snapshot]);

      // Index issue snapshots
      const issueSnapshots = issues.map(issue => ({
        id: `${issue.key}-${sprint.id}-${ts}`,
        key: issue.key, summary: issue.fields.summary,
        status: issue.fields.status?.name || 'Unknown',
        priority: issue.fields.priority?.name || 'Normal',
        type: issue.fields.issuetype?.name || 'Story',
        assignee: issue.fields.assignee?.displayName || 'Unassigned',
        components: (issue.fields.components || []).map(c => c.name),
        storyPoints: issue.fields.customfield_10028 || 0,
        sprintCount: ((issue.fields.customfield_10020 || []).filter(s => new RegExp(teamName, 'i').test(s.name || ''))).length,
        blocked: issue.fields.customfield_10517 === true,
        dodScore: (() => {
          const labels = issue.fields.labels || [];
          const hasPending = labels.some(l => ['pending', 'req', 'missing'].some(p => l.includes(p)));
          if (!hasPending && /Closed|Verified/i.test(issue.fields.status?.name || '')) return 'complete';
          if (hasPending && /Code Review|Dev Complete|On QA/i.test(issue.fields.status?.name || '')) return 'atRisk';
          if (hasPending) return 'incomplete';
          return 'na';
        })(),
        team: teamName, sprintId: sprint.id, sprintName: sprint.name,
        snapshotDate: sprint.endDate || sprint.completeDate || new Date().toISOString(),
      }));

      if (issueSnapshots.length > 0) {
        await httpRequest('POST', 'http://localhost:7700/indexes/issue-snapshots/documents', headers, issueSnapshots);
      }

      console.log(`${colors.dim}    ${completedSPs}/${totalSPs} SP (${completionPercent}%) | ${issues.length} issues indexed${colors.reset}`);
    } catch (e) {
      console.log(`${colors.dim}    Skipped: ${e.message}${colors.reset}`);
    }

    await sleep(200);
  }

  console.log(`${colors.green}Backfill complete: ${allClosed.length} sprints indexed${colors.reset}`);
}

// Index to Meilisearch
async function indexToMeilisearch(data, config) {
  // Check Docker availability
  try {
    execSync('docker ps', { stdio: 'pipe' });
  } catch (e) {
    console.log(`${colors.dim}Meilisearch indexing skipped — Docker not available${colors.reset}`);
    return;
  }

  // Ensure config directory exists
  const configDir = path.join(os.homedir(), '.config', 'osp');
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  // Get or generate Meilisearch key
  let meiliKey = config.meilisearch?.key;
  if (!meiliKey) {
    const crypto = require('crypto');
    meiliKey = crypto.randomUUID();

    // Save to config
    const configFile = path.join(configDir, 'config.json');
    const fullConfig = fs.existsSync(configFile) ? JSON.parse(fs.readFileSync(configFile, 'utf8')) : {};
    fullConfig.meilisearch = {
      url: 'http://localhost:7700',
      key: meiliKey,
      container: 'osp-meilisearch'
    };
    fs.writeFileSync(configFile, JSON.stringify(fullConfig, null, 2), { mode: 0o600 });
    console.log(`${colors.green}Generated Meilisearch master key${colors.reset}`);
  }

  // Check container status
  let containerStatus = '';
  try {
    containerStatus = execSync('docker ps -a --filter name=osp-meilisearch --format "{{.Status}}"', { encoding: 'utf8' }).trim();
  } catch (e) {
    // Container doesn't exist
  }

  if (!containerStatus) {
    // Create and start container
    console.log(`${colors.green}Starting Meilisearch container...${colors.reset}`);
    execSync(`docker run -d --name osp-meilisearch -p 7700:7700 -v osp-meili-data:/meili_data -e MEILI_MASTER_KEY="${meiliKey}" getmeili/meilisearch:latest`, { stdio: 'pipe' });
  } else if (containerStatus.includes('Exited')) {
    // Restart container
    console.log(`${colors.green}Restarting Meilisearch container...${colors.reset}`);
    execSync('docker start osp-meilisearch', { stdio: 'pipe' });
  }

  // Wait for health check
  const meiliUrl = 'http://localhost:7700';
  for (let i = 0; i < 10; i++) {
    try {
      const health = await httpRequest('GET', `${meiliUrl}/health`, {}, null);
      if (health.status === 'available') break;
    } catch (e) {
      // Ignore
    }
    await sleep(1000);
  }

  const headers = {
    'Authorization': `Bearer ${meiliKey}`,
    'Content-Type': 'application/json'
  };

  // Create indexes (idempotent)
  await httpRequest('POST', `${meiliUrl}/indexes`, headers, { uid: 'sprint-snapshots', primaryKey: 'id' });
  await httpRequest('POST', `${meiliUrl}/indexes`, headers, { uid: 'issue-snapshots', primaryKey: 'id' });

  // Configure settings
  await httpRequest('PUT', `${meiliUrl}/indexes/sprint-snapshots/settings`, headers, {
    filterableAttributes: ['team', 'sprintId', 'sprintName', 'healthScore', 'snapshotDate'],
    sortableAttributes: ['snapshotDate', 'completionPercent', 'totalSPs']
  });

  await httpRequest('PUT', `${meiliUrl}/indexes/issue-snapshots/settings`, headers, {
    filterableAttributes: ['team', 'key', 'status', 'priority', 'type', 'assignee', 'components', 'blocked', 'dodScore', 'sprintId', 'sprintName', 'snapshotDate'],
    sortableAttributes: ['snapshotDate', 'sprintCount', 'storyPoints'],
    searchableAttributes: ['key', 'summary', 'assignee', 'components', 'labels']
  });

  // Build sprint snapshot
  const snapshotId = `${data.meta.team}-${data.meta.sprint.id}-${Date.now()}`;
  const sprintSnapshot = {
    id: snapshotId,
    team: data.meta.team,
    sprintId: data.meta.sprint.id,
    sprintName: data.meta.sprint.name,
    snapshotDate: data.meta.generatedAt,
    sprintStartDate: data.meta.sprint.startDate,
    sprintEndDate: data.meta.sprint.endDate,
    totalIssues: data.summary.totalIssues,
    totalSPs: data.summary.totalSPs,
    completedSPs: data.velocity.current.completed,
    completionPercent: data.completionPercent,
    blockedCount: data.summary.blocked.count,
    blockedSPs: data.summary.blocked.sp,
    codeReviewCount: data.summary.byStatus['Code Review']?.count || 0,
    codeReviewSPs: data.summary.byStatus['Code Review']?.sp || 0,
    carryForwardCount: data.carryForward.length,
    carryForwardCriticalCount: data.carryForward.filter(i => i.severity === 'critical').length,
    dodCompletePercent: data.dod.complete.percent,
    dodAtRiskPercent: data.dod.atRisk.percent,
    healthScore: data.healthScore,
    plannedPercent: data.roadmap.planned.percent,
    unplannedPercent: data.roadmap.unplanned.percent,
    cvePercent: data.roadmap.cve.percent,
    velocityAvg3: data.velocity.avg3,
    velocityAvg5: data.velocity.avg5,
    assigneeCount: Object.keys(data.assignees).length,
    componentCount: Object.keys(data.components).length
  };

  // Index sprint snapshot
  await httpRequest('POST', `${meiliUrl}/indexes/sprint-snapshots/documents`, headers, [sprintSnapshot]);

  // Build issue snapshots
  const timestamp = Date.now();
  const issueSnapshots = [];

  Object.entries(data.assignees).forEach(([assignee, assigneeData]) => {
    assigneeData.issues.forEach(issue => {
      const carryItem = data.carryForward.find(i => i.key === issue.key);
      const blockedItem = data.blocked.find(i => i.key === issue.key);
      const dodItem = data.dod.issues.find(i => i.key === issue.key);
      const crItem = data.codeReview.find(i => i.key === issue.key);
      const bugItem = data.highPriorityBugs.find(i => i.key === issue.key);

      issueSnapshots.push({
        id: `${issue.key}-${data.meta.sprint.id}-${timestamp}`,
        key: issue.key,
        summary: issue.summary,
        status: issue.status,
        priority: bugItem?.priority || blockedItem?.priority || 'Normal',
        type: bugItem ? 'Bug' : 'Story',
        assignee,
        components: [],
        storyPoints: issue.sp || 0,
        originalStoryPoints: crItem?.originalSP || null,
        sprintCount: carryItem?.sprintCount || 1,
        blocked: !!blockedItem,
        blockedReason: blockedItem?.reason || null,
        dodScore: dodItem?.score || 'unknown',
        dodMissing: dodItem?.missing || [],
        labels: dodItem?.labels || [],
        team: data.meta.team,
        sprintId: data.meta.sprint.id,
        sprintName: data.meta.sprint.name,
        snapshotDate: data.meta.generatedAt,
        epicKey: null,
        epicSummary: null
      });
    });
  });

  // Index issue snapshots
  if (issueSnapshots.length > 0) {
    await httpRequest('POST', `${meiliUrl}/indexes/issue-snapshots/documents`, headers, issueSnapshots);
  }

  console.log(`${colors.green}Indexed sprint snapshot and ${issueSnapshots.length} issue snapshots into Meilisearch${colors.reset}`);
}

// Print terminal summary
function printSummary(data) {
  const d = data;
  const totalIssues = d.summary.totalIssues;
  const totalSP = d.summary.totalSPs;
  const completedSP = d.velocity.current.completed;
  const committedSP = d.velocity.current.committed;
  const completionRate = committedSP > 0 ? Math.round((completedSP / committedSP) * 100) : 0;
  const blockedCount = d.summary.blocked.count;
  const noSPCount = d.summary.noStoryPoints;
  const avgVelocity = d.velocity.avg3 !== null ? d.velocity.avg3.toFixed(1) : 'N/A';
  const overCommitted = d.expectations.overCommitted.flag;
  const crBottleneck = d.expectations.codeReviewBottleneck.flag;
  const dodComplete = d.dod.complete.percent;
  const dodAtRisk = d.dod.atRisk.percent;
  const carryForwardCritical = d.carryForward.filter(i => i.severity === 'critical').length;

  console.log('');
  console.log('=========================================');
  console.log(`  Sprint Status: ${d.meta.sprint.name}`);
  console.log('=========================================');
  console.log('');
  console.log('Sprint Summary:');
  console.log(`  Total Issues: ${totalIssues}`);
  console.log(`  Total Story Points: ${totalSP}`);
  console.log(`  Completed: ${completedSP} SP (${completionRate}%)`);
  console.log(`  Blocked: ${blockedCount} issues`);
  console.log(`  No Story Points: ${noSPCount} issues`);
  console.log('');
  console.log('Velocity:');
  console.log(`  3-Sprint Avg: ${avgVelocity} SP`);
  console.log(`  Current Committed: ${committedSP} SP`);
  console.log('');
  console.log('Alerts:');
  if (overCommitted) {
    console.log(`  ${colors.yellow}WARNING${colors.reset}  Over-committed (above avg velocity)`);
  }
  if (crBottleneck) {
    console.log(`  ${colors.yellow}WARNING${colors.reset}  Code Review bottleneck (>30% of SPs)`);
  }
  if (carryForwardCritical > 0) {
    console.log(`  ${colors.yellow}WARNING${colors.reset}  ${carryForwardCritical} critical carry-forward issues (5+ sprints)`);
  }
  if (blockedCount > 0) {
    console.log(`  ${colors.yellow}WARNING${colors.reset}  ${blockedCount} blocked issues`);
  }
  if (!overCommitted && !crBottleneck && carryForwardCritical === 0 && blockedCount === 0) {
    console.log(`  ${colors.green}No alerts${colors.reset}`);
  }
  console.log('');
  console.log('DoD Compliance:');
  console.log(`  Complete: ${dodComplete}%`);
  console.log(`  At Risk: ${dodAtRisk}%`);
  console.log('');
  console.log('Top 3 Action Items:');
  console.log('  1. Review blocked issues and resolve blockers');
  console.log('  2. Re-estimate Code Review issues for next sprint');
  console.log('  3. Address carry-forward worst offenders (latest comments in dashboard)');
  console.log('');
  console.log('=========================================');
}

// Main
async function main() {
  const fetchAll = process.argv.includes('--all');
  const teamName = fetchAll ? null : process.argv[2];

  if (!fetchAll && !teamName) {
    console.log(`${colors.bright}Usage:${colors.reset} node bin/sprint-status.js <team-name>`);
    console.log(`${colors.bright}       ${colors.reset} node bin/sprint-status.js --all [--publish]`);
    console.log(`${colors.bright}Example:${colors.reset} node bin/sprint-status.js pioneers`);
    console.log(`${colors.bright}        ${colors.reset} node bin/sprint-status.js --all`);
    process.exit(1);
  }

  // 1. Load config
  const config = loadConfig();

  // 2. Verify auth
  await verifyAuth(config.auth);

  if (fetchAll) {
    // Multi-team mode
    console.log(`\n${colors.cyan}${colors.bright}Sprint Status Dashboard — All Teams${colors.reset}\n`);

    // 3. Discover all active team sprints
    console.log(`${colors.cyan}Discovering team sprints...${colors.reset}`);
    const activeSprints = await discoverTeamSprints(config.auth);

    // Extract unique team names
    const teamNames = [...new Set(activeSprints.map(s => {
      const match = s.name.match(/Pipelines Sprint (\w+)/);
      return match ? match[1] : null;
    }).filter(Boolean))];

    console.log(`${colors.green}Found teams: ${teamNames.join(', ')}${colors.reset}\n`);

    const teamsData = {};
    const allComponents = new Set();

    // Process each team
    for (const currentTeamName of teamNames) {
      console.log(`${colors.cyan}${colors.bright}Processing ${currentTeamName}...${colors.reset}`);

      const teamSprint = activeSprints.find(s =>
        s.name.toLowerCase().includes(currentTeamName.toLowerCase())
      );

      if (!teamSprint) {
        console.log(`${colors.yellow}No active sprint found for ${currentTeamName}, skipping${colors.reset}\n`);
        continue;
      }

      const sprintInfo = {
        id: teamSprint.id,
        name: teamSprint.name,
        startDate: teamSprint.startDate,
        endDate: teamSprint.endDate,
        boardId: teamSprint.boardId
      };

      console.log(`${colors.green}Sprint: ${sprintInfo.name}${colors.reset}`);

      // Fetch sprint issues
      console.log(`${colors.dim}Fetching sprint issues...${colors.reset}`);
      const issues = await fetchAllSprintIssues(sprintInfo.id, config.auth);

      // Fetch historical sprints
      console.log(`${colors.dim}Fetching historical sprints...${colors.reset}`);
      const historicalSprints = await fetchHistoricalSprints(sprintInfo.boardId, currentTeamName, config.auth);

      // Fetch future sprint
      console.log(`${colors.dim}Fetching future sprint...${colors.reset}`);
      const futureSprint = await fetchFutureSprint(sprintInfo.boardId, currentTeamName, config.auth);

      // Fetch Epic progress
      console.log(`${colors.dim}Fetching Epic progress...${colors.reset}`);
      const epicProgress = await fetchEpicProgress(issues, config.auth);

      // Compute metrics
      console.log(`${colors.dim}Computing metrics...${colors.reset}`);
      const data = computeMetrics(issues, historicalSprints, futureSprint, epicProgress, currentTeamName, sprintInfo);

      // Enrich blocked and code review items with PR links
      const prIssueKeys = [...data.blocked.map(b => b.key), ...data.codeReview.map(c => c.key)];
      if (prIssueKeys.length > 0) {
        console.log(`${colors.dim}Fetching PR links for ${prIssueKeys.length} issues...${colors.reset}`);
        const prMap = await fetchPrLinks(prIssueKeys, config.auth);
        data.blocked.forEach(b => { if (prMap[b.key]) b.prs = prMap[b.key]; });
        data.codeReview.forEach(c => { if (prMap[c.key]) c.prs = prMap[c.key]; });
      }

      // Collect components
      Object.keys(data.components || {}).forEach(c => allComponents.add(c));

      // Index to Meilisearch
      console.log(`${colors.dim}Indexing to Meilisearch...${colors.reset}`);
      await indexToMeilisearch(data, config);

      // Auto-backfill historical sprints on first run
      await backfillIfNeeded(currentTeamName, config.auth, config.meilisearch?.key);

      // Fetch historical snapshots
      console.log(`${colors.dim}Fetching historical trends...${colors.reset}`);
      const historicalData = await fetchHistoricalSnapshots(currentTeamName, config);
      data.trends = historicalData;

      teamsData[currentTeamName] = data;

      console.log(`${colors.green}${currentTeamName} complete${colors.reset}\n`);
    }

    // Fetch combined trends from all teams
    console.log(`${colors.cyan}Fetching combined trends...${colors.reset}`);
    const allTrends = { sprintSnapshots: [], issueSnapshots: [] };
    for (const currentTeamName of teamNames) {
      if (teamsData[currentTeamName]) {
        const teamTrends = teamsData[currentTeamName].trends || {};
        allTrends.sprintSnapshots.push(...(teamTrends.sprintSnapshots || []));
        allTrends.issueSnapshots.push(...(teamTrends.issueSnapshots || []));
      }
    }

    // Build combined data
    const combinedData = {
      multiTeam: true,
      teams: teamsData,
      allComponents: [...allComponents].sort(),
      trends: allTrends,
      meta: {
        generatedAt: new Date().toISOString(),
        jiraBaseUrl: 'https://redhat.atlassian.net',
      }
    };

    // Render dashboard
    console.log(`${colors.cyan}Rendering dashboard...${colors.reset}`);
    const dashboardFile = renderDashboard(combinedData, 'all-teams');

    // Print summary for each team
    console.log('');
    console.log('=========================================');
    console.log('  Multi-Team Sprint Status Summary');
    console.log('=========================================');
    for (const [currentTeamName, data] of Object.entries(teamsData)) {
      console.log(`\n${colors.cyan}${colors.bright}${currentTeamName}${colors.reset}`);
      console.log(`  Sprint: ${data.meta.sprint.name}`);
      console.log(`  Total Issues: ${data.summary.totalIssues}`);
      console.log(`  Total SP: ${data.summary.totalSPs}`);
      console.log(`  Completed: ${data.velocity.current.completed} SP (${data.completionPercent}%)`);
      console.log(`  Blocked: ${data.summary.blocked.count} issues`);
      console.log(`  Health: ${data.healthScore.toUpperCase()}`);
    }
    console.log('');
    console.log(`Dashboard: ${dashboardFile}`);
    console.log('=========================================\n');

    // Publish to GitHub Pages if --publish flag
    const shouldPublish = process.argv.includes('--publish');
    if (shouldPublish) {
      console.log(`${colors.cyan}Publishing to GitHub Pages...${colors.reset}`);
      const projectRoot = path.join(__dirname, '..');
      const sprintDir = path.join(projectRoot, 'docs', 'sprint');

      if (!fs.existsSync(sprintDir)) {
        fs.mkdirSync(sprintDir, { recursive: true });
      }

      // Save combined JSON data file
      const allJsonPath = path.join(sprintDir, 'all.json');
      fs.writeFileSync(allJsonPath, JSON.stringify(combinedData, null, 2));
      console.log(`${colors.green}Data saved: docs/sprint/all.json${colors.reset}`);

      // Save individual team JSONs
      for (const [currentTeamName, data] of Object.entries(teamsData)) {
        const jsonPath = path.join(sprintDir, `${currentTeamName.toLowerCase()}.json`);
        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
        console.log(`${colors.green}Data saved: docs/sprint/${currentTeamName.toLowerCase()}.json${colors.reset}`);
      }

      // Build GitHub Pages version if dashboard exists
      const dashboardDir = path.join(projectRoot, 'dashboard');
      if (fs.existsSync(dashboardDir)) {
        try {
          console.log(`${colors.dim}Building GitHub Pages dashboard...${colors.reset}`);
          execSync('npm run build:ghpages', { cwd: dashboardDir, stdio: 'pipe' });
          console.log(`${colors.green}GitHub Pages build complete${colors.reset}`);
        } catch (e) {
          console.log(`${colors.yellow}GitHub Pages build skipped: ${e.message}${colors.reset}`);
        }
      }

      // Git commit and push
      try {
        execSync(`git add docs/sprint/`, { cwd: projectRoot, stdio: 'pipe' });
        execSync(`git commit -m "data: update sprint data for all teams"`, { cwd: projectRoot, stdio: 'pipe' });
        execSync('git push origin main', { cwd: projectRoot, stdio: 'pipe' });
        console.log(`${colors.green}Published! View at: https://openshift-pipelines.github.io/skills/sprint/all${colors.reset}`);
      } catch (e) {
        console.log(`${colors.yellow}Git push skipped: ${e.message}${colors.reset}`);
        console.log(`${colors.dim}Commit manually: git add docs/sprint/ && git commit -m "update sprint data" && git push${colors.reset}`);
      }
    }

  } else {
    // Single-team mode (existing behavior)
    console.log(`\n${colors.cyan}${colors.bright}Sprint Status Dashboard${colors.reset}`);
    console.log(`${colors.dim}Fetching data for team: ${teamName}${colors.reset}\n`);

    // 3. Discover team sprints
    console.log(`${colors.cyan}Discovering team sprints...${colors.reset}`);
    const activeSprints = await discoverTeamSprints(config.auth);

    const teamSprint = activeSprints.find(s =>
      s.name.toLowerCase().includes(teamName.toLowerCase())
    );

    if (!teamSprint) {
      console.error(`${colors.red}Error: No active sprint found for team "${teamName}"${colors.reset}`);
      console.log(`\nAvailable teams with active sprints:`);
      const teams = [...new Set(activeSprints.map(s => {
        const match = s.name.match(/Pipelines Sprint (\w+)/);
        return match ? match[1] : null;
      }))].filter(t => t);
      teams.forEach(t => console.log(`  - ${t}`));
      process.exit(1);
    }

    const sprintInfo = {
      id: teamSprint.id,
      name: teamSprint.name,
      startDate: teamSprint.startDate,
      endDate: teamSprint.endDate,
      boardId: teamSprint.boardId
    };

    console.log(`${colors.green}Selected sprint: ${sprintInfo.name} (ID: ${sprintInfo.id}, Board: ${sprintInfo.boardId})${colors.reset}`);

    // 4. Fetch sprint issues
    console.log(`${colors.cyan}Fetching sprint issues...${colors.reset}`);
    const issues = await fetchAllSprintIssues(sprintInfo.id, config.auth);

    // 5. Fetch historical sprints
    console.log(`${colors.cyan}Fetching historical sprints...${colors.reset}`);
    const extractedTeamName = teamSprint.name.match(/Pipelines Sprint (\w+)/)[1];
    const historicalSprints = await fetchHistoricalSprints(sprintInfo.boardId, extractedTeamName, config.auth);

    // 6. Fetch future sprint
    console.log(`${colors.cyan}Fetching future sprint...${colors.reset}`);
    const futureSprint = await fetchFutureSprint(sprintInfo.boardId, extractedTeamName, config.auth);

    // 7. Fetch Epic progress
    console.log(`${colors.cyan}Fetching Epic progress...${colors.reset}`);
    const epicProgress = await fetchEpicProgress(issues, config.auth);

    // 8. Compute metrics
    console.log(`${colors.cyan}Computing metrics...${colors.reset}`);
    const data = computeMetrics(issues, historicalSprints, futureSprint, epicProgress, extractedTeamName, sprintInfo);

    // 8.5 Enrich blocked and code review items with PR links
    const prIssueKeys = [...data.blocked.map(b => b.key), ...data.codeReview.map(c => c.key)];
    if (prIssueKeys.length > 0) {
      console.log(`${colors.cyan}Fetching PR links for ${prIssueKeys.length} issues...${colors.reset}`);
      const prMap = await fetchPrLinks(prIssueKeys, config.auth);
      data.blocked.forEach(b => { if (prMap[b.key]) b.prs = prMap[b.key]; });
      data.codeReview.forEach(c => { if (prMap[c.key]) c.prs = prMap[c.key]; });
    }

    // 9. Index to Meilisearch (before rendering so we can fetch history)
    console.log(`${colors.cyan}Indexing to Meilisearch...${colors.reset}`);
    await indexToMeilisearch(data, config);

    // 10. Auto-backfill historical sprints on first run
    await backfillIfNeeded(extractedTeamName, config.auth, config.meilisearch?.key);

    // 11. Fetch historical snapshots from Meilisearch for trends tab
    console.log(`${colors.cyan}Fetching historical trends...${colors.reset}`);
    const historicalData = await fetchHistoricalSnapshots(extractedTeamName, config);
    data.trends = historicalData;
    console.log(`${colors.green}Historical snapshots: ${historicalData.sprintSnapshots.length} sprints, ${historicalData.issueSnapshots.length} issues${colors.reset}`);

    // 11. Render dashboard
    console.log(`${colors.cyan}Rendering dashboard...${colors.reset}`);
    const dashboardFile = renderDashboard(data, extractedTeamName);

    // 12. Print summary
    printSummary(data);
    console.log(`Dashboard: ${dashboardFile}`);
    console.log('=========================================\n');

    // 13. Publish to GitHub Pages if --publish flag
    const shouldPublish = process.argv.includes('--publish');
    if (shouldPublish) {
      console.log(`${colors.cyan}Publishing to GitHub Pages...${colors.reset}`);
      const projectRoot = path.join(__dirname, '..');
      const sprintDir = path.join(projectRoot, 'docs', 'sprint');

      if (!fs.existsSync(sprintDir)) {
        fs.mkdirSync(sprintDir, { recursive: true });
      }

      // Save JSON data file
      const jsonPath = path.join(sprintDir, `${extractedTeamName.toLowerCase()}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
      console.log(`${colors.green}Data saved: docs/sprint/${extractedTeamName.toLowerCase()}.json${colors.reset}`);

      // Build GitHub Pages version if dashboard exists
      const dashboardDir = path.join(projectRoot, 'dashboard');
      if (fs.existsSync(dashboardDir)) {
        try {
          console.log(`${colors.dim}Building GitHub Pages dashboard...${colors.reset}`);
          execSync('npm run build:ghpages', { cwd: dashboardDir, stdio: 'pipe' });
          console.log(`${colors.green}GitHub Pages build complete${colors.reset}`);
        } catch (e) {
          console.log(`${colors.yellow}GitHub Pages build skipped: ${e.message}${colors.reset}`);
        }
      }

      // Git commit and push
      try {
        execSync(`git add docs/sprint/`, { cwd: projectRoot, stdio: 'pipe' });
        execSync(`git commit -m "data: update sprint data for ${extractedTeamName}"`, { cwd: projectRoot, stdio: 'pipe' });
        execSync('git push origin main', { cwd: projectRoot, stdio: 'pipe' });
        console.log(`${colors.green}Published! View at: https://openshift-pipelines.github.io/skills/sprint/${extractedTeamName.toLowerCase()}${colors.reset}`);
      } catch (e) {
        console.log(`${colors.yellow}Git push skipped: ${e.message}${colors.reset}`);
        console.log(`${colors.dim}Commit manually: git add docs/sprint/ && git commit -m "update sprint data" && git push${colors.reset}`);
      }
    }
  }
}

main().catch(err => {
  console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
  process.exit(1);
});
