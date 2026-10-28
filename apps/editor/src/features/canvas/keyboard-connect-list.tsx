import { useMemo } from 'react'
import type { RefObject } from 'react'

import { useT } from '@/i18n/use-t'
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/shared/ui/command'
import { KeyHints } from '@/shared/components/key-hints'
import type { KeyHint } from '@/shared/components/key-hints'
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/ui/popover'

import type { ConnectCandidate } from './connect-candidates'

const KEY_HINTS: readonly KeyHint[] = [
  { keys: '↑ ↓', action: 'keyHint.move' },
  { keys: 'Enter', action: 'keyHint.connect' },
  { keys: 'Esc', action: 'keyHint.close' },
]

/** Plain substring match, so "sin" finds "Sine" and not every label with an s, an i and an n. */
function matchesQuery(label: string, query: string): number {
  return label.toLowerCase().includes(query.trim().toLowerCase()) ? 1 : 0
}

export interface KeyboardConnectListProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The port being connected, "Node › Port": names the list for assistive technology. */
  title: string
  /** The element the list opens next to. */
  anchorRef: RefObject<HTMLElement | null>
  /** Read once each time the list opens, so it reflects the graph at that moment. */
  loadCandidates: () => readonly ConnectCandidate[]
  onPick: (candidate: ConnectCandidate) => void
  /** Runs after the list closes, in place of Radix's default, to put focus back on the port. */
  restoreFocus: () => void
}

/**
 * A searchable list of every port the origin can connect to. Enter on an option connects, Escape
 * closes, and typing narrows the list. Opens next to the port it was started from.
 */
export function KeyboardConnectList({
  open,
  onOpenChange,
  title,
  anchorRef,
  loadCandidates,
  onPick,
  restoreFocus,
}: KeyboardConnectListProps) {
  const t = useT()
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        aria-label={t('connect.title', { port: title })}
        side="bottom"
        align="start"
        className="w-80 gap-0 p-0"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreFocus()
        }}
      >
        <ConnectSearch title={title} loadCandidates={loadCandidates} onPick={onPick} />
      </PopoverContent>
    </Popover>
  )
}

interface ConnectSearchProps {
  title: string
  loadCandidates: () => readonly ConnectCandidate[]
  onPick: (candidate: ConnectCandidate) => void
}

/** Lives inside the popover content, so it mounts (and reads the graph) only while open. */
function ConnectSearch({ title, loadCandidates, onPick }: ConnectSearchProps) {
  const candidates = useMemo(() => loadCandidates(), [loadCandidates])
  const t = useT()

  return (
    <Command
      filter={matchesQuery}
      loop
      label={t('connect.title', { port: title })}
      className="gap-1"
    >
      <CommandInput placeholder={t('connect.placeholder')} aria-label={t('connect.search')} />
      <CommandList label={t('connect.list')} className="max-h-[min(18rem,50dvh)]">
        <CommandEmpty className="px-3 py-6 text-center text-sm text-muted-foreground">
          {t('connect.empty')}
        </CommandEmpty>
        {candidates.map((candidate) => (
          <CommandItem
            key={candidate.label}
            value={candidate.label}
            onSelect={() => {
              onPick(candidate)
            }}
          >
            {candidate.label}
          </CommandItem>
        ))}
      </CommandList>
      <footer className="-mx-1 -mb-1 border-t bg-muted/40 px-3 py-2 text-xs">
        <KeyHints hints={KEY_HINTS} />
      </footer>
    </Command>
  )
}
