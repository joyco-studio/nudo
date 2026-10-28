import { MASTER_NODE_ID, addNode, asNodeId, createGraph } from '@nudo-tsl/core'
import type { CompileError, Graph } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { nodeRegistryFor } from '@/i18n/use-node-registry'
import { registry } from '@/store/registry'

import { failedNodesOf } from './failed-nodes'

const SINE = asNodeId('sine')

function graphWithSine(): Graph {
  const added = addNode(createGraph(), registry, {
    id: SINE,
    type: 'math/sin',
    position: { x: 0, y: 0 },
  })
  if (!added.ok) throw new Error('Could not add the Sine node')
  return added.value
}

const failure = (nodeId: string, message = 'broken'): CompileError => ({
  nodeId: asNodeId(nodeId),
  code: 'build-failed',
  message,
})

describe('failedNodesOf', () => {
  it('names each failing node once, in the order the errors name them', () => {
    const errors = [failure('sine'), failure(MASTER_NODE_ID), failure('sine', 'again')]

    expect(failedNodesOf(errors, graphWithSine(), registry)).toEqual([
      { nodeId: SINE, title: 'Sine' },
      { nodeId: MASTER_NODE_ID, title: 'Master Stack' },
    ])
  })

  it('titles nodes in the UI language', () => {
    const [entry] = failedNodesOf([failure('sine')], graphWithSine(), nodeRegistryFor('es'))

    expect(entry?.title).toBe('Seno')
  })

  it('leaves out a node deleted since the module was generated', () => {
    expect(failedNodesOf([failure('gone')], graphWithSine(), registry)).toEqual([])
  })
})
