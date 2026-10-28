import { useT } from '@/i18n/use-t'
import { ReplaceGraphDialog } from '@/shared/components/replace-graph-dialog'

export interface NewGraphDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "2 nodes and 1 property": what starting over removes. */
  contentsLabel: string
  onConfirm: () => void
  /** Runs after the dialog closes, in place of Radix's default, to put focus back. */
  restoreFocus: () => void
}

/** Confirms starting a new graph, named as the header button and the shortcut name it. */
export function NewGraphDialog({ contentsLabel, ...props }: NewGraphDialogProps) {
  const t = useT()
  return (
    <ReplaceGraphDialog
      {...props}
      title={t('newGraph.title')}
      description={t('newGraph.description', { contents: contentsLabel })}
      confirmLabel={t('newGraph.confirm')}
    />
  )
}
