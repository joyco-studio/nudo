import { useMemo } from 'react'

import { useNodePlacement } from '@/features/add-node-menu/use-node-placement'
import { useEditorStore } from '@/store/editor-store'

import { addPropertyToCanvas } from './add-property-to-canvas'
import { AddPropertyMenu } from './add-property-menu'
import type { BlackboardActions } from './blackboard-actions'
import { BlackboardPanel } from './blackboard-panel'
import type { PropertyKind } from './property-kinds'

const getStore = () => useEditorStore.getState()

/** Adds a property, opening a collapsed panel first so the new row shows. */
function addProperty(kind: PropertyKind) {
  const store = getStore()
  if (!store.panels.open.blackboard) store.togglePanel('blackboard')
  return store.addProperty(kind)
}

/** Connects the Properties panel to the store. Must sit inside a `ReactFlowProvider`. */
export function BlackboardContainer() {
  const properties = useEditorStore((state) => state.graph.properties)
  const resolvePlacement = useNodePlacement()

  const actions = useMemo<BlackboardActions>(
    () => ({
      addProperty,
      renameLabel: (id, label) => getStore().renamePropertyLabel(id, label),
      renameReference: (id, name) => getStore().renameProperty(id, name),
      setExposed: (id, exposed) => {
        getStore().setPropertyExposed(id, exposed)
      },
      setValue: (id, value) => {
        getStore().setPropertyValue(id, value)
      },
      previewValue: (id, value) => {
        getStore().previewPropertyValue(id, value)
      },
      endPreview: () => {
        getStore().clearPropertyPreview()
      },
      remove: (id) => {
        getStore().removeProperty(id)
      },
      addToCanvas: (id) => {
        addPropertyToCanvas(id, resolvePlacement({ kind: 'viewport-center' }))
      },
    }),
    [resolvePlacement],
  )

  return <BlackboardPanel properties={properties} actions={actions} />
}

/** The "+" of the Properties header, wired to the store. */
export function AddPropertyMenuContainer() {
  return <AddPropertyMenu onAdd={addProperty} />
}
