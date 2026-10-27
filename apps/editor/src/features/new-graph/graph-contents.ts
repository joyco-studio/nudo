import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'

export interface GraphContents {
  /** Nodes besides the master, which a new graph keeps. */
  readonly nodeCount: number
  readonly propertyCount: number
}

export function graphContents(graph: Graph): GraphContents {
  return {
    nodeCount: Object.keys(graph.nodes).filter((id) => id !== MASTER_NODE_ID).length,
    propertyCount: graph.properties.length,
  }
}

/** Starting over loses work only when there are nodes besides the master or properties. */
export function hasWorkToLose(contents: GraphContents): boolean {
  return contents.nodeCount > 0 || contents.propertyCount > 0
}

function counted(count: number, singular: string, plural: string): string {
  return `${String(count)} ${count === 1 ? singular : plural}`
}

/** "2 nodes and 1 property": what starting a new graph clears. */
export function describeGraphContents(contents: GraphContents): string {
  const parts = [
    contents.nodeCount > 0 ? counted(contents.nodeCount, 'node', 'nodes') : null,
    contents.propertyCount > 0 ? counted(contents.propertyCount, 'property', 'properties') : null,
  ].filter((part) => part !== null)
  return parts.join(' and ')
}
