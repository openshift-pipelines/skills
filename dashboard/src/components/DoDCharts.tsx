import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { DoD } from '../lib/types'

interface DoDChartsProps {
  dod: DoD
}

const DOD_COLORS = ['#22c55e', '#eab308', '#ef4444', '#475569']

export function DoDCharts({ dod }: DoDChartsProps) {
  // Donut data
  const donutData = [
    { name: 'Complete', value: dod.complete.count },
    { name: 'At Risk', value: dod.atRisk.count },
    { name: 'Incomplete', value: dod.incomplete.count },
    { name: 'N/A', value: dod.na.count },
  ].filter(d => d.value > 0)

  // Count missing label types across all non-compliant issues
  const missingCounts: Record<string, number> = {}
  dod.issues.forEach(issue => {
    if (issue.score === 'atRisk' || issue.score === 'incomplete') {
      issue.missing.forEach(label => {
        missingCounts[label] = (missingCounts[label] || 0) + 1
      })
    }
  })

  const missingData = Object.entries(missingCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const tooltipStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '12px',
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* DoD Compliance Donut */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">DoD Compliance</div>
        <div className="relative">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {donutData.map((entry) => {
                  const colorIndex = ['Complete', 'At Risk', 'Incomplete', 'N/A'].indexOf(entry.name)
                  return <Cell key={entry.name} fill={DOD_COLORS[colorIndex >= 0 ? colorIndex : 3]} />
                })}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: '#e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-2xl font-bold text-white">{dod.complete.percent}%</div>
            <div className="text-[10px] text-slate-500 uppercase">Complete</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
          {donutData.map((d) => {
            const colorIndex = ['Complete', 'At Risk', 'Incomplete', 'N/A'].indexOf(d.name)
            return (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ background: DOD_COLORS[colorIndex >= 0 ? colorIndex : 3] }} />
                {d.name}: {d.value}
              </div>
            )
          })}
        </div>
      </div>

      {/* Missing Labels Bar Chart */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Missing Labels</div>
        {missingData.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-emerald-400">
            No missing labels - all issues compliant
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={missingData} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={140} />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: '#e2e8f0' }}
                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
              />
              <Bar dataKey="count" name="Issues" fill="#ef4444" radius={[0, 4, 4, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
