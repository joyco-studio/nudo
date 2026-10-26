import { CURRENT_SCHEMA_VERSION } from '../serialization/schema-version'
import { edgeJson, nodeJson, sortedById, stringify } from '../serialization/stable-json'
import type { GraphFragment } from './graph-fragment'

/** Stable clipboard text: nodes and edges sorted by id, fixed key order. */
export function serializeFragment(fragment: GraphFragment): string {
  return stringify({
    kind: fragment.kind,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    nodes: sortedById(fragment.nodes).map(nodeJson),
    edges: sortedById(fragment.edges).map(edgeJson),
  })
}
