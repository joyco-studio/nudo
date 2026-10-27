import {
  addProperty,
  addPropertyNode,
  removeProperty,
  renameProperty,
  setPropertyExposed,
  setPropertyLabel,
  setPropertyValue,
} from '@nudo-tsl/core'
import type {
  BlackboardProperty,
  Graph,
  PortValue,
  PropertyId,
  VectorPortValue,
} from '@nudo-tsl/core'

import { PROPERTY_KIND_SPECS, propertyKindOf } from '@/features/blackboard/property-kinds'
import {
  defaultPropertyName,
  followsLabel,
  suggestReferenceName,
} from '@/features/blackboard/property-names'

import { createNodeId, createPropertyId } from './ids'
import { registry } from './registry'
import type { EditorSliceCreator, PropertySlice } from './store-types'

function findProperty(graph: Graph, id: PropertyId): BlackboardProperty | undefined {
  return graph.properties.find((property) => property.id === id)
}

/** Reference names every property but `id` uses. */
function namesOfOthers(graph: Graph, id: PropertyId): ReadonlySet<string> {
  return new Set(graph.properties.filter((p) => p.id !== id).map((p) => p.name))
}

function components(value: VectorPortValue): readonly number[] {
  return value.type === 'float' ? [value.value] : value.value
}

function isSameValue(a: PortValue, b: PortValue): boolean {
  if (a.type === 'texture') return b.type === 'texture' && a.assetId === b.assetId
  if (b.type === 'texture' || a.type !== b.type) return false
  const others = components(b)
  return components(a).every((component, index) => component === others[index])
}

/** Renames the label, and the reference with it while it still follows the label. */
function relabel(graph: Graph, property: BlackboardProperty, label: string) {
  const labelled = setPropertyLabel(graph, property.id, label)
  const fallback = PROPERTY_KIND_SPECS[propertyKindOf(property)].nameBase
  const others = namesOfOthers(graph, property.id)
  if (!labelled.ok || !followsLabel(property, others, fallback)) return labelled
  return renameProperty(labelled.value, property.id, suggestReferenceName(label, others, fallback))
}

export const createPropertySlice: EditorSliceCreator<PropertySlice> = (set, get) => ({
  addProperty: (kind) => {
    const { graph } = get()
    const spec = PROPERTY_KIND_SPECS[kind]
    const name = defaultPropertyName(spec.nameBase, new Set(graph.properties.map((p) => p.name)))
    const id = createPropertyId()
    const result = addProperty(graph, {
      id,
      label: name,
      name,
      exposed: true,
      type: spec.type,
      ...(spec.widget === undefined ? {} : { widget: spec.widget }),
      value: spec.defaultValue,
    })
    if (!result.ok) return null
    set({ graph: result.value })
    return id
  },

  renamePropertyLabel: (id, label) => {
    const { graph } = get()
    const property = findProperty(graph, id)
    if (property === undefined) return { code: 'property-not-found', id }
    if (property.label === label) return null
    const result = relabel(graph, property, label)
    if (!result.ok) return result.error
    set({ graph: result.value })
    return null
  },

  renameProperty: (id, name) => {
    const { graph } = get()
    if (findProperty(graph, id)?.name === name) return null
    const result = renameProperty(graph, id, name)
    if (!result.ok) return result.error
    set({ graph: result.value })
    return null
  },

  setPropertyExposed: (id, exposed) => {
    const { graph } = get()
    if (findProperty(graph, id)?.exposed === exposed) return
    const result = setPropertyExposed(graph, id, exposed)
    if (result.ok) set({ graph: result.value })
  },

  setPropertyValue: (id, value) => {
    const { graph } = get()
    const property = findProperty(graph, id)
    if (property === undefined || isSameValue(property.value, value)) return
    const result = setPropertyValue(graph, id, value)
    if (result.ok) set({ graph: result.value })
  },

  removeProperty: (id) => {
    const { propertyPreview } = get()
    const result = removeProperty(get().graph, id)
    if (!result.ok) return
    // Selection and drafts of the removed readers are pruned by the store subscription.
    set({
      graph: result.value,
      ...(propertyPreview?.id === id ? { propertyPreview: null } : {}),
    })
  },

  addPropertyNode: (id, position) => {
    const nodeId = createNodeId()
    const result = addPropertyNode(get().graph, registry, { id: nodeId, propertyId: id, position })
    if (!result.ok) return null
    set({ graph: result.value })
    return nodeId
  },
})
