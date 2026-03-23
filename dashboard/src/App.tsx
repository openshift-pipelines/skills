import { useState } from 'react'
import type { DashboardData } from './lib/types'
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
import { formatDate } from './lib/utils'

declare global {
  interface Window {
    __DASHBOARD_DATA__: DashboardData | Record<string, never>
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
] as const

type TabId = typeof TABS[number]['id']

function App() {
  const data = window.__DASHBOARD_DATA__ as DashboardData
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const [filter, setFilter] = useState('')

  const hasData = data && data.meta && data.summary

  if (!hasData) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-400 text-lg">No data loaded.</div>
      </div>
    )
  }

  const filterLower = filter.toLowerCase()
  const closedStatus = data.summary.byStatus?.['Closed'] || { count: 0, sp: 0 }
  const crStatus = data.summary.byStatus?.['Code Review'] || { count: 0, sp: 0 }
  const criticalCF = data.carryForward?.filter(i => i.severity === 'critical').length || 0
  const progressPct = data.sprintDuration > 0 ? Math.round((data.sprintDay / data.sprintDuration) * 100) : 0

  return (
    <div className="h-screen bg-slate-950 text-slate-200 flex flex-col overflow-hidden">
      {/* ─── Top Bar ─── */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-950 px-6 py-3">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-white">{data.meta.sprint.name}</h1>
            <HealthScore score={data.healthScore} completionPercent={data.completionPercent} />
          </div>
          <p className="text-xs text-slate-500">
            Ends {formatDate(data.meta.sprint.endDate)} &middot; Generated {formatDate(data.meta.generatedAt)}
          </p>
        </div>
      </div>

      {/* ─── Tab Navigation ─── */}
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
              {tab.id === 'issues' && data.blocked.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-400">
                  {data.blocked.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Content Area ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto px-6 py-4">

          {/* ════════ OVERVIEW TAB ════════ */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Row 1: Sprint Progress + Completion */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Sprint Timeline */}
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Sprint Timeline</div>
                  <div className="text-2xl font-bold text-white">Day {data.sprintDay} <span className="text-base font-normal text-slate-400">of {data.sprintDuration}</span></div>
                  <div className="text-sm text-slate-400 mt-1">{data.daysRemaining} days remaining</div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                </div>

                {/* Completion */}
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Completion</div>
                  <div className="text-4xl font-bold text-white">{data.completionPercent}%</div>
                  <div className="text-sm text-slate-400 mt-1">{data.velocity.current.completed} / {data.summary.totalSPs} SP</div>
                  <div className="mt-3 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${data.completionPercent}%` }} />
                  </div>
                </div>

                {/* DoD + Roadmap */}
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Health Indicators</div>
                  <div className="space-y-2 mt-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">DoD Compliance</span>
                      <span className="text-white font-medium">{data.dod.complete.percent}% complete</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Roadmap Alignment</span>
                      <span className="text-white font-medium">{data.roadmap.planned.percent}% planned</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Velocity Avg (3-sprint)</span>
                      <span className="text-white font-medium">{data.velocity.avg3 ?? 'N/A'} SP</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Key Numbers */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <KpiCard label="Total Issues" value={data.summary.totalIssues} sub={`${data.summary.totalSPs} SP`} />
                <KpiCard label="Completed" value={closedStatus.count} sub={`${closedStatus.sp} SP`} color="emerald" />
                <KpiCard label="Code Review" value={crStatus.count} sub={`${crStatus.sp} SP`} color="amber" />
                <KpiCard label="Blocked" value={data.summary.blocked.count} sub={`${data.summary.blocked.sp} SP`} color={data.summary.blocked.count > 0 ? 'red' : 'emerald'} />
                <KpiCard label="Carry-Forward" value={criticalCF} sub={`critical (5+ sprints)`} color={criticalCF > 0 ? 'red' : 'emerald'} />
              </div>

              {/* Row 3: Visual Charts */}
              <OverviewCharts data={data} />

              {/* Row 4: Alerts */}
              <Alerts expectations={data.expectations} />

              {/* Row 4: Quick Glance Tables (side by side) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Top Blocked / Carry-Forward */}
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      Blocked Issues ({data.blocked.length})
                    </h3>
                    {data.blocked.length > 0 && (
                      <button onClick={() => setActiveTab('issues')} className="text-xs text-blue-400 hover:text-blue-300">View all &rarr;</button>
                    )}
                  </div>
                  {data.blocked.length === 0 ? (
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> No blocked issues
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {data.blocked.slice(0, 3).map(item => (
                        <div key={item.key} className="flex items-center gap-3 text-sm">
                          <a href={`${data.meta.jiraBaseUrl}/browse/${item.key}`} target="_blank" className="text-blue-400 hover:underline font-mono text-xs">{item.key}</a>
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
                      Carry-Forward Worst ({data.carryForward.filter(i => i.severity !== 'normal').length})
                    </h3>
                    <button onClick={() => setActiveTab('issues')} className="text-xs text-blue-400 hover:text-blue-300">View all &rarr;</button>
                  </div>
                  <div className="space-y-2">
                    {data.carryForward.filter(i => i.severity !== 'normal').slice(0, 3).map(item => (
                      <div key={item.key} className="flex items-center gap-3 text-sm">
                        <a href={`${data.meta.jiraBaseUrl}/browse/${item.key}`} target="_blank" className="text-blue-400 hover:underline font-mono text-xs">{item.key}</a>
                        <span className="text-slate-300 truncate flex-1">{item.summary}</span>
                        <span className={`text-xs font-bold ${item.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}`}>
                          {item.sprintCount} sprints
                        </span>
                      </div>
                    ))}
                    {data.carryForward.filter(i => i.severity !== 'normal').length === 0 && (
                      <div className="text-sm text-slate-500">No chronic carry-forwards</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ════════ ISSUES TAB ════════ */}
          {activeTab === 'issues' && (
            <div className="space-y-4">
              <FilterBar value={filter} onChange={setFilter} />
              <BlockedIssues items={data.blocked} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
              <CodeReviewRedo items={data.codeReview} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
              <CarryForward items={data.carryForward} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
              <HighPriorityBugs items={data.highPriorityBugs} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
              <FutureSprint futureSprint={data.futureSprint} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
            </div>
          )}

          {/* ════════ VELOCITY TAB ════════ */}
          {activeTab === 'velocity' && (
            <div className="space-y-4">
              <VelocityTrend velocity={data.velocity} />
              <Alerts expectations={data.expectations} />
            </div>
          )}

          {/* ════════ DOD TAB ════════ */}
          {activeTab === 'dod' && (
            <div className="space-y-4">
              <FilterBar value={filter} onChange={setFilter} />
              <DoDCompliance dod={data.dod} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
            </div>
          )}

          {/* ════════ ROADMAP TAB ════════ */}
          {activeTab === 'roadmap' && (
            <div className="space-y-4">
              <RoadmapAlignment roadmap={data.roadmap} jiraBaseUrl={data.meta.jiraBaseUrl} />
            </div>
          )}

          {/* ════════ PEOPLE TAB ════════ */}
          {activeTab === 'people' && (
            <div className="space-y-4">
              <FilterBar value={filter} onChange={setFilter} />
              <AssigneeBreakdown assignees={data.assignees} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
            </div>
          )}

          {/* ════════ COMPONENTS TAB ════════ */}
          {activeTab === 'components' && (
            <div className="space-y-4">
              <FilterBar value={filter} onChange={setFilter} />
              <ComponentBreakdown components={data.components} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

/* ─── KPI Card ─── */
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
