import type { ConnectionRejection } from '../validation/check-connection'
import type { PortRef } from '../types/graph'
import type { NodeId, NodeTypeId } from '../types/ids'

export type GraphError =
  | { code: 'unknown-node-type'; type: NodeTypeId }
  | { code: 'node-not-found'; nodeId: NodeId }
  | { code: 'cannot-remove-master' }
  | { code: 'duplicate-id'; id: string }
  | { code: 'invalid-connection'; reason: ConnectionRejection }
  | { code: 'unknown-port'; ref: PortRef }
  | { code: 'unknown-param'; nodeId: NodeId; paramId: string }
  | { code: 'invalid-param-value'; nodeId: NodeId; paramId: string }
