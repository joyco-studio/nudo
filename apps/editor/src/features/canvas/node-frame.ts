import type { AnyNodeDefinition, GraphNode, ParamDefinition } from '@nudo-tsl/core'

import type { NodeFrame } from '@/store/store-types'

import type { Size } from './canvas-keyboard-model'

/** A node sized by its `width` and `height` params (a comment frame), with its minimum size. */
export interface ResizableFrame extends NodeFrame {
  readonly minWidth: number
  readonly minHeight: number
}

type NumberParam = Extract<ParamDefinition, { kind: 'number' }>

function numberParam(definition: AnyNodeDefinition, id: string): NumberParam | null {
  const param = definition.params?.find((candidate) => candidate.id === id)
  return param?.kind === 'number' ? param : null
}

function storedNumber(node: GraphNode, param: NumberParam): number {
  const value = node.params[param.id]
  return typeof value === 'number' ? value : param.default
}

/** The frame of a node whose definition declares `width` and `height`; null for other nodes. */
export function frameOf(node: GraphNode, definition: AnyNodeDefinition): ResizableFrame | null {
  const width = numberParam(definition, 'width')
  const height = numberParam(definition, 'height')
  if (width === null || height === null) return null
  return {
    position: node.position,
    width: storedNumber(node, width),
    height: storedNumber(node, height),
    minWidth: width.min ?? 0,
    minHeight: height.min ?? 0,
  }
}

/** The frame grown (or shrunk) by `delta`, kept at or above its minimum size. */
export function resizedFrame(frame: ResizableFrame, delta: Size): NodeFrame {
  return {
    position: frame.position,
    width: Math.max(frame.minWidth, frame.width + delta.width),
    height: Math.max(frame.minHeight, frame.height + delta.height),
  }
}

/** The frame at a typed width and/or height, kept at or above its minimum size. */
export function sizedFrame(frame: ResizableFrame, size: Partial<Size>): NodeFrame {
  return {
    position: frame.position,
    width: Math.max(frame.minWidth, size.width ?? frame.width),
    height: Math.max(frame.minHeight, size.height ?? frame.height),
  }
}
