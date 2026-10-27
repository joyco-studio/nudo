import type { GraphNode } from '@nudo-tsl/core'

/** The comment frame's hidden params, edited on the frame and in the Inspector. */
export const COMMENT_TITLE_PARAM = 'title'
export const COMMENT_BODY_PARAM = 'body'

/** The note a comment frame holds; empty while none was written. */
export function commentBody(node: GraphNode): string {
  const value = node.params[COMMENT_BODY_PARAM]
  return typeof value === 'string' ? value : ''
}
