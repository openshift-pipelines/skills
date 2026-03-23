import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { AssigneeData } from '../lib/types'

interface PeopleChartsProps {
  assignees: Record<string, AssigneeData>
}

const STATUS_BUCKETS: { key: string; label: string; color: string; match: (s: string) => boolean }[] = [
  { key: 'closed', label: 'Closed', color: '#22c55e', match: s => s.includes('closed') || s.includes('done') || s.includes('verified') || s.includes('release pending') },
  { key: 'inProgress', label: 'In Progress', color: '#3b82f6', match: s => s.includes('in progress') || s.includes('dev complete') || s.includes('on qa') || s.includes('testing') },
  { key: 'codeReview', label: 'Code Review', color: '#eab308', match: s => s.includes('code review') },
  { key: 'todo', label: 'To Do', color: '#64748b', match: s => s.includes('to do') || s.includes('new') || s.includes('planning') },
]

function bucketStatus(status: string): string {
  const lower = status.toLowerCase()
  for (const bucket of STATUS_BUCKETS) {
    if (bucket.match(lower)) return bucket.key
  }
  return 'todo'
}

export function PeopleCharts({ assignees }: PeopleChartsProps) {
  // Build stacked bar data per assignee
  const chartData = Object.entries(assignees)
    .map(([name, data]) => {
      const buckets: Record<string, number> = { closed: 0, inProgress: 0, codeReview: 0, todo: 0 }
      data.issues.forEach(issue => {
        const bucket = bucketStatus(issue.status)
        buckets[bucket] += issue.sp
      })
      return {
        name: name.length > 12 ? name.slice(0, 12) + '...' : name,
        fullName: name,
        closed: buckets.closed,
        inProgress: buckets.inProgress,
        codeReview: buckets.codeReview,
        todo: buckets.todo,
        total: data.totalSP,
      }
    })
    .sort((a, b) => b.total - a.total)

  if (chartData.length === 0) {
    return (
      <div className="text-slate-400 text-sm p-4">
        No assignee data available
      </div>
    )
  }

  const tooltipStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '12px',
  }

  const chartHeight = Math.max(200, chartData.length * 32 + 40)

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">SP per Assignee by Status</div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={{ color: '#e2e8f0' }}
            labelFormatter={(label) => {
              const entry = chartData.find(d => d.name === label)
              return entry ? `${entry.fullName} (${entry.total} SP)` : label
            }}
            cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
          />
          <Legend
            wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }}
          />
          {STATUS_BUCKETS.map(bucket => (
            <Bar
              key={bucket.key}
              dataKey={bucket.key}
              name={bucket.label}
              stackId="status"
              fill={bucket.color}
              maxBarSize={20}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
