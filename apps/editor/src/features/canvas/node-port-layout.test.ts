import { MASTER_NODE_ID, asNodeId } from '@nudo-tsl/core'
import type { GraphNode } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { UNLIT_IGNORED_HINT, inputGroups, visibleOutputs } from './node-port-layout'
import type { FlowNodeData } from './to-flow'

function dataFor(
  node: GraphNode,
  connected: { inputs?: readonly string[]; outputs?: readonly string[] } = {},
): FlowNodeData {
  const definition = registry.get(node.type)
  if (definition === undefined) throw new Error(`Missing ${node.type}`)
  return {
    definition,
    node,
    title: definition.label,
    typeChip: null,
    inputTypes: {},
    outputTypes: {},
    connectedInputs: new Set(connected.inputs ?? []),
    connectedOutputs: new Set(connected.outputs ?? []),
    error: undefined,
  }
}

const sine = (params: GraphNode['params'] = {}): GraphNode => ({
  id: asNodeId('sine'),
  type: 'math/sin',
  position: { x: 0, y: 0 },
  inputValues: {},
  params,
})

const master = (params: GraphNode['params'] = {}): GraphNode => ({
  id: MASTER_NODE_ID,
  type: 'master/stack',
  position: { x: 0, y: 0 },
  inputValues: {},
  params,
})

const inputIds = (data: FlowNodeData) =>
  inputGroups(data).flatMap((group) => group.rows.map((row) => row.input.id))

describe('node port layout', () => {
  it('shows every port of an expanded node', () => {
    const data = dataFor(sine())
    expect(inputIds(data)).toEqual(['in'])
    expect(visibleOutputs(data).map((output) => output.id)).toEqual(['out'])
  })

  it('shows only connected ports of a collapsed node', () => {
    const data = dataFor(sine({ collapsed: true }), { inputs: ['in'] })
    expect(inputIds(data)).toEqual(['in'])
    expect(visibleOutputs(data)).toEqual([])
  })

  it('groups the master inputs into Vertex and Fragment', () => {
    const groups = inputGroups(dataFor(master()))
    expect(groups.map((group) => group.title)).toEqual(['Vertex', 'Fragment'])
    expect(groups[0]?.rows.map((row) => row.input.id)).toEqual(['position'])
  })

  it('marks metalness, roughness and normal as ignored by an unlit master', () => {
    const rows = inputGroups(dataFor(master({ lighting: 'unlit' }))).flatMap((group) => group.rows)
    const disabled = rows.filter((row) => row.disabledHint === UNLIT_IGNORED_HINT)
    expect(disabled.map((row) => row.input.id)).toEqual(['metalness', 'roughness', 'normal'])
    const standardRows = inputGroups(dataFor(master())).flatMap((group) => group.rows)
    expect(standardRows.every((row) => row.disabledHint === null)).toBe(true)
  })
})
