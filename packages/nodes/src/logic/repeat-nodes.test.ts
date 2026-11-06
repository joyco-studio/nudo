import {
  MASTER_NODE_ID,
  REPEAT_INPUT_PARAM,
  addNode,
  addRepeatZone,
  asEdgeId,
  asNodeId,
  compile,
  connect,
  createGraph,
  resolvePortTypes,
} from '@nudo-tsl/core'
import type { CompileBackend, Graph, Result } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import { createDefaultRegistry, createRecordingFacade, openRecordingRepeat } from '../index'
import { repeatInputNode, repeatOutputNode } from './repeat-nodes'

const registry = createDefaultRegistry()
const ORIGIN = { x: 0, y: 0 }

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const backend: CompileBackend<string> = {
  tsl: createRecordingFacade(),
  inputValue: (ref) => `u(${ref.nodeId}:${ref.portId})`,
  property: (property) => `prop(${property.name})`,
  openRepeat: openRecordingRepeat,
}

/** A zone that adds the normal to the position each pass, into the base color. */
function marchingZone(): Graph {
  let graph = unwrap(
    addRepeatZone(createGraph(), registry, {
      inputId: asNodeId('p'),
      outputId: asNodeId('r'),
      position: ORIGIN,
    }),
  )
  for (const [id, type] of [
    ['position', 'input/position'],
    ['normal', 'input/normal'],
    ['step', 'math/add'],
  ] as const) {
    graph = unwrap(addNode(graph, registry, { id: asNodeId(id), type, position: ORIGIN }))
  }
  const wires = [
    [
      ['position', 'out'],
      ['p', 'a'],
    ],
    [
      ['p', 'a'],
      ['step', 'a'],
    ],
    [
      ['normal', 'out'],
      ['step', 'b'],
    ],
    [
      ['step', 'out'],
      ['r', 'a'],
    ],
    [
      ['r', 'a'],
      [MASTER_NODE_ID, 'baseColor'],
    ],
  ] as const
  wires.forEach(([[fromId, fromPort], [toId, toPort]], index) => {
    graph = unwrap(
      connect(graph, registry, {
        id: asEdgeId(`e${String(index)}`),
        from: { nodeId: asNodeId(fromId), portId: fromPort },
        to: { nodeId: asNodeId(toId), portId: toPort },
      }),
    )
  })
  return graph
}

describe('Repeat Input and Repeat Output', () => {
  it('mark the two ends of a zone, the output pairing through a hidden param', () => {
    expect(repeatInputNode.repeat).toBe('input')
    expect(repeatOutputNode.repeat).toBe('output')
    expect(repeatOutputNode.params?.find((param) => param.id === REPEAT_INPUT_PARAM)).toMatchObject(
      { kind: 'string', hidden: true },
    )
  })

  it('compile into a loop that reads the outside value once', () => {
    const result = compile(marchingZone(), registry, backend, { kind: 'master' })

    expect(
      result.ok && result.output.kind === 'master' ? result.output.slots.baseColor : result,
    ).toBe(
      'repeat(p,u(p:iterations),[builtin(positionLocal)],[add(state(p,0),captured(builtin(normalWorld)))])[0]',
    )
  })

  it('give every slot of the zone the type of its starting value', () => {
    const types = resolvePortTypes(marchingZone(), registry)

    expect([types.outputs.get('p:a'), types.inputs.get('r:a'), types.outputs.get('r:a')]).toEqual([
      'vec3',
      'vec3',
      'vec3',
    ])
  })

  it('preview the body at its first pass', () => {
    const result = compile(marchingZone(), registry, backend, {
      kind: 'port',
      ref: { nodeId: asNodeId('step'), portId: 'out' },
    })

    expect(result).toEqual({
      ok: true,
      output: { kind: 'port', expression: 'add(builtin(positionLocal),builtin(normalWorld))' },
    })
  })
})
