import { generateModule } from '@nudo-tsl/codegen'
import type { AgentError } from '@nudo-tsl/agent-protocol'
import {
  MASTER_NODE_ID,
  MASTER_NODE_TYPE,
  addProperty,
  asEdgeId,
  asNodeId,
  asPropertyId,
  checkConnection,
  err,
  findParamDefinition,
  ok,
  portKey,
  renameProperty,
  resolvePortTypes,
  setParam,
  setPropertyValue,
} from '@nudo-tsl/core'
import type {
  ConnectionRejection,
  Graph,
  GraphError,
  NodeId,
  PortRef,
  PropertyError,
  PropertyId,
  Result,
  XY,
} from '@nudo-tsl/core'
import { PROPERTY_KIND_SPECS } from '@/features/blackboard/property-kinds'
import { listedExamples } from '@/examples'
import { openExample } from '@/features/examples/open-example'
import { readInitialLocale } from '@/i18n/locale'
import { graphContents, hasWorkToLose } from '@/shared/lib/graph-contents'
import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'
import { placeForAgent } from './agent-placement'
import { defineHandler } from './define-handler'
import type { AgentGraph } from './agent-graph-view'
import type { ConfirmKind, ToolContext, ToolHandler } from './tool-context'

type WriteToolName =
  | 'add_node'
  | 'remove_nodes'
  | 'move_nodes'
  | 'connect'
  | 'disconnect'
  | 'set_input'
  | 'set_param'
  | 'add_property'
  | 'set_property'
  | 'remove_property'
  | 'tidy_up'
  | 'new_graph'
  | 'load_template'

type WriteResult<T extends object = object> = Result<
  T & { errors: AgentGraph['errors'] },
  AgentError
>

const currentGraph = (): Graph => useEditorStore.getState().graph

/** Compile errors of the graph as it is now, computed fresh so the agent sees the edit's effect. */
const compileErrors = (): AgentGraph['errors'] =>
  generateModule(currentGraph(), registry).errors.map(({ nodeId, message }) => ({
    nodeId,
    message,
  }))

const succeed = <T extends object>(value: T): WriteResult<T> =>
  ok({ ...value, errors: compileErrors() })

const notFound = (message: string, extraState: object = {}): Result<never, AgentError> =>
  err({
    code: 'not_found',
    message,
    state: { nodeIds: Object.keys(currentGraph().nodes), ...extraState },
  })

const invalid = (message: string, state?: unknown): Result<never, AgentError> =>
  err(state === undefined ? { code: 'invalid', message } : { code: 'invalid', message, state })

const NOT_FOUND_GRAPH_ERRORS: ReadonlySet<GraphError['code']> = new Set([
  'node-not-found',
  'edge-not-found',
  'unknown-port',
  'unknown-param',
  'property-not-found',
])

function fromGraphError(error: GraphError): Result<never, AgentError> {
  const message = `The edit was rejected: ${error.code}.`
  return NOT_FOUND_GRAPH_ERRORS.has(error.code) ? notFound(message) : invalid(message, error)
}

function fromPropertyError(error: PropertyError): Result<never, AgentError> {
  if (error.code === 'property-not-found') {
    return err({
      code: 'not_found',
      message: `Unknown property ${error.id}.`,
      state: { propertyIds: currentGraph().properties.map((property) => property.id) },
    })
  }
  return invalid(`The property edit was rejected: ${error.code}.`, error)
}

/** Moves the cursor, runs the edit once it has arrived, and always lets the cursor rest after. */
async function atCursor<T>(
  context: ToolContext,
  arrive: () => Promise<void>,
  edit: () => T,
): Promise<T> {
  try {
    await arrive()
    return edit()
  } finally {
    context.choreograph.settle()
  }
}

const nodePosition = (graph: Graph, nodeId: NodeId): XY =>
  graph.nodes[nodeId]?.position ?? { x: 0, y: 0 }

const toPortRef = (endpoint: { nodeId: string; portId: string }): PortRef => ({
  nodeId: asNodeId(endpoint.nodeId),
  portId: endpoint.portId,
})

const knownNodeIds = (graph: Graph, ids: readonly NodeId[]): boolean =>
  ids.every((id) => graph.nodes[id] !== undefined)

type PortSide = 'inputs' | 'outputs'

function hasPort(graph: Graph, ref: PortRef, side: PortSide): boolean {
  const node = graph.nodes[ref.nodeId]
  const definition = node === undefined ? undefined : registry.get(node.type)
  return definition?.[side].some((port) => port.id === ref.portId) ?? false
}

const touchEdited = (context: ToolContext, nodeId: NodeId): void => {
  context.onTouch({ nodeId, created: false })
}

const addNodeTool = defineHandler('add_node', async ({ type, position }, context) => {
  const definition = registry.get(type)
  if (definition === undefined) return invalid(`Unknown node type "${type}".`)
  if (type === MASTER_NODE_TYPE) return invalid('The output node already exists.')

  const spot = position ?? placeForAgent(currentGraph(), context.lastTouched())
  const nodeId = await atCursor(
    context,
    () =>
      context.choreograph.arrive(
        { kind: 'point', position: spot },
        { ghost: { type, position: spot } },
      ),
    () => useEditorStore.getState().addNode(type, spot),
  )
  if (nodeId === null) return invalid(`Node type "${type}" cannot be added directly.`)
  context.onTouch({ nodeId, created: true })
  return succeed({ nodeId })
})

const removeNodes = defineHandler('remove_nodes', async ({ ids }, context) => {
  const nodeIds = ids.map(asNodeId)
  if (nodeIds.includes(MASTER_NODE_ID)) return invalid('The output node cannot be removed.')
  if (!knownNodeIds(currentGraph(), nodeIds)) return notFound('Some nodes do not exist.')
  const [first] = nodeIds
  if (first === undefined) return succeed({ removed: [] })

  await atCursor(
    context,
    () => context.choreograph.arrive({ kind: 'node', nodeId: first }),
    () => {
      useEditorStore.getState().removeNodes(nodeIds)
    },
  )
  return succeed({ removed: ids })
})

const moveNodes = defineHandler('move_nodes', async ({ positions }, context) => {
  const entries = Object.entries(positions).map(
    ([id, position]) => [asNodeId(id), position] as const,
  )
  if (
    !knownNodeIds(
      currentGraph(),
      entries.map(([id]) => id),
    )
  ) {
    return notFound('Some nodes do not exist.')
  }
  const [first] = entries
  if (first === undefined) return succeed({ moved: [] })

  await atCursor(
    context,
    () => context.choreograph.arrive({ kind: 'node', nodeId: first[0] }),
    () => {
      useEditorStore.getState().commitMove(Object.fromEntries(entries))
    },
  )
  for (const [nodeId] of entries) touchEdited(context, nodeId)
  return succeed({ moved: entries.map(([id]) => id) })
})

const REJECTION_MESSAGES: Record<ConnectionRejection, string> = {
  'type-mismatch': 'The port types are not compatible.',
  cycle: 'The connection would create a cycle.',
  'same-node': 'A node cannot be connected to itself.',
  'unknown-port': 'The port does not exist.',
}

const rejected = (reason: ConnectionRejection): Result<never, AgentError> =>
  invalid(REJECTION_MESSAGES[reason], { reason })

function findEdgeId(graph: Graph, from: PortRef, to: PortRef): string | undefined {
  return Object.values(graph.edges).find(
    (edge) => portKey(edge.from) === portKey(from) && portKey(edge.to) === portKey(to),
  )?.id
}

const connectTool = defineHandler('connect', async ({ from: rawFrom, to: rawTo }, context) => {
  const from = toPortRef(rawFrom)
  const to = toPortRef(rawTo)
  const graph = currentGraph()
  if (!knownNodeIds(graph, [from.nodeId, to.nodeId])) return notFound('Some nodes do not exist.')
  if (!hasPort(graph, from, 'outputs'))
    return notFound(`Node ${from.nodeId} has no output "${from.portId}".`)
  if (!hasPort(graph, to, 'inputs'))
    return notFound(`Node ${to.nodeId} has no input "${to.portId}".`)
  const check = checkConnection(graph, registry, from, to)
  if (!check.ok) return rejected(check.reason)

  const connection = await atCursor(
    context,
    async () => {
      await context.choreograph.arrive(
        { kind: 'port', ref: from },
        { pendingWire: { from, to: nodePosition(graph, to.nodeId) } },
      )
      await context.choreograph.arrive({ kind: 'port', ref: to })
    },
    () => useEditorStore.getState().connect(from, to),
  )
  if (!connection.ok) return rejected(connection.reason)
  const edgeId = findEdgeId(currentGraph(), from, to)
  if (edgeId === undefined) return invalid('The connection could not be made.')
  touchEdited(context, to.nodeId)
  return succeed({ edgeId })
})

const disconnectTool = defineHandler('disconnect', ({ edgeIds }, context) => {
  const graph = currentGraph()
  const edges = edgeIds.map((id) => graph.edges[asEdgeId(id)])
  if (edges.some((edge) => edge === undefined)) {
    return Promise.resolve(
      notFound('Some edges do not exist.', { edgeIds: Object.keys(graph.edges) }),
    )
  }
  useEditorStore.getState().disconnect(edgeIds.map(asEdgeId))
  for (const edge of edges) if (edge !== undefined) touchEdited(context, edge.to.nodeId)
  return Promise.resolve(succeed({ disconnected: edgeIds }))
})

const setInput = defineHandler(
  'set_input',
  async ({ nodeId: rawNodeId, portId, value }, context) => {
    const ref: PortRef = { nodeId: asNodeId(rawNodeId), portId }
    const graph = currentGraph()
    if (graph.nodes[ref.nodeId] === undefined) return notFound(`Node ${rawNodeId} does not exist.`)
    if (!hasPort(graph, ref, 'inputs'))
      return notFound(`Node ${rawNodeId} has no input "${portId}".`)
    if (Object.values(graph.edges).some((edge) => portKey(edge.to) === portKey(ref))) {
      return invalid(`Input "${portId}" is connected; disconnect it to set a constant.`)
    }
    const portType = resolvePortTypes(graph, registry).inputs.get(portKey(ref))
    if (portType !== value.type) {
      return invalid(
        `Input "${portId}" takes a ${portType ?? 'different'} value, not ${value.type}.`,
      )
    }

    await atCursor(
      context,
      () => context.choreograph.arrive({ kind: 'port', ref }),
      () => {
        useEditorStore.getState().setInputValue(ref, value)
      },
    )
    touchEdited(context, ref.nodeId)
    return succeed({ nodeId: rawNodeId, portId })
  },
)

const setParamTool = defineHandler(
  'set_param',
  async ({ nodeId: rawNodeId, paramId, value }, context) => {
    const ref = { nodeId: asNodeId(rawNodeId), paramId }
    const graph = currentGraph()
    const node = graph.nodes[ref.nodeId]
    if (node === undefined) return notFound(`Node ${rawNodeId} does not exist.`)
    const definition = registry.get(node.type)
    if (definition !== undefined && findParamDefinition(definition, paramId) === undefined) {
      return notFound(`Node ${rawNodeId} has no param "${paramId}".`)
    }
    const dryRun = setParam(graph, registry, ref, value)
    if (!dryRun.ok) return fromGraphError(dryRun.error)

    await atCursor(
      context,
      () => context.choreograph.arrive({ kind: 'node', nodeId: ref.nodeId }),
      () => {
        useEditorStore.getState().setParam(ref, value)
      },
    )
    touchEdited(context, ref.nodeId)
    return succeed({ nodeId: rawNodeId, paramId })
  },
)

const addPropertyTool = defineHandler('add_property', ({ kind, name }) => {
  const graph = currentGraph()
  if (name !== undefined) {
    const spec = PROPERTY_KIND_SPECS[kind]
    const dryRun = addProperty(graph, {
      id: asPropertyId('dry-run'),
      label: name,
      name,
      exposed: true,
      type: spec.type,
      value: spec.defaultValue,
    })
    if (!dryRun.ok) return Promise.resolve(fromPropertyError(dryRun.error))
  }
  const store = useEditorStore.getState()
  const id = store.addProperty(kind)
  if (id === null) return Promise.resolve(invalid('The property could not be added.'))
  const renamed = name === undefined ? null : store.renameProperty(id, name)
  if (renamed !== null) return Promise.resolve(fromPropertyError(renamed))
  return Promise.resolve(succeed({ id }))
})

function findProperty(id: PropertyId) {
  return currentGraph().properties.find((property) => property.id === id)
}

const setPropertyTool = defineHandler(
  'set_property',
  ({ id: rawId, label, name, exposed, value }) => {
    const id = asPropertyId(rawId)
    const graph = currentGraph()
    if (findProperty(id) === undefined)
      return Promise.resolve(fromPropertyError({ code: 'property-not-found', id }))

    // Validate everything that can be refused against the current graph before applying anything,
    // so a rejected field leaves the graph as it was.
    const nameCheck = name === undefined ? null : renameProperty(graph, id, name)
    if (nameCheck !== null && !nameCheck.ok)
      return Promise.resolve(fromPropertyError(nameCheck.error))
    const valueCheck = value === undefined ? null : setPropertyValue(graph, id, value)
    if (valueCheck !== null && !valueCheck.ok)
      return Promise.resolve(fromPropertyError(valueCheck.error))

    const store = useEditorStore.getState()
    const labelError = label === undefined ? null : store.renamePropertyLabel(id, label)
    if (labelError !== null) return Promise.resolve(fromPropertyError(labelError))
    const nameError = name === undefined ? null : store.renameProperty(id, name)
    if (nameError !== null) return Promise.resolve(fromPropertyError(nameError))
    if (exposed !== undefined) store.setPropertyExposed(id, exposed)
    if (value !== undefined) store.setPropertyValue(id, value)
    return Promise.resolve(succeed({ id: rawId }))
  },
)

const removePropertyTool = defineHandler('remove_property', ({ id: rawId }) => {
  const id = asPropertyId(rawId)
  if (findProperty(id) === undefined)
    return Promise.resolve(fromPropertyError({ code: 'property-not-found', id }))
  useEditorStore.getState().removeProperty(id)
  return Promise.resolve(succeed({ id: rawId }))
})

const tidyUp = defineHandler('tidy_up', async (_args, context) => {
  await context.tidyUp()
  return succeed({})
})

const declined = (kind: ConfirmKind): Result<never, AgentError> =>
  err({ code: 'declined', message: `The person declined ${kind}.` })

/** Replacing the graph asks first, but only when there is something to lose. */
async function isReplacementConfirmed(context: ToolContext, kind: ConfirmKind): Promise<boolean> {
  if (!hasWorkToLose(graphContents(currentGraph()))) return true
  return context.confirm(kind)
}

const newGraph = defineHandler('new_graph', async (_args, context) => {
  if (!(await isReplacementConfirmed(context, 'new_graph'))) return declined('new_graph')
  useEditorStore.getState().resetGraph()
  return succeed({})
})

const loadTemplate = defineHandler('load_template', async ({ id }, context) => {
  const templates = listedExamples()
  const example = templates.find((candidate) => candidate.id === id)
  if (example === undefined) {
    return notFound(`Unknown template "${id}".`, {
      templateIds: templates.map((template) => template.id),
    })
  }
  if (!(await isReplacementConfirmed(context, 'load_template'))) return declined('load_template')
  const locale = readInitialLocale(window.localStorage, window.navigator.language)
  if (!(await openExample(example, locale))) return invalid(`Template "${id}" could not be opened.`)
  return succeed({ id })
})

export const writeTools: Pick<Record<WriteToolName, ToolHandler>, WriteToolName> = {
  add_node: addNodeTool,
  remove_nodes: removeNodes,
  move_nodes: moveNodes,
  connect: connectTool,
  disconnect: disconnectTool,
  set_input: setInput,
  set_param: setParamTool,
  add_property: addPropertyTool,
  set_property: setPropertyTool,
  remove_property: removePropertyTool,
  tidy_up: tidyUp,
  new_graph: newGraph,
  load_template: loadTemplate,
}
