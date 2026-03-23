import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import type { DashboardData } from '../lib/types'

interface IssuesChartsProps {
  data: DashboardData
}

const STATUS_COLORS: Record<string, string> = {
  'Closed': '#22c55e',
  'Verified': '#22c55e',
  'Release Pending': '#22c55e',
  'Code Review': '#eab308',
  'Dev Complete': '#eab308',
  'In Progress': '#3b82f6',
  'On QA': '#8b5cf6',
  'Testing': '#8b5cf6',
  'To Do': '#64748b',
  'New': '#64748b',
  'Planning': '#64748b',
}

const CATEGORY_COLORS = ['#ef4444', '#eab308', '#f97316', '#3b82f6', '#64748b']

export function IssuesCharts({ data }: IssuesChartsProps) {
  // SP by Status — horizontal bar chart
  const spByStatus = Object.entries(data.summary.byStatus || {})
    .map(([name, { sp }]) => ({ name, sp }))
    .filter(d => d.sp > 0)
    .sort((a, b) => b.sp - a.sp)

  // Issues by Category — pie chart
  const categoryData = [
    { name: 'Blocked', value: data.blocked.length },
    { name: 'Code Review', value: data.codeReview.length },
    { name: 'Carry Forward', value: data.carryForward.length },
    { name: 'High Priority Bugs', value: data.highPriorityBugs.length },
  ].filter(d => d.value > 0)

  // If no category data, compute "other" from total
  const categorizedCount = categoryData.reduce((sum, d) => sum + d.value, 0)
  const otherCount = data.summary.totalIssues - categorizedCount
  if (otherCount > 0) {
    categoryData.push({ name: 'Other', value: otherCount })
  }

  const tooltipStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '12px',
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* SP by Status */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">SP by Status</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={spByStatus} layout="vertical" margin={{ left: 10, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
            <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={100} />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#e2e8f0' }}
              cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
            />
            <Bar dataKey="sp" name="Story Points" radius={[0, 4, 4, 0]}>
              {spByStatus.map((entry) => (
                <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#64748b'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Issues by Category */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Issues by Category</div>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              label={({ name, value }) => `${name}: ${value}`}
            >
              {categoryData.map((_, i) => (
                <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#e2e8f0' }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
          {categoryData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
              {d.name}: {d.value}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
