import { MASTER_NODE_ID, PROPERTY_ID_PARAM, createGraph, float, vec2 } from '@nudo-tsl/core'
import type { NodeId, PropertyId } from '@nudo-tsl/core'
import { beforeEach, describe, expect, it } from 'vitest'

import { undo, useEditorStore } from './editor-store'

const getState = () => useEditorStore.getState()
const historyLength = () => useEditorStore.temporal.getState().pastStates.length
const ORIGIN = { x: 0, y: 0 }

function addOrFail(kind: Parameters<ReturnType<typeof getState>['addProperty']>[0]): PropertyId {
  const id = getState().addProperty(kind)
  if (id === null) throw new Error(`Could not add a ${kind} property`)
  return id
}

function propertyOf(id: PropertyId) {
  const property = getState().graph.properties.find((candidate) => candidate.id === id)
  if (property === undefined) throw new Error(`Missing property ${id}`)
  return property
}

function readerOrFail(id: PropertyId): NodeId {
  const nodeId = getState().addPropertyNode(id, ORIGIN)
  if (nodeId === null) throw new Error('Could not add the reader')
  return nodeId
}

beforeEach(() => {
  useEditorStore.setState({
    graph: createGraph(),
    selectedNodeIds: [],
    draftPositions: {},
    inputPreview: null,
    propertyPreview: null,
    notice: null,
    errorsByNode: {},
  })
  useEditorStore.temporal.getState().clear()
})

describe('addProperty', () => {
  it('adds an exposed property with a unique default name and the kind default value', () => {
    const first = addOrFail('float')
    const second = addOrFail('float')
    const color = addOrFail('color')
    const vector = addOrFail('vec2')

    expect(propertyOf(first)).toMatchObject({ name: 'float1', label: 'float1', exposed: true })
    expect(propertyOf(first).value).toEqual(float(0))
    expect(propertyOf(second).name).toBe('float2')
    expect(propertyOf(color)).toMatchObject({ name: 'color1', type: 'vec3', widget: 'color' })
    expect(propertyOf(vector)).toMatchObject({ name: 'vec2_1', value: vec2(0, 0) })
    expect(historyLength()).toBe(4)
  })
})

describe('renamePropertyLabel', () => {
  it('renames the label, and the reference while it is generated, as one entry', () => {
    const id = addOrFail('float')
    const before = historyLength()

    expect(getState().renamePropertyLabel(id, 'Wave Speed')).toBeNull()

    expect(propertyOf(id)).toMatchObject({ label: 'Wave Speed', name: 'waveSpeed' })
    expect(historyLength()).toBe(before + 1)
  })

  it('leaves a reference chosen by hand alone', () => {
    const id = addOrFail('float')
    expect(getState().renameProperty(id, 'uSpeed')).toBeNull()

    getState().renamePropertyLabel(id, 'Speed')

    expect(propertyOf(id)).toMatchObject({ label: 'Speed', name: 'uSpeed' })
  })

  it('numbers a suggested reference another property uses', () => {
    const taken = addOrFail('float')
    getState().renameProperty(taken, 'speed')
    const id = addOrFail('float')

    getState().renamePropertyLabel(id, 'speed')

    expect(propertyOf(id).name).toBe('speed2')
  })

  it('does nothing for the same label', () => {
    const id = addOrFail('float')
    const before = historyLength()

    getState().renamePropertyLabel(id, 'float1')

    expect(historyLength()).toBe(before)
  })
})

describe('renameProperty', () => {
  it.each(['2x', 'my var', 'class', ''])('rejects %j and keeps the old name', (name) => {
    const id = addOrFail('float')
    const before = historyLength()

    expect(getState().renameProperty(id, name)).toMatchObject({ code: 'invalid-name' })

    expect(propertyOf(id).name).toBe('float1')
    expect(historyLength()).toBe(before)
  })

  it('rejects a name another property uses', () => {
    addOrFail('float')
    const id = addOrFail('float')

    expect(getState().renameProperty(id, 'float1')).toMatchObject({ code: 'duplicate-name' })
    expect(propertyOf(id).name).toBe('float2')
  })
})

describe('property values', () => {
  it('sets a value as one entry, and ignores the same value', () => {
    const id = addOrFail('float')
    const before = historyLength()

    getState().setPropertyValue(id, float(2))
    getState().setPropertyValue(id, float(2))

    expect(propertyOf(id).value).toEqual(float(2))
    expect(historyLength()).toBe(before + 1)
  })

  it('previews a value without touching the graph or the history', () => {
    const id = addOrFail('float')
    const graph = getState().graph
    const before = historyLength()

    getState().previewPropertyValue(id, float(3))
    expect(getState().propertyPreview).toEqual({ id, value: float(3) })
    getState().clearPropertyPreview()

    expect(getState().propertyPreview).toBeNull()
    expect(getState().graph).toBe(graph)
    expect(historyLength()).toBe(before)
  })

  it('toggles exposed', () => {
    const id = addOrFail('float')
    getState().setPropertyExposed(id, false)
    expect(propertyOf(id).exposed).toBe(false)
  })
})

describe('addPropertyNode', () => {
  it('adds a reader with the property id as one entry', () => {
    const id = addOrFail('float')
    const before = historyLength()

    const nodeId = readerOrFail(id)

    expect(getState().graph.nodes[nodeId]).toMatchObject({
      type: 'property/float',
      params: { [PROPERTY_ID_PARAM]: id },
    })
    expect(historyLength()).toBe(before + 1)
  })
})

describe('removeProperty', () => {
  it('removes the property, its readers and their edges at once; one undo restores all', () => {
    const id = addOrFail('float')
    const reader = readerOrFail(id)
    getState().connect(
      { nodeId: reader, portId: 'out' },
      { nodeId: MASTER_NODE_ID, portId: 'roughness' },
    )
    getState().setSelection([reader])
    const used = getState().graph
    const before = historyLength()

    getState().removeProperty(id)

    const { graph, selectedNodeIds } = getState()
    expect(graph.properties).toHaveLength(0)
    expect(graph.nodes[reader]).toBeUndefined()
    expect(Object.keys(graph.edges)).toHaveLength(0)
    expect(selectedNodeIds).toEqual([])
    expect(historyLength()).toBe(before + 1)

    undo()
    expect(getState().graph).toBe(used)
  })

  it('ends a preview of the removed property', () => {
    const id = addOrFail('float')
    getState().previewPropertyValue(id, float(1))

    getState().removeProperty(id)

    expect(getState().propertyPreview).toBeNull()
  })
})
