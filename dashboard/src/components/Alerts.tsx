import React from 'react'
import { AlertTriangle, AlertCircle, TrendingUp, CheckCircle } from 'lucide-react'
import type { Expectations } from '../lib/types'

interface AlertsProps {
  expectations: Expectations
}

export function Alerts({ expectations }: AlertsProps) {
  const alerts: React.ReactElement[] = []

  if (expectations.overCommitted.flag) {
    const { delta, committed, avgVelocity } = expectations.overCommitted
    alerts.push(
      <div
        key="over-committed"
        className="rounded-lg border-l-4 border-red-500 bg-red-500/10 p-3 mb-2 flex items-start gap-3"
      >
        <AlertCircle className="text-red-400 flex-shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-red-400">
          Over-committed by {delta} SPs (committed: {committed}, avg velocity: {avgVelocity})
        </div>
      </div>
    )
  }

  if (expectations.underCommitted.flag) {
    alerts.push(
      <div
        key="under-committed"
        className="rounded-lg border-l-4 border-emerald-500 bg-emerald-500/10 p-3 mb-2 flex items-start gap-3"
      >
        <CheckCircle className="text-emerald-400 flex-shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-emerald-400">
          Under-committed — team has capacity
        </div>
      </div>
    )
  }

  if (expectations.codeReviewBottleneck.flag) {
    const { percent } = expectations.codeReviewBottleneck
    alerts.push(
      <div
        key="code-review"
        className="rounded-lg border-l-4 border-amber-500 bg-amber-500/10 p-3 mb-2 flex items-start gap-3"
      >
        <AlertTriangle className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
        <div className="text-sm text-amber-400">
          Code Review holding {percent}% of sprint capacity
        </div>
      </div>
    )
  }

  if (expectations.carryForwardRate.length >= 2) {
    const rates = expectations.carryForwardRate
    const lastRate = rates[rates.length - 1]
    const secondLastRate = rates[rates.length - 2]

    if (lastRate > secondLastRate) {
      alerts.push(
        <div
          key="carry-forward"
          className="rounded-lg border-l-4 border-amber-500 bg-amber-500/10 p-3 mb-2 flex items-start gap-3"
        >
          <TrendingUp className="text-amber-400 flex-shrink-0 mt-0.5" size={18} />
          <div className="text-sm text-amber-400">
            Carry-forward rate increasing: {rates.map(r => `${r}%`).join(' → ')}
          </div>
        </div>
      )
    }
  }

  if (alerts.length === 0) {
    return null
  }

  return <div>{alerts}</div>
}
