import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Velocity } from '../lib/types'

interface VelocityTrendProps {
  velocity: Velocity
}

export function VelocityTrend({ velocity }: VelocityTrendProps) {
  if (!velocity.history || velocity.history.length === 0) {
    return (
      <div className="text-slate-400 text-sm p-4">
        Insufficient data for velocity trend
      </div>
    )
  }

  const getTrendColor = (trend: string) => {
    if (trend.toLowerCase().includes('improving')) return 'text-emerald-500'
    if (trend.toLowerCase().includes('declining')) return 'text-red-500'
    return 'text-slate-400'
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={velocity.history}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis
            dataKey="sprint"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '6px',
              color: '#e2e8f0'
            }}
          />
          <Legend
            wrapperStyle={{ color: '#94a3b8', fontSize: 12 }}
          />
          <Bar dataKey="completed" stackId="a" fill="#10b981" name="Completed" />
          <Bar dataKey="carried" stackId="a" fill="#f59e0b" name="Carried" />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 text-xs text-slate-400 flex gap-4">
        <span>3-sprint avg: {velocity.avg3 ?? 'N/A'} SP</span>
        <span>|</span>
        <span>5-sprint avg: {velocity.avg5 ?? 'N/A'} SP</span>
        <span>|</span>
        <span>
          Trend: <span className={getTrendColor(velocity.trend)}>{velocity.trend}</span>
        </span>
      </div>
    </div>
  )
}
