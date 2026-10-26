import type { PortRef } from '../types/graph'

/** `${nodeId}:${portId}` */
export type PortKey = `${string}:${string}`

export const portKey = (ref: PortRef): PortKey => `${ref.nodeId}:${ref.portId}`
