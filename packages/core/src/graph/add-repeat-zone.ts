import type { NodeRegistry } from '../registry/node-registry'
import { REPEAT_INPUT_PARAM } from '../repeat/repeat-zone'
import type { Graph, GraphNode, XY } from '../types/graph'
import type { NodeId, NodeTypeId } from '../types/ids'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { defaultParams } from './default-params'
import type { GraphError } from './graph-error'

export interface AddRepeatZoneInput {
  readonly inputId: NodeId
  readonly outputId: NodeId
  /** Where the Repeat Input goes; the Repeat Output sits `REPEAT_ZONE_WIDTH` to its right. */
  readonly position: XY
}

/** How far right of its Repeat Input a new Repeat Output sits: room for a body in between. */
export const REPEAT_ZONE_WIDTH = 520

/** The registered definitions of the two ends of a zone, by `repeat` marker. */
function zoneTypes(registry: NodeRegistry): { input: NodeTypeId; output: NodeTypeId } | null {
  const definitions = registry.list()
  const input = definitions.find((definition) => definition.repeat === 'input')
  const output = definitions.find((definition) => definition.repeat === 'output')
  return input === undefined || output === undefined
    ? null
    : { input: input.type, output: output.type }
}

/**
 * Adds a Repeat zone in one step: a Repeat Input and the Repeat Output paired with it, so the
 * graph never holds one end without the other.
 */
export function addRepeatZone(
  graph: Graph,
  registry: NodeRegistry,
  input: AddRepeatZoneInput,
): Result<Graph, GraphError> {
  const types = zoneTypes(registry)
  if (types === null) return err({ code: 'unknown-node-type', type: 'repeat' })
  for (const id of [input.inputId, input.outputId]) {
    if (graph.nodes[id] !== undefined) return err({ code: 'duplicate-id', id })
  }
  if (input.inputId === input.outputId) return err({ code: 'duplicate-id', id: input.outputId })

  const nodeOf = (id: NodeId, type: NodeTypeId, position: XY): GraphNode => {
    const definition = registry.get(type)
    return {
      id,
      type,
      position,
      inputValues: {},
      params: definition === undefined ? {} : defaultParams(definition),
    }
  }
  const start = nodeOf(input.inputId, types.input, input.position)
  const end = nodeOf(input.outputId, types.output, {
    x: input.position.x + REPEAT_ZONE_WIDTH,
    y: input.position.y,
  })
  const paired = { ...end, params: { ...end.params, [REPEAT_INPUT_PARAM]: input.inputId } }
  return ok({ ...graph, nodes: { ...graph.nodes, [start.id]: start, [paired.id]: paired } })
}
