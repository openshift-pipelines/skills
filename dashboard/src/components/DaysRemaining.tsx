interface DaysRemainingProps {
  daysRemaining: number
  sprintDay: number
  sprintDuration: number
  completionPercent: number
  completedSP: number
  totalSP: number
}

export function DaysRemaining({
  daysRemaining,
  sprintDay,
  sprintDuration,
  completionPercent,
  completedSP,
  totalSP,
}: DaysRemainingProps) {
  const progressPercent = (sprintDay / sprintDuration) * 100

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4 mb-4">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="text-sm text-slate-400 mb-2">
            Day {sprintDay} of {sprintDuration} &middot; {daysRemaining} days remaining
          </div>
          <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
        <div className="text-right ml-6">
          <div className="text-3xl font-bold text-white">
            {completionPercent}% Complete
          </div>
          <div className="text-sm text-slate-400 mt-1">
            {completedSP} / {totalSP} SP
          </div>
        </div>
      </div>
    </div>
  )
}
