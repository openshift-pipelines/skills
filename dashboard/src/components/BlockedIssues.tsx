import type { BlockedItem } from '../lib/types'
import { jiraUrl, truncate } from '../lib/utils'

interface BlockedIssuesProps {
  items: BlockedItem[]
  jiraBaseUrl: string
  filter: string
}

export function BlockedIssues({ items, jiraBaseUrl, filter }: BlockedIssuesProps) {
  const filteredItems = items.filter((item) => {
    if (!filter) return true
    const searchTerm = filter.toLowerCase()
    return (
      item.key.toLowerCase().includes(searchTerm) ||
      item.summary.toLowerCase().includes(searchTerm) ||
      item.assignee.toLowerCase().includes(searchTerm)
    )
  })

  const getPriorityBadge = (priority: string) => {
    const normalizedPriority = priority.toLowerCase()
    if (normalizedPriority.includes('critical') || normalizedPriority.includes('highest')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
          {priority}
        </span>
      )
    }
    if (normalizedPriority.includes('high')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/20 text-orange-400">
          {priority}
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400">
        {priority}
      </span>
    )
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
      <h3 className="text-xs uppercase text-slate-400 mb-3 font-semibold tracking-wider">
        Blocked Issues ({filteredItems.length})
      </h3>

      {filteredItems.length === 0 ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4 flex items-center gap-3">
          <svg
            className="w-5 h-5 text-emerald-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-emerald-400 font-medium">No blocked issues</span>
        </div>
      ) : (
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
                Priority
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Reason
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Assignee
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                PRs
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
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
                <td className="py-2 px-3">{getPriorityBadge(item.priority)}</td>
                <td className="py-2 px-3 text-slate-400">{item.reason}</td>
                <td className="py-2 px-3 text-slate-300">{item.assignee}</td>
                <td className="py-2 px-3">
                  {item.prs && item.prs.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {item.prs.map((pr, idx) => (
                        <a
                          key={idx}
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-purple-400 hover:text-purple-300 hover:underline text-xs"
                        >
                          {pr.status === 'MERGED' ? '✓' : pr.status === 'OPEN' ? '○' : '•'} {pr.name || 'PR'}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-600 text-xs">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
