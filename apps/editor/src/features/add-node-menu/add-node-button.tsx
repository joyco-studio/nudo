import { useId } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { Kbd } from '@/shared/ui/kbd'

import { useOpenAddNodeMenu } from './add-node-menu-context'

/** Header action. The Space hint is visual; assistive tech hears it as a description. */
export function AddNodeButton() {
  const openMenu = useOpenAddNodeMenu()
  const shortcutHintId = useId()

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
        Add node
        <Kbd aria-hidden="true">Space</Kbd>
      </Button>
      <span id={shortcutHintId} className="sr-only">
        Shortcut: Space while the canvas or a node has focus
      </span>
    </>
  )
}
