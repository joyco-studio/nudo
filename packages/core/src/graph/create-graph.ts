import type { Graph } from '../types/graph'
import { MASTER_NODE_ID, MASTER_NODE_TYPE } from '../types/ids'

/** An empty graph that contains only the master node. Needs no registry. */
export function createGraph(): Graph {
  return {
    schemaVersion: 1,
    nodes: {
      [MASTER_NODE_ID]: {
        id: MASTER_NODE_ID,
        type: MASTER_NODE_TYPE,
        position: { x: 600, y: 0 },
        inputValues: {},
        params: {},
      },
    },
    edges: {},
    properties: [],
  }
}
