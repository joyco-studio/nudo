import { useMemo, useState } from 'react'

import { keyCapLabel } from '@/features/shortcuts/key-chord'
import type { MessageKey, Translate } from '@/i18n/translate'
import { useNodeRegistry } from '@/i18n/use-node-registry'
import { useT } from '@/i18n/use-t'
import { KeyHints } from '@/shared/components/key-hints'
import type { KeyHint } from '@/shared/components/key-hints'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/shared/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Kbd, KbdGroup } from '@/shared/ui/kbd'
import { useEditorStore } from '@/store/editor-store'

import { PALETTE_COMMANDS, invocationFrom } from './command-registry'
import { commandLabelKey } from './command-text'
import { paletteResults } from './palette-results'
import type { PaletteGroupId, PaletteItem } from './palette-results'

function groupHeadingKey(group: PaletteGroupId): MessageKey {
  return `palette.group.${group}`
}

const KEY_HINTS: readonly KeyHint[] = [
  { keys: '↑ ↓', action: 'keyHint.move' },
  { keys: 'Enter', action: 'keyHint.run' },
  { keys: 'Esc', action: 'keyHint.close' },
]

export interface CommandPaletteProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Runs once the dialog has closed, in place of Radix's default, to put focus back. */
  onCloseAutoFocus: (event: Event) => void
  /** What had focus when the palette opened: it decides which node commands apply. */
  opener: HTMLElement | null
  onRun: (item: PaletteItem) => void
}

/**
 * Every action and node in one searchable list (Ctrl/⌘ K). A keyboard surface: from Ctrl/⌘ K it
 * opens and closes without animation (the motion rules' frequency gate); from the header button it
 * shares the add-node menu's one fast fade.
 */
export function CommandPalette({
  open,
  onOpenChange,
  onCloseAutoFocus,
  opener,
  onRun,
}: CommandPaletteProps) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-command-palette
        showCloseButton={false}
        motionPreset="quickFade"
        className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogTitle className="sr-only">{t('palette.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('palette.description')}</DialogDescription>
        <PaletteSearch opener={opener} onRun={onRun} />
      </DialogContent>
    </Dialog>
  )
}

interface PaletteSearchProps {
  opener: HTMLElement | null
  onRun: (item: PaletteItem) => void
}

/** Lives inside the dialog content, so the query resets every time the palette opens. */
function PaletteSearch({ opener, onRun }: PaletteSearchProps) {
  const [query, setQuery] = useState('')
  const graph = useEditorStore((state) => state.graph)
  const t = useT()
  const registry = useNodeRegistry()
  // Commands with nothing to act on (Undo with no history, Copy with no node) are left out.
  const commands = useMemo(() => {
    const { nodeId } = invocationFrom(opener)
    return PALETTE_COMMANDS.filter((command) => command.isAvailable?.(nodeId) ?? true)
  }, [opener])
  const groups = paletteResults({ query, graph, registry, commands, t })

  return (
    <Command shouldFilter={false} loop label={t('palette.title')} className="gap-1">
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t('palette.placeholder')}
        aria-label={t('palette.search')}
        className="h-full pr-1.5"
      />
      {/* 23rem lets the next row peek past the edge, so the list reads as scrollable. */}
      <CommandList label={t('palette.list')} className="max-h-[min(23rem,50dvh)]">
        <CommandEmpty className="text-muted-foreground">
          {t('palette.empty', { query: query.trim() })}
        </CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.id} heading={t(groupHeadingKey(group.id))}>
            {group.items.map((item) => (
              <PaletteRow key={item.key} item={item} onRun={onRun} />
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      {/* With no match there is nothing to move through: the empty message says it. */}
      {groups.length > 0 && (
        // Equal padding that lines the hints up with the row text, 16px in from the edge.
        <footer className="-mx-1 -mb-1 border-t bg-muted/40 p-4 text-xs">
          <KeyHints hints={KEY_HINTS} />
        </footer>
      )}
    </Command>
  )
}

interface PaletteRowProps {
  item: PaletteItem
  onRun: (item: PaletteItem) => void
}

function rowText(item: PaletteItem, t: Translate): { label: string; detail: string | undefined } {
  if (item.kind === 'command')
    return { label: t(commandLabelKey(item.command.id)), detail: undefined }
  return { label: item.label, detail: item.detail }
}

/** A row: the name, what kind of node it is (for nodes), and the first chord that runs it. */
function PaletteRow({ item, onRun }: PaletteRowProps) {
  const t = useT()
  const { label, detail } = rowText(item, t)
  const chord = item.kind === 'command' ? item.command.shortcut[0] : undefined

  return (
    <CommandItem
      value={item.key}
      onSelect={() => {
        onRun(item)
      }}
    >
      <span className="truncate">{label}</span>
      {detail !== undefined && (
        <span className="truncate text-muted-foreground">
          <span className="sr-only">, </span>
          {detail}
        </span>
      )}
      {chord !== undefined && (
        <CommandShortcut className="tracking-normal">
          <span className="sr-only">, {t('palette.shortcut')} </span>
          <KbdGroup>
            {chord.map((key) => (
              <Kbd key={key} className="group-data-selected/command-item:bg-background">
                {keyCapLabel(key, t)}
              </Kbd>
            ))}
          </KbdGroup>
        </CommandShortcut>
      )}
    </CommandItem>
  )
}
