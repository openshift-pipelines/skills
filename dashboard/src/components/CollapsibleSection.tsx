import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

interface CollapsibleSectionProps {
  title: string
  defaultOpen: boolean
  children: React.ReactNode
}

export function CollapsibleSection({ title, defaultOpen, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-2 border-b border-slate-800 py-3 mb-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <ChevronRight
          size={16}
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        />
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          {title}
        </h2>
      </div>
      {isOpen && <div>{children}</div>}
    </div>
  )
}
