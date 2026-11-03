import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { Graph, NodeId, XY } from '@nudo-tsl/core'
import {
  BESIDE_NODE_OFFSET_X,
  NEW_NODE_SIZE,
  findFreeSpot,
} from '@/features/add-node-menu/add-node-placement'
import type { FlowRect } from '@/features/add-node-menu/add-node-placement'

const ORIGIN: XY = { x: 0, y: 0 }

const toRect = (position: XY): FlowRect => ({ ...position, ...NEW_NODE_SIZE })

/**
 * Where an agent-added node goes when it names no position: to the left of the node the agent
 * touched last (nodes feed the master from the left), else to the left of the master, and never on
 * top of another node.
 */
export function placeForAgent(graph: Graph, near: NodeId | null): XY {
  const anchor = (near === null ? undefined : graph.nodes[near]) ?? graph.nodes[MASTER_NODE_ID]
  const origin = anchor?.position ?? ORIGIN
  const wanted: XY = { x: origin.x - BESIDE_NODE_OFFSET_X, y: origin.y }
  return findFreeSpot(
    wanted,
    Object.values(graph.nodes).map((node) => toRect(node.position)),
  )
}
