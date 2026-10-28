import { MASTER_NODE_ID, addNode, asNodeId, moveNodes, setParam } from '@nudo-tsl/core'
import type { Graph, NodeId, NodeRegistry, ParamValue, Result, XY } from '@nudo-tsl/core'
import { commentNode } from '@nudo-tsl/nodes'

import { boundsOf } from '@/features/canvas/tidy-up/bounds'
import { layeredLayout } from '@/features/canvas/tidy-up/layered-layout'
import type { LayoutLink } from '@/features/canvas/tidy-up/layered-layout'
import { planTidyUp } from '@/features/canvas/tidy-up/plan-tidy-up'
import type { NodeGeometry } from '@/features/canvas/tidy-up/plan-tidy-up'

import { frameIdOf } from './example-spec'
import type { ExampleSpec, GroupSpec } from './example-spec'
import { estimateGeometry } from './node-geometry'

/** Room between a frame's edge and the nodes on it. */
const FRAME_PADDING = 32
const FRAME_HEADER_HEIGHT = 32
/** The note's text inset inside the frame body, on each side. */
const NOTE_INSET = 8
/** The note is 12px text on 16px lines; this average glyph width rounds up for Public Sans. */
const NOTE_LINE_HEIGHT = 16
const NOTE_CHAR_WIDTH = 6.6
/** Wide enough that a note of a few sentences reads as a paragraph, not a column. */
const MIN_FRAME_WIDTH = 400
/** Where the first group goes, left of the master and clear of it, before tidying up. */
const START_GAP = 400

function expectOk<T, E>(result: Result<T, E>, what: string): T {
  if (!result.ok) throw new Error(`${what}: ${JSON.stringify(result.error)}`)
  return result.value
}

/** How tall the frame's note is at this frame width, wrapped word by word. */
export function noteHeight(body: string, frameWidth: number): number {
  const charsPerLine = Math.max(1, Math.floor((frameWidth - 2 * NOTE_INSET) / NOTE_CHAR_WIDTH))
  const lines = body.split('\n').reduce((count, paragraph) => {
    let lineCount = 1
    let lineLength = 0
    for (const word of paragraph.split(' ')) {
      const needed = lineLength === 0 ? word.length : lineLength + 1 + word.length
      if (needed > charsPerLine && lineLength > 0) {
        lineCount += 1
        lineLength = word.length
      } else {
        lineLength = needed
      }
    }
    return count + lineCount
  }, 0)
  return lines * NOTE_LINE_HEIGHT + 2 * NOTE_INSET
}

function geometryOf(
  graph: Graph,
  registry: NodeRegistry,
  nodeId: NodeId,
  position: XY,
): NodeGeometry {
  const graphNode = graph.nodes[nodeId]
  const definition = graphNode === undefined ? undefined : registry.get(graphNode.type)
  if (graphNode === undefined || definition === undefined) throw new Error(`No node ${nodeId}`)
  return estimateGeometry(graphNode, definition, position)
}

interface PlacedGroup {
  readonly frameId: NodeId
  readonly frame: { readonly width: number; readonly height: number }
  /** The group's nodes, relative to the frame's top-left corner. */
  readonly members: readonly NodeGeometry[]
}

/** Lays one group out left to right and sizes its frame around the note and the nodes. */
function placeGroup(
  graph: Graph,
  group: GroupSpec,
  geometry: (nodeId: NodeId, position: XY) => NodeGeometry,
): PlacedGroup {
  // Spec order is reading order: it breaks ties inside a column.
  const blocks = group.nodes.map((spec, index) => geometry(asNodeId(spec.id), { x: 0, y: index }))
  const blockById = new Map(blocks.map((block) => [block.id, block]))
  const links = Object.values(graph.edges).flatMap((edge): LayoutLink[] => {
    const from = blockById.get(edge.from.nodeId)
    const to = blockById.get(edge.to.nodeId)
    if (from === undefined || to === undefined) return []
    return [
      {
        from: from.id,
        to: to.id,
        fromOffsetY: from.outputY[edge.from.portId] ?? from.height / 2,
        toOffsetY: to.inputY[edge.to.portId] ?? to.height / 2,
      },
    ]
  })
  const positions = layeredLayout({ blocks, links, sinkId: null })
  const laidOut = blocks.map((block) => ({
    ...block,
    position: positions.get(block.id) ?? block.position,
  }))
  const content = boundsOf(laidOut)
  const width = Math.max(MIN_FRAME_WIDTH, content.width + 2 * FRAME_PADDING)
  // The note must clear the nodes in every language the frame can speak.
  const note = Math.max(noteHeight(group.body, width), noteHeight(group.es.body, width))
  const top = FRAME_HEADER_HEIGHT + note + FRAME_PADDING / 2
  const left = (width - content.width) / 2
  const members = laidOut.map((block) => ({
    ...block,
    position: {
      x: Math.round(block.position.x - content.x + left),
      y: Math.round(block.position.y - content.y + top),
    },
  }))
  return {
    frameId: asNodeId(frameIdOf(group.id)),
    frame: { width: Math.ceil(width), height: Math.ceil(top + content.height + FRAME_PADDING) },
    members,
  }
}

function withFrame(graph: Graph, registry: NodeRegistry, group: GroupSpec, placed: PlacedGroup) {
  const added = expectOk(
    addNode(graph, registry, {
      id: placed.frameId,
      type: commentNode.type,
      position: { x: 0, y: 0 },
    }),
    placed.frameId,
  )
  const params: Readonly<Record<string, ParamValue>> = {
    title: group.title,
    body: group.body,
    width: placed.frame.width,
    height: placed.frame.height,
  }
  return Object.entries(params).reduce(
    (current, [paramId, value]) =>
      expectOk(setParam(current, registry, { nodeId: placed.frameId, paramId }, value), paramId),
    added,
  )
}

/**
 * Lays an assembled example out the way Tidy up would, with every group in a comment frame: each
 * group is laid out on its own and framed under its note, then the frames (which carry their
 * nodes) are tidied left to right into the Master Stack, which stays where it is.
 */
export function layoutExample(graph: Graph, spec: ExampleSpec, registry: NodeRegistry): Graph {
  const geometry = (nodeId: NodeId, position: XY) => geometryOf(graph, registry, nodeId, position)
  const placedGroups = spec.groups.map((group) => placeGroup(graph, group, geometry))

  const master = geometry(MASTER_NODE_ID, graph.nodes[MASTER_NODE_ID]?.position ?? { x: 0, y: 0 })
  // Frames side by side in spec order, left of the master, so none holds another's nodes.
  const totalWidth = placedGroups.reduce((sum, placed) => sum + placed.frame.width + START_GAP, 0)
  let x = master.position.x - totalWidth
  const framed: NodeGeometry[] = [master]
  let withFrames = graph
  spec.groups.forEach((group, index) => {
    const placed = placedGroups[index]
    if (placed === undefined) return
    const origin = { x, y: master.position.y }
    withFrames = withFrame(withFrames, registry, group, placed)
    framed.push({
      id: placed.frameId,
      position: origin,
      ...placed.frame,
      isFrame: true,
      inputY: {},
      outputY: {},
    })
    for (const member of placed.members) {
      framed.push({
        ...member,
        position: { x: origin.x + member.position.x, y: origin.y + member.position.y },
      })
    }
    x += placed.frame.width + START_GAP
  })

  const placedPositions = Object.fromEntries(framed.map((item) => [item.id, item.position]))
  const plan = planTidyUp(Object.values(withFrames.edges), framed, { kind: 'graph' })
  return moveNodes(withFrames, { ...placedPositions, ...plan })
}
