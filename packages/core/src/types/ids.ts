type Brand<T, B extends string> = T & { readonly __brand: B }

export type NodeId = Brand<string, 'NodeId'>
export type EdgeId = Brand<string, 'EdgeId'>
/** Namespaced node type, e.g. 'math/add' or 'community/my-noise'. */
export type NodeTypeId = string

// The brand constructors below are the only places allowed to use a type assertion (ruling R1).
export const asNodeId = (raw: string): NodeId =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- brand constructor: a plain string cannot be narrowed to a branded type without an assertion
  raw as NodeId

export const asEdgeId = (raw: string): EdgeId =>
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- brand constructor: a plain string cannot be narrowed to a branded type without an assertion
  raw as EdgeId

export const MASTER_NODE_ID: NodeId = asNodeId('master')
/** Type of the single, undeletable master node. */
export const MASTER_NODE_TYPE = 'master/stack'
