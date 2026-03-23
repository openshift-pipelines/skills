import type { DashboardData } from '../lib/types'
import { AlertTriangle, UserX, Clock, TrendingDown, Scissors } from 'lucide-react'

interface ActionableInsightsProps {
  data: DashboardData
}

interface Insight {
  type: 'danger' | 'warning' | 'info'
  icon: React.ReactNode
  title: string
  detail: string
  action: string
}

export function ActionableInsights({ data }: ActionableInsightsProps) {
  const insights: Insight[] = []

  // --- WHO NEEDS HELP? ---

  // Assignees with blocked issues
  for (const [name, assigneeData] of Object.entries(data.assignees || {})) {
    if (assigneeData.blocked > 0) {
      insights.push({
        type: 'danger',
        icon: <UserX className="w-4 h-4" />,
        title: `${name.split(' ')[0]} has ${assigneeData.blocked} blocked issue(s)`,
        detail: `${assigneeData.totalSP} SP committed, ${assigneeData.blocked} blocked`,
        action: 'Escalate blockers — unblock this person'
      })
    }
  }

  // Code Review bottleneck per person
  for (const [name, assigneeData] of Object.entries(data.assignees || {})) {
    const crIssues = assigneeData.issues.filter(i => i.status === 'Code Review')
    if (crIssues.length >= 2) {
      const crSP = crIssues.reduce((s, i) => s + (i.sp || 0), 0)
      insights.push({
        type: 'warning',
        icon: <Clock className="w-4 h-4" />,
        title: `${name.split(' ')[0]} has ${crIssues.length} issues stuck in Code Review`,
        detail: `${crSP} SP waiting for review`,
        action: 'Nudge reviewers — these SPs are stuck'
      })
    }
  }

  // Overloaded assignees (SP > 1.5x team average)
  const assigneeEntries = Object.entries(data.assignees || {})
  if (assigneeEntries.length > 1) {
    const avgSP = assigneeEntries.reduce((s, [, d]) => s + d.totalSP, 0) / assigneeEntries.length
    for (const [name, assigneeData] of assigneeEntries) {
      if (assigneeData.totalSP > avgSP * 1.5 && assigneeData.totalSP > 5) {
        insights.push({
          type: 'warning',
          icon: <TrendingDown className="w-4 h-4" />,
          title: `${name.split(' ')[0]} is overloaded`,
          detail: `${assigneeData.totalSP} SP (team avg: ${Math.round(avgSP)} SP) — ${Math.round((assigneeData.totalSP / avgSP) * 100 - 100)}% above average`,
          action: 'Consider redistributing work'
        })
      }
    }
  }

  // --- WHAT'S AT RISK? ---

  // High SP unstarted issues with few days left
  const unstartedHighSP = Object.values(data.assignees || {})
    .flatMap(a => a.issues)
    .filter(i => (i.status === 'To Do' || i.status === 'New') && (i.sp || 0) >= 3)

  if (unstartedHighSP.length > 0 && data.daysRemaining <= Math.ceil(data.sprintDuration / 2)) {
    const totalUnstartedSP = unstartedHighSP.reduce((s, i) => s + (i.sp || 0), 0)
    insights.push({
      type: 'danger',
      icon: <AlertTriangle className="w-4 h-4" />,
      title: `${unstartedHighSP.length} high-SP issues not started with ${data.daysRemaining} days left`,
      detail: `${totalUnstartedSP} SP still in To Do/New`,
      action: 'These likely won\'t complete — consider descoping'
    })
  }

  // --- SPRINT REALITY CHECK ---

  // Projected completion
  if (data.sprintDay > 2 && data.sprintDuration > 0) {
    const dailyRate = data.velocity.current.completed / Math.max(data.sprintDay, 1)
    const projected = Math.round(dailyRate * data.sprintDuration)
    const gap = data.summary.totalSPs - projected

    if (gap > 5) {
      // Find descope candidates: lowest priority unstarted issues
      const descopes = Object.values(data.assignees || {})
        .flatMap(a => a.issues)
        .filter(i => i.status === 'To Do' || i.status === 'New')
        .sort((a, b) => (a.sp || 0) - (b.sp || 0))
        .slice(0, 3)

      const descopeList = descopes.length > 0
        ? ` Consider descoping: ${descopes.map(d => d.key).join(', ')}`
        : ''

      insights.push({
        type: 'warning',
        icon: <Scissors className="w-4 h-4" />,
        title: `At current pace, ~${projected} of ${data.summary.totalSPs} SP will complete`,
        detail: `Gap: ${gap} SP. Daily rate: ${dailyRate.toFixed(1)} SP/day.${descopeList}`,
        action: 'Descope lowest-priority unstarted issues or rally the team'
      })
    }
  }

  if (insights.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg border border-emerald-800/30 p-4">
        <div className="flex items-center gap-2 text-emerald-400 text-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          No actionable issues detected — sprint is on track
        </div>
      </div>
    )
  }

  const bgMap = {
    danger: 'border-l-red-500 bg-red-500/5',
    warning: 'border-l-amber-500 bg-amber-500/5',
    info: 'border-l-blue-500 bg-blue-500/5',
  }

  const iconColorMap = {
    danger: 'text-red-400',
    warning: 'text-amber-400',
    info: 'text-blue-400',
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
        Actionable Insights ({insights.length})
      </h3>
      <div className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className={`rounded-lg border-l-4 p-3 ${bgMap[insight.type]}`}>
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 ${iconColorMap[insight.type]}`}>
                {insight.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">{insight.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">{insight.detail}</div>
                <div className="text-xs text-blue-400 mt-1 font-medium">{insight.action}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
