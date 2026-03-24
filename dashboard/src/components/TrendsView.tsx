import { useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ComposedChart, Area
} from 'recharts'
import type { SprintSnapshot } from '../lib/types'

interface TrendsViewProps {
  sprintSnapshots: SprintSnapshot[]
  selectedTeam?: string
}

const TEAM_COLORS: Record<string, { primary: string; secondary: string }> = {
  Pioneers: { primary: '#3b82f6', secondary: '#60a5fa' },
  CrookShank: { primary: '#8b5cf6', secondary: '#a78bfa' },
}
const DEFAULT_COLORS = { primary: '#3b82f6', secondary: '#60a5fa' }

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

export function TrendsView({ sprintSnapshots, selectedTeam }: TrendsViewProps) {
  const [range, setRange] = useState<'all' | '10' | '5'>('all')

  // Determine if we have multi-team data
  const teams = useMemo(() => {
    const t = [...new Set(sprintSnapshots.map(s => s.team).filter(Boolean))] as string[]
    return t.length > 1 ? t.sort() : t
  }, [sprintSnapshots])

  const isMultiTeam = teams.length > 1 && (!selectedTeam || selectedTeam === 'all')

  // Process data per team
  const processedData = useMemo(() => {
    let filtered = [...sprintSnapshots].sort((a, b) =>
      new Date(a.snapshotDate).getTime() - new Date(b.snapshotDate).getTime()
    )

    // Filter by team if single team selected
    if (selectedTeam && selectedTeam !== 'all') {
      filtered = filtered.filter(s => s.team === selectedTeam)
    }

    if (range === '10') filtered = filtered.slice(-10 * (isMultiTeam ? teams.length : 1))
    if (range === '5') filtered = filtered.slice(-5 * (isMultiTeam ? teams.length : 1))

    return filtered
  }, [sprintSnapshots, selectedTeam, range, isMultiTeam, teams])

  if (processedData.length < 2) {
    return (
      <div className="bg-slate-900 rounded-lg border border-slate-800 p-8 text-center">
        <div className="text-slate-400 text-sm">Not enough historical data yet.</div>
        <div className="text-slate-500 text-xs mt-2">Current snapshots: {processedData.length}</div>
      </div>
    )
  }

  // For multi-team: create paired data points by sprint number
  // For single team: same as before
  const chartData = useMemo(() => {
    if (!isMultiTeam) {
      // Single team — deduplicate by sprint name, use as-is
      const byName = new Map<string, SprintSnapshot>()
      processedData.forEach(s => byName.set(s.sprintName, s))
      return Array.from(byName.values()).map(s => ({
        ...s,
        label: s.sprintName.replace('Pipelines Sprint ', '').replace(/\s+/g, ' '),
        gap: s.totalSPs - s.completedSPs,
        codeReviewPct: s.totalSPs > 0 ? Math.round((s.codeReviewSPs / s.totalSPs) * 100) : 0,
      }))
    }

    // Multi-team: group by sprint number, create side-by-side data
    const byTeam: Record<string, SprintSnapshot[]> = {}
    teams.forEach(t => { byTeam[t] = [] })
    processedData.forEach(s => {
      if (s.team && byTeam[s.team]) {
        // Deduplicate by sprint name within team
        const existing = byTeam[s.team].findIndex(e => e.sprintName === s.sprintName)
        if (existing >= 0) byTeam[s.team][existing] = s
        else byTeam[s.team].push(s)
      }
    })

    // Find the max sprint count across teams
    const maxLen = Math.max(...Object.values(byTeam).map(arr => arr.length))

    // Create paired data points indexed by position
    const paired = []
    for (let i = 0; i < maxLen; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const point: Record<string, any> = { index: i }

      // Use the sprint number as label (e.g., "Sprint 47")
      const labels: string[] = []
      teams.forEach(team => {
        const snapshot = byTeam[team]?.[i]
        if (snapshot) {
          const num = snapshot.sprintName.match(/(\d+)$/)?.[1] || String(i)
          labels.push(num)
          point[`${team}_committed`] = snapshot.totalSPs
          point[`${team}_completed`] = snapshot.completedSPs
          point[`${team}_completion`] = snapshot.completionPercent
          point[`${team}_blocked`] = snapshot.blockedCount
          point[`${team}_carryForward`] = snapshot.carryForwardCount
          point[`${team}_carryForwardCritical`] = snapshot.carryForwardCriticalCount
          point[`${team}_dodComplete`] = snapshot.dodCompletePercent
          point[`${team}_codeReviewPct`] = snapshot.totalSPs > 0 ? Math.round((snapshot.codeReviewSPs / snapshot.totalSPs) * 100) : 0
          point[`${team}_health`] = snapshot.healthScore
          point[`${team}_gap`] = snapshot.totalSPs - snapshot.completedSPs
        }
      })
      point['label'] = `Sprint ${[...new Set(labels)].join('/')}`
      paired.push(point)
    }

    return paired
  }, [processedData, isMultiTeam, teams])

  const totalSnapshots = processedData.length

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">
            Multi-Sprint Trends ({totalSnapshots} snapshots)
            {isMultiTeam && <span className="text-slate-400 font-normal ml-2">— {teams.join(' vs ')}</span>}
          </h2>
        </div>
        <div className="flex bg-slate-800 rounded-lg p-0.5">
          {([['5', 'Last 5'], ['10', 'Last 10'], ['all', 'All']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setRange(id)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                range === id ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Row 1: Committed vs Done + Completion Rate */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Committed vs Completed SP">
          <ResponsiveContainer width="100%" height={280}>
            {isMultiTeam ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                {teams.map(team => {
                  const c = TEAM_COLORS[team] || DEFAULT_COLORS
                  return [
                    <Bar key={`${team}_committed`} dataKey={`${team}_committed`} fill={c.primary} name={`${team} Committed`} opacity={0.3} />,
                    <Bar key={`${team}_completed`} dataKey={`${team}_completed`} fill={c.primary} name={`${team} Completed`} />,
                  ]
                }).flat()}
              </BarChart>
            ) : (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey="totalSPs" fill="#3b82f6" name="Committed" opacity={0.4} />
                <Bar dataKey="completedSPs" fill="#22c55e" name="Completed" />
                <Line dataKey="gap" stroke="#ef4444" name="Gap" strokeWidth={2} dot={{ fill: '#ef4444', r: 3 }} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Completion Rate %">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              {isMultiTeam ? teams.map(team => {
                const c = TEAM_COLORS[team] || DEFAULT_COLORS
                return <Line key={team} dataKey={`${team}_completion`} stroke={c.primary} strokeWidth={2} name={team} dot={{ fill: c.primary, r: 3 }} />
              }) : (
                <Line dataKey="completionPercent" stroke="#22c55e" strokeWidth={2} name="Completion %" dot={{ fill: '#22c55e', r: 3 }} />
              )}
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
            {isMultiTeam ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                {teams.map(team => {
                  const c = TEAM_COLORS[team] || DEFAULT_COLORS
                  return <Bar key={team} dataKey={`${team}_carryForward`} fill={c.primary} name={team} />
                })}
              </BarChart>
            ) : (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                <Bar dataKey="carryForwardCount" fill="#eab308" name="Total" />
                <Line dataKey="carryForwardCriticalCount" stroke="#ef4444" strokeWidth={2} name="Critical" dot={{ fill: '#ef4444', r: 3 }} />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Blocked Issues">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              {isMultiTeam ? teams.map(team => {
                const c = TEAM_COLORS[team] || DEFAULT_COLORS
                return <Bar key={team} dataKey={`${team}_blocked`} fill={c.primary} name={team} />
              }) : (
                <Bar dataKey="blockedCount" fill="#ef4444" name="Blocked" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 3: DoD + Code Review */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="DoD Compliance Trend">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
              <Tooltip {...tooltipStyle} />
              <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
              {isMultiTeam ? teams.map(team => {
                const c = TEAM_COLORS[team] || DEFAULT_COLORS
                return <Line key={team} dataKey={`${team}_dodComplete`} stroke={c.primary} strokeWidth={2} name={`${team} DoD %`} dot={{ fill: c.primary, r: 3 }} />
              }) : [
                <Line key="complete" dataKey="dodCompletePercent" stroke="#22c55e" strokeWidth={2} name="Complete %" dot={{ fill: '#22c55e', r: 3 }} />,
                <Line key="risk" dataKey="dodAtRiskPercent" stroke="#eab308" strokeWidth={2} name="At Risk %" dot={{ fill: '#eab308', r: 3 }} />,
              ]}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Code Review as % of Sprint Capacity">
          <ResponsiveContainer width="100%" height={250}>
            {isMultiTeam ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
                <Tooltip {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8' }} />
                {teams.map(team => {
                  const c = TEAM_COLORS[team] || DEFAULT_COLORS
                  return <Line key={team} dataKey={`${team}_codeReviewPct`} stroke={c.primary} strokeWidth={2} name={team} dot={{ fill: c.primary, r: 3 }} />
                })}
                <Line dataKey={() => 30} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Threshold" />
              </LineChart>
            ) : (
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} domain={[0, 100]} />
                <Tooltip {...tooltipStyle} />
                <Area dataKey="codeReviewPct" fill="#eab308" fillOpacity={0.2} stroke="#eab308" strokeWidth={2} name="Code Review %" />
                <Line dataKey={() => 30} stroke="#ef4444" strokeDasharray="5 5" strokeWidth={1} dot={false} name="Threshold" />
              </ComposedChart>
            )}
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Row 4: Health Score Timeline */}
      <ChartCard title="Sprint Health Score Timeline">
        {isMultiTeam ? (
          <div className="space-y-4">
            {teams.map(team => (
              <div key={team}>
                <div className="text-xs text-slate-400 mb-2">{team}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  {chartData.map((s: Record<string, unknown>, i: number) => {
                    const health = s[`${team}_health`] as string | undefined
                    if (!health) return null
                    const bg = health === 'green' ? 'bg-emerald-500' : health === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
                    const pct = s[`${team}_completion`] as number | undefined
                    return (
                      <div key={i} className="text-center">
                        <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center text-[9px] font-bold text-white`}>
                          {pct ?? '?'}
                        </div>
                        <div className="text-[8px] text-slate-600 mt-0.5">{String(s.label).replace('Sprint ', '')}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            {(chartData as Array<SprintSnapshot & { label: string }>).map((s, i) => {
              const bg = s.healthScore === 'green' ? 'bg-emerald-500' : s.healthScore === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
              return (
                <div key={i} className="text-center">
                  <div className={`w-7 h-7 rounded-full ${bg} flex items-center justify-center text-[9px] font-bold text-white`}>
                    {s.completionPercent}
                  </div>
                  <div className="text-[8px] text-slate-600 mt-0.5">{s.label?.replace('Sprint ', '')}</div>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex gap-4 mt-3 text-[10px] text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Good</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Warning</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> At Risk</span>
        </div>
      </ChartCard>
    </div>
  )
}
