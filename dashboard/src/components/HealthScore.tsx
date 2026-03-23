interface HealthScoreProps {
  score: 'green' | 'yellow' | 'red'
  completionPercent: number
}

export function HealthScore({ score, completionPercent }: HealthScoreProps) {
  const colorClasses = {
    green: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    yellow: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
  }

  return (
    <div
      className={`inline-flex items-center rounded-full border px-4 py-1 font-semibold text-sm ${colorClasses[score]}`}
    >
      {completionPercent}% Complete
    </div>
  )
}
