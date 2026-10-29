import { useId } from 'react'
import type { ReactNode } from 'react'

import { GroupToggle } from '@/features/canvas/group-toggle'
import { cn } from '@/shared/lib/utils'

/** A section whose heading folds its rows away. */
export interface SectionFold {
  readonly isOpen: boolean
  readonly onToggle: () => void
  /** The id of the rows it shows and hides. */
  readonly controls: string
}

interface InspectorSectionProps {
  title: string
  /** Makes the heading a toggle that folds the rows away; left out for a section always shown. */
  fold?: SectionFold | undefined
  children: ReactNode
}

const HEADING_INSET = 'px-3 pt-3 pb-1'

/** A titled group of Inspector rows, separated from the one above by a hairline. */
export function InspectorSection({ title, fold, children }: InspectorSectionProps) {
  const headingId = useId()
  return (
    <div role="group" aria-labelledby={headingId} className="border-t pb-1">
      <h4
        id={headingId}
        className={cn(
          'font-mono text-micro tracking-[0.2em] text-muted-foreground uppercase',
          fold === undefined && HEADING_INSET,
        )}
      >
        {fold === undefined ? (
          title
        ) : (
          <GroupToggle
            label={title}
            isOpen={fold.isOpen}
            controls={fold.controls}
            onToggle={fold.onToggle}
            className={HEADING_INSET}
          />
        )}
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
