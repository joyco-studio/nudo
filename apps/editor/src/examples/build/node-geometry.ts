import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { AnyNodeDefinition, GraphNode, NodeId, XY } from '@nudo-tsl/core'

import { groupInputs } from '@/features/canvas/node-port-layout'
import { bodyParams } from '@/features/canvas/param-field'
import type { NodeGeometry } from '@/features/canvas/tidy-up/plan-tidy-up'
import { hasNodePreview, isPreviewShown } from '@/features/node-previews/preview-graph'

/**
 * The size of a node as the canvas draws it (compact fields, previews on), worked out from its
 * parts so examples can be laid out without a browser. Every figure was measured on the rendered
 * editor (the example layout e2e checks they still hold).
 */
const BORDER = 2
const NODE_WIDTH = 224
const MASTER_WIDTH = 256
const PILL = { width: 176, height: 30 } as const
const HEADER_HEIGHT = 34
/** The formula line under the title. */
const FORMULA_HEIGHT = 14
const ROW_HEIGHT = 28
/** The vertical padding of a list (params, outputs, inputs), at each end. */
const LIST_PADDING = 4
/** The line between two lists. */
const DIVIDER = 1
/** A Master Stack heading ("Vertex", "Fragment") over its inputs. */
const GROUP_HEADING_HEIGHT = 24
/** The node preview with its margins. */
const PREVIEW_HEIGHT = 120

function pillGeometry(definition: AnyNodeDefinition, id: NodeId, position: XY): NodeGeometry {
  const outputY = Object.fromEntries(
    definition.outputs.map((output) => [output.id, PILL.height / 2]),
  )
  return { id, position, ...PILL, isFrame: false, inputY: {}, outputY }
}

/** Where a node sits, its size and the middle of each of its ports below its top. */
export function estimateGeometry(
  node: GraphNode,
  definition: AnyNodeDefinition,
  position: XY,
): NodeGeometry {
  if (definition.reads === 'property') return pillGeometry(definition, node.id, position)

  let y = HEADER_HEIGHT + (definition.formula === undefined ? 0 : FORMULA_HEIGHT)
  const paramCount = bodyParams(definition.params).length
  if (paramCount > 0) y += 2 * LIST_PADDING + paramCount * ROW_HEIGHT + DIVIDER

  const outputY: Record<string, number> = {}
  if (definition.outputs.length > 0) {
    y += LIST_PADDING
    for (const output of definition.outputs) {
      outputY[output.id] = y + ROW_HEIGHT / 2
      y += ROW_HEIGHT
    }
    y += LIST_PADDING
  }

  const inputY: Record<string, number> = {}
  if (definition.inputs.length > 0) {
    y += LIST_PADDING + (definition.outputs.length > 0 ? DIVIDER : 0)
    for (const group of groupInputs(node, definition.inputs)) {
      if (group.rows.length > 0 && group.title !== null) y += GROUP_HEADING_HEIGHT
      for (const row of group.rows) {
        inputY[row.input.id] = y + ROW_HEIGHT / 2
        y += ROW_HEIGHT
      }
    }
    y += LIST_PADDING
  }
  if (hasNodePreview(node, definition) && isPreviewShown(node)) y += PREVIEW_HEIGHT

  return {
    id: node.id,
    position,
    width: node.id === MASTER_NODE_ID ? MASTER_WIDTH : NODE_WIDTH,
    height: y + BORDER,
    isFrame: false,
    inputY,
    outputY,
  }
}
