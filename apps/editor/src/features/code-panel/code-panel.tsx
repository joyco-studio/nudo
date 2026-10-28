import { useT } from '@/i18n/use-t'
import { Empty, EmptyDescription } from '@/shared/ui/empty'

/** The code drawer's body. The live module comes with the code generator. */
export function CodePanel() {
  const t = useT()
  return (
    <Empty className="items-start p-3 text-left">
      <EmptyDescription className="text-xs">{t('code.empty')}</EmptyDescription>
    </Empty>
  )
}
