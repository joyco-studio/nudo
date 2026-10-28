import { addNode, asNodeId, createGraph } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { registry } from '@/store/registry'

import { isGraphMeasured } from './is-graph-measured'
import type { MeasuredSize } from './is-graph-measured'

function graphWithSine() {
  const added = addNode(createGraph(), registry, {
    id: asNodeId('sine'),
    type: 'math/sin',
    position: { x: 0, y: 0 },
  })
  if (!added.ok) throw new Error('Could not add a sine')
  return added.value
}

const sizes =
  (known: Readonly<Record<string, MeasuredSize>>) =>
  (nodeId: string): MeasuredSize | undefined =>
    known[nodeId]

describe('isGraphMeasured', () => {
  it('is true once every node of the graph has a size, sizes kept from before included', () => {
    const graph = graphWithSine()
    const measured = sizes({
      master: { width: 256, height: 400 },
      sine: { width: 224, height: 90 },
    })

    expect(isGraphMeasured(graph, measured)).toBe(true)
  })

  it('waits for a node the canvas has not measured yet', () => {
    const graph = graphWithSine()

    expect(isGraphMeasured(graph, sizes({ master: { width: 256, height: 400 } }))).toBe(false)
    expect(
      isGraphMeasured(
        graph,
        sizes({ master: { width: 256, height: 400 }, sine: { width: 0, height: 0 } }),
      ),
    ).toBe(false)
  })
})
