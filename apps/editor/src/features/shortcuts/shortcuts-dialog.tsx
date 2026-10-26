import { Fragment } from 'react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/shared/ui/dialog'
import { Kbd } from '@/shared/ui/kbd'

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
    <tr className="border-t">
      <th scope="row" className="py-1.5 pr-4 text-left font-normal">
        {entry.action}
      </th>
      <td className="py-1.5">
        <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          {entry.chords.map((chord, index) => (
            <Fragment key={chord.join('+')}>
              {index > 0 && <span className="text-xs text-muted-foreground">or</span>}
              <Chord chord={chord} />
            </Fragment>
          ))}
        </span>
      </td>
    </tr>
  )
}

function SectionRows({ section }: { section: ShortcutSection }) {
  return (
    <tbody>
      <tr>
        <th
          scope="rowgroup"
          colSpan={2}
          className="pt-4 pb-1 text-left font-mono text-[10px] font-normal tracking-[0.2em] text-muted-foreground uppercase"
        >
          {section.title}
        </th>
      </tr>
      {section.entries.map((entry) => (
        <EntryRow key={entry.action} entry={entry} />
      ))}
    </tbody>
  )
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
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Keyboard shortcuts by area of the editor</caption>
            <thead className="sr-only">
              <tr>
                <th scope="col">Action</th>
                <th scope="col">Keys</th>
              </tr>
            </thead>
            {SHORTCUT_SECTIONS.map((section) => (
              <SectionRows key={section.title} section={section} />
            ))}
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}
