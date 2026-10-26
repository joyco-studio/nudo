import type { EdgeId, NodeId, NodeTypeId } from './ids'
import type { PortValue } from './port-value'

export type ParamValue = string | number | boolean

export interface XY {
  readonly x: number
  readonly y: number
}

/** Phase 2 placeholder: `Graph.properties` is always empty until the blackboard exists. */
export type BlackboardProperty = never

export interface PortRef {
  readonly nodeId: NodeId
  readonly portId: string
}

export interface GraphNode {
  readonly id: NodeId
  readonly type: NodeTypeId
  readonly position: XY
  /** Values for unconnected inputs. Live: uniform(). Changing them never recompiles. */
  readonly inputValues: Readonly<Record<string, PortValue>>
  /** Structural settings (noise kind, code source). Changing them recompiles. */
  readonly params: Readonly<Record<string, ParamValue>>
}

export interface GraphEdge {
  readonly id: EdgeId
  readonly from: PortRef
  readonly to: PortRef
}

export interface Graph {
  readonly schemaVersion: 1
  readonly nodes: Readonly<Record<NodeId, GraphNode>>
  readonly edges: Readonly<Record<EdgeId, GraphEdge>>
  readonly properties: readonly BlackboardProperty[]
}
