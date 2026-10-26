import type { NodeRegistry } from '../registry/node-registry'
import type { Graph, GraphEdge, GraphNode } from '../types/graph'
import { MASTER_NODE_ID, MASTER_NODE_TYPE } from '../types/ids'
import type { Result } from '../types/result'
import { ok } from '../types/result'
import { invalidShape, joinPath, parseJson } from './json-guards'
import { migrate } from './migrate'
import type { Migration } from './migrate'
import { DEFAULT_MIGRATIONS } from './migrations'
import { parseEdge, parseNode, parseRecord } from './parse-entities'
import { parseProperties, validatePropertyReaders } from './parse-properties'
import { CURRENT_SCHEMA_VERSION } from './schema-version'
import type { ParseError } from './schema-version'
import { validateEdgeStructure } from './validate-structure'

const parseKeyedNode = (
  registry: NodeRegistry,
): ((input: unknown, path: string, key: string) => Result<GraphNode, ParseError>) => {
  return (input, path, key) => {
    const node = parseNode(input, path, registry)
    if (!node.ok) return node
    return node.value.id === key ? node : invalidShape(joinPath(path, 'id'))
  }
}

const parseKeyedEdge = (
  input: unknown,
  path: string,
  key: string,
): Result<GraphEdge, ParseError> => {
  const edge = parseEdge(input, path)
  if (!edge.ok) return edge
  return edge.value.id === key ? edge : invalidShape(joinPath(path, 'id'))
}

/** Exactly one master: the node stored under the master id, of the master type. */
function validateMaster(nodes: readonly GraphNode[]): Result<void, ParseError> {
  const master = nodes.find((node) => node.id === MASTER_NODE_ID)
  if (master === undefined) return invalidShape(`nodes.${MASTER_NODE_ID}`)
  if (master.type !== MASTER_NODE_TYPE) return invalidShape(`nodes.${MASTER_NODE_ID}.type`)
  const extraMaster = nodes.find(
    (node) => node.id !== MASTER_NODE_ID && node.type === MASTER_NODE_TYPE,
  )
  return extraMaster === undefined ? ok(undefined) : invalidShape(`nodes.${extraMaster.id}.type`)
}

/**
 * Validates an untrusted document into a `Graph`. `input` is either the JSON text or an already
 * parsed value. Documents older than the current version are migrated first (`DEFAULT_MIGRATIONS`
 * unless the caller passes its own chain). Never throws; the first problem found is returned.
 */
export function parseGraph(
  input: unknown,
  registry: NodeRegistry,
  migrations: readonly Migration[] = DEFAULT_MIGRATIONS,
): Result<Graph, ParseError> {
  const document = typeof input === 'string' ? parseJson(input) : ok(input)
  if (!document.ok) return document
  const migrated = migrate(document.value, migrations)
  if (!migrated.ok) return migrated

  const nodes = parseRecord(migrated.value.nodes, 'nodes', parseKeyedNode(registry))
  if (!nodes.ok) return nodes
  const edges = parseRecord(migrated.value.edges, 'edges', parseKeyedEdge)
  if (!edges.ok) return edges
  const properties = parseProperties(migrated.value.properties)
  if (!properties.ok) return properties

  const nodeList = Object.values(nodes.value)
  const edgeList = Object.values(edges.value)
  const master = validateMaster(nodeList)
  if (!master.ok) return master
  const readers = validatePropertyReaders(nodeList, registry, properties.value)
  if (!readers.ok) return readers
  const structure = validateEdgeStructure(
    nodeList,
    edgeList,
    registry,
    (edge) => `edges.${edge.id}`,
  )
  if (!structure.ok) return structure

  return ok({
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodes: nodes.value,
    edges: edges.value,
    properties: properties.value,
  })
}
