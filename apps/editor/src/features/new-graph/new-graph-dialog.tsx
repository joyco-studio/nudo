import { useRef } from 'react'

import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/shared/ui/dialog'

export interface NewGraphDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "2 nodes and 1 property": what the reset clears. */
  contentsLabel: string
  onConfirm: () => void
  /** Runs after the dialog closes, in place of Radix's default, to put focus back. */
  restoreFocus: () => void
}

/** Confirms starting over. Cancel has focus: the safe choice is the easy one. */
export function NewGraphDialog({
  open,
  onOpenChange,
  contentsLabel,
  onConfirm,
  restoreFocus,
}: NewGraphDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          cancelRef.current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreFocus()
        }}
      >
        <DialogTitle className="font-heading text-sm font-semibold tracking-wide uppercase">
          Start a new graph?
        </DialogTitle>
        <DialogDescription>
          This clears {contentsLabel} and keeps only the Master Stack. Undo (Ctrl/⌘ Z) brings them
          back.
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button ref={cancelRef} variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            Clear graph
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
