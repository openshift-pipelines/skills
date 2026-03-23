import { useState } from 'react'
import type { ComponentData } from '../lib/types'
import { jiraUrl, truncate } from '../lib/utils'

interface ComponentBreakdownProps {
  components: Record<string, ComponentData>
  jiraBaseUrl: string
  filter: string
}

export function ComponentBreakdown({ components, jiraBaseUrl, filter }: ComponentBreakdownProps) {
  const [openComponents, setOpenComponents] = useState<Record<string, boolean>>({})

  const toggleComponent = (name: string) => {
    setOpenComponents(prev => ({ ...prev, [name]: !prev[name] }))
  }

  const getStatusBadgeColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes('closed') || statusLower.includes('done')) return 'bg-emerald-600'
    if (statusLower.includes('code review')) return 'bg-amber-600'
    if (statusLower.includes('in progress')) return 'bg-blue-600'
    return 'bg-slate-600'
  }

  const getPriorityBadgeColor = (priority: string) => {
    const priorityLower = priority.toLowerCase()
    if (priorityLower.includes('critical') || priorityLower.includes('highest')) return 'bg-red-600'
    if (priorityLower.includes('high')) return 'bg-orange-600'
    if (priorityLower.includes('medium')) return 'bg-yellow-600'
    return 'bg-slate-600'
  }

  // Filter components
  const filteredComponents = Object.entries(components).filter(([name, data]) => {
    if (!filter) return true
    const filterLower = filter.toLowerCase()
    if (name.toLowerCase().includes(filterLower)) return true
    return data.issues.some(issue =>
      issue.key.toLowerCase().includes(filterLower) ||
      issue.summary.toLowerCase().includes(filterLower)
    )
  })

  // Sort by totalSP descending
  const sortedComponents = filteredComponents.sort((a, b) => b[1].totalSP - a[1].totalSP)

  if (sortedComponents.length === 0) {
    return (
      <div className="text-slate-400 text-sm p-4">
        No components match the current filter
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sortedComponents.map(([name, data]) => {
        const isOpen = openComponents[name] || false

        // Calculate status counts
        const statusCounts: Record<string, number> = {}
        data.issues.forEach(issue => {
          statusCounts[issue.status] = (statusCounts[issue.status] || 0) + 1
        })

        return (
          <div key={name} className="bg-slate-900 rounded-lg border border-slate-800">
            {/* Header */}
            <button
              onClick={() => toggleComponent(name)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors"
            >
              <span className="text-slate-200 font-medium">
                {name} — {data.totalIssues} issue{data.totalIssues !== 1 ? 's' : ''}, {data.totalSP} SP
              </span>
              <svg
                className={`w-5 h-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Content */}
            {isOpen && (
              <div className="px-4 pb-4 space-y-3">
                {/* Status summary */}
                <div className="text-xs text-slate-400">
                  {Object.entries(statusCounts).map(([status, count], idx) => (
                    <span key={status}>
                      {idx > 0 && ' | '}
                      {status}: {count}
                    </span>
                  ))}
                </div>

                {/* Blocked alert */}
                {data.blocked > 0 && (
                  <div className="bg-red-900/30 border border-red-600 rounded-lg p-2 text-sm text-red-300">
                    {data.blocked} blocked issue{data.blocked !== 1 ? 's' : ''}
                  </div>
                )}

                {/* High priority bugs alert */}
                {data.highPriorityBugs > 0 && (
                  <div className="bg-amber-900/30 border border-amber-600 rounded-lg p-2 text-sm text-amber-300">
                    {data.highPriorityBugs} high priority bug{data.highPriorityBugs !== 1 ? 's' : ''}
                  </div>
                )}

                {/* Issues table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left py-2 px-2 text-slate-400 font-medium">Key</th>
                        <th className="text-left py-2 px-2 text-slate-400 font-medium">Summary</th>
                        <th className="text-left py-2 px-2 text-slate-400 font-medium">Status</th>
                        <th className="text-right py-2 px-2 text-slate-400 font-medium">SP</th>
                        <th className="text-left py-2 px-2 text-slate-400 font-medium">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.issues.map((issue) => (
                        <tr key={issue.key} className="border-b border-slate-800">
                          <td className="py-2 px-2">
                            <a
                              href={jiraUrl(jiraBaseUrl, issue.key)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-400 hover:text-blue-300"
                            >
                              {issue.key}
                            </a>
                          </td>
                          <td className="py-2 px-2 text-slate-200">
                            {truncate(issue.summary, 50)}
                          </td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-1 rounded text-xs text-white ${getStatusBadgeColor(issue.status)}`}>
                              {issue.status}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-right text-slate-200">
                            {issue.sp}
                          </td>
                          <td className="py-2 px-2">
                            <span className={`px-2 py-1 rounded text-xs text-white ${getPriorityBadgeColor(issue.priority)}`}>
                              {issue.priority}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
