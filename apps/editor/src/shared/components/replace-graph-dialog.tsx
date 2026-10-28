import { useT } from '@/i18n/use-t'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog'

export interface ReplaceGraphDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** What the person loses, and that undo brings it back. */
  description: string
  /** Names the action, as the control that asked for it does. */
  confirmLabel: string
  onConfirm: () => void
  /** Runs after the dialog closes, in place of Radix's default, to put focus back. */
  restoreFocus: () => void
}

/**
 * Confirms replacing the graph (a new graph, an example). An alert dialog focuses Cancel first,
 * so the safe choice is the easy one.
 */
export function ReplaceGraphDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  restoreFocus,
}: ReplaceGraphDialogProps) {
  const t = useT()
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          restoreFocus()
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading text-sm font-semibold tracking-wide uppercase">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="sm">{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
