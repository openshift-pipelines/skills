import type { Roadmap } from '../lib/types'
import { jiraUrl, truncate } from '../lib/utils'

interface RoadmapAlignmentProps {
  roadmap: Roadmap
  jiraBaseUrl: string
}

export function RoadmapAlignment({ roadmap, jiraBaseUrl }: RoadmapAlignmentProps) {
  return (
    <div className="space-y-4">
      {/* Stacked progress bar */}
      <div className="h-6 rounded-full overflow-hidden flex bg-slate-800">
        {roadmap.planned.percent > 0 && (
          <div
            className="bg-emerald-500"
            style={{ width: `${roadmap.planned.percent}%` }}
          />
        )}
        {roadmap.unplanned.percent > 0 && (
          <div
            className="bg-amber-500"
            style={{ width: `${roadmap.unplanned.percent}%` }}
          />
        )}
        {roadmap.cve.percent > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${roadmap.cve.percent}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span className="text-slate-300">
            Planned: {roadmap.planned.sp} SP ({roadmap.planned.percent}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-slate-300">
            Unplanned: {roadmap.unplanned.sp} SP ({roadmap.unplanned.percent}%)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-slate-300">
            CVE: {roadmap.cve.sp} SP ({roadmap.cve.percent}%)
          </span>
        </div>
      </div>

      {/* Untracked warning */}
      {roadmap.untrackedCount > 0 && (
        <div className="bg-amber-900/30 border border-amber-600 rounded-lg p-3 text-sm text-amber-300">
          Warning: {roadmap.untrackedCount} issue{roadmap.untrackedCount !== 1 ? 's' : ''} not tracked in epics
        </div>
      )}

      {/* Epic progress table */}
      {roadmap.epics && roadmap.epics.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Key</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Summary</th>
                <th className="text-left py-2 px-3 text-slate-400 font-medium">Progress</th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">SPs</th>
              </tr>
            </thead>
            <tbody>
              {roadmap.epics.map((epic) => {
                const progressPercent = epic.totalSP > 0
                  ? (epic.completedSP / epic.totalSP) * 100
                  : 0

                return (
                  <tr key={epic.key} className="border-b border-slate-800">
                    <td className="py-2 px-3">
                      <a
                        href={jiraUrl(jiraBaseUrl, epic.key)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {epic.key}
                      </a>
                    </td>
                    <td className="py-2 px-3 text-slate-200">
                      {truncate(epic.summary, 50)}
                    </td>
                    <td className="py-2 px-3">
                      <div className="w-24 h-2 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-200">
                      {epic.completedSP}/{epic.totalSP}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
