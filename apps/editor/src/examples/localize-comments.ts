import { asNodeId } from '@nudo-tsl/core'
import type { Graph, GraphNode } from '@nudo-tsl/core'

import { COMMENT_BODY_PARAM, COMMENT_TITLE_PARAM } from '@/features/canvas/comment-params'
import { COMMENT_TYPE } from '@/features/canvas/to-flow'

import type { CommentText } from './build/example-spec'

/** The words of each comment frame in one language, by frame id. */
export type CommentTexts = Readonly<Record<string, CommentText>>

function localized(node: GraphNode, text: CommentText | undefined): GraphNode {
  if (text === undefined || node.type !== COMMENT_TYPE) return node
  return {
    ...node,
    params: { ...node.params, [COMMENT_TITLE_PARAM]: text.title, [COMMENT_BODY_PARAM]: text.body },
  }
}

/** The graph with its comment frames worded in another language; other nodes stay as they are. */
export function localizeComments(graph: Graph, texts: CommentTexts): Graph {
  const nodes = Object.values(graph.nodes).map((node) => localized(node, texts[node.id]))
  return { ...graph, nodes: Object.fromEntries(nodes.map((node) => [asNodeId(node.id), node])) }
}
