import type { BugItem } from '../lib/types'
import { jiraUrl, truncate } from '../lib/utils'

interface HighPriorityBugsProps {
  items: BugItem[]
  jiraBaseUrl: string
  filter: string
}

export function HighPriorityBugs({ items, jiraBaseUrl, filter }: HighPriorityBugsProps) {
  const filteredItems = items.filter((item) => {
    if (!filter) return true
    const searchTerm = filter.toLowerCase()
    return (
      item.key.toLowerCase().includes(searchTerm) ||
      item.summary.toLowerCase().includes(searchTerm)
    )
  })

  if (filteredItems.length === 0) {
    return null
  }

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

  const getProximityDots = (proximity: 'done' | 'near' | 'mid' | 'far') => {
    const filledCount = proximity === 'done' ? 5 : proximity === 'near' ? 4 : proximity === 'mid' ? 2 : 0
    return (
      <div className="flex gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full ${
              i < filledCount ? 'bg-emerald-400' : 'bg-slate-700'
            }`}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
      <h3 className="text-xs uppercase text-slate-400 mb-3 font-semibold tracking-wider">
        High Priority Bugs — Closure Proximity
      </h3>

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
              Status
            </th>
            <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Proximity
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
              <td className="py-2 px-3 text-slate-400">{item.status}</td>
              <td className="py-2 px-3">{getProximityDots(item.proximity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
