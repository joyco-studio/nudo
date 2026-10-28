import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'

import { plural } from '@/i18n/translate'
import type { Translate } from '@/i18n/translate'

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

/** "2 nodes and 1 property": what starting a new graph clears, in the UI language. */
export function describeGraphContents(contents: GraphContents, t: Translate): string {
  const { nodeCount, propertyCount } = contents
  const nodes = t(plural(nodeCount, { one: 'newGraph.nodes.one', other: 'newGraph.nodes.other' }), {
    count: nodeCount,
  })
  const properties = t(
    plural(propertyCount, { one: 'newGraph.properties.one', other: 'newGraph.properties.other' }),
    { count: propertyCount },
  )
  if (nodeCount > 0 && propertyCount > 0) {
    return t('newGraph.and', { first: nodes, second: properties })
  }
  return nodeCount > 0 ? nodes : properties
}
