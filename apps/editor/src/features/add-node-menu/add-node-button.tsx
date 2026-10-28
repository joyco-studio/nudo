import { useId } from 'react'
import { Plus } from 'lucide-react'

import { useT } from '@/i18n/use-t'
import { Button } from '@/shared/ui/button'
import { Kbd } from '@/shared/ui/kbd'

import { useOpenAddNodeMenu } from './add-node-menu-context'

/** Header action. The Space hint is visual; assistive tech hears it as a description. */
export function AddNodeButton() {
  const openMenu = useOpenAddNodeMenu()
  const shortcutHintId = useId()
  const t = useT()

  return (
    <>
      <Button
        variant="accent"
        size="sm"
        aria-describedby={shortcutHintId}
        onClick={(event) => {
          openMenu({ kind: 'viewport-center' }, event.currentTarget)
        }}
      >
        <Plus aria-hidden="true" />
        {/* Icon only on a narrow header; the label stays the accessible name. */}
        <span className="max-sm:sr-only">{t('addNode.label')}</span>
        <Kbd aria-hidden="true" className="max-sm:hidden">
          {t('key.space')}
        </Kbd>
      </Button>
      <span id={shortcutHintId} className="sr-only">
        {t('addNode.shortcutHint')}
      </span>
    </>
  )
}
