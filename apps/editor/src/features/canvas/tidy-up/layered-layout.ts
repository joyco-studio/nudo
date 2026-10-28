import type { XY } from '@nudo-tsl/core'

import { boundsOf } from './bounds'

/** Horizontal room between columns, in flow units: enough for a wire to curve. */
export const COLUMN_GAP = 96
/** Vertical room between neighbors in a column, in flow units. */
export const ROW_GAP = 32

/** Something the layout places: a node, or a comment frame with the nodes on it. */
export interface LayoutBlock {
  readonly id: string
  /** Where it is now: the tie-breaker for order, and the anchor of the layout. */
  readonly position: XY
  readonly width: number
  readonly height: number
}

/** A connection between two blocks, with where its ports sit below each block's top. */
export interface LayoutLink {
  readonly from: string
  readonly to: string
  readonly fromOffsetY: number
  readonly toOffsetY: number
}

export interface LayoutInput {
  readonly blocks: readonly LayoutBlock[]
  readonly links: readonly LayoutLink[]
  /**
   * The block everything flows into (the Master Stack): it stays where it is, alone in the last
   * column. Null: the layout keeps the top-left corner of the blocks instead.
   */
  readonly sinkId: string | null
}

interface Graph {
  readonly blocks: ReadonlyMap<string, LayoutBlock>
  readonly outgoing: ReadonlyMap<string, readonly LayoutLink[]>
  /** Blocks in a stable reading order: left to right, then top to bottom, then by id. */
  readonly order: readonly string[]
}

function byReadingOrder(a: LayoutBlock, b: LayoutBlock): number {
  return a.position.x - b.position.x || a.position.y - b.position.y || a.id.localeCompare(b.id)
}

/**
 * Indexes the links, without the ones that would close a cycle: a depth-first walk in reading
 * order drops each link back to a block still on its path. A cycle can only appear between
 * comment frames treated as one block each, never between plain nodes.
 */
function acyclicGraph(input: LayoutInput): Graph {
  const blocks = new Map(input.blocks.map((block) => [block.id, block]))
  const order = [...input.blocks].sort(byReadingOrder).map((block) => block.id)
  const candidates = new Map<string, LayoutLink[]>()
  for (const link of input.links) {
    if (link.from === link.to || !blocks.has(link.from) || !blocks.has(link.to)) continue
    candidates.set(link.from, [...(candidates.get(link.from) ?? []), link])
  }

  const outgoing = new Map<string, LayoutLink[]>()
  const state = new Map<string, 'open' | 'done'>()
  const visit = (id: string): void => {
    state.set(id, 'open')
    for (const link of candidates.get(id) ?? []) {
      if (state.get(link.to) === 'open') continue
      outgoing.set(id, [...(outgoing.get(id) ?? []), link])
      if (!state.has(link.to)) visit(link.to)
    }
    state.set(id, 'done')
  }
  for (const id of order) if (!state.has(id)) visit(id)
  return { blocks, outgoing, order }
}

/**
 * How many columns left of the last one a block goes: one more than the deepest block it feeds,
 * so every link runs left to right and a source sits as far left as its longest path needs. The
 * sink, and without one every block that feeds nothing, is the last column; with a sink, a loose
 * end that feeds nothing waits one column before it.
 */
function ranksFrom(graph: Graph, sinkId: string | null): ReadonlyMap<string, number> {
  const ranks = new Map<string, number>()
  const rankOf = (id: string): number => {
    const known = ranks.get(id)
    if (known !== undefined) return known
    const consumers = (graph.outgoing.get(id) ?? []).map((link) => rankOf(link.to))
    const rank =
      consumers.length > 0 ? 1 + Math.max(...consumers) : sinkId === null || id === sinkId ? 0 : 1
    ranks.set(id, rank)
    return rank
  }
  graph.order.forEach(rankOf)
  return ranks
}

function linkedIds(graph: Graph): ReadonlySet<string> {
  const linked = new Set<string>()
  for (const links of graph.outgoing.values()) {
    for (const link of links) {
      linked.add(link.from)
      linked.add(link.to)
    }
  }
  return linked
}

interface Wish {
  readonly block: LayoutBlock
  /** The top the block would like: where its links line up best. */
  readonly top: number
}

interface Cluster {
  top: number
  height: number
  idealSum: number
  readonly members: { wish: Wish; offset: number }[]
}

/**
 * Stacks a column's blocks in order, a row gap apart, as close to their wished tops as the order
 * allows: overlapping neighbors merge into a cluster that sits at the mean of its members' wishes.
 */
function packColumn(wishes: readonly Wish[]): ReadonlyMap<string, number> {
  const clusters: Cluster[] = []
  for (const wish of wishes) {
    clusters.push({
      top: wish.top,
      height: wish.block.height,
      idealSum: wish.top,
      members: [{ wish, offset: 0 }],
    })
    for (;;) {
      const last = clusters.at(-1)
      const previous = clusters.at(-2)
      if (last === undefined || previous === undefined) break
      if (previous.top + previous.height + ROW_GAP <= last.top) break
      const shift = previous.height + ROW_GAP
      for (const member of last.members) {
        const offset = member.offset + shift
        previous.members.push({ wish: member.wish, offset })
        previous.idealSum += member.wish.top - offset
      }
      previous.height = shift + last.height
      previous.top = previous.idealSum / previous.members.length
      clusters.pop()
    }
  }
  return new Map(
    clusters.flatMap((cluster) =>
      cluster.members.map((member): [string, number] => [
        member.wish.block.id,
        cluster.top + member.offset,
      ]),
    ),
  )
}

const mean = (values: readonly number[]): number =>
  values.reduce((sum, value) => sum + value, 0) / values.length

/**
 * The tops a column's blocks wish for: each lines its output ports up with the ports they feed,
 * already placed one column to the right. Blocks that feed nothing keep their order and go last.
 */
function columnWishes(
  column: readonly LayoutBlock[],
  graph: Graph,
  tops: ReadonlyMap<string, number>,
): readonly Wish[] {
  const linked: Wish[] = []
  const loose: LayoutBlock[] = []
  for (const block of column) {
    const targets = (graph.outgoing.get(block.id) ?? []).flatMap((link) => {
      const top = tops.get(link.to)
      return top === undefined ? [] : [top + link.toOffsetY - link.fromOffsetY]
    })
    if (targets.length === 0) loose.push(block)
    else linked.push({ block, top: mean(targets) })
  }
  // A stable sort: blocks with the same wish keep the order they had on the canvas.
  linked.sort((a, b) => a.top - b.top)
  let next = Math.max(...linked.map((wish) => wish.top + wish.block.height + ROW_GAP), -Infinity)
  const appended = loose.map((block): Wish => {
    const top = Number.isFinite(next) ? next : block.position.y
    next = top + block.height + ROW_GAP
    return { block, top }
  })
  return [...linked, ...appended]
}

function translate(positions: Map<string, XY>, delta: XY): void {
  for (const [id, position] of positions) {
    positions.set(id, { x: position.x + delta.x, y: position.y + delta.y })
  }
}

function topLeftOf(blocks: readonly LayoutBlock[], positions: ReadonlyMap<string, XY>): XY {
  const { x, y } = boundsOf(
    blocks.map((block) => ({ ...block, position: positions.get(block.id) ?? block.position })),
  )
  return { x, y }
}

/** Blocks with no links at all, in a row under everything else, left to right. */
function placeIslands(
  islands: readonly LayoutBlock[],
  placed: readonly LayoutBlock[],
  positions: Map<string, XY>,
): void {
  if (islands.length === 0) return
  const origin = placed.length === 0 ? topLeftOf(islands, new Map()) : topLeftOf(placed, positions)
  const bottom = placed.reduce(
    (lowest, block) => Math.max(lowest, (positions.get(block.id)?.y ?? 0) + block.height),
    -Infinity,
  )
  let x = origin.x
  const y = Number.isFinite(bottom) ? bottom + COLUMN_GAP : origin.y
  for (const block of [...islands].sort(byReadingOrder)) {
    positions.set(block.id, { x, y })
    x += block.width + COLUMN_GAP
  }
}

/**
 * A layered layout, left to right: blocks go in columns by how far they are from the sink, each
 * column is ordered and stacked so its links line up with what they feed, and blocks without links
 * line up underneath. Deterministic, and every link that is kept runs left to right.
 */
export function layeredLayout(input: LayoutInput): ReadonlyMap<string, XY> {
  const graph = acyclicGraph(input)
  const sinkId = input.sinkId !== null && graph.blocks.has(input.sinkId) ? input.sinkId : null
  const linked = linkedIds(graph)
  const ranks = ranksFrom(graph, sinkId)
  const ordered = graph.order.flatMap((id) => {
    const block = graph.blocks.get(id)
    return block === undefined ? [] : [block]
  })
  const layered = ordered.filter((block) => linked.has(block.id) || block.id === sinkId)
  const islands = ordered.filter((block) => !linked.has(block.id) && block.id !== sinkId)

  const maxRank = Math.max(0, ...layered.map((block) => ranks.get(block.id) ?? 0))
  const columns = Array.from({ length: maxRank + 1 }, (_, rank) =>
    layered
      .filter((block) => (ranks.get(block.id) ?? 0) === rank)
      .sort((a, b) => a.position.y - b.position.y || a.id.localeCompare(b.id)),
  )

  const sink = sinkId === null ? undefined : graph.blocks.get(sinkId)
  const tops = new Map<string, number>()
  const positions = new Map<string, XY>()
  // Columns are placed from the sink leftward, each right-aligned a gap left of the next.
  let columnRight = sink === undefined ? 0 : sink.position.x + sink.width
  for (const [rank, column] of columns.entries()) {
    // The last column has nothing to its right to line up with: it keeps its blocks' heights.
    const wishes =
      rank === 0
        ? column.map((block): Wish => ({ block, top: block.position.y }))
        : columnWishes(column, graph, tops)
    const packed = packColumn(wishes)
    let columnLeft = columnRight
    for (const block of column) {
      const top = packed.get(block.id) ?? block.position.y
      tops.set(block.id, top)
      positions.set(block.id, { x: columnRight - block.width, y: top })
      columnLeft = Math.min(columnLeft, columnRight - block.width)
    }
    columnRight = columnLeft - COLUMN_GAP
  }

  if (sink !== undefined) {
    const placedSink = positions.get(sink.id) ?? sink.position
    translate(positions, { x: sink.position.x - placedSink.x, y: sink.position.y - placedSink.y })
  } else if (layered.length > 0) {
    const before = topLeftOf(layered, new Map())
    const after = topLeftOf(layered, positions)
    translate(positions, { x: before.x - after.x, y: before.y - after.y })
  }
  placeIslands(islands, layered, positions)

  return new Map(
    ordered.map((block): [string, XY] => {
      const position = positions.get(block.id) ?? block.position
      return [block.id, { x: Math.round(position.x), y: Math.round(position.y) }]
    }),
  )
}
