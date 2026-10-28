import { MASTER_NODE_ID, setParam } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import {
  hasNodePreview,
  isAnimatedPreview,
  isPreviewShown,
  previewPortRef,
  resolvePreviewShape,
  upstreamNodeIds,
  upstreamTopologyKey,
} from './preview-graph'
import { graphWith, id, port, unwrap, withEdge, withNode } from './test-graph'

function definitionOf(graph: Graph, nodeId: string) {
  const node = graph.nodes[id(nodeId)]
  const definition = node === undefined ? undefined : registry.get(node.type)
  if (node === undefined || definition === undefined) throw new Error(`No node ${nodeId}`)
  return { node, definition }
}

const hasPreview = (graph: Graph, nodeId: string): boolean => {
  const { node, definition } = definitionOf(graph, nodeId)
  return hasNodePreview(node, definition)
}

describe('which nodes preview', () => {
  const graph = graphWith([
    ['color', 'input/color'],
    ['note', 'utility/comment'],
  ])

  it('previews a node with an output, never the master or a comment', () => {
    expect(hasPreview(graph, 'color')).toBe(true)
    expect(hasPreview(graph, MASTER_NODE_ID)).toBe(false)
    expect(hasPreview(graph, 'note')).toBe(false)
  })

  it('previews the first output', () => {
    const { node, definition } = definitionOf(graph, 'color')
    expect(previewPortRef(node, definition)).toEqual(port('color', 'out'))
  })

  it('shows a preview until the showPreview param turns it off', () => {
    const hidden = unwrap(
      setParam(graph, registry, { nodeId: id('color'), paramId: 'showPreview' }, false),
    )
    expect(isPreviewShown(definitionOf(graph, 'color').node)).toBe(true)
    expect(isPreviewShown(definitionOf(hidden, 'color').node)).toBe(false)
  })
})

describe('upstream analysis', () => {
  const chain = withEdge(
    withEdge(
      graphWith([
        ['time', 'input/time'],
        ['fract', 'math/fract'],
        ['sine', 'math/sin'],
        ['color', 'input/color'],
      ]),
      port('time', 'out'),
      port('fract', 'in'),
    ),
    port('fract', 'out'),
    port('sine', 'in'),
  )

  it('collects the node and everything feeding it', () => {
    expect(upstreamNodeIds(chain, id('sine'))).toEqual(new Set(['sine', 'fract', 'time']))
    expect(upstreamNodeIds(chain, id('color'))).toEqual(new Set(['color']))
  })

  it('keeps a preview key unchanged by edits outside its upstream', () => {
    const before = upstreamTopologyKey(chain, port('sine', 'out'), registry)
    const elsewhere = withNode(chain, 'noise', 'effects/noise')
    expect(upstreamTopologyKey(elsewhere, port('sine', 'out'), registry)).toBe(before)
  })

  it('changes a preview key when its upstream changes', () => {
    const before = upstreamTopologyKey(chain, port('sine', 'out'), registry)
    const rewired = withEdge(chain, port('time', 'out'), port('sine', 'in'))
    expect(upstreamTopologyKey(rewired, port('sine', 'out'), registry)).not.toBe(before)
  })

  it('animates only previews with Time upstream', () => {
    expect(isAnimatedPreview(chain, id('sine'))).toBe(true)
    expect(isAnimatedPreview(chain, id('color'))).toBe(false)
  })
})

describe('preview shape', () => {
  const graph = withEdge(
    graphWith([
      ['normal', 'input/normal'],
      ['split', 'vector/split'],
      ['uv', 'input/uv'],
    ]),
    port('normal', 'out'),
    port('split', 'in'),
  )

  it('picks a sphere on auto when the surface feeds the node, a quad otherwise', () => {
    expect(resolvePreviewShape(graph, id('split'))).toBe('3d')
    expect(resolvePreviewShape(graph, id('uv'))).toBe('2d')
  })

  it('follows a 2D or 3D override', () => {
    const forced = unwrap(
      setParam(graph, registry, { nodeId: id('split'), paramId: 'previewMode' }, '2d'),
    )
    const forcedUv = unwrap(
      setParam(forced, registry, { nodeId: id('uv'), paramId: 'previewMode' }, '3d'),
    )
    expect(resolvePreviewShape(forcedUv, id('split'))).toBe('2d')
    expect(resolvePreviewShape(forcedUv, id('uv'))).toBe('3d')
  })
})
