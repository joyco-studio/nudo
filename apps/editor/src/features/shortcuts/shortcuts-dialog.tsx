import { Fragment } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Kbd } from '@/shared/ui/kbd'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/ui/table'

import { SHORTCUT_SECTIONS } from './shortcut-catalog'
import type { KeyChord, ShortcutEntry, ShortcutSection } from './shortcut-catalog'

function Chord({ chord }: { chord: KeyChord }) {
  return (
    <span className="inline-flex items-center gap-1">
      {chord.map((key, index) => (
        <Fragment key={key}>
          {index > 0 && <span aria-hidden="true">+</span>}
          <Kbd>{key}</Kbd>
          {/* Read as "Ctrl plus Z", not "Ctrl Z". */}
          {index < chord.length - 1 && <span className="sr-only">plus</span>}
        </Fragment>
      ))}
    </span>
  )
}

function EntryRow({ entry }: { entry: ShortcutEntry }) {
  return (
    <TableRow className="border-t border-b-0 hover:bg-transparent">
      <TableHead scope="row" className="h-auto py-1.5 pr-4 pl-0 font-normal whitespace-normal">
        {entry.action}
      </TableHead>
      <TableCell className="py-1.5 pr-0">
        <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          {entry.chords.map((chord, index) => (
            <Fragment key={chord.join('+')}>
              {index > 0 && <span className="text-xs text-muted-foreground">or</span>}
              <Chord chord={chord} />
            </Fragment>
          ))}
        </span>
      </TableCell>
    </TableRow>
  )
}

function SectionRows({ section }: { section: ShortcutSection }) {
  return (
    <TableBody>
      <TableRow className="border-b-0 hover:bg-transparent">
        <TableHead
          scope="rowgroup"
          colSpan={2}
          className="h-auto px-0 pt-4 pb-1 font-mono text-micro font-normal tracking-[0.2em] text-muted-foreground uppercase"
        >
          {section.title}
        </TableHead>
      </TableRow>
      {section.entries.map((entry) => (
        <EntryRow key={entry.action} entry={entry} />
      ))}
    </TableBody>
  )
}

function closeButtonIn(dialog: Element): HTMLElement | null {
  return dialog.querySelector<HTMLElement>('[data-slot="dialog-close"]')
}

export interface ShortcutsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Runs after the dialog closes, in place of Radix's default, to put focus back. */
  restoreFocus: () => void
}

/** Every keyboard shortcut in one semantic table. */
export function ShortcutsDialog({ open, onOpenChange, restoreFocus }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85dvh] grid-rows-[auto_auto_minmax(0,1fr)] sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          // Close is the first stop, so the tall scroll region doesn't open wrapped in a ring.
          const close =
            event.currentTarget instanceof Element ? closeButtonIn(event.currentTarget) : null
          if (close === null) return
          event.preventDefault()
          close.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreFocus()
        }}
      >
        <DialogTitle className="font-heading text-sm font-semibold tracking-wide uppercase">
          Keyboard shortcuts
        </DialogTitle>
        <DialogDescription>
          Everything works from the keyboard. Shortcuts pause while you type in a field.
        </DialogDescription>
        {/* Focusable so a keyboard user can scroll the list when it is taller than the dialog. */}
        <div
          tabIndex={0}
          role="region"
          aria-label="All shortcuts"
          className="-mx-1 overflow-y-auto px-1 pb-1"
        >
          <Table className="border-collapse">
            <TableCaption className="sr-only">
              Keyboard shortcuts by area of the editor
            </TableCaption>
            <TableHeader className="sr-only">
              <TableRow>
                <TableHead scope="col">Action</TableHead>
                <TableHead scope="col">Keys</TableHead>
              </TableRow>
            </TableHeader>
            {SHORTCUT_SECTIONS.map((section) => (
              <SectionRows key={section.title} section={section} />
            ))}
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
