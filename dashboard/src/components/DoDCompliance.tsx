import type { DoD } from '../lib/types'
import { jiraUrl, truncate } from '../lib/utils'

interface DoDComplianceProps {
  dod: DoD
  jiraBaseUrl: string
  filter: string
}

export function DoDCompliance({ dod, jiraBaseUrl, filter }: DoDComplianceProps) {
  const nonCompliantIssues = dod.issues.filter(
    (issue) => issue.score === 'atRisk' || issue.score === 'incomplete'
  )

  const filteredIssues = nonCompliantIssues.filter((item) => {
    if (!filter) return true
    const searchTerm = filter.toLowerCase()
    return (
      item.key.toLowerCase().includes(searchTerm) ||
      item.summary.toLowerCase().includes(searchTerm)
    )
  })

  const getScoreBadge = (score: 'atRisk' | 'incomplete') => {
    if (score === 'atRisk') {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
          At Risk
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
        Incomplete
      </span>
    )
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
      <h3 className="text-xs uppercase text-slate-400 mb-3 font-semibold tracking-wider">
        Definition of Done Compliance
      </h3>

      {/* Summary bar */}
      <div className="mb-4">
        <div className="h-3 rounded-full overflow-hidden flex mb-2">
          {dod.complete.count > 0 && (
            <div
              className="bg-emerald-500"
              style={{ width: `${dod.complete.percent}%` }}
            />
          )}
          {dod.atRisk.count > 0 && (
            <div
              className="bg-amber-500"
              style={{ width: `${dod.atRisk.percent}%` }}
            />
          )}
          {dod.incomplete.count > 0 && (
            <div
              className="bg-red-500"
              style={{ width: `${dod.incomplete.percent}%` }}
            />
          )}
          {dod.na.count > 0 && (
            <div
              className="bg-slate-600"
              style={{ width: `${dod.na.percent}%` }}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-400">Complete ({dod.complete.count})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span className="text-slate-400">At Risk ({dod.atRisk.count})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span className="text-slate-400">Incomplete ({dod.incomplete.count})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-600" />
            <span className="text-slate-400">N/A ({dod.na.count})</span>
          </div>
        </div>
      </div>

      {/* Non-compliant issues table */}
      {filteredIssues.length === 0 ? (
        <div className="text-slate-500 text-sm py-4">
          {nonCompliantIssues.length === 0
            ? 'All issues are DoD compliant'
            : 'No matching non-compliant issues'}
        </div>
      ) : (
        <div>
          <h4 className="text-xs uppercase text-slate-500 mb-2 font-semibold tracking-wider">
            Non-Compliant Issues
          </h4>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Key
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Summary
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Status
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Score
                </th>
                <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Missing
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((item) => (
                <tr key={item.key} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                  <td className="py-2 px-3">
                    <a
                      href={jiraUrl(jiraBaseUrl, item.key)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 hover:underline font-mono text-sm"
                    >
                      {item.key}
                    </a>
                  </td>
                  <td className="py-2 px-3 text-slate-300">{truncate(item.summary, 50)}</td>
                  <td className="py-2 px-3 text-slate-400">{item.status}</td>
                  <td className="py-2 px-3">
                    {getScoreBadge(item.score as 'atRisk' | 'incomplete')}
                  </td>
                  <td className="py-2 px-3 text-slate-400 text-xs">
                    {item.missing.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
