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

export interface NewGraphDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "2 nodes and 1 property": what starting over removes. */
  contentsLabel: string
  onConfirm: () => void
  /** Runs after the dialog closes, in place of Radix's default, to put focus back. */
  restoreFocus: () => void
}

/**
 * Confirms starting a new graph. An alert dialog focuses Cancel first, so the safe choice is the
 * easy one, and names the one action the header button and the shortcut also call "New graph".
 */
export function NewGraphDialog({
  open,
  onOpenChange,
  contentsLabel,
  onConfirm,
  restoreFocus,
}: NewGraphDialogProps) {
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
            {t('newGraph.title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('newGraph.description', { contents: contentsLabel })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="sm">{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" size="sm" onClick={onConfirm}>
            {t('newGraph.confirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
