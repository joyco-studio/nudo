import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { GraphEdge, NodeId, XY } from '@nudo-tsl/core'

import { layeredLayout } from './layered-layout'
import type { LayoutBlock, LayoutLink } from './layered-layout'

/** A node as the canvas shows it: its box and where its ports sit. */
export interface NodeGeometry {
  readonly id: NodeId
  readonly position: XY
  readonly width: number
  readonly height: number
  /** A comment frame: it carries the nodes whose middle lies on it. */
  readonly isFrame: boolean
  /** The middle of each input port, below the node's top, by port id. */
  readonly inputY: Readonly<Record<string, number>>
  /** The middle of each output port, below the node's top, by port id. */
  readonly outputY: Readonly<Record<string, number>>
}

export type TidyScope =
  { readonly kind: 'graph' } | { readonly kind: 'selection'; readonly nodeIds: readonly NodeId[] }

export type TidyPlan = Readonly<Partial<Record<NodeId, XY>>>

interface Block extends LayoutBlock {
  readonly members: readonly NodeGeometry[]
}

const areaOf = (item: NodeGeometry): number => item.width * item.height

function contains(frame: NodeGeometry, item: NodeGeometry): boolean {
  const middle = { x: item.position.x + item.width / 2, y: item.position.y + item.height / 2 }
  return (
    middle.x >= frame.position.x &&
    middle.x <= frame.position.x + frame.width &&
    middle.y >= frame.position.y &&
    middle.y <= frame.position.y + frame.height
  )
}

/**
 * The outermost frame an item lies on (its middle inside, and the frame larger than it), or none.
 * Nested frames travel with the outermost one, so a group is never pulled apart.
 */
function outermostFrame(
  item: NodeGeometry,
  frames: readonly NodeGeometry[],
): NodeGeometry | undefined {
  return frames
    .filter(
      (frame) => frame.id !== item.id && areaOf(frame) > areaOf(item) && contains(frame, item),
    )
    .reduce<NodeGeometry | undefined>(
      (largest, frame) =>
        largest === undefined || areaOf(frame) > areaOf(largest) ? frame : largest,
      undefined,
    )
}

/** One block per top-level frame (with what lies on it) and per node on no frame. */
function blocksOf(nodes: readonly NodeGeometry[]): readonly Block[] {
  const frames = nodes.filter((item) => item.isFrame)
  const membersByBlock = new Map<NodeId, NodeGeometry[]>()
  for (const item of nodes) {
    const ownerId = outermostFrame(item, frames)?.id ?? item.id
    membersByBlock.set(ownerId, [...(membersByBlock.get(ownerId) ?? []), item])
  }
  return [...membersByBlock].map(([id, members]): Block => {
    const left = Math.min(...members.map((member) => member.position.x))
    const top = Math.min(...members.map((member) => member.position.y))
    const right = Math.max(...members.map((member) => member.position.x + member.width))
    const bottom = Math.max(...members.map((member) => member.position.y + member.height))
    return { id, position: { x: left, y: top }, width: right - left, height: bottom - top, members }
  })
}

function linksBetween(
  edges: readonly GraphEdge[],
  blockOf: ReadonlyMap<NodeId, Block>,
  geometry: ReadonlyMap<NodeId, NodeGeometry>,
): readonly LayoutLink[] {
  return edges.flatMap((edge) => {
    const from = blockOf.get(edge.from.nodeId)
    const to = blockOf.get(edge.to.nodeId)
    const source = geometry.get(edge.from.nodeId)
    const target = geometry.get(edge.to.nodeId)
    if (from === undefined || to === undefined || source === undefined || target === undefined) {
      return []
    }
    const sourcePortY = source.outputY[edge.from.portId] ?? source.height / 2
    const targetPortY = target.inputY[edge.to.portId] ?? target.height / 2
    return [
      {
        from: from.id,
        to: to.id,
        fromOffsetY: source.position.y - from.position.y + sourcePortY,
        toOffsetY: target.position.y - to.position.y + targetPortY,
      },
    ]
  })
}

function isInScope(block: Block, scope: TidyScope): boolean {
  if (scope.kind === 'graph') return true
  return block.members.some((member) => scope.nodeIds.includes(member.id))
}

/**
 * Where tidying up puts each node: a layered layout, left to right, with the Master Stack last and
 * unmoved. A comment frame moves as one block with every node on it, so a group stays a group. For
 * a selection, only the blocks holding a selected node move. Lists only the nodes that move.
 */
export function planTidyUp(
  edges: readonly GraphEdge[],
  nodes: readonly NodeGeometry[],
  scope: TidyScope,
): TidyPlan {
  const blocks = blocksOf(nodes).filter((block) => isInScope(block, scope))
  if (blocks.length < 2) return {}

  const geometry = new Map(nodes.map((item) => [item.id, item]))
  const blockOf = new Map(
    blocks.flatMap((block) => block.members.map((member): [NodeId, Block] => [member.id, block])),
  )
  const sink = blockOf.get(MASTER_NODE_ID)
  const layout = layeredLayout({
    blocks,
    links: linksBetween(edges, blockOf, geometry),
    sinkId: sink?.id ?? null,
  })

  const plan: Partial<Record<NodeId, XY>> = {}
  for (const block of blocks) {
    const target = layout.get(block.id)
    if (target === undefined) continue
    const delta = { x: target.x - block.position.x, y: target.y - block.position.y }
    if (delta.x === 0 && delta.y === 0) continue
    for (const member of block.members) {
      plan[member.id] = { x: member.position.x + delta.x, y: member.position.y + delta.y }
    }
  }
  return plan
}
