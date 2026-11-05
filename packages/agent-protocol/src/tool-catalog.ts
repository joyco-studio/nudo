import { z } from 'zod'

export const DEFAULT_TOOL_TIMEOUT_MS = 15_000
export const CONFIRM_TOOL_TIMEOUT_MS = 120_000

export const TOOL_NAMES = [
  'get_graph',
  'list_node_types',
  'get_code',
  'get_preview_image',
  'add_node',
  'remove_nodes',
  'move_nodes',
  'connect',
  'disconnect',
  'set_input',
  'set_param',
  'add_property',
  'set_property',
  'remove_property',
  'tidy_up',
  'new_graph',
  'load_template',
  'start_task',
  'set_step',
  'finish_task',
] as const

export type ToolName = (typeof TOOL_NAMES)[number]

export interface ToolSpec {
  name: ToolName
  description: string
  args: z.ZodType
  timeoutMs: number
}

// zod 4: z.number() already rejects NaN and +-Infinity
const finiteNumber = z.number()
const positionSchema = z.object({ x: finiteNumber, y: finiteNumber })
const endpointSchema = z.object({ nodeId: z.string(), portId: z.string() })

const portValueSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('float'), value: finiteNumber }),
  z.object({ type: z.literal('vec2'), value: z.tuple([finiteNumber, finiteNumber]) }),
  z.object({ type: z.literal('vec3'), value: z.tuple([finiteNumber, finiteNumber, finiteNumber]) }),
  z.object({
    type: z.literal('vec4'),
    value: z.tuple([finiteNumber, finiteNumber, finiteNumber, finiteNumber]),
  }),
  z.object({ type: z.literal('texture'), assetId: z.string().nullable() }),
])

const propertyKindSchema = z.enum(['float', 'vec2', 'vec3', 'vec4', 'color', 'texture'])

const noArgs = z.object({})

const spec = (
  name: ToolName,
  description: string,
  args: z.ZodType,
  timeoutMs: number = DEFAULT_TOOL_TIMEOUT_MS,
): ToolSpec => ({ name, description, args, timeoutMs })

export const TOOL_ARG_SCHEMAS = {
  get_graph: noArgs,
  list_node_types: z.object({ query: z.string().optional(), category: z.string().optional() }),
  get_code: noArgs,
  get_preview_image: noArgs,
  add_node: z.object({ type: z.string(), position: positionSchema.optional() }),
  remove_nodes: z.object({ ids: z.array(z.string()) }),
  move_nodes: z.object({ positions: z.record(z.string(), positionSchema) }),
  connect: z.object({ from: endpointSchema, to: endpointSchema }),
  disconnect: z.object({ edgeIds: z.array(z.string()) }),
  set_input: z.object({ nodeId: z.string(), portId: z.string(), value: portValueSchema }),
  set_param: z.object({
    nodeId: z.string(),
    paramId: z.string(),
    value: z.union([z.string(), finiteNumber, z.boolean()]),
  }),
  add_property: z.object({ kind: propertyKindSchema, name: z.string().optional() }),
  set_property: z.object({
    id: z.string(),
    label: z.string().optional(),
    name: z.string().optional(),
    exposed: z.boolean().optional(),
    value: portValueSchema.optional(),
  }),
  remove_property: z.object({ id: z.string() }),
  tidy_up: noArgs,
  new_graph: noArgs,
  load_template: z.object({ id: z.string() }),
  start_task: z.object({ prompt: z.string(), steps: z.array(z.string()).optional() }),
  set_step: z.object({ label: z.string(), detail: z.string().optional() }),
  finish_task: z.object({ summary: z.string().optional() }),
} satisfies Record<ToolName, z.ZodType>

export type ToolArgs<N extends ToolName> = z.infer<(typeof TOOL_ARG_SCHEMAS)[N]>

type ArgParsers = {
  [N in ToolName]: (raw: unknown) => z.ZodSafeParseResult<ToolArgs<N>>
}

const ARG_PARSERS: ArgParsers = {
  get_graph: (raw) => TOOL_ARG_SCHEMAS.get_graph.safeParse(raw),
  list_node_types: (raw) => TOOL_ARG_SCHEMAS.list_node_types.safeParse(raw),
  get_code: (raw) => TOOL_ARG_SCHEMAS.get_code.safeParse(raw),
  get_preview_image: (raw) => TOOL_ARG_SCHEMAS.get_preview_image.safeParse(raw),
  add_node: (raw) => TOOL_ARG_SCHEMAS.add_node.safeParse(raw),
  remove_nodes: (raw) => TOOL_ARG_SCHEMAS.remove_nodes.safeParse(raw),
  move_nodes: (raw) => TOOL_ARG_SCHEMAS.move_nodes.safeParse(raw),
  connect: (raw) => TOOL_ARG_SCHEMAS.connect.safeParse(raw),
  disconnect: (raw) => TOOL_ARG_SCHEMAS.disconnect.safeParse(raw),
  set_input: (raw) => TOOL_ARG_SCHEMAS.set_input.safeParse(raw),
  set_param: (raw) => TOOL_ARG_SCHEMAS.set_param.safeParse(raw),
  add_property: (raw) => TOOL_ARG_SCHEMAS.add_property.safeParse(raw),
  set_property: (raw) => TOOL_ARG_SCHEMAS.set_property.safeParse(raw),
  remove_property: (raw) => TOOL_ARG_SCHEMAS.remove_property.safeParse(raw),
  tidy_up: (raw) => TOOL_ARG_SCHEMAS.tidy_up.safeParse(raw),
  new_graph: (raw) => TOOL_ARG_SCHEMAS.new_graph.safeParse(raw),
  load_template: (raw) => TOOL_ARG_SCHEMAS.load_template.safeParse(raw),
  start_task: (raw) => TOOL_ARG_SCHEMAS.start_task.safeParse(raw),
  set_step: (raw) => TOOL_ARG_SCHEMAS.set_step.safeParse(raw),
  finish_task: (raw) => TOOL_ARG_SCHEMAS.finish_task.safeParse(raw),
}

/** Validates raw args for one tool and keeps the schema's inferred type. */
export const parseToolArgs = <N extends ToolName>(
  name: N,
  raw: unknown,
): z.ZodSafeParseResult<ToolArgs<N>> => ARG_PARSERS[name](raw)

export const TOOL_CATALOG: readonly ToolSpec[] = [
  spec(
    'get_graph',
    'Returns the current graph: nodes, edges, properties and the output node, with the resolved type of every port.',
    TOOL_ARG_SCHEMAS.get_graph,
  ),
  spec(
    'list_node_types',
    'Lists the node types you can add, with their ports and params. Filter by a search query or a category.',
    TOOL_ARG_SCHEMAS.list_node_types,
  ),
  spec(
    'get_code',
    'Returns the TSL code generated from the current graph.',
    TOOL_ARG_SCHEMAS.get_code,
  ),
  spec(
    'get_preview_image',
    'Returns an image of the current shader preview, so you can check how the graph looks.',
    TOOL_ARG_SCHEMAS.get_preview_image,
  ),
  spec(
    'add_node',
    'Adds a node of a type from list_node_types. Omit position to let nudo place it next to related nodes.',
    TOOL_ARG_SCHEMAS.add_node,
  ),
  spec(
    'remove_nodes',
    'Removes the nodes with the given ids, along with the edges attached to them.',
    TOOL_ARG_SCHEMAS.remove_nodes,
  ),
  spec(
    'move_nodes',
    'Moves nodes to new canvas positions, keyed by node id.',
    TOOL_ARG_SCHEMAS.move_nodes,
  ),
  spec(
    'connect',
    'Connects an output port to an input port. Fails if the types are incompatible or the edge would create a cycle.',
    TOOL_ARG_SCHEMAS.connect,
  ),
  spec('disconnect', 'Removes the edges with the given ids.', TOOL_ARG_SCHEMAS.disconnect),
  spec(
    'set_input',
    'Sets the constant value of an unconnected input port. The value must match the port type.',
    TOOL_ARG_SCHEMAS.set_input,
  ),
  spec(
    'set_param',
    'Sets a node param, such as an operator or a toggle.',
    TOOL_ARG_SCHEMAS.set_param,
  ),
  spec(
    'add_property',
    'Adds a blackboard property (a named uniform-like value) and returns its id.',
    TOOL_ARG_SCHEMAS.add_property,
  ),
  spec(
    'set_property',
    'Updates a blackboard property: its label, name, whether it is exposed, or its value.',
    TOOL_ARG_SCHEMAS.set_property,
  ),
  spec('remove_property', 'Removes a blackboard property by id.', TOOL_ARG_SCHEMAS.remove_property),
  spec(
    'tidy_up',
    'Rearranges all nodes into a clean left-to-right layout.',
    TOOL_ARG_SCHEMAS.tidy_up,
  ),
  spec(
    'new_graph',
    'Replaces the current graph with an empty one. The person must confirm first, so this can take a while.',
    TOOL_ARG_SCHEMAS.new_graph,
    CONFIRM_TOOL_TIMEOUT_MS,
  ),
  spec(
    'load_template',
    'Replaces the current graph with a built-in template by id. The person must confirm first, so this can take a while.',
    TOOL_ARG_SCHEMAS.load_template,
    CONFIRM_TOOL_TIMEOUT_MS,
  ),
  spec(
    'start_task',
    'Announces a multi-step job to the person, with an optional list of planned steps. Call it before you start editing.',
    TOOL_ARG_SCHEMAS.start_task,
  ),
  spec(
    'set_step',
    'Tells the person which step of the task you are on now.',
    TOOL_ARG_SCHEMAS.set_step,
  ),
  spec(
    'finish_task',
    'Marks the task as done, with an optional short summary for the person.',
    TOOL_ARG_SCHEMAS.finish_task,
  ),
]
