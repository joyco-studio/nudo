import { Plus } from 'lucide-react'

import { Button } from '@/shared/ui/button'
import { Kbd } from '@/shared/ui/kbd'

import { useOpenAddNodeMenu } from './add-node-menu-context'

/** Header action. The Space hint is visual; assistive tech hears it as a description. */
export function AddNodeButton() {
  const openMenu = useOpenAddNodeMenu()

  return (
    <Button
      variant="accent"
      size="sm"
      aria-description="Shortcut: Space while the canvas or a node has focus"
      onClick={(event) => {
        openMenu({ kind: 'viewport-center' }, event.currentTarget)
      }}
    >
      <Plus aria-hidden="true" />
      Add node
      <Kbd aria-hidden="true">Space</Kbd>
    </Button>
  )
}
