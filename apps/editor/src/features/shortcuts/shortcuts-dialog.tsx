import { Fragment } from 'react'

import { useT } from '@/i18n/use-t'

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

import { keyCapLabel } from './key-chord'
import type { KeyChord } from './key-chord'
import { SHORTCUT_SECTIONS } from './shortcut-catalog'
import type { ShortcutEntry, ShortcutSection } from './shortcut-catalog'

function Chord({ chord }: { chord: KeyChord }) {
  const t = useT()
  return (
    <span className="inline-flex items-center gap-1">
      {chord.map((key, index) => (
        <Fragment key={key}>
          {index > 0 && <span aria-hidden="true">+</span>}
          <Kbd>{keyCapLabel(key, t)}</Kbd>
          {/* Read as "Ctrl plus Z", not "Ctrl Z". */}
          {index < chord.length - 1 && <span className="sr-only">{t('key.plus')}</span>}
        </Fragment>
      ))}
    </span>
  )
}

function EntryRow({ entry }: { entry: ShortcutEntry }) {
  const t = useT()
  return (
    <TableRow className="border-t border-b-0 hover:bg-transparent">
      <TableHead scope="row" className="h-auto py-1.5 pr-4 pl-0 font-normal whitespace-normal">
        {t(entry.action)}
      </TableHead>
      <TableCell className="py-1.5 pr-0">
        <span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
          {entry.chords.map((chord, index) => (
            <Fragment key={chord.join('+')}>
              {index > 0 && <span className="text-xs text-muted-foreground">{t('key.or')}</span>}
              <Chord chord={chord} />
            </Fragment>
          ))}
        </span>
      </TableCell>
    </TableRow>
  )
}

function SectionRows({ section }: { section: ShortcutSection }) {
  const t = useT()
  return (
    <TableBody>
      <TableRow className="border-b-0 hover:bg-transparent">
        <TableHead
          scope="rowgroup"
          colSpan={2}
          className="h-auto px-0 pt-4 pb-1 font-mono text-micro font-normal tracking-[0.2em] text-muted-foreground uppercase"
        >
          {t(section.title)}
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
  const t = useT()
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
          {t('shortcuts.title')}
        </DialogTitle>
        <DialogDescription>{t('shortcuts.description')}</DialogDescription>
        {/* Focusable so a keyboard user can scroll the list when it is taller than the dialog. */}
        <div
          tabIndex={0}
          role="region"
          aria-label={t('shortcuts.region')}
          data-focus-ring="inset"
          className="-mx-1 overflow-y-auto px-1 pb-1"
        >
          <Table className="border-collapse">
            <TableCaption className="sr-only">{t('shortcuts.caption')}</TableCaption>
            <TableHeader className="sr-only">
              <TableRow>
                <TableHead scope="col">{t('shortcuts.action')}</TableHead>
                <TableHead scope="col">{t('shortcuts.keys')}</TableHead>
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
