import { MASTER_NODE_ID, PREVIEW_MODE_PARAM, SHOW_PREVIEW_PARAM, topologyKey } from '@nudo-tsl/core'
import type {
  AnyNodeDefinition,
  Graph,
  GraphEdge,
  GraphNode,
  NodeId,
  NodeRegistry,
  NodeTypeId,
  PortRef,
} from '@nudo-tsl/core'
import {
  commentNode,
  fresnelNode,
  normalFromHeightNode,
  normalNode,
  positionNode,
  rerouteNode,
  timeNode,
  triplanarNode,
  viewDirectionNode,
  voronoi3dNode,
} from '@nudo-tsl/nodes'

/** A flat quad (2D, drawn square) or a sphere (3D, drawn as a circle like Unity's previews). */
export type PreviewShape = '2d' | '3d'

/**
 * Nodes that pass a value along without shaping it have nothing of their own to show: a reroute
 * is a dot on a wire, and a comment has no output.
 */
const NO_PREVIEW_TYPES: ReadonlySet<NodeTypeId> = new Set([commentNode.type, rerouteNode.type])

/** Upstream nodes whose value only makes sense on a curved surface, so `auto` picks the sphere. */
const SURFACE_NODE_TYPES: ReadonlySet<NodeTypeId> = new Set([
  normalNode.type,
  positionNode.type,
  viewDirectionNode.type,
  fresnelNode.type,
  normalFromHeightNode.type,
  voronoi3dNode.type,
  triplanarNode.type,
])

/** Upstream nodes that change every frame, so the preview keeps rendering while it is visible. */
const ANIMATED_NODE_TYPES: ReadonlySet<NodeTypeId> = new Set([timeNode.type])

/**
 * Whether a node can show a preview at all: never the master (the Main Preview is its preview),
 * a property pill, a reroute or a node without outputs.
 */
export function hasNodePreview(node: GraphNode, definition: AnyNodeDefinition): boolean {
  return (
    node.id !== MASTER_NODE_ID &&
    definition.reads !== 'property' &&
    definition.outputs.length > 0 &&
    !NO_PREVIEW_TYPES.has(node.type)
  )
}

/** Whether the preview is switched on: the universal `showPreview` param, on by default. */
export function isPreviewShown(node: GraphNode): boolean {
  return node.params[SHOW_PREVIEW_PARAM] !== false
}

/** The output a node previews: its first one, like Unity. `null` for a node without a preview. */
export function previewPortRef(node: GraphNode, definition: AnyNodeDefinition): PortRef | null {
  const [output] = definition.outputs
  if (output === undefined || !hasNodePreview(node, definition)) return null
  return { nodeId: node.id, portId: output.id }
}

function sourcesByTarget(graph: Graph): ReadonlyMap<NodeId, readonly NodeId[]> {
  const sources = new Map<NodeId, NodeId[]>()
  for (const edge of Object.values(graph.edges)) {
    const list = sources.get(edge.to.nodeId)
    if (list === undefined) sources.set(edge.to.nodeId, [edge.from.nodeId])
    else list.push(edge.from.nodeId)
  }
  return sources
}

/** The node and every node that feeds it, directly or through others. */
export function upstreamNodeIds(graph: Graph, nodeId: NodeId): ReadonlySet<NodeId> {
  const sources = sourcesByTarget(graph)
  const upstream = new Set<NodeId>()
  const pending: NodeId[] = [nodeId]
  for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
    if (upstream.has(next) || graph.nodes[next] === undefined) continue
    upstream.add(next)
    pending.push(...(sources.get(next) ?? []))
  }
  return upstream
}

function pickNodes(graph: Graph, ids: ReadonlySet<NodeId>): Graph['nodes'] {
  return Object.fromEntries(Object.entries(graph.nodes).filter(([, node]) => ids.has(node.id)))
}

function pickEdges(graph: Graph, ids: ReadonlySet<NodeId>): Graph['edges'] {
  const isUpstreamEdge = (edge: GraphEdge): boolean => ids.has(edge.to.nodeId)
  return Object.fromEntries(Object.entries(graph.edges).filter(([, edge]) => isUpstreamEdge(edge)))
}

/**
 * The topology a preview depends on: the nodes and edges upstream of the port, plus the port. A
 * change anywhere else in the graph leaves it equal, so that preview is not rebuilt.
 */
export function upstreamTopologyKey(graph: Graph, ref: PortRef, registry: NodeRegistry): string {
  const ids = upstreamNodeIds(graph, ref.nodeId)
  const subgraph: Graph = { ...graph, nodes: pickNodes(graph, ids), edges: pickEdges(graph, ids) }
  return `${ref.portId}|${topologyKey(subgraph, registry)}`
}

function upstreamUses(graph: Graph, nodeId: NodeId, types: ReadonlySet<NodeTypeId>): boolean {
  for (const id of upstreamNodeIds(graph, nodeId)) {
    const node = graph.nodes[id]
    if (node !== undefined && types.has(node.type)) return true
  }
  return false
}

/** Whether the preview changes over time (Time upstream), so it animates while it is visible. */
export function isAnimatedPreview(graph: Graph, nodeId: NodeId): boolean {
  return upstreamUses(graph, nodeId, ANIMATED_NODE_TYPES)
}

/**
 * The shape a node previews on: its `previewMode` override, or on `auto` a sphere when the value
 * depends on the surface (normal, position, view direction, fresnel, normal from height) and a
 * quad otherwise.
 */
export function resolvePreviewShape(graph: Graph, nodeId: NodeId): PreviewShape {
  const mode = graph.nodes[nodeId]?.params[PREVIEW_MODE_PARAM]
  if (mode === '2d' || mode === '3d') return mode
  return upstreamUses(graph, nodeId, SURFACE_NODE_TYPES) ? '3d' : '2d'
}
