import { useState } from 'react'
import type { AnyNodeDefinition, NodeTypeId } from '@nudo-tsl/core'

import { registry } from '@/store/registry'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/shared/ui/command'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { KeyHints } from '@/shared/components/key-hints'
import type { KeyHint } from '@/shared/components/key-hints'

import { CATEGORY_HEADINGS, searchNodes } from './search-nodes'
import type { NodeSearchGroup } from './search-nodes'

const KEY_HINTS: readonly KeyHint[] = [
  { keys: '↑ ↓', action: 'Move' },
  { keys: 'Enter', action: 'Add' },
  { keys: 'Esc', action: 'Close' },
]

export interface AddNodeMenuProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (type: NodeTypeId) => void
  /**
   * Runs once the dialog has closed, in place of Radix's default (which would focus a trigger this
   * dialog doesn't have), so the parent decides where focus goes.
   */
  restoreFocus: () => void
}

/** A searchable dialog listing every node a person can add, grouped by category. */
export function AddNodeMenu({ open, onOpenChange, onPick, restoreFocus }: AddNodeMenuProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-md"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreFocus()
        }}
      >
        <DialogTitle className="sr-only">Add node</DialogTitle>
        <DialogDescription className="sr-only">
          Search nodes by name or keyword, then press Enter to add the highlighted node.
        </DialogDescription>
        <NodeSearch onPick={onPick} />
      </DialogContent>
    </Dialog>
  )
}

interface NodeSearchProps {
  onPick: (type: NodeTypeId) => void
}

function findDefinition(
  groups: readonly NodeSearchGroup[],
  type: string,
): AnyNodeDefinition | undefined {
  for (const group of groups) {
    const match = group.items.find((definition) => definition.type === type)
    if (match !== undefined) return match
  }
  return undefined
}

/**
 * Lives inside the dialog content, so the query resets every time the menu opens. Rows show only
 * the label so the list scans quickly; the highlighted node's description shows in the footer.
 */
function NodeSearch({ onPick }: NodeSearchProps) {
  const [query, setQuery] = useState('')
  const [highlightedType, setHighlightedType] = useState('')
  const groups = searchNodes(registry.list(), query)
  const highlighted = findDefinition(groups, highlightedType)

  return (
    <Command
      shouldFilter={false}
      loop
      label="Search nodes"
      value={highlightedType}
      onValueChange={setHighlightedType}
      className="gap-1"
    >
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search nodes, e.g. mix or time"
        aria-label="Search nodes"
        className="h-full pr-1.5"
      />
      {/* 23rem lets the next row peek past the edge, so the list reads as scrollable. */}
      <CommandList label="Nodes" className="max-h-[min(23rem,50dvh)]">
        <CommandEmpty className="text-muted-foreground">
          No nodes match "{query.trim()}". Try another word, like mix or time.
        </CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.category} heading={CATEGORY_HEADINGS[group.category]}>
            {group.items.map((definition) => (
              <CommandItem
                key={definition.type}
                value={definition.type}
                onSelect={() => {
                  onPick(definition.type)
                }}
              >
                {definition.label}
                <span className="sr-only">, {definition.description}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
      {/* With no match there is nothing to describe or move through: the empty message says it. */}
      {groups.length > 0 && (
        <footer className="-mx-1 -mb-1 flex flex-col gap-2 border-t bg-muted/40 px-3 py-2 text-xs">
          {/* Screen readers already hear the description as part of the highlighted option. */}
          <p aria-hidden="true" className="min-h-[2lh] text-pretty text-foreground sm:min-h-lh">
            {highlighted?.description}
          </p>
          <KeyHints hints={KEY_HINTS} />
        </footer>
      )}
    </Command>
  )
}
