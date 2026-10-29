import {
  MASTER_NODE_ID,
  addNode,
  addProperty,
  addPropertyNode,
  asEdgeId,
  asNodeId,
  asPropertyId,
  connect,
  createGraph,
  float,
} from '@nudo-tsl/core'
import type { BlackboardProperty, Graph, NodeRegistry, PortRef } from '@nudo-tsl/core'
import { unwrap } from './unwrap'

const ORIGIN = { x: 0, y: 0 }

/** An exposed Blackboard property that takes the name of the module's `lights` export. */
export const LIGHTS_PROPERTY: BlackboardProperty = {
  id: asPropertyId('prop-lights'),
  label: 'Lights',
  name: 'lights',
  exposed: true,
  type: 'float',
  value: float(0.5),
}

/**
 * A graph whose roughness is the `lights` property times a Main Light's Lambert term, so the
 * module prints both `uniforms.lights` and the `lights` export.
 */
export function createLightsPropertyGraph(registry: NodeRegistry): Graph {
  const reader = asNodeId('lights-reader')
  const sun = asNodeId('sun')
  const product = asNodeId('product')
  let graph = unwrap(addProperty(createGraph(), LIGHTS_PROPERTY))
  graph = unwrap(
    addPropertyNode(graph, registry, {
      id: reader,
      propertyId: LIGHTS_PROPERTY.id,
      position: ORIGIN,
    }),
  )
  graph = unwrap(addNode(graph, registry, { id: sun, type: 'input/main-light', position: ORIGIN }))
  graph = unwrap(addNode(graph, registry, { id: product, type: 'math/multiply', position: ORIGIN }))

  const links: readonly (readonly [PortRef, PortRef])[] = [
    [
      { nodeId: reader, portId: 'out' },
      { nodeId: product, portId: 'a' },
    ],
    [
      { nodeId: sun, portId: 'lambert' },
      { nodeId: product, portId: 'b' },
    ],
    [
      { nodeId: product, portId: 'out' },
      { nodeId: MASTER_NODE_ID, portId: 'roughness' },
    ],
  ]
  return links.reduce(
    (current, [from, to]) =>
      unwrap(
        connect(current, registry, {
          id: asEdgeId(`${from.nodeId}.${from.portId}-${to.nodeId}.${to.portId}`),
          from,
          to,
        }),
      ),
    graph,
  )
}
