import { Search } from 'lucide-react'

interface FilterBarProps {
  value: string
  onChange: (val: string) => void
}

export function FilterBar({ value, onChange }: FilterBarProps) {
  return (
    <div className="relative mb-4">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <Search size={18} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Filter by issue key, assignee, component, or summary..."
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 pl-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  )
}
