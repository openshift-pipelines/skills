import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { DashboardData } from '../lib/types'

interface OverviewChartsProps {
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

const DOD_COLORS = ['#22c55e', '#eab308', '#ef4444', '#475569']
const ROADMAP_COLORS = ['#22c55e', '#eab308', '#ef4444']

function MiniDonut({ data, colors, centerLabel, centerValue }: {
  data: { name: string; value: number }[]
  colors: string[]
  centerLabel: string
  centerValue: string
}) {
  const filtered = data.filter(d => d.value > 0)
  if (filtered.length === 0) return null

  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={filtered}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={65}
            paddingAngle={2}
            dataKey="value"
            stroke="none"
          >
            {filtered.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' }}
            itemStyle={{ color: '#e2e8f0' }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-lg font-bold text-white">{centerValue}</div>
        <div className="text-[10px] text-slate-500 uppercase">{centerLabel}</div>
      </div>
    </div>
  )
}

export function OverviewCharts({ data }: OverviewChartsProps) {
  // Status distribution
  const statusData = Object.entries(data.summary.byStatus || {}).map(([name, { count }]) => ({
    name,
    value: count,
  })).filter(d => d.value > 0)

  const statusColors = statusData.map(d => STATUS_COLORS[d.name] || '#64748b')

  // SP by status
  const spData = Object.entries(data.summary.byStatus || {}).map(([name, { sp }]) => ({
    name,
    value: sp,
  })).filter(d => d.value > 0)

  const spColors = spData.map(d => STATUS_COLORS[d.name] || '#64748b')

  // DoD
  const dodData = [
    { name: 'Complete', value: data.dod.complete.count },
    { name: 'At Risk', value: data.dod.atRisk.count },
    { name: 'Incomplete', value: data.dod.incomplete.count },
    { name: 'N/A', value: data.dod.na.count },
  ]

  // Roadmap
  const roadmapData = [
    { name: 'Planned', value: data.roadmap.planned.sp },
    { name: 'Unplanned', value: data.roadmap.unplanned.sp },
    { name: 'CVE', value: data.roadmap.cve.sp },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Issues by Status */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 text-center">Issues by Status</div>
        <MiniDonut
          data={statusData}
          colors={statusColors}
          centerLabel="Issues"
          centerValue={String(data.summary.totalIssues)}
        />
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
          {statusData.slice(0, 4).map((d, i) => (
            <div key={d.name} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ background: statusColors[i] }} />
              {d.name}: {d.value}
            </div>
          ))}
        </div>
      </div>

      {/* SP Distribution */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 text-center">SP Distribution</div>
        <MiniDonut
          data={spData}
          colors={spColors}
          centerLabel="Story Points"
          centerValue={String(data.summary.totalSPs)}
        />
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
          {spData.slice(0, 4).map((d, i) => (
            <div key={d.name} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ background: spColors[i] }} />
              {d.name}: {d.value}
            </div>
          ))}
        </div>
      </div>

      {/* DoD Compliance */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 text-center">DoD Compliance</div>
        <MiniDonut
          data={dodData}
          colors={DOD_COLORS}
          centerLabel="Complete"
          centerValue={`${data.dod.complete.percent}%`}
        />
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
          {dodData.filter(d => d.value > 0).map((d, i) => (
            <div key={d.name} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ background: DOD_COLORS[i] }} />
              {d.name}: {d.value}
            </div>
          ))}
        </div>
      </div>

      {/* Roadmap Alignment */}
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-3">
        <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 text-center">Roadmap Alignment</div>
        <MiniDonut
          data={roadmapData}
          colors={ROADMAP_COLORS}
          centerLabel="Planned"
          centerValue={`${data.roadmap.planned.percent}%`}
        />
        <div className="flex flex-wrap gap-x-3 gap-y-1 justify-center mt-1">
          {roadmapData.filter(d => d.value > 0).map((d, i) => (
            <div key={d.name} className="flex items-center gap-1 text-[10px] text-slate-400">
              <span className="w-2 h-2 rounded-full" style={{ background: ROADMAP_COLORS[i] }} />
              {d.name}: {d.value} SP
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
