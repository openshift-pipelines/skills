import { useState } from 'react'
import type { DashboardData } from './lib/types'
import { HealthScore } from './components/HealthScore'
import { DaysRemaining } from './components/DaysRemaining'
import { FilterBar } from './components/FilterBar'
import { Alerts } from './components/Alerts'
import { SummaryCards } from './components/SummaryCards'
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
import { CollapsibleSection } from './components/CollapsibleSection'
import { formatDate } from './lib/utils'

declare global {
  interface Window {
    __DASHBOARD_DATA__: DashboardData | Record<string, never>
  }
}

function App() {
  const data = window.__DASHBOARD_DATA__ as DashboardData
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-1">
            <h1 className="text-2xl font-semibold text-white">
              Sprint Status: {data.meta.team}
            </h1>
            <HealthScore score={data.healthScore} completionPercent={data.completionPercent} />
          </div>
          <p className="text-sm text-slate-400">
            {data.meta.sprint.name} &middot; Ends {formatDate(data.meta.sprint.endDate)} &middot; Generated {formatDate(data.meta.generatedAt)}
          </p>
        </div>

        {/* Days Remaining + Completion */}
        <DaysRemaining
          daysRemaining={data.daysRemaining}
          sprintDay={data.sprintDay}
          sprintDuration={data.sprintDuration}
          completionPercent={data.completionPercent}
          completedSP={data.velocity.current.completed}
          totalSP={data.summary.totalSPs}
        />

        {/* Filter Bar */}
        <FilterBar value={filter} onChange={setFilter} />

        {/* Alerts */}
        <Alerts expectations={data.expectations} />

        {/* Summary Cards */}
        <SummaryCards summary={data.summary} />

        {/* Primary sections — always expanded */}
        <BlockedIssues items={data.blocked} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
        <HighPriorityBugs items={data.highPriorityBugs} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
        <CarryForward items={data.carryForward} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />

        {/* Secondary sections — collapsed by default */}
        <CollapsibleSection title="DoD Compliance" defaultOpen={false}>
          <DoDCompliance dod={data.dod} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
        </CollapsibleSection>

        <CollapsibleSection title="Code Review — SP Redo Recommendations" defaultOpen={false}>
          <CodeReviewRedo items={data.codeReview} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
        </CollapsibleSection>

        <CollapsibleSection title="Velocity Trend" defaultOpen={false}>
          <VelocityTrend velocity={data.velocity} />
        </CollapsibleSection>

        <CollapsibleSection title="Roadmap Alignment" defaultOpen={false}>
          <RoadmapAlignment roadmap={data.roadmap} jiraBaseUrl={data.meta.jiraBaseUrl} />
        </CollapsibleSection>

        <CollapsibleSection title={`Future Sprint${data.futureSprint.name ? ` — ${data.futureSprint.name}` : ''}`} defaultOpen={false}>
          <FutureSprint futureSprint={data.futureSprint} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
        </CollapsibleSection>

        <CollapsibleSection title={`Per-Assignee Breakdown (${Object.keys(data.assignees).length})`} defaultOpen={false}>
          <AssigneeBreakdown assignees={data.assignees} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
        </CollapsibleSection>

        <CollapsibleSection title={`Per-Component Breakdown (${Object.keys(data.components).length})`} defaultOpen={false}>
          <ComponentBreakdown components={data.components} jiraBaseUrl={data.meta.jiraBaseUrl} filter={filterLower} />
        </CollapsibleSection>
      </div>
    </div>
  )
}

export default App
