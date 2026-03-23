import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import type { Roadmap } from '../lib/types'

interface RoadmapChartsProps {
  roadmap: Roadmap
}

const ROADMAP_COLORS = ['#22c55e', '#eab308', '#ef4444']

export function RoadmapCharts({ roadmap }: RoadmapChartsProps) {
  // Donut data
  const donutData = [
    { name: 'Planned', value: roadmap.planned.sp },
    { name: 'Unplanned', value: roadmap.unplanned.sp },
    { name: 'CVE', value: roadmap.cve.sp },
  ].filter(d => d.value > 0)

  // Epic progress data
  const epicData = (roadmap.epics || []).map(epic => ({
    name: epic.key,
    summary: epic.summary,
    completed: epic.completedSP,
    remaining: Math.max(0, epic.totalSP - epic.completedSP),
    total: epic.totalSP,
    percent: epic.totalSP > 0 ? Math.round((epic.completedSP / epic.totalSP) * 100) : 0,
  }))

  const tooltipStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '12px',
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Planned/Unplanned/CVE Donut */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Roadmap Alignment</div>
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
                  const colorIndex = ['Planned', 'Unplanned', 'CVE'].indexOf(entry.name)
                  return <Cell key={entry.name} fill={ROADMAP_COLORS[colorIndex >= 0 ? colorIndex : 0]} />
                })}
              </Pie>
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: '#e2e8f0' }}
                formatter={(value) => [`${value} SP`, '']}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <div className="text-2xl font-bold text-white">{roadmap.planned.percent}%</div>
            <div className="text-[10px] text-slate-500 uppercase">Planned</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
          {donutData.map((d) => {
            const colorIndex = ['Planned', 'Unplanned', 'CVE'].indexOf(d.name)
            return (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className="w-2 h-2 rounded-full" style={{ background: ROADMAP_COLORS[colorIndex >= 0 ? colorIndex : 0] }} />
                {d.name}: {d.value} SP
              </div>
            )
          })}
        </div>
      </div>

      {/* Epic Progress */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
        <div className="text-xs text-slate-500 uppercase tracking-wider mb-3 font-semibold">Epic Progress</div>
        {epicData.length === 0 ? (
          <div className="flex items-center justify-center h-[250px] text-sm text-slate-500">
            No epic data available
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={epicData} layout="vertical" margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fill: '#94a3b8', fontSize: 11 }} width={90} />
              <Tooltip
                contentStyle={tooltipStyle}
                itemStyle={{ color: '#e2e8f0' }}
                formatter={(value, name) => {
                  if (name === 'Completed') return [`${value} SP`, String(name)]
                  return [`${value} SP`, 'Remaining']
                }}
              />
              <Bar dataKey="completed" name="Completed" stackId="epic" fill="#22c55e" radius={[0, 0, 0, 0]} maxBarSize={20} />
              <Bar dataKey="remaining" name="Remaining" stackId="epic" fill="#334155" radius={[0, 4, 4, 0]} maxBarSize={20} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
