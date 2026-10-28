import {
  addNode,
  asEdgeId,
  asNodeId,
  compile,
  connect,
  createGraph,
  splitEdge,
} from '@nudo-tsl/core'
import type { CompileBackend, Graph, Result } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { createDefaultRegistry, createRecordingFacade, rerouteNode } from './index'

const registry = createDefaultRegistry()

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const backend: CompileBackend<string> = {
  tsl: createRecordingFacade(),
  inputValue: (ref) => `u(${ref.nodeId}:${ref.portId})`,
  property: (property) => `prop(${property.name})`,
}

const NOISE_TO_BASE_COLOR = asEdgeId('noise-to-base-color')

/** Noise feeding the master's Base Color: a float widened to vec3 where it enters. */
function noiseToBaseColor(): Graph {
  const withNoise = unwrap(
    addNode(createGraph(), registry, {
      id: asNodeId('noise'),
      type: 'effects/noise',
      position: { x: 0, y: 0 },
    }),
  )
  return unwrap(
    connect(withNoise, registry, {
      id: NOISE_TO_BASE_COLOR,
      from: { nodeId: asNodeId('noise'), portId: 'out' },
      to: { nodeId: asNodeId('master'), portId: 'baseColor' },
    }),
  )
}

function withReroute(graph: Graph): Graph {
  return unwrap(
    splitEdge(graph, registry, {
      edgeId: NOISE_TO_BASE_COLOR,
      node: { id: asNodeId('dot'), type: rerouteNode.type, position: { x: 100, y: 0 } },
      inputPortId: 'in',
      outputPortId: 'out',
      edgeIds: [asEdgeId('into-dot'), asEdgeId('out-of-dot')],
    }),
  )
}

describe('reroute node', () => {
  it('is a registered utility node with one generic input and output in the same group', () => {
    expect(registry.get('utility/reroute')).toBe(rerouteNode)
    expect(rerouteNode.category).toBe('utility')
    expect(rerouteNode.passthrough).toBe(true)
    expect(rerouteNode.inputs.map((input) => [input.id, input.type])).toEqual([
      ['in', { kind: 'generic', group: 'T', allowed: ['float', 'vec2', 'vec3', 'vec4'] }],
    ])
    expect(rerouteNode.outputs.map((output) => [output.id, output.type])).toEqual([
      ['out', { kind: 'generic', group: 'T', allowed: ['float', 'vec2', 'vec3', 'vec4'] }],
    ])
  })

  it('hands its input on unchanged', () => {
    const built = rerouteNode.build({
      tsl: createRecordingFacade(),
      inputs: { in: 'value' },
      resolvedTypes: { in: 'vec3' },
      params: {},
      property: null,
    })

    expect(built).toEqual({ out: 'value' })
  })

  it('leaves the compiled master exactly as it was without the reroute', () => {
    const direct = compile(noiseToBaseColor(), registry, backend, { kind: 'master' })
    const rerouted = compile(withReroute(noiseToBaseColor()), registry, backend, { kind: 'master' })

    expect(rerouted).toEqual(direct)
    expect(rerouted.ok).toBe(true)
  })
})
