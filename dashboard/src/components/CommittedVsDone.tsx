import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts'
import type { Velocity } from '../lib/types'

interface CommittedVsDoneProps {
  velocity: Velocity
}

export function CommittedVsDone({ velocity }: CommittedVsDoneProps) {
  // Build chart data from history + current sprint
  const historyData = (velocity.history || []).map(h => ({
    sprint: h.sprint,
    committed: h.committed,
    completed: h.completed,
    gap: h.committed - h.completed,
  }))

  // Add current sprint
  const allData = [
    ...historyData,
    {
      sprint: 'Current',
      committed: velocity.current.committed,
      completed: velocity.current.completed,
      gap: velocity.current.committed - velocity.current.completed,
    },
  ]

  if (allData.length === 0) {
    return (
      <div className="text-slate-400 text-sm p-4">
        Insufficient data for committed vs done chart
      </div>
    )
  }

  const tooltipStyle = {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '8px',
    fontSize: '12px',
  }

  const maxValue = Math.max(...allData.map(d => Math.max(d.committed, d.completed))) * 1.15

  return (
    <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
          Committed vs Done — SP Gap
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-1.5 rounded-sm bg-blue-400/50 border border-blue-400 inline-block" />
            Committed
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-1.5 rounded-sm bg-emerald-500 inline-block" />
            Completed
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={allData} barGap={4} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="sprint"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickLine={{ stroke: '#475569' }}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            domain={[0, maxValue]}
            tickLine={{ stroke: '#475569' }}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            itemStyle={{ color: '#e2e8f0' }}
            formatter={(value, name) => {
              return [value + ' SP', String(name)]
            }}
            labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
          />
          <Legend content={() => null} />
          <ReferenceLine y={0} stroke="#475569" />
          <Bar dataKey="committed" name="Committed" radius={[4, 4, 0, 0]} maxBarSize={40}>
            {allData.map((_, index) => (
              <Cell
                key={index}
                fill="rgba(59, 130, 246, 0.2)"
                stroke="#3b82f6"
                strokeWidth={2}
              />
            ))}
          </Bar>
          <Bar dataKey="completed" name="Completed" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>

      {/* Gap indicators below the chart */}
      <div className="flex justify-around mt-2 px-8">
        {allData.map((d) => (
          <div key={d.sprint} className="text-center">
            <span className={`text-xs font-bold ${d.gap > 0 ? 'text-red-400' : d.gap < 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
              {d.gap > 0 ? `-${d.gap} SP` : d.gap < 0 ? `+${Math.abs(d.gap)} SP` : '0 SP'}
            </span>
          </div>
        ))}
      </div>

      {/* Averages */}
      <div className="flex gap-6 mt-3 text-xs text-slate-400">
        <span>
          Avg gap:{' '}
          <span className="text-red-400 font-medium">
            {allData.length > 0
              ? (allData.reduce((s, d) => s + d.gap, 0) / allData.length).toFixed(1)
              : '0'} SP
          </span>
        </span>
        <span>
          Commitment accuracy:{' '}
          <span className="text-white font-medium">
            {velocity.commitmentAccuracy && velocity.commitmentAccuracy.length > 0
              ? velocity.commitmentAccuracy[velocity.commitmentAccuracy.length - 1] + '%'
              : 'N/A'}
          </span>
        </span>
      </div>
    </div>
  )
}
