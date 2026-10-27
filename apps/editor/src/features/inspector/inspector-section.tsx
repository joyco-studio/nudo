import { useId } from 'react'
import type { ReactNode } from 'react'

interface InspectorSectionProps {
  title: string
  children: ReactNode
}

/** A titled group of Inspector rows, separated from the one above by a hairline. */
export function InspectorSection({ title, children }: InspectorSectionProps) {
  const headingId = useId()
  return (
    <div role="group" aria-labelledby={headingId} className="border-t pb-1">
      <h4
        id={headingId}
        className="px-3 pt-3 pb-1 font-mono text-micro tracking-[0.2em] text-muted-foreground uppercase"
      >
        {title}
      </h4>
      {children}
    </div>
  )
}

interface InspectorHeaderProps {
  title: string
  children: ReactNode
}

/** The subject's name, then what it is, in the Inspector's top block. */
export function InspectorHeader({ title, children }: InspectorHeaderProps) {
  return (
    <header className="flex flex-col gap-1 p-3">
      <h3 className="font-heading text-xs font-semibold tracking-wide uppercase">{title}</h3>
      {children}
    </header>
  )
}
