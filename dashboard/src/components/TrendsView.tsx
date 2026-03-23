import { useState } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area
} from 'recharts'
import type { SprintSnapshot } from '../lib/types'

interface TrendsViewProps {
  sprintSnapshots: SprintSnapshot[]
}

const tooltipStyle = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '12px' },
  itemStyle: { color: '#e2e8f0' },
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</h3>
      {children}
    </div>
  )
}

export function TrendsView({ sprintSnapshots }: TrendsViewProps) {
  const [range, setRange] = useState<'all' | '10' | '5'>('all')

  if (!sprintSnapshots || sprintSnapshots.length < 2) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8 text-center">
        <div className="text-slate-400 text-sm">Not enough historical data yet. Run <code className="text-blue-400">node bin/sprint-status.js</code> across multiple sprints to build trend data.</div>
        <div className="text-slate-500 text-xs mt-2">Current snapshots: {sprintSnapshots?.length || 0}</div>
      </div>
    )
  }

  // Apply range filter
  let data = [...sprintSnapshots].sort((a, b) => new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime())
  if (range === '10') data = data.slice(-10)
  if (range === '5') data = data.slice(-5)

  // Deduplicate by sprint name (keep latest snapshot per sprint)
  const bySprintName = new Map<string, SprintSnapshot>()
  data.forEach(s => bySprintName.set(s.sprintName, s))
  data = Array.from(bySprintName.values())

  // Shorten sprint names for labels
  const chartData = data.map(s => ({
    ...s,
    label: s.sprintName.replace('Pipelines Sprint ', '').replace(/\s+/g, ' '),
    gap: s.totalSPs - s.completedSPs,
    carriedSPs: s.totalSPs - s.completedSPs,
    codeReviewPct: s.totalSPs > 0 ? Math.round((s.codeReviewSPs / s.totalSPs) * 100) : 0,
  }))

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Multi-Sprint Trends ({data.length} sprints)</h2>
        <div className="flex bg-slate-800 rounded-lg p-0.5">
          {[
            { id: '5' as const, label: 'Last 5' },
            { id: '10' as const, label: 'Last 10' },
            { id: 'all' as const, label: 'All' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setRange(opt.id)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                range === opt.id ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Committed vs Done + Completion Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Committed vs Completed SP (Gap Analysis)">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Bar dataKey="totalSPs" fill="#3b82f6" name="Committed" opacity={0.4} />
              <Bar dataKey="completedSPs" fill="#22c55e" name="Completed" />
              <Line dataKey="gap" stroke="#ef4444" name="Gap" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Completion Rate %">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Line dataKey="completionPercent" stroke="#22c55e" strokeWidth={2} name="Completion %" dot={{ fill: '#22c55e', r: 3 }} />
              {/* Threshold lines */}
              <Line dataKey={() => 70} stroke="#22c55e" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Target (70%)" />
              <Line dataKey={() => 50} stroke="#eab308" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Warning (50%)" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 2: Carry-Forward + Blocked */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Carry-Forward Issues">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Bar dataKey="carryForwardCount" fill="#eab308" name="Total Carry-Forward" />
              <Line dataKey="carryForwardCriticalCount" stroke="#ef4444" strokeWidth={2} name="Critical (5+ sprints)" dot={{ fill: '#ef4444', r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Blocked Issues">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="blockedCount" fill="#ef4444" name="Blocked Issues" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3: DoD Compliance + Code Review Bottleneck */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="DoD Compliance Trend">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Line dataKey="dodCompletePercent" stroke="#22c55e" strokeWidth={2} name="Complete %" dot={{ fill: '#22c55e', r: 3 }} />
              <Line dataKey="dodAtRiskPercent" stroke="#eab308" strokeWidth={2} name="At Risk %" dot={{ fill: '#eab308', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Code Review as % of Sprint Capacity">
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Area dataKey="codeReviewPct" fill="#eab308" fillOpacity={0.2} stroke="#eab308" strokeWidth={2} name="Code Review %" />
              <Line dataKey={() => 30} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Threshold (30%)" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 4: Roadmap Alignment + Health Score */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Roadmap Alignment Trend">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
              <Bar dataKey="plannedPercent" stackId="a" fill="#22c55e" name="Planned %" />
              <Bar dataKey="unplannedPercent" stackId="a" fill="#eab308" name="Unplanned %" />
              <Bar dataKey="cvePercent" stackId="a" fill="#ef4444" name="CVE %" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Sprint Health Score">
          <div className="flex items-center gap-3 flex-wrap mt-2">
            {chartData.map((s, i) => {
              const bg = s.healthScore === 'green' ? 'bg-emerald-500' : s.healthScore === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
              return (
                <div key={i} className="text-center">
                  <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center text-[10px] font-bold text-white`}>
                    {s.completionPercent}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-1 max-w-[60px] truncate">{s.label}</div>
                </div>
              )
            })}
          </div>
          <div className="flex gap-4 mt-4 text-[10px] text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Good (&ge;70%)</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Warning</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> At Risk (&lt;50%)</span>
          </div>
        </ChartCard>
      </div>
    </div>
  )
}
