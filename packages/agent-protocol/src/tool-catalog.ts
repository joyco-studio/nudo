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

export const TOOL_CATALOG: readonly ToolSpec[] = [
  spec(
    'get_graph',
    'Returns the current graph: nodes, edges, properties and the output node, with the resolved type of every port.',
    noArgs,
  ),
  spec(
    'list_node_types',
    'Lists the node types you can add, with their ports and params. Filter by a search query or a category.',
    z.object({ query: z.string().optional(), category: z.string().optional() }),
  ),
  spec('get_code', 'Returns the TSL code generated from the current graph.', noArgs),
  spec(
    'get_preview_image',
    'Returns an image of the current shader preview, so you can check how the graph looks.',
    noArgs,
  ),
  spec(
    'add_node',
    'Adds a node of a type from list_node_types. Omit position to let nudo place it next to related nodes.',
    z.object({ type: z.string(), position: positionSchema.optional() }),
  ),
  spec(
    'remove_nodes',
    'Removes the nodes with the given ids, along with the edges attached to them.',
    z.object({ ids: z.array(z.string()) }),
  ),
  spec(
    'move_nodes',
    'Moves nodes to new canvas positions, keyed by node id.',
    z.object({ positions: z.record(z.string(), positionSchema) }),
  ),
  spec(
    'connect',
    'Connects an output port to an input port. Fails if the types are incompatible or the edge would create a cycle.',
    z.object({ from: endpointSchema, to: endpointSchema }),
  ),
  spec(
    'disconnect',
    'Removes the edges with the given ids.',
    z.object({ edgeIds: z.array(z.string()) }),
  ),
  spec(
    'set_input',
    'Sets the constant value of an unconnected input port. The value must match the port type.',
    z.object({ nodeId: z.string(), portId: z.string(), value: portValueSchema }),
  ),
  spec(
    'set_param',
    'Sets a node param, such as an operator or a toggle.',
    z.object({
      nodeId: z.string(),
      paramId: z.string(),
      value: z.union([z.string(), finiteNumber, z.boolean()]),
    }),
  ),
  spec(
    'add_property',
    'Adds a blackboard property (a named uniform-like value) and returns its id.',
    z.object({ kind: propertyKindSchema, name: z.string().optional() }),
  ),
  spec(
    'set_property',
    'Updates a blackboard property: its label, name, whether it is exposed, or its value.',
    z.object({
      id: z.string(),
      label: z.string().optional(),
      name: z.string().optional(),
      exposed: z.boolean().optional(),
      value: portValueSchema.optional(),
    }),
  ),
  spec('remove_property', 'Removes a blackboard property by id.', z.object({ id: z.string() })),
  spec('tidy_up', 'Rearranges all nodes into a clean left-to-right layout.', noArgs),
  spec(
    'new_graph',
    'Replaces the current graph with an empty one. The person must confirm first, so this can take a while.',
    noArgs,
    CONFIRM_TOOL_TIMEOUT_MS,
  ),
  spec(
    'load_template',
    'Replaces the current graph with a built-in template by id. The person must confirm first, so this can take a while.',
    z.object({ id: z.string() }),
    CONFIRM_TOOL_TIMEOUT_MS,
  ),
  spec(
    'start_task',
    'Announces a multi-step job to the person, with an optional list of planned steps. Call it before you start editing.',
    z.object({ prompt: z.string(), steps: z.array(z.string()).optional() }),
  ),
  spec(
    'set_step',
    'Tells the person which step of the task you are on now.',
    z.object({ label: z.string(), detail: z.string().optional() }),
  ),
  spec(
    'finish_task',
    'Marks the task as done, with an optional short summary for the person.',
    z.object({ summary: z.string().optional() }),
  ),
]
