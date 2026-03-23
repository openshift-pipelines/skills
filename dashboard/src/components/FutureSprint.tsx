import type { FutureSprintItem } from '../lib/types'
import { jiraUrl, truncate } from '../lib/utils'

interface FutureSprintProps {
  futureSprint: { name: string; issues: FutureSprintItem[] }
  jiraBaseUrl: string
  filter: string
}

export function FutureSprint({ futureSprint, jiraBaseUrl, filter }: FutureSprintProps) {
  const filteredItems = futureSprint.issues.filter((item) => {
    if (!filter) return true
    const searchTerm = filter.toLowerCase()
    return (
      item.key.toLowerCase().includes(searchTerm) ||
      item.summary.toLowerCase().includes(searchTerm)
    )
  })

  if (filteredItems.length === 0 && futureSprint.issues.length === 0) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
        <h3 className="text-xs uppercase text-slate-400 mb-3 font-semibold tracking-wider">
          Future Sprint
        </h3>
        <div className="text-slate-500 text-sm py-4">No future sprint found</div>
      </div>
    )
  }

  const getTypeTag = (type: string) => {
    const normalizedType = type.toLowerCase()
    if (normalizedType.includes('vulnerability')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
          {type}
        </span>
      )
    }
    if (normalizedType.includes('bug')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
          {type}
        </span>
      )
    }
    if (normalizedType.includes('story')) {
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/20 text-blue-400">
          {type}
        </span>
      )
    }
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-500/20 text-slate-400">
        {type}
      </span>
    )
  }

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-4">
      <h3 className="text-xs uppercase text-slate-400 mb-3 font-semibold tracking-wider">
        Future Sprint: {futureSprint.name}
      </h3>

      {filteredItems.length === 0 ? (
        <div className="text-slate-500 text-sm py-4">No matching issues</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Rank
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Key
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Summary
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Type
              </th>
              <th className="text-left py-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Priority
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.key} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-2 px-3 text-slate-400 font-mono">#{item.rank}</td>
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
                <td className="py-2 px-3">{getTypeTag(item.type)}</td>
                <td className="py-2 px-3 text-slate-400">{item.priority}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
