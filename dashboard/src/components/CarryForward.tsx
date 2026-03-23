import type { CarryForwardItem } from '../lib/types'
import { jiraUrl, truncate } from '../lib/utils'

interface CarryForwardProps {
  items: CarryForwardItem[]
  jiraBaseUrl: string
  filter: string
}

export function CarryForward({ items, jiraBaseUrl, filter }: CarryForwardProps) {
  const filteredItems = items.filter((item) => {
    if (!filter) return true
    const searchTerm = filter.toLowerCase()
    return (
      item.key.toLowerCase().includes(searchTerm) ||
      item.summary.toLowerCase().includes(searchTerm)
    )
  })

  const getSprintCountClass = (severity: 'normal' | 'warning' | 'critical') => {
    if (severity === 'critical') {
      return 'text-red-400 font-bold'
    }
    if (severity === 'warning') {
      return 'text-amber-400 font-semibold'
    }
    return 'text-slate-300'
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
      <h3 className="text-xs uppercase text-slate-400 mb-3 font-semibold tracking-wider">
        Carry-Forward Worst Offenders
      </h3>

      {filteredItems.length === 0 ? (
        <div className="text-slate-500 text-sm py-4">No carry-forward issues</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Key
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Sprint Count
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Status
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Summary
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Latest Comment
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
                <td className={`py-2 px-3 ${getSprintCountClass(item.severity)}`}>
                  {item.sprintCount}
                </td>
                <td className="py-2 px-3 text-slate-400">{item.status}</td>
                <td className="py-2 px-3 text-slate-300">{truncate(item.summary, 45)}</td>
                <td className="py-2 px-3 text-slate-400 italic">
                  {truncate(item.latestComment, 50)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
