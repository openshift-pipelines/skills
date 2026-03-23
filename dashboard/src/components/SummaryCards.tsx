import type { Summary } from '../lib/types'

interface SummaryCardsProps {
  summary: Summary
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const closedData = summary.byStatus['Closed'] || { count: 0, sp: 0 }
  const codeReviewData = summary.byStatus['Code Review'] || { count: 0, sp: 0 }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
        <div className="text-2xl font-bold text-white">{summary.totalIssues}</div>
        <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">
          Issues ({summary.totalSPs} SP)
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
        <div className="text-2xl font-bold text-emerald-400">{closedData.count}</div>
        <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">
          Completed ({closedData.sp} SP)
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
        <div className="text-2xl font-bold text-amber-400">{codeReviewData.count}</div>
        <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">
          Code Review ({codeReviewData.sp} SP)
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
        <div className="text-2xl font-bold text-red-400">{summary.blocked.count}</div>
        <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">
          Blocked ({summary.blocked.sp} SP)
        </div>
      </div>

      {summary.noStoryPoints > 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 text-center">
          <div className="text-2xl font-bold text-slate-500">{summary.noStoryPoints}</div>
          <div className="mt-1 text-xs uppercase tracking-wider text-slate-400">
            No Story Points
          </div>
        </div>
      )}
    </div>
  )
}
