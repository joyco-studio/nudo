import { createContext, use } from 'react'
import type { NodeId, NodeTypeId } from '@nudo-tsl/core'

import type { PlacementOrigin } from './add-node-placement'

/** Opens the add-node menu. `opener` gets focus back if the menu closes without adding a node. */
export type OpenAddNodeMenu = (origin: PlacementOrigin, opener: HTMLElement | null) => void

/**
 * Adds a node where the menu would place it, clear of other nodes, and selects it. Returns its id,
 * or null when it could not be added.
 */
export type AddNodeAt = (type: NodeTypeId, origin: PlacementOrigin) => NodeId | null

export interface AddNodeMenuApi {
  readonly openMenu: OpenAddNodeMenu
  readonly addNodeAt: AddNodeAt
}

export const AddNodeMenuContext = createContext<AddNodeMenuApi | null>(null)

function useAddNodeMenuApi(): AddNodeMenuApi {
  const api = use(AddNodeMenuContext)
  if (api === null) throw new Error('Add-node menu hooks must be used inside AddNodeMenuProvider')
  return api
}

export function useOpenAddNodeMenu(): OpenAddNodeMenu {
  return useAddNodeMenuApi().openMenu
}

export function useAddNodeAt(): AddNodeAt {
  return useAddNodeMenuApi().addNodeAt
}
