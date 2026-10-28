import { addNode, asNodeId, createGraph, setParam } from '@nudo-tsl/core'
import type { Graph, GraphError, NodeId, Result } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { paletteResults } from './palette-results'
import type { PaletteGroup } from './palette-results'

const SINE_ID = asNodeId('sine')
const NOTE_ID = asNodeId('note')

function unwrap(result: Result<Graph, GraphError>): Graph {
  if (!result.ok) throw new Error(`Graph operation failed: ${JSON.stringify(result.error)}`)
  return result.value
}

function withNode(graph: Graph, id: NodeId, type: string): Graph {
  return unwrap(addNode(graph, registry, { id, type, position: { x: 0, y: 0 } }))
}

/** The master, a Sine node and a comment titled "Ripples". */
function sampleGraph(): Graph {
  const graph = withNode(withNode(createGraph(), SINE_ID, 'math/sin'), NOTE_ID, 'utility/comment')
  return unwrap(setParam(graph, registry, { nodeId: NOTE_ID, paramId: 'title' }, 'Ripples'))
}

function search(query: string): readonly PaletteGroup[] {
  return paletteResults({ query, graph: sampleGraph(), registry })
}

function summarize(groups: readonly PaletteGroup[]) {
  return groups.map((group) => ({ group: group.id, keys: group.items.map((item) => item.key) }))
}

describe('paletteResults', () => {
  it('shows only the commands, Actions, View then Examples, before anything is typed', () => {
    const groups = search('')
    expect(groups.map((group) => group.id)).toEqual(['actions', 'view', 'examples'])
  })

  it('ranks commands above the node lists, so "split" runs the split layout first', () => {
    const groups = search('split')
    expect(groups.map((group) => group.id)).toEqual(['view', 'add-node'])
    expect(groups[0]?.items[0]?.key).toBe('command:preview-split')
    expect(groups[1]?.items.map((item) => item.key)).toEqual(['add:vector/split'])
  })

  it('finds nodes in the graph by the title they show, before nodes to add', () => {
    const sine = summarize(search('sine'))
    expect(sine.map((group) => group.group)).toEqual(['nodes-in-graph', 'add-node'])
    expect(sine[0]?.keys).toEqual(['node:sine'])
    expect(sine[1]?.keys[0]).toBe('add:math/sin')
    const ripples = search('ripples')
    expect(ripples).toEqual([
      {
        id: 'nodes-in-graph',
        items: [
          { kind: 'jump', key: 'node:note', nodeId: NOTE_ID, label: 'Ripples', detail: 'Comment' },
        ],
      },
    ])
  })

  it('matches nodes in the graph and nodes to add the same way: "ine" finds Sine in both', () => {
    const groups = search('ine')
    const keysOf = (id: string) => groups.find((group) => group.id === id)?.items.map((i) => i.key)
    expect(keysOf('nodes-in-graph')).toEqual(['node:sine'])
    expect(keysOf('add-node')).toContain('add:math/sin')
  })

  it('finds nodes in the graph by keyword and type id too, like the add-node search', () => {
    // "annotation" is a Comment keyword; "math/sin" is Sine's type id.
    const inGraph = (query: string) =>
      summarize(search(query)).find((group) => group.group === 'nodes-in-graph')?.keys
    expect(inGraph('annotation')).toEqual(['node:note'])
    expect(inGraph('math/sin')).toEqual(['node:sine'])
  })

  it('lists the master as a node to jump to, never as one to add', () => {
    expect(summarize(search('master stack'))).toEqual([
      { group: 'nodes-in-graph', keys: ['node:master'] },
    ])
  })

  it('returns no groups when nothing matches', () => {
    expect(search('zzz-no-such-thing')).toEqual([])
  })
})
