import { useState } from 'react'

import { DisclosureChevron } from '@/shared/components/disclosure-chevron'
import { cn } from '@/shared/lib/utils'

import type { GroupDisclosure } from './node-port-layout'

interface OpenChoice {
  /** The default the reader's choice was made against. */
  readonly against: boolean
  readonly isOpen: boolean
}

/**
 * Whether a folding group is open, and the toggle. It starts at the group's default and follows
 * the reader's choice until the default itself changes (the master's lighting turns physical, or
 * stops being physical), which starts it over. A group that never folds is always open (its
 * default), and its toggle is never offered.
 */
export function useGroupOpen(disclosure: GroupDisclosure | null): readonly [boolean, () => void] {
  const [choice, setChoice] = useState<OpenChoice | null>(null)
  const isOpenByDefault = disclosure?.isOpenByDefault ?? true
  const isOpen = isGroupOpen(isOpenByDefault, choice)
  const toggle = (): void => {
    setChoice({ against: isOpenByDefault, isOpen: !isOpen })
  }
  return [isOpen, toggle]
}

function isGroupOpen(isOpenByDefault: boolean, choice: OpenChoice | null): boolean {
  if (choice !== null && choice.against === isOpenByDefault) return choice.isOpen
  return isOpenByDefault
}

interface GroupToggleProps {
  label: string
  isOpen: boolean
  /** The id of the rows it shows and hides. */
  controls: string
  onToggle: () => void
  className?: string
}

/**
 * The heading of a group that folds away, as one button: its label where a plain heading's sits,
 * and the chevron at the row's far end, so the label keeps the column its sibling headings share.
 */
export function GroupToggle({ label, isOpen, controls, onToggle, className }: GroupToggleProps) {
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={controls}
      onClick={onToggle}
      className={cn(
        'nodrag flex w-full items-center justify-between gap-2 text-left uppercase outline-none',
        'text-muted-foreground transition-[color,box-shadow] hover:text-foreground',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
        className,
      )}
    >
      <span>{label}</span>
      <DisclosureChevron isOpen={isOpen} className="size-3 shrink-0" />
    </button>
  )
}
