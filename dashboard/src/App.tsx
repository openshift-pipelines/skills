import { useState, useMemo, useEffect } from 'react'
import type { DashboardData, AppData, MultiTeamData, AssigneeData, ComponentData, StatusBreakdown } from './lib/types'
import { isMultiTeam } from './lib/types'
import { HealthScore } from './components/HealthScore'
import { Alerts } from './components/Alerts'
import { BlockedIssues } from './components/BlockedIssues'
import { HighPriorityBugs } from './components/HighPriorityBugs'
import { CarryForward } from './components/CarryForward'
import { DoDCompliance } from './components/DoDCompliance'
import { CodeReviewRedo } from './components/CodeReviewRedo'
import { VelocityTrend } from './components/VelocityTrend'
import { RoadmapAlignment } from './components/RoadmapAlignment'
import { FutureSprint } from './components/FutureSprint'
import { AssigneeBreakdown } from './components/AssigneeBreakdown'
import { ComponentBreakdown } from './components/ComponentBreakdown'
import { FilterBar } from './components/FilterBar'
import { OverviewCharts } from './components/OverviewCharts'
import { ActionableInsights } from './components/ActionableInsights'
import { IssuesCharts } from './components/IssuesCharts'
import { CommittedVsDone } from './components/CommittedVsDone'
import { DoDCharts } from './components/DoDCharts'
import { RoadmapCharts } from './components/RoadmapCharts'
import { PeopleCharts } from './components/PeopleCharts'
import { ComponentCharts } from './components/ComponentCharts'
import { TrendsView } from './components/TrendsView'
import { formatDate } from './lib/utils'

declare global {
  interface Window {
    __DASHBOARD_DATA__: AppData | Record<string, never>
  }
}

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'issues', label: 'Issues' },
  { id: 'velocity', label: 'Velocity' },
  { id: 'dod', label: 'DoD' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'people', label: 'People' },
  { id: 'components', label: 'Components' },
  { id: 'trends', label: 'Trends' },
] as const

type TabId = typeof TABS[number]['id']

function mergeStatusBreakdowns(breakdowns: StatusBreakdown[]): StatusBreakdown {
  const merged: StatusBreakdown = {}
  breakdowns.forEach(breakdown => {
    Object.entries(breakdown).forEach(([status, data]) => {
      if (!merged[status]) {
        merged[status] = { count: 0, sp: 0 }
      }
      merged[status].count += data.count
      merged[status].sp += data.sp
    })
  })
  return merged
}

function mergeDod(dods: DashboardData['dod'][]): DashboardData['dod'] {
  const allIssues = dods.flatMap(d => d.issues)
  const total = allIssues.length || 1
  const complete = allIssues.filter(i => i.score === 'complete').length
  const atRisk = allIssues.filter(i => i.score === 'atRisk').length
  const incomplete = allIssues.filter(i => i.score === 'incomplete').length
  const na = allIssues.filter(i => i.score === 'na').length

  return {
    complete: { count: complete, percent: Math.round((complete / total) * 100) },
    atRisk: { count: atRisk, percent: Math.round((atRisk / total) * 100) },
    incomplete: { count: incomplete, percent: Math.round((incomplete / total) * 100) },
    na: { count: na, percent: Math.round((na / total) * 100) },
    issues: allIssues,
  }
}

function mergeTeamData(teams: Record<string, DashboardData>, meta: { generatedAt: string; jiraBaseUrl: string }): DashboardData {
  const allTeamData = Object.values(teams)
  if (allTeamData.length === 0) return null!
  if (allTeamData.length === 1) return allTeamData[0]

  // Merge summaries
  const mergedSummary = {
    totalIssues: allTeamData.reduce((s, t) => s + t.summary.totalIssues, 0),
    totalSPs: allTeamData.reduce((s, t) => s + t.summary.totalSPs, 0),
    byStatus: mergeStatusBreakdowns(allTeamData.map(t => t.summary.byStatus)),
    blocked: {
      count: allTeamData.reduce((s, t) => s + t.summary.blocked.count, 0),
      sp: allTeamData.reduce((s, t) => s + t.summary.blocked.sp, 0),
    },
    noStoryPoints: allTeamData.reduce((s, t) => s + t.summary.noStoryPoints, 0),
  }

  // Merge arrays (blocked, codeReview, carryForward, highPriorityBugs)
  const mergedBlocked = allTeamData.flatMap(t => t.blocked)
  const mergedCR = allTeamData.flatMap(t => t.codeReview)
  const mergedCF = allTeamData.flatMap(t => t.carryForward).sort((a, b) => b.sprintCount - a.sprintCount)
  const mergedBugs = allTeamData.flatMap(t => t.highPriorityBugs)

  // Merge assignees (combine across teams)
  const mergedAssignees: Record<string, AssigneeData> = {}
  allTeamData.forEach(t => {
    Object.entries(t.assignees).forEach(([name, data]) => {
      if (mergedAssignees[name]) {
        mergedAssignees[name].totalIssues += data.totalIssues
        mergedAssignees[name].totalSP += data.totalSP
        mergedAssignees[name].blocked += data.blocked
        mergedAssignees[name].carryForwardCount += data.carryForwardCount
        mergedAssignees[name].issues.push(...data.issues)
        // Merge byStatus
        Object.entries(data.byStatus).forEach(([status, statusData]) => {
          if (!mergedAssignees[name].byStatus[status]) {
            mergedAssignees[name].byStatus[status] = { count: 0, sp: 0 }
          }
          mergedAssignees[name].byStatus[status].count += statusData.count
          mergedAssignees[name].byStatus[status].sp += statusData.sp
        })
      } else {
        mergedAssignees[name] = {
          ...data,
          issues: [...data.issues],
          byStatus: { ...data.byStatus }
        }
      }
    })
  })

  // Merge components (THIS IS THE KEY — cross-team component view)
  const mergedComponents: Record<string, ComponentData> = {}
  allTeamData.forEach(t => {
    Object.entries(t.components).forEach(([name, data]) => {
      if (mergedComponents[name]) {
        mergedComponents[name].totalIssues += data.totalIssues
        mergedComponents[name].totalSP += data.totalSP
        mergedComponents[name].blocked += data.blocked
        mergedComponents[name].highPriorityBugs += data.highPriorityBugs
        mergedComponents[name].issues.push(...data.issues)
        // Merge byStatus
        Object.entries(data.byStatus).forEach(([status, statusData]) => {
          if (!mergedComponents[name].byStatus[status]) {
            mergedComponents[name].byStatus[status] = { count: 0, sp: 0 }
          }
          mergedComponents[name].byStatus[status].count += statusData.count
          mergedComponents[name].byStatus[status].sp += statusData.sp
        })
      } else {
        mergedComponents[name] = {
          ...data,
          issues: [...data.issues],
          byStatus: { ...data.byStatus }
        }
      }
    })
  })

  // Use first team's velocity/roadmap/dod as base (these don't merge well across teams)
  const firstTeam = allTeamData[0]

  // Merge velocity
  const mergedVelocity = {
    current: {
      committed: allTeamData.reduce((s, t) => s + t.velocity.current.committed, 0),
      completed: allTeamData.reduce((s, t) => s + t.velocity.current.completed, 0),
    },
    history: firstTeam.velocity.history, // Can't easily merge histories
    avg3: null,
    avg5: null,
    trend: 'stable',
    commitmentAccuracy: [],
  }

  const totalSPs = mergedSummary.totalSPs || 1
  const completedSPs = mergedVelocity.current.completed

  return {
    meta: {
      team: 'All Teams',
      sprint: { id: 0, name: 'All Active Sprints', startDate: firstTeam.meta.sprint.startDate, endDate: firstTeam.meta.sprint.endDate },
      generatedAt: meta.generatedAt,
      jiraBaseUrl: meta.jiraBaseUrl,
    },
    summary: mergedSummary,
    velocity: mergedVelocity,
    expectations: firstTeam.expectations, // Use first team's expectations
    roadmap: firstTeam.roadmap,
    dod: mergeDod(allTeamData.map(t => t.dod)),
    codeReview: mergedCR,
    blocked: mergedBlocked,
    highPriorityBugs: mergedBugs,
    carryForward: mergedCF,
    futureSprint: firstTeam.futureSprint,
    assignees: mergedAssignees,
    components: mergedComponents,
    daysRemaining: firstTeam.daysRemaining,
    sprintDuration: firstTeam.sprintDuration,
    sprintDay: firstTeam.sprintDay,
    completionPercent: Math.round((completedSPs / totalSPs) * 100),
    healthScore: (Math.round((completedSPs / totalSPs) * 100) >= 70 ? 'green' : Math.round((completedSPs / totalSPs) * 100) >= 50 ? 'yellow' : 'red') as 'green' | 'yellow' | 'red',
    trends: { sprintSnapshots: [], issueSnapshots: [] },
  }
}

function filterByAssignee(data: DashboardData, assignee: string): DashboardData {
  if (!assignee) return data

  const filteredBlocked = data.blocked.filter(i => i.assignee === assignee)
  const filteredCR = data.codeReview.filter(i => i.assignee === assignee)
  const filteredCF = data.carryForward // carryForward items don't have assignee field — keep all
  // highPriorityBugs don't have assignee — keep all
  const filteredBugs = data.highPriorityBugs

  // Filter assignees to only the selected one
  const filteredAssignees: Record<string, typeof data.assignees[string]> = {}
  if (data.assignees[assignee]) {
    filteredAssignees[assignee] = data.assignees[assignee]
  }

  // Recompute summary from the filtered assignee data
  const assigneeData = data.assignees[assignee]
  let filteredSummary = data.summary
  if (assigneeData) {
    const totalIssues = assigneeData.totalIssues
    const totalSPs = assigneeData.totalSP
    const blockedCount = filteredBlocked.length
    const blockedSP = filteredBlocked.reduce((sum, _) => sum + 1, 0) // no SP on blocked items, approximate
    filteredSummary = {
      ...data.summary,
      totalIssues,
      totalSPs,
      byStatus: assigneeData.byStatus,
      blocked: { count: blockedCount, sp: blockedSP },
    }
  }

  // Filter DoD issues — check if the issue belongs to the assignee's issues
  const assigneeIssueKeys = assigneeData
    ? new Set(assigneeData.issues.map(i => i.key))
    : new Set<string>()

  const filteredDoDIssues = data.dod.issues.filter(i => assigneeIssueKeys.has(i.key))
  const dodTotal = filteredDoDIssues.length || 1
  const dodComplete = filteredDoDIssues.filter(i => i.score === 'complete').length
  const dodAtRisk = filteredDoDIssues.filter(i => i.score === 'atRisk').length
  const dodIncomplete = filteredDoDIssues.filter(i => i.score === 'incomplete').length
  const dodNa = filteredDoDIssues.filter(i => i.score === 'na').length

  const filteredDoD = {
    complete: { count: dodComplete, percent: Math.round((dodComplete / dodTotal) * 100) },
    atRisk: { count: dodAtRisk, percent: Math.round((dodAtRisk / dodTotal) * 100) },
    incomplete: { count: dodIncomplete, percent: Math.round((dodIncomplete / dodTotal) * 100) },
    na: { count: dodNa, percent: Math.round((dodNa / dodTotal) * 100) },
    issues: filteredDoDIssues,
  }

  // Completion percent for filtered data
  const closedSP = assigneeData?.byStatus?.['Closed']?.sp || 0
  const verifiedSP = assigneeData?.byStatus?.['Verified']?.sp || 0
  const releasePendingSP = assigneeData?.byStatus?.['Release Pending']?.sp || 0
  const completedSPs = closedSP + verifiedSP + releasePendingSP
  const filteredCompletionPercent = assigneeData && assigneeData.totalSP > 0
    ? Math.round((completedSPs / assigneeData.totalSP) * 100)
    : 0

  // Filter components to only include issues from this assignee
  const filteredComponents: Record<string, typeof data.components[string]> = {}
  for (const [compName, compData] of Object.entries(data.components)) {
    const compIssues = compData.issues.filter(i => assigneeIssueKeys.has(i.key))
    if (compIssues.length > 0) {
      const compByStatus: Record<string, { count: number; sp: number }> = {}
      compIssues.forEach(issue => {
        if (!compByStatus[issue.status]) compByStatus[issue.status] = { count: 0, sp: 0 }
        compByStatus[issue.status].count++
        compByStatus[issue.status].sp += issue.sp
      })
      filteredComponents[compName] = {
        ...compData,
        totalIssues: compIssues.length,
        totalSP: compIssues.reduce((s, i) => s + i.sp, 0),
        byStatus: compByStatus,
        issues: compIssues,
      }
    }
  }

  return {
    ...data,
    summary: filteredSummary,
    blocked: filteredBlocked,
    codeReview: filteredCR,
    carryForward: filteredCF,
    highPriorityBugs: filteredBugs,
    assignees: filteredAssignees,
    components: filteredComponents,
    dod: filteredDoD,
    completionPercent: filteredCompletionPercent,
  }
}

function getTeamFromPath(): string | null {
  const path = window.location.pathname
  const match = path.match(/\/sprint\/(\w+)/i)
  return match ? match[1] : null
}

function App() {
  const [dynamicData, setDynamicData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const embeddedData = window.__DASHBOARD_DATA__ as AppData
  const teamFromPath = getTeamFromPath()

  // Load data from JSON file if on GitHub Pages (no embedded data, team in URL path)
  useEffect(() => {
    const hasEmbedded = embeddedData && (isMultiTeam(embeddedData) || (embeddedData as DashboardData).meta)
    if (hasEmbedded || !teamFromPath) return

    setLoading(true)
    setError(null)

    // Try loading team JSON from same directory
    const jsonUrl = `${teamFromPath.toLowerCase()}.json`
    fetch(jsonUrl)
      .then(res => {
        if (!res.ok) throw new Error(`No data for team "${teamFromPath}" (HTTP ${res.status})`)
        return res.json()
      })
      .then(data => { setDynamicData(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [teamFromPath])

  const rawData: AppData | null = dynamicData || (embeddedData && (isMultiTeam(embeddedData) || (embeddedData as DashboardData).meta) ? embeddedData : null)

  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [filter, setFilter] = useState('')
  const [viewMode, setViewMode] = useState<'po' | 'assignee'>('po')
  const [selectedAssignee, setSelectedAssignee] = useState<string>('')
  const [selectedTeam, setSelectedTeam] = useState<string>('all')
  const [selectedComponent, setSelectedComponent] = useState<string>('all')

  // Resolve multi-team data to single DashboardData based on team filter
  const resolvedData = useMemo((): DashboardData | null => {
    if (!rawData) return null

    if (isMultiTeam(rawData)) {
      if (selectedTeam !== 'all') {
        // Single team selected — use that team's data
        return rawData.teams[selectedTeam] || null
      }

      // All teams — merge data from all teams
      return mergeTeamData(rawData.teams, rawData.meta)
    }

    return rawData as DashboardData
  }, [rawData, selectedTeam])

  const hasData = resolvedData && resolvedData.meta && resolvedData.summary

  // Apply component filter
  const componentFilteredData = useMemo((): DashboardData | null => {
    if (!resolvedData || selectedComponent === 'all') return resolvedData

    const compData = resolvedData.components[selectedComponent]
    if (!compData) return resolvedData

    const compIssueKeys = new Set(compData.issues.map(i => i.key))

    // Filter all issue arrays
    const filteredBlocked = resolvedData.blocked.filter(i => compIssueKeys.has(i.key))
    const filteredCR = resolvedData.codeReview.filter(i => compIssueKeys.has(i.key))
    const filteredBugs = resolvedData.highPriorityBugs.filter(i => compIssueKeys.has(i.key))
    const filteredCF = resolvedData.carryForward.filter(i => compIssueKeys.has(i.key))
    const filteredFuture = {
      ...resolvedData.futureSprint,
      issues: resolvedData.futureSprint.issues.filter(i => compIssueKeys.has(i.key)),
    }

    // Recompute byStatus from component issues
    const byStatus: Record<string, { count: number; sp: number }> = {}
    compData.issues.forEach(issue => {
      if (!byStatus[issue.status]) byStatus[issue.status] = { count: 0, sp: 0 }
      byStatus[issue.status].count++
      byStatus[issue.status].sp += issue.sp || 0
    })

    const totalSPs = compData.totalSP
    const blockedSP = filteredBlocked.reduce((s, i) => s + (compData.issues.find(ci => ci.key === i.key)?.sp || 0), 0)
    const noSP = compData.issues.filter(i => !i.sp || i.sp === 0).length
    const completedSP = (byStatus['Closed']?.sp || 0) + (byStatus['Verified']?.sp || 0) + (byStatus['Release Pending']?.sp || 0)
    const completionPct = totalSPs > 0 ? Math.round((completedSP / totalSPs) * 100) : 0
    const blockedPct = compData.totalIssues > 0 ? Math.round((filteredBlocked.length / compData.totalIssues) * 100) : 0
    const health: 'green' | 'yellow' | 'red' = completionPct >= 70 && blockedPct < 10 ? 'green' : completionPct >= 50 || blockedPct < 20 ? 'yellow' : 'red'

    // Filter DoD to component issues
    const filteredDoDIssues = resolvedData.dod.issues.filter(i => compIssueKeys.has(i.key))
    const dodTotal = filteredDoDIssues.length || 1
    const dodComplete = filteredDoDIssues.filter(i => i.score === 'complete').length
    const dodAtRisk = filteredDoDIssues.filter(i => i.score === 'atRisk').length
    const dodIncomplete = filteredDoDIssues.filter(i => i.score === 'incomplete').length
    const dodNa = filteredDoDIssues.filter(i => i.score === 'na').length

    // Filter assignees to only those with issues in this component
    const filteredAssignees: Record<string, typeof resolvedData.assignees[string]> = {}
    Object.entries(resolvedData.assignees).forEach(([name, aData]) => {
      const compIssues = aData.issues.filter(i => compIssueKeys.has(i.key))
      if (compIssues.length > 0) {
        const aByStatus: Record<string, { count: number; sp: number }> = {}
        compIssues.forEach(i => {
          if (!aByStatus[i.status]) aByStatus[i.status] = { count: 0, sp: 0 }
          aByStatus[i.status].count++
          aByStatus[i.status].sp += i.sp || 0
        })
        filteredAssignees[name] = {
          ...aData,
          totalIssues: compIssues.length,
          totalSP: compIssues.reduce((s, i) => s + (i.sp || 0), 0),
          byStatus: aByStatus,
          blocked: filteredBlocked.filter(b => b.assignee === name).length,
          carryForwardCount: filteredCF.filter(c => compIssues.some(ci => ci.key === c.key)).length,
          issues: compIssues,
        }
      }
    })

    return {
      ...resolvedData,
      summary: {
        totalIssues: compData.totalIssues,
        totalSPs: totalSPs,
        byStatus,
        blocked: { count: filteredBlocked.length, sp: blockedSP },
        noStoryPoints: noSP,
      },
      velocity: {
        ...resolvedData.velocity,
        current: { committed: totalSPs, completed: completedSP },
      },
      blocked: filteredBlocked,
      codeReview: filteredCR,
      highPriorityBugs: filteredBugs,
      carryForward: filteredCF,
      futureSprint: filteredFuture,
      dod: {
        complete: { count: dodComplete, percent: Math.round((dodComplete / dodTotal) * 100) },
        atRisk: { count: dodAtRisk, percent: Math.round((dodAtRisk / dodTotal) * 100) },
        incomplete: { count: dodIncomplete, percent: Math.round((dodIncomplete / dodTotal) * 100) },
        na: { count: dodNa, percent: Math.round((dodNa / dodTotal) * 100) },
        issues: filteredDoDIssues,
      },
      assignees: filteredAssignees,
      components: { [selectedComponent]: compData },
      completionPercent: completionPct,
      healthScore: health,
    }
  }, [resolvedData, selectedComponent])

  // Apply assignee filter
  const filteredData = useMemo((): DashboardData | null => {
    if (!hasData || !componentFilteredData) return componentFilteredData
    if (viewMode === 'assignee' && selectedAssignee) {
      return filterByAssignee(componentFilteredData, selectedAssignee)
    }
    return componentFilteredData
  }, [componentFilteredData, viewMode, selectedAssignee, hasData])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-lg">Loading sprint data for {teamFromPath}...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4">
        <div className="text-red-400 text-lg">{error}</div>
        <div className="text-slate-500 text-sm">Run <code className="text-blue-400">node bin/sprint-status.js {teamFromPath} --publish</code> to generate data</div>
      </div>
    )
  }

  if (!hasData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        <h1 className="text-2xl font-semibold text-white">Sprint Dashboard</h1>
        <p className="text-slate-400">Select a team to view sprint data:</p>
        <div className="flex gap-3">
          {['pioneers', 'crookshank'].map(team => (
            <a
              key={team}
              href={`/skills/sprint/${team}`}
              className="px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-blue-400 font-medium capitalize transition-colors"
            >
              {team}
            </a>
          ))}
        </div>
        <p className="text-slate-600 text-xs mt-4">Or load local data: <code className="text-slate-500">node bin/sprint-status.js &lt;team&gt;</code></p>
      </div>
    )
  }

  // After the hasData guard above, filteredData is guaranteed non-null
  const fd = filteredData!
  const filterLower = filter.toLowerCase()
  const closedStatus = fd.summary.byStatus?.['Closed'] || { count: 0, sp: 0 }
  const crStatus = fd.summary.byStatus?.['Code Review'] || { count: 0, sp: 0 }
  const criticalCF = fd.carryForward?.filter(i => i.severity === 'critical').length || 0
  const progressPct = fd.sprintDuration > 0 ? Math.round((fd.sprintDay / fd.sprintDuration) * 100) : 0

  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-950 px-6 py-3">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">{resolvedData.meta.sprint.name}</h1>
            <HealthScore score={fd.healthScore} completionPercent={fd.completionPercent} />

            {/* Team Filter — only show when multiTeam */}
            {isMultiTeam(rawData) && (
              <select
                value={selectedTeam}
                onChange={e => { setSelectedTeam(e.target.value); setSelectedComponent('all') }}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm text-slate-200"
              >
                <option value="all">All Teams</option>
                {Object.keys((rawData as MultiTeamData).teams).sort().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}

            {/* Component Filter — always show when data has components */}
            {resolvedData && Object.keys(resolvedData.components).length > 0 && (
              <select
                value={selectedComponent}
                onChange={e => setSelectedComponent(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm text-slate-200"
              >
                <option value="all">All Components</option>
                {(isMultiTeam(rawData) ? (rawData as MultiTeamData).allComponents : Object.keys(resolvedData.components)).sort().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}

            {/* View Toggle */}
            <div className="flex bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => { setViewMode('po'); setSelectedAssignee('') }}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'po' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-300'}`}
              >
                PO View
              </button>
              <button
                onClick={() => setViewMode('assignee')}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${viewMode === 'assignee' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-300'}`}
              >
                Assignee
              </button>
            </div>

            {/* Assignee dropdown */}
            {viewMode === 'assignee' && (
              <select
                value={selectedAssignee}
                onChange={(e) => setSelectedAssignee(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm text-slate-200"
              >
                <option value="">Select assignee...</option>
                {Object.keys(resolvedData.assignees).sort().map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Ends {formatDate(resolvedData.meta.sprint.endDate)} &middot; Generated {formatDate(resolvedData.meta.generatedAt)}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 px-6">
        <div className="flex gap-1 max-w-screen-2xl mx-auto -mb-px">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-xs font-medium uppercase tracking-wider transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
              }`}
            >
              {tab.label}
              {tab.id === 'issues' && fd.blocked.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400">
                  {fd.blocked.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Row 1: Sprint Progress + Completion */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Sprint Timeline */}
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Sprint Timeline</div>
                  <div className="text-2xl font-bold text-white">Day {fd.sprintDay} <span className="text-base font-normal text-slate-400">of {fd.sprintDuration}</span></div>
                  <div className="text-sm text-slate-400 mt-1">{fd.daysRemaining} days remaining</div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                {/* Completion */}
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Completion</div>
                  <div className="text-4xl font-bold text-white">{fd.completionPercent}%</div>
                  <div className="text-sm text-slate-400 mt-1">{fd.velocity.current.completed} / {fd.summary.totalSPs} SP</div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${fd.completionPercent}%` }} />
                  </div>
                </div>

                {/* DoD + Roadmap */}
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Health Indicators</div>
                  <div className="space-y-2 mt-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">DoD Compliance</span>
                      <span className="text-white font-medium">{fd.dod.complete.percent}% complete</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Roadmap Alignment</span>
                      <span className="text-white font-medium">{fd.roadmap.planned.percent}% planned</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Velocity Avg (3-sprint)</span>
                      <span className="text-white font-medium">{fd.velocity.avg3 ?? 'N/A'} SP</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Key Numbers */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="Total Issues" value={fd.summary.totalIssues} sub={`${fd.summary.totalSPs} SP`} />
                <KpiCard label="Completed" value={closedStatus.count} sub={`${closedStatus.sp} SP`} color="emerald" />
                <KpiCard label="Code Review" value={crStatus.count} sub={`${crStatus.sp} SP`} color="amber" />
                <KpiCard label="Blocked" value={fd.summary.blocked.count} sub={`${fd.summary.blocked.sp} SP`} color={fd.summary.blocked.count > 0 ? 'red' : 'emerald'} />
                <KpiCard label="Carry-Forward" value={criticalCF} sub={`critical (5+ sprints)`} color={criticalCF > 0 ? 'red' : 'emerald'} />
              </div>

              {/* Row 3: Visual Charts */}
              <OverviewCharts data={fd} />

              {/* Row 4: Actionable Insights */}
              <ActionableInsights data={fd} />

              {/* Row 5: Alerts */}
              <Alerts expectations={fd.expectations} />

              {/* Row 5: Quick Glance Tables (side by side) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Blocked / Carry-Forward */}
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Blocked Issues ({fd.blocked.length})
                    </h3>
                    {fd.blocked.length > 0 && (
                      <button onClick={() => setActiveTab('issues')} className="text-xs text-blue-400 hover:text-blue-300">View all &rarr;</button>
                    )}
                  </div>
                  {fd.blocked.length === 0 ? (
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> No blocked issues
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fd.blocked.slice(0, 3).map(item => (
                        <div key={item.key} className="flex items-center gap-3 text-sm">
                          <a href={`${resolvedData.meta.jiraBaseUrl}/browse/${item.key}`} target="_blank" className="text-blue-400 hover:underline font-mono text-xs">{item.key}</a>
                          <span className="text-slate-300 truncate flex-1">{item.summary}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-500/20 text-red-400">{item.priority}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top Carry-Forward */}
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Carry-Forward Worst ({fd.carryForward.filter(i => i.severity !== 'normal').length})
                    </h3>
                    <button onClick={() => setActiveTab('issues')} className="text-xs text-blue-400 hover:text-blue-300">View all &rarr;</button>
                  </div>
                  <div className="space-y-2">
                    {fd.carryForward.filter(i => i.severity !== 'normal').slice(0, 3).map(item => (
                      <div key={item.key} className="flex items-center gap-3 text-sm">
                        <a href={`${resolvedData.meta.jiraBaseUrl}/browse/${item.key}`} target="_blank" className="text-blue-400 hover:underline font-mono text-xs">{item.key}</a>
                        <span className="text-slate-300 truncate flex-1">{item.summary}</span>
                        <span className={`text-xs font-bold ${item.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                          {item.sprintCount} sprints
                        </span>
                      </div>
                    ))}
                    {fd.carryForward.filter(i => i.severity !== 'normal').length === 0 && (
                      <div className="text-sm text-slate-500">No chronic carry-forwards</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ISSUES TAB */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              <IssuesCharts data={fd} />
              <FilterBar value={filter} onChange={setFilter} />
              <BlockedIssues items={fd.blocked} jiraBaseUrl={resolvedData.meta.jiraBaseUrl} filter={filterLower} />
              <CodeReviewRedo items={fd.codeReview} jiraBaseUrl={resolvedData.meta.jiraBaseUrl} filter={filterLower} />
              <CarryForward items={fd.carryForward} jiraBaseUrl={resolvedData.meta.jiraBaseUrl} filter={filterLower} />
              <HighPriorityBugs items={fd.highPriorityBugs} jiraBaseUrl={resolvedData.meta.jiraBaseUrl} filter={filterLower} />
              <FutureSprint futureSprint={fd.futureSprint} jiraBaseUrl={resolvedData.meta.jiraBaseUrl} filter={filterLower} />
            </div>
          )}

          {/* VELOCITY TAB */}
          {activeTab === 'velocity' && (
            <div className="space-y-4">
              <CommittedVsDone velocity={fd.velocity} />
              <VelocityTrend velocity={fd.velocity} />
              <Alerts expectations={fd.expectations} />
            </div>
          )}

          {/* DOD TAB */}
          {activeTab === 'dod' && (
            <div className="space-y-4">
              <DoDCharts dod={fd.dod} />
              <FilterBar value={filter} onChange={setFilter} />
              <DoDCompliance dod={fd.dod} jiraBaseUrl={resolvedData.meta.jiraBaseUrl} filter={filterLower} />
            </div>
          )}

          {/* ROADMAP TAB */}
          {activeTab === 'roadmap' && (
            <div className="space-y-4">
              <RoadmapCharts roadmap={fd.roadmap} />
              <RoadmapAlignment roadmap={fd.roadmap} jiraBaseUrl={resolvedData.meta.jiraBaseUrl} />
            </div>
          )}

          {/* PEOPLE TAB */}
          {activeTab === 'people' && (
            <div className="space-y-4">
              <PeopleCharts assignees={fd.assignees} />
              <FilterBar value={filter} onChange={setFilter} />
              <AssigneeBreakdown assignees={fd.assignees} jiraBaseUrl={resolvedData.meta.jiraBaseUrl} filter={filterLower} />
            </div>
          )}

          {/* COMPONENTS TAB */}
          {activeTab === 'components' && (
            <div className="space-y-4">
              <ComponentCharts components={fd.components} />
              <FilterBar value={filter} onChange={setFilter} />
              <ComponentBreakdown components={fd.components} jiraBaseUrl={resolvedData.meta.jiraBaseUrl} filter={filterLower} />
            </div>
          )}

          {/* TRENDS TAB */}
          {activeTab === 'trends' && (
            <TrendsView
              sprintSnapshots={
                isMultiTeam(rawData)
                  ? (rawData as MultiTeamData).trends.sprintSnapshots
                  : fd.trends?.sprintSnapshots || []
              }
              selectedTeam={selectedTeam}
            />
          )}

        </div>
      </div>
    </div>
  )
}

/* KPI Card */
function KpiCard({ label, value, sub, color }: { label: string; value: number | string; sub: string; color?: string }) {
  const colorClass = {
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
  }[color || ''] || 'text-white'

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-3 text-center">
      <div className={`text-2xl font-bold ${colorClass}`}>{value}</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">{label}</div>
      <div className="text-xs text-slate-400 mt-0.5">{sub}</div>
    </div>
  )
}

export default App
