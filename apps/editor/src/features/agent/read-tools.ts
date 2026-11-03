import { generateModule } from '@nudo-tsl/codegen'
import { MASTER_NODE_TYPE, ok } from '@nudo-tsl/core'
import type { AnyNodeDefinition, ParamDefinition, ParamValue, PortTypeSpec } from '@nudo-tsl/core'
import { rerouteNode } from '@nudo-tsl/nodes'
import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'
import { toAgentGraph } from './agent-graph-view'
import type { ToolHandler } from './tool-context'

const HIDDEN_NODE_TYPES: ReadonlySet<string> = new Set([MASTER_NODE_TYPE, rerouteNode.type])

interface PortDescription {
  id: string
  label: string
  type: string
}

interface ParamDescription {
  id: string
  kind: ParamDefinition['kind']
  default: ParamValue
  options?: string[]
}

export interface NodeTypeDescription {
  type: string
  category: string
  label: string
  description: string
  inputs: PortDescription[]
  outputs: PortDescription[]
  params: ParamDescription[]
}

interface ListArgs {
  query?: string | undefined
  category?: string | undefined
}

const readOptionalString = (source: Record<string, unknown>, key: string): string | undefined => {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

/** The queue already validated the args against the catalog; this narrows them for the type system. */
const toListArgs = (args: unknown): ListArgs => {
  if (typeof args !== 'object' || args === null) return {}
  const source: Record<string, unknown> = { ...args }
  return {
    query: readOptionalString(source, 'query'),
    category: readOptionalString(source, 'category'),
  }
}

const describePortType = (spec: PortTypeSpec): string =>
  spec.kind === 'concrete' ? spec.type : `generic(${spec.allowed.join('|')})`

const describeParam = (param: ParamDefinition): ParamDescription => ({
  id: param.id,
  kind: param.kind,
  default: param.default,
  ...(param.kind === 'enum' ? { options: param.options.map((option) => option.value) } : {}),
})

const describeNodeType = (definition: AnyNodeDefinition): NodeTypeDescription => ({
  type: definition.type,
  category: definition.category,
  label: definition.label,
  description: definition.description,
  inputs: definition.inputs.map((input) => ({
    id: input.id,
    label: input.label,
    type: describePortType(input.type),
  })),
  outputs: definition.outputs.map((output) => ({
    id: output.id,
    label: output.label,
    type: describePortType(output.type),
  })),
  params: (definition.params ?? []).map(describeParam),
})

const matchesQuery = (definition: AnyNodeDefinition, query: string): boolean => {
  const needle = query.toLowerCase()
  return [definition.type, definition.label, definition.description].some((text) =>
    text.toLowerCase().includes(needle),
  )
}

const getGraph: ToolHandler = () => {
  const { graph, errorsByNode } = useEditorStore.getState()
  return Promise.resolve(ok(toAgentGraph(graph, errorsByNode, registry)))
}

export function describeNodeTypes({ query, category }: ListArgs = {}): NodeTypeDescription[] {
  return registry
    .list()
    .filter((definition) => !HIDDEN_NODE_TYPES.has(definition.type))
    .filter((definition) => category === undefined || definition.category === category)
    .filter((definition) => query === undefined || matchesQuery(definition, query))
    .map(describeNodeType)
}

const listNodeTypes: ToolHandler = (args) =>
  Promise.resolve(ok(describeNodeTypes(toListArgs(args))))

const getCode: ToolHandler = () => {
  const { code, errors } = generateModule(useEditorStore.getState().graph, registry)
  return Promise.resolve(ok({ code, errors }))
}

export const readTools = {
  get_graph: getGraph,
  list_node_types: listNodeTypes,
  get_code: getCode,
} satisfies Record<'get_graph' | 'list_node_types' | 'get_code', ToolHandler>
