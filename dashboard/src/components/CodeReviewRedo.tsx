import type { CodeReviewItem } from '../lib/types'
import { jiraUrl, truncate } from '../lib/utils'

interface CodeReviewRedoProps {
  items: CodeReviewItem[]
  jiraBaseUrl: string
  filter: string
}

export function CodeReviewRedo({ items, jiraBaseUrl, filter }: CodeReviewRedoProps) {
  const filteredItems = items.filter((item) => {
    if (!filter) return true
    const searchTerm = filter.toLowerCase()
    return (
      item.key.toLowerCase().includes(searchTerm) ||
      item.summary.toLowerCase().includes(searchTerm) ||
      item.assignee.toLowerCase().includes(searchTerm)
    )
  })

  const totalCurrentSP = filteredItems.reduce((sum, item) => sum + item.currentSP, 0)
  const totalSuggestedSP = filteredItems.reduce((sum, item) => sum + item.suggestedSP, 0)

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
      <h3 className="text-xs uppercase text-slate-400 mb-3 font-semibold tracking-wider">
        Code Review Re-estimation
      </h3>

      {filteredItems.length === 0 ? (
        <div className="text-slate-500 text-sm py-4">No issues in Code Review</div>
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
                Current SP
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Original SP
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Suggested SP
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
                <td className="py-2 px-3 text-slate-300">{truncate(item.summary, 60)}</td>
                <td className="py-2 px-3 text-slate-300">{item.currentSP}</td>
                <td className="py-2 px-3 text-slate-400">
                  {item.originalSP !== null ? item.originalSP : '—'}
                  {item.alreadyReestimated && '*'}
                </td>
                <td className="py-2 px-3 text-amber-400 font-semibold">{item.suggestedSP}</td>
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
            <tr className="border-t-2 border-slate-700 font-bold">
              <td className="py-2 px-3" colSpan={2}>
                Total
              </td>
              <td className="py-2 px-3 text-slate-200">{totalCurrentSP}</td>
              <td className="py-2 px-3"></td>
              <td className="py-2 px-3 text-amber-400">{totalSuggestedSP}</td>
              <td className="py-2 px-3" colSpan={2}></td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  )
}
