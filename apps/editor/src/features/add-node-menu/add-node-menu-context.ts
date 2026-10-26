import { createContext, use } from 'react'

import type { PlacementOrigin } from './add-node-placement'

/** Opens the add-node menu. `opener` gets focus back if the menu closes without adding a node. */
export type OpenAddNodeMenu = (origin: PlacementOrigin, opener: HTMLElement | null) => void

export const AddNodeMenuContext = createContext<OpenAddNodeMenu | null>(null)

export function useOpenAddNodeMenu(): OpenAddNodeMenu {
  const openMenu = use(AddNodeMenuContext)
  if (openMenu === null)
    throw new Error('useOpenAddNodeMenu must be used inside AddNodeMenuProvider')
  return openMenu
}
