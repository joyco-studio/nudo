import type { NodeRegistry } from '../registry/node-registry'
import {
  invalidShape,
  isRecord,
  joinPath,
  parseJson,
  ROOT_PATH,
} from '../serialization/json-guards'
import { parseEdge, parseList, parseNode } from '../serialization/parse-entities'
import { CURRENT_SCHEMA_VERSION } from '../serialization/schema-version'
import type { ParseError } from '../serialization/schema-version'
import { validateEdgeStructure } from '../serialization/validate-structure'
import type { GraphNode } from '../types/graph'
import { MASTER_NODE_ID, MASTER_NODE_TYPE } from '../types/ids'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { FRAGMENT_KIND } from './graph-fragment'
import type { GraphFragment } from './graph-fragment'

/** Nodes must be unique and must not include the master, which a paste can never create. */
function validateFragmentNodes(nodes: readonly GraphNode[]): Result<void, ParseError> {
  const seen = new Set<string>()
  for (const [index, node] of nodes.entries()) {
    const path = joinPath('nodes', index)
    if (node.id === MASTER_NODE_ID || node.type === MASTER_NODE_TYPE) return invalidShape(path)
    if (seen.has(node.id)) return invalidShape(joinPath(path, 'id'))
    seen.add(node.id)
  }
  return ok(undefined)
}

/** Validates clipboard text into a fragment; anything that is not a fragment is rejected. */
export function parseFragment(
  text: string,
  registry: NodeRegistry,
): Result<GraphFragment, ParseError> {
  const document = parseJson(text)
  if (!document.ok) return document
  if (!isRecord(document.value)) return invalidShape(ROOT_PATH)
  const { kind, schemaVersion } = document.value
  if (kind !== FRAGMENT_KIND) return invalidShape('kind')
  if (typeof schemaVersion !== 'number') return invalidShape('schemaVersion')
  if (schemaVersion > CURRENT_SCHEMA_VERSION) {
    return err({ code: 'unsupported-version', version: schemaVersion })
  }
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) return invalidShape('schemaVersion')

  const nodes = parseList(document.value.nodes, 'nodes', (input, path) =>
    parseNode(input, path, registry),
  )
  if (!nodes.ok) return nodes
  const edges = parseList(document.value.edges, 'edges', parseEdge)
  if (!edges.ok) return edges

  const nodesCheck = validateFragmentNodes(nodes.value)
  if (!nodesCheck.ok) return nodesCheck
  const structure = validateEdgeStructure(nodes.value, edges.value, (_edge, index) =>
    joinPath('edges', index),
  )
  if (!structure.ok) return structure

  return ok({
    kind: FRAGMENT_KIND,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodes: nodes.value,
    edges: edges.value,
  })
}
