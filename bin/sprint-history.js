#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
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
  cyan: '\x1b[36m'
};

// Meilisearch helper
function meiliSearch(index, body, config) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 7700,
      path: `/indexes/${index}/search`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.key}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse Meilisearch response: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Meilisearch health check
function meiliHealth(config) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: 7700,
      path: '/health',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.key}`
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve(health.status === 'available');
        } catch (e) {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
    req.end();
  });
}

// Subcommands
async function velocity(team, config) {
  const result = await meiliSearch('sprint-snapshots', {
    filter: `team = "${team}"`,
    sort: ['snapshotDate:desc'],
    limit: 20
  }, config);

  if (!result.hits || result.hits.length === 0) {
    console.log(`${colors.yellow}No sprint data found for ${team}${colors.reset}`);
    console.log(`Run '/osp:sprint-status ${team}' to index current sprint data.`);
    return;
  }

  // Format as table
  console.log('\n' + colors.bright + `Velocity Trend: ${team} (Last 20 sprints)` + colors.reset + '\n');
  console.log('Sprint'.padEnd(30) + ' | ' + 'Committed'.padEnd(9) + ' | ' + 'Completed'.padEnd(9) + ' | ' + 'Carried'.padEnd(7) + ' | ' + 'Rate');
  console.log('-'.repeat(30) + '-+-' + '-'.repeat(9) + '-+-' + '-'.repeat(9) + '-+-' + '-'.repeat(7) + '-+-' + '-'.repeat(6));

  result.hits.forEach(s => {
    const totalSPs = s.totalSPs || 0;
    const completedSPs = s.completedSPs || 0;
    const carried = s.carryForwardCount || 0;
    const rate = totalSPs > 0 ? Math.floor(completedSPs / totalSPs * 100) : 0;
    const rateColor = rate >= 70 ? colors.green : rate >= 50 ? colors.yellow : colors.red;

    console.log(
      (s.sprintName || '').substring(0, 30).padEnd(30) + ' | ' +
      String(totalSPs).padEnd(9) + ' | ' +
      String(completedSPs).padEnd(9) + ' | ' +
      String(carried).padEnd(7) + ' | ' +
      rateColor + String(rate).padStart(5) + '%' + colors.reset
    );
  });

  // Summary stats
  console.log('');
  console.log(colors.bright + 'Summary Statistics:' + colors.reset);
  const avgCommitted = Math.floor(result.hits.reduce((acc, s) => acc + (s.totalSPs || 0), 0) / result.hits.length);
  const avgCompleted = Math.floor(result.hits.reduce((acc, s) => acc + (s.completedSPs || 0), 0) / result.hits.length);
  const avgRate = Math.floor(result.hits.reduce((acc, s) => {
    const total = s.totalSPs || 0;
    const completed = s.completedSPs || 0;
    return acc + (total > 0 ? completed / total * 100 : 0);
  }, 0) / result.hits.length);

  console.log(`  Average Committed: ${avgCommitted} SP/sprint`);
  console.log(`  Average Completed: ${avgCompleted} SP/sprint`);
  console.log(`  Average Completion Rate: ${avgRate}%`);
}

async function issue(team, key, config) {
  if (!key) {
    console.error(`${colors.red}ERROR: Issue key required.${colors.reset}`);
    console.log('Usage: node bin/sprint-history.js <team> issue <key>');
    console.log('Example: node bin/sprint-history.js pioneers issue SRVKP-1801');
    process.exit(1);
  }

  const result = await meiliSearch('issue-snapshots', {
    filter: `key = "${key}"`,
    sort: ['snapshotDate:asc'],
    limit: 100
  }, config);

  if (!result.hits || result.hits.length === 0) {
    console.log(`${colors.yellow}No historical data found for ${key}${colors.reset}`);
    console.log('Issue may not have appeared in any indexed sprints.');
    console.log(`Run '/osp:sprint-status ${team}' to index current sprint data.`);
    return;
  }

  // Get issue summary from first snapshot
  const summary = result.hits[0].summary || 'N/A';

  console.log('\n' + colors.bright + `Issue Lifecycle: ${key}` + colors.reset);
  console.log(colors.dim + summary + colors.reset + '\n');
  console.log('Sprint'.padEnd(25) + ' | ' + 'Status'.padEnd(15) + ' | ' + 'SP'.padEnd(2) + ' | ' + 'Assignee'.padEnd(15) + ' | ' + 'Blocked'.padEnd(7) + ' | ' + 'DoD');
  console.log('-'.repeat(25) + '-+-' + '-'.repeat(15) + '-+-' + '-'.repeat(2) + '-+-' + '-'.repeat(15) + '-+-' + '-'.repeat(7) + '-+-' + '-'.repeat(10));

  result.hits.forEach(s => {
    const blockedText = s.blocked ? colors.red + 'Yes' + colors.reset : 'No';
    const blockedPadding = s.blocked ? 7 + colors.red.length + colors.reset.length : 7;

    console.log(
      (s.sprintName || '').substring(0, 25).padEnd(25) + ' | ' +
      (s.status || '').substring(0, 15).padEnd(15) + ' | ' +
      String(s.storyPoints || 0).padStart(2) + ' | ' +
      (s.assignee || 'Unassigned').substring(0, 15).padEnd(15) + ' | ' +
      blockedText.padEnd(blockedPadding) + ' | ' +
      (s.dodScore || '')
    );
  });

  // Summary
  console.log('');
  console.log(colors.bright + 'Journey Summary:' + colors.reset);
  console.log(`  First seen: ${result.hits[0].sprintName}`);
  console.log(`  Last seen: ${result.hits[result.hits.length - 1].sprintName}`);
  console.log(`  Total sprints: ${result.hits.length}`);
  console.log(`  Current status: ${result.hits[result.hits.length - 1].status}`);
}

async function trends(team, config) {
  // Fetch all sprint snapshots for the team
  const sprintResult = await meiliSearch('sprint-snapshots', {
    filter: `team = "${team}"`,
    sort: ['snapshotDate:asc'],
    limit: 200
  }, config);

  // Fetch all issue snapshots for the team
  const issueResult = await meiliSearch('issue-snapshots', {
    filter: `team = "${team}"`,
    limit: 10000
  }, config);

  if (!sprintResult.hits || sprintResult.hits.length === 0) {
    console.log(`${colors.yellow}No sprint data available for ${team}${colors.reset}`);
    console.log(`Run '/osp:sprint-status ${team}' to index data.`);
    return;
  }

  // Build analytics data
  const analyticsData = {
    team: team,
    generatedAt: new Date().toISOString(),
    sprints: sprintResult.hits,
    issues: issueResult.hits || [],
    sprintCount: sprintResult.hits.length,
    issueCount: (issueResult.hits || []).length
  };

  // Find template
  const templatePaths = [
    path.join(os.homedir(), '.claude', 'templates', 'osp', 'sprint-analytics.html'),
    path.join(__dirname, '..', 'docs', 'templates', 'sprint-analytics.html')
  ];

  let templatePath = templatePaths.find(p => fs.existsSync(p));

  // If no template found, generate inline HTML
  const template = templatePath ? fs.readFileSync(templatePath, 'utf-8') : generateAnalyticsTemplate();

  // Inject data
  const output = template.replace('/*INJECT_DATA*/', JSON.stringify(analyticsData));

  // Write to temp file
  const tmpFile = path.join(os.tmpdir(), `sprint-analytics-${team}-${Date.now()}.html`);
  fs.writeFileSync(tmpFile, output, { mode: 0o600 });

  console.log(`${colors.green}Analytics dashboard generated${colors.reset}`);
  console.log(`File: ${tmpFile}`);

  // Try to open in browser (safe: tmpFile is controlled path, no user input)
  try {
    if (process.platform === 'darwin') {
      execSync(`open "${tmpFile}"`, { stdio: 'ignore' });
    } else if (process.platform === 'linux') {
      execSync(`xdg-open "${tmpFile}"`, { stdio: 'ignore' });
    } else {
      console.log(`${colors.yellow}Open the file manually in your browser${colors.reset}`);
    }
  } catch (e) {
    console.log(`${colors.yellow}Open manually: ${tmpFile}${colors.reset}`);
  }
}

// Generate analytics template inline (fallback if external template not found)
function generateAnalyticsTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprint Analytics</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0d1117;
      color: #c9d1d9;
      padding: 20px;
    }
    .header {
      max-width: 1400px;
      margin: 0 auto 30px;
      padding: 20px;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
    }
    .header h1 {
      font-size: 24px;
      color: #58a6ff;
      margin-bottom: 8px;
    }
    .header .meta {
      font-size: 14px;
      color: #8b949e;
    }
    .grid {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(600px, 1fr));
      gap: 20px;
    }
    .card {
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      padding: 20px;
    }
    .card h2 {
      font-size: 16px;
      color: #58a6ff;
      margin-bottom: 15px;
      font-weight: 600;
    }
    .chart-container {
      position: relative;
      height: 300px;
    }
    .full-width {
      grid-column: 1 / -1;
    }
    .full-width .chart-container {
      height: 400px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 15px;
      margin-bottom: 20px;
    }
    .stat-box {
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 15px;
      text-align: center;
    }
    .stat-box .value {
      font-size: 28px;
      font-weight: 700;
      color: #58a6ff;
      margin-bottom: 5px;
    }
    .stat-box .label {
      font-size: 12px;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .issue-search {
      margin-bottom: 20px;
    }
    .issue-search input {
      width: 100%;
      padding: 12px;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      color: #c9d1d9;
      font-size: 14px;
    }
    .issue-timeline {
      max-height: 400px;
      overflow-y: auto;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
      padding: 15px;
    }
    .timeline-item {
      padding: 10px;
      border-left: 3px solid #30363d;
      margin-bottom: 15px;
      padding-left: 15px;
    }
    .timeline-item.complete { border-color: #238636; }
    .timeline-item.blocked { border-color: #da3633; }
    .timeline-item.progress { border-color: #58a6ff; }
    .timeline-sprint {
      font-size: 12px;
      color: #8b949e;
      margin-bottom: 5px;
    }
    .timeline-status {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 3px;
    }
    .timeline-details {
      font-size: 13px;
      color: #8b949e;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1 id="teamName">Sprint Analytics</h1>
    <div class="meta">
      <span id="sprintRange"></span> •
      <span id="generatedAt"></span>
    </div>
  </div>

  <div class="grid">
    <!-- Stats Overview -->
    <div class="card full-width">
      <h2>Performance Overview</h2>
      <div class="stats-grid">
        <div class="stat-box">
          <div class="value" id="avgVelocity">--</div>
          <div class="label">Avg Velocity (SP)</div>
        </div>
        <div class="stat-box">
          <div class="value" id="avgCompletion">--</div>
          <div class="label">Avg Completion</div>
        </div>
        <div class="stat-box">
          <div class="value" id="avgCarryForward">--</div>
          <div class="label">Avg Carry Forward</div>
        </div>
        <div class="stat-box">
          <div class="value" id="avgBlockedRate">--</div>
          <div class="label">Avg Blocked Rate</div>
        </div>
      </div>
    </div>

    <!-- Velocity Trend -->
    <div class="card">
      <h2>Velocity Trend</h2>
      <div class="chart-container">
        <canvas id="velocityChart"></canvas>
      </div>
    </div>

    <!-- Completion Rate -->
    <div class="card">
      <h2>Completion Rate</h2>
      <div class="chart-container">
        <canvas id="completionChart"></canvas>
      </div>
    </div>

    <!-- Carry Forward Rate -->
    <div class="card">
      <h2>Carry Forward Rate</h2>
      <div class="chart-container">
        <canvas id="carryForwardChart"></canvas>
      </div>
    </div>

    <!-- DoD Compliance -->
    <div class="card">
      <h2>DoD Compliance Trend</h2>
      <div class="chart-container">
        <canvas id="dodChart"></canvas>
      </div>
    </div>

    <!-- Blocked Issues -->
    <div class="card">
      <h2>Blocked Issues Trend</h2>
      <div class="chart-container">
        <canvas id="blockedChart"></canvas>
      </div>
    </div>

    <!-- Roadmap Alignment -->
    <div class="card">
      <h2>Roadmap Alignment</h2>
      <div class="chart-container">
        <canvas id="roadmapChart"></canvas>
      </div>
    </div>

    <!-- Issue Lifecycle Viewer -->
    <div class="card full-width">
      <h2>Issue Lifecycle Viewer</h2>
      <div class="issue-search">
        <input type="text" id="issueSearch" placeholder="Search by issue key or summary...">
      </div>
      <div class="issue-timeline" id="issueTimeline"></div>
    </div>
  </div>

  <script>
    const ANALYTICS_DATA = /*INJECT_DATA*/;

    // Initialize dashboard
    document.getElementById('teamName').textContent = \`Sprint Analytics: \${ANALYTICS_DATA.team}\`;
    document.getElementById('generatedAt').textContent = \`Generated: \${new Date(ANALYTICS_DATA.generatedAt).toLocaleString()}\`;

    const sprints = ANALYTICS_DATA.sprints;
    const sprintLabels = sprints.map(s => (s.sprintName || '').replace(/Pipelines Sprint /, ''));

    document.getElementById('sprintRange').textContent = \`\${sprints.length} sprints analyzed\`;

    // Calculate stats
    const avgVelocity = sprints.length > 0 ? Math.round(sprints.reduce((acc, s) => acc + (s.completedSPs || 0), 0) / sprints.length) : 0;
    const avgCompletion = sprints.length > 0 ? Math.round(sprints.reduce((acc, s) => acc + (s.completionPercent || 0), 0) / sprints.length) : 0;
    const avgCarryForward = sprints.length > 0 ? Math.round(sprints.reduce((acc, s) => acc + (s.carryForwardCount || 0), 0) / sprints.length) : 0;
    const avgBlockedRate = sprints.length > 0 ? Math.round(sprints.reduce((acc, s) => acc + ((s.blockedCount / s.totalIssues * 100) || 0), 0) / sprints.length) : 0;

    document.getElementById('avgVelocity').textContent = avgVelocity;
    document.getElementById('avgCompletion').textContent = avgCompletion + '%';
    document.getElementById('avgCarryForward').textContent = avgCarryForward;
    document.getElementById('avgBlockedRate').textContent = avgBlockedRate + '%';

    // Chart defaults
    Chart.defaults.color = '#8b949e';
    Chart.defaults.borderColor = '#30363d';

    // Velocity Chart
    new Chart(document.getElementById('velocityChart'), {
      type: 'line',
      data: {
        labels: sprintLabels,
        datasets: [
          {
            label: 'Committed',
            data: sprints.map(s => s.totalSPs || 0),
            borderColor: '#58a6ff',
            backgroundColor: 'rgba(88, 166, 255, 0.1)',
            tension: 0.3
          },
          {
            label: 'Completed',
            data: sprints.map(s => s.completedSPs || 0),
            borderColor: '#238636',
            backgroundColor: 'rgba(35, 134, 54, 0.1)',
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Completion Rate Chart
    new Chart(document.getElementById('completionChart'), {
      type: 'line',
      data: {
        labels: sprintLabels,
        datasets: [{
          label: 'Completion %',
          data: sprints.map(s => s.completionPercent || 0),
          borderColor: '#58a6ff',
          backgroundColor: 'rgba(88, 166, 255, 0.2)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100 } },
        plugins: { legend: { display: false } }
      }
    });

    // Carry Forward Chart
    new Chart(document.getElementById('carryForwardChart'), {
      type: 'line',
      data: {
        labels: sprintLabels,
        datasets: [{
          label: 'Carry Forward Count',
          data: sprints.map(s => s.carryForwardCount || 0),
          borderColor: '#d29922',
          backgroundColor: 'rgba(210, 153, 34, 0.2)',
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });

    // DoD Compliance Chart
    new Chart(document.getElementById('dodChart'), {
      type: 'line',
      data: {
        labels: sprintLabels,
        datasets: [
          {
            label: 'Complete',
            data: sprints.map(s => s.dodCompletePercent || 0),
            borderColor: '#238636',
            backgroundColor: 'rgba(35, 134, 54, 0.2)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'At Risk',
            data: sprints.map(s => s.dodAtRiskPercent || 0),
            borderColor: '#d29922',
            backgroundColor: 'rgba(210, 153, 34, 0.2)',
            fill: true,
            tension: 0.3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true, max: 100, stacked: true } },
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Blocked Issues Chart
    new Chart(document.getElementById('blockedChart'), {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: [{
          label: 'Blocked Count',
          data: sprints.map(s => s.blockedCount || 0),
          backgroundColor: '#da3633'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: { y: { beginAtZero: true } },
        plugins: { legend: { display: false } }
      }
    });

    // Roadmap Alignment Chart
    new Chart(document.getElementById('roadmapChart'), {
      type: 'bar',
      data: {
        labels: sprintLabels,
        datasets: [
          {
            label: 'Planned',
            data: sprints.map(s => s.plannedPercent || 0),
            backgroundColor: '#238636'
          },
          {
            label: 'Unplanned',
            data: sprints.map(s => s.unplannedPercent || 0),
            backgroundColor: '#d29922'
          },
          {
            label: 'CVE',
            data: sprints.map(s => s.cvePercent || 0),
            backgroundColor: '#da3633'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true },
          y: { stacked: true, beginAtZero: true, max: 100 }
        },
        plugins: { legend: { position: 'bottom' } }
      }
    });

    // Issue Lifecycle Viewer
    const issueSearch = document.getElementById('issueSearch');
    const issueTimeline = document.getElementById('issueTimeline');

    function renderMessage(msg) {
      const p = document.createElement('p');
      p.style.cssText = 'color: #8b949e; text-align: center; padding: 20px;';
      p.textContent = msg;
      issueTimeline.innerHTML = '';
      issueTimeline.appendChild(p);
    }

    function renderTimeline(issueKey, timeline, summary) {
      issueTimeline.innerHTML = '';

      const h3 = document.createElement('h3');
      h3.style.cssText = 'margin-bottom: 15px; color: #58a6ff;';
      h3.textContent = \`\${issueKey}: \${summary}\`;
      issueTimeline.appendChild(h3);

      timeline.forEach(snapshot => {
        const statusClass = (snapshot.status || '').match(/Done|Closed|Verified/) ? 'complete' :
                           snapshot.blocked ? 'blocked' : 'progress';

        const item = document.createElement('div');
        item.className = \`timeline-item \${statusClass}\`;

        const sprint = document.createElement('div');
        sprint.className = 'timeline-sprint';
        sprint.textContent = snapshot.sprintName || '';

        const status = document.createElement('div');
        status.className = 'timeline-status';
        status.textContent = snapshot.status || '';

        const details = document.createElement('div');
        details.className = 'timeline-details';
        details.textContent = \`\${snapshot.storyPoints || 0} SP • \${snapshot.assignee || 'Unassigned'} • DoD: \${snapshot.dodScore || 'unknown'}\${snapshot.blocked ? ' • BLOCKED' : ''}\`;

        item.appendChild(sprint);
        item.appendChild(status);
        item.appendChild(details);
        issueTimeline.appendChild(item);
      });
    }

    issueSearch.addEventListener('input', function() {
      const query = this.value.toLowerCase();
      if (query.length < 3) {
        renderMessage('Type at least 3 characters to search...');
        return;
      }

      // Find matching issues
      const matchingIssues = ANALYTICS_DATA.issues.filter(i =>
        (i.key || '').toLowerCase().includes(query) ||
        (i.summary || '').toLowerCase().includes(query)
      );

      if (matchingIssues.length === 0) {
        renderMessage('No issues found');
        return;
      }

      // Group by issue key
      const issueGroups = {};
      matchingIssues.forEach(issue => {
        if (!issueGroups[issue.key]) {
          issueGroups[issue.key] = [];
        }
        issueGroups[issue.key].push(issue);
      });

      // Render timeline for first matching issue
      const firstKey = Object.keys(issueGroups)[0];
      const timeline = issueGroups[firstKey].sort((a, b) =>
        new Date(a.snapshotDate) - new Date(b.snapshotDate)
      );

      renderTimeline(firstKey, timeline, timeline[0].summary);
    });

    renderMessage('Search for an issue to view its lifecycle...');
  </script>
</body>
</html>`;
}

async function search(team, query, config) {
  if (!query) {
    console.error(`${colors.red}ERROR: Search query required.${colors.reset}`);
    console.log('Usage: node bin/sprint-history.js <team> search <query>');
    console.log('Example: node bin/sprint-history.js pioneers search "resource quota"');
    process.exit(1);
  }

  const result = await meiliSearch('issue-snapshots', {
    q: query,
    filter: `team = "${team}"`,
    limit: 50
  }, config);

  if (!result.hits || result.hits.length === 0) {
    console.log(`${colors.yellow}No issues found matching: ${query}${colors.reset}`);
    return;
  }

  // Group by issue key, show latest
  const byKey = {};
  result.hits.forEach(h => {
    if (!byKey[h.key]) {
      byKey[h.key] = h;
    }
  });

  console.log('\n' + colors.bright + `Search Results for "${query}" (${Object.keys(byKey).length} issues)` + colors.reset + '\n');
  console.log('Key'.padEnd(15) + ' | ' + 'Summary'.padEnd(50) + ' | ' + 'Status'.padEnd(15) + ' | ' + 'Sprint');
  console.log('-'.repeat(15) + '-+-' + '-'.repeat(50) + '-+-' + '-'.repeat(15) + '-+-' + '-'.repeat(30));

  Object.values(byKey).forEach(h => {
    console.log(
      (h.key || '').padEnd(15) + ' | ' +
      ((h.summary || '').substring(0, 48) + '..').padEnd(50) + ' | ' +
      (h.status || '').substring(0, 15).padEnd(15) + ' | ' +
      (h.sprintName || '')
    );
  });
}

async function compare(team1, team2, config) {
  if (!team2) {
    console.error(`${colors.red}ERROR: Second team name required.${colors.reset}`);
    console.log('Usage: node bin/sprint-history.js <team1> compare <team2>');
    console.log('Example: node bin/sprint-history.js pioneers compare crookshank');
    process.exit(1);
  }

  // Normalize team2 name
  team2 = team2.charAt(0).toUpperCase() + team2.slice(1).toLowerCase();
  if (team2.toLowerCase() === 'crookshank') team2 = 'CrookShank';

  const t1 = await meiliSearch('sprint-snapshots', {
    filter: `team = "${team1}"`,
    limit: 200
  }, config);

  const t2 = await meiliSearch('sprint-snapshots', {
    filter: `team = "${team2}"`,
    limit: 200
  }, config);

  if (!t1.hits || t1.hits.length === 0 || !t2.hits || t2.hits.length === 0) {
    console.error(`${colors.red}ERROR: Insufficient data for comparison.${colors.reset}`);
    console.log(`  ${team1}: ${(t1.hits || []).length} sprints`);
    console.log(`  ${team2}: ${(t2.hits || []).length} sprints`);
    return;
  }

  const avg = (arr, field) => arr.length ? Math.round(arr.reduce((s, h) => s + (h[field] || 0), 0) / arr.length) : 0;

  console.log('\n' + colors.bright + `Team Comparison: ${team1} vs ${team2}` + colors.reset + '\n');
  console.log('Metric'.padEnd(30) + ' | ' + team1.padEnd(20) + ' | ' + team2.padEnd(20));
  console.log('-'.repeat(30) + '-+-' + '-'.repeat(20) + '-+-' + '-'.repeat(20));

  const metrics = [
    ['Velocity (SP/sprint)', 'completedSPs', ' SP'],
    ['Completion Rate', 'completionPercent', '%'],
    ['Blocked Rate', 'blockedCount', ''],
    ['Carry-Forward Rate', 'carryForwardCount', ''],
    ['DoD Compliance', 'dodCompletePercent', '%']
  ];

  metrics.forEach(([label, field, suffix]) => {
    const val1 = avg(t1.hits, field);
    const val2 = avg(t2.hits, field);
    console.log(
      label.padEnd(30) + ' | ' +
      (String(val1) + suffix).padEnd(20) + ' | ' +
      (String(val2) + suffix).padEnd(20)
    );
  });

  console.log('');
  console.log(colors.bright + 'Data Range:' + colors.reset);
  console.log(`  ${team1}: ${t1.hits.length} sprints indexed`);
  console.log(`  ${team2}: ${t2.hits.length} sprints indexed`);
}

// Main
async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log(`${colors.bright}Sprint History Analytics${colors.reset}

Usage: node bin/sprint-history.js <team> <subcommand> [args]

${colors.bright}Subcommands:${colors.reset}
  ${colors.cyan}velocity${colors.reset}              Velocity trend table
  ${colors.cyan}issue <key>${colors.reset}           Issue lifecycle across sprints
  ${colors.cyan}trends${colors.reset}                Open analytics dashboard in browser
  ${colors.cyan}search <query>${colors.reset}        Full-text search across issues
  ${colors.cyan}compare <team2>${colors.reset}       Compare two teams side by side

${colors.bright}Examples:${colors.reset}
  node bin/sprint-history.js pioneers velocity
  node bin/sprint-history.js pioneers issue SRVKP-1801
  node bin/sprint-history.js pioneers trends
  node bin/sprint-history.js pioneers search "resource quota"
  node bin/sprint-history.js pioneers compare crookshank
`);
    process.exit(1);
  }

  let team = args[0];
  const cmd = args[1];

  // Normalize team name
  team = team.charAt(0).toUpperCase() + team.slice(1).toLowerCase();
  if (team.toLowerCase() === 'pioneers') team = 'Pioneers';
  if (team.toLowerCase() === 'crookshank') team = 'CrookShank';

  // Load config
  const configPath = path.join(os.homedir(), '.config', 'osp', 'config.json');
  if (!fs.existsSync(configPath)) {
    console.error(`${colors.red}Config not found.${colors.reset} Run /osp:configure first.`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const meiliConfig = config.meilisearch || {};

  if (!meiliConfig.key) {
    console.error(`${colors.red}Meilisearch not configured.${colors.reset} Run /osp:sprint-status first to auto-configure.`);
    process.exit(1);
  }

  // Check Meilisearch health
  const isHealthy = await meiliHealth(meiliConfig);
  if (!isHealthy) {
    console.error(`${colors.red}Meilisearch not reachable.${colors.reset}`);
    console.log('Start it with: docker start osp-meilisearch');
    console.log('Or run: /osp:sprint-status to auto-setup');
    process.exit(1);
  }

  // Route to subcommand
  try {
    switch (cmd) {
      case 'velocity':
        await velocity(team, meiliConfig);
        break;
      case 'issue':
        await issue(team, args[2], meiliConfig);
        break;
      case 'trends':
        await trends(team, meiliConfig);
        break;
      case 'search':
        await search(team, args.slice(2).join(' '), meiliConfig);
        break;
      case 'compare':
        await compare(team, args[2], meiliConfig);
        break;
      default:
        console.error(`${colors.red}Unknown subcommand: ${cmd}${colors.reset}`);
        console.log('Run without arguments to see usage.');
        process.exit(1);
    }
  } catch (err) {
    console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    if (err.code === 'ECONNREFUSED') {
      console.log('Meilisearch connection refused. Make sure the Docker container is running:');
      console.log('  docker start osp-meilisearch');
    }
    process.exit(1);
  }
}

main().catch(err => {
  console.error(`${colors.red}Fatal error: ${err.message}${colors.reset}`);
  process.exit(1);
});
