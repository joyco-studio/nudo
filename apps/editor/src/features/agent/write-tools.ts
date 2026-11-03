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
  setPropertyExposed,
  setPropertyValue,
} from '@nudo-tsl/core'
import type {
  ConnectionRejection,
  Graph,
  GraphError,
  NodeId,
  ParamRef,
  ParamValue,
  PortRef,
  PortValue,
  PropertyError,
  PropertyId,
  Result,
  XY,
} from '@nudo-tsl/core'
import { PROPERTY_KIND_SPECS } from '@/features/blackboard/property-kinds'
import { listedExamples } from '@/examples'
import { openExample } from '@/features/examples/open-example'
import { readInitialLocale } from '@/i18n/locale'
import type { Locale } from '@/i18n/locale'
import { graphContents, hasWorkToLose } from '@/shared/lib/graph-contents'
import { useEditorStore } from '@/store/editor-store'
import { createPropertyId } from '@/store/ids'
import { registry } from '@/store/registry'
import { relabelProperty } from '@/store/property-slice'
import { placeForAgent } from './agent-placement'
import { defineHandler } from './define-handler'
import type { AgentGraph } from './agent-graph-view'
import type { WriteToolName } from './tool-kinds'
import type { CommitWrite, ConfirmKind, ToolContext, ToolHandler } from './tool-context'
import { markAgentWrite } from './undo-all'

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

type Refusal = Result<never, AgentError>
type Problem = Refusal | null

/**
 * Why the agent may not write now, if it may not. The gate already admitted the call, but the
 * person can press Stop while the cursor travels or a confirmation is open, so every commit that
 * follows an await asks again.
 */
function writeRefusal(context: ToolContext): Problem {
  const allowed = context.canWrite(context.agent)
  return allowed.ok ? null : allowed
}

/** A `CommitWrite` that refuses after Stop and remembers why, for handlers that commit late. */
function guardedCommit(context: ToolContext): { commit: CommitWrite; refusal: () => Problem } {
  let refusal: Problem = null
  const commit: CommitWrite = (write) => {
    refusal = writeRefusal(context)
    if (refusal !== null) return false
    markAgentWrite(write)
    return true
  }
  return { commit, refusal: () => refusal }
}

/**
 * Moves the cursor, then runs the edit, unless the agent was stopped meanwhile. The graph can
 * change while the cursor travels, so every edit re-validates its target and answers with a
 * problem instead of silently doing nothing. The cursor always rests after. */
async function atCursor<T>(
  context: ToolContext,
  arrive: () => Promise<void>,
  edit: () => T,
): Promise<T | Refusal> {
  try {
    await arrive()
    return writeRefusal(context) ?? edit()
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
    () => markAgentWrite(() => useEditorStore.getState().addNode(type, spot)),
  )
  if (nodeId === null) return invalid(`Node type "${type}" cannot be added directly.`)
  if (typeof nodeId !== 'string') return nodeId
  context.onTouch({ nodeId, created: true })
  return succeed({ nodeId })
})

const removeNodes = defineHandler('remove_nodes', async ({ ids }, context) => {
  const nodeIds = ids.map(asNodeId)
  if (nodeIds.includes(MASTER_NODE_ID)) return invalid('The output node cannot be removed.')
  const missing = (): Problem =>
    knownNodeIds(currentGraph(), nodeIds) ? null : notFound('Some nodes do not exist.')
  const early = missing()
  if (early !== null) return early
  const [first] = nodeIds
  if (first === undefined) return succeed({ removed: [] })

  const problem = await atCursor(
    context,
    () => context.choreograph.arrive({ kind: 'node', nodeId: first }),
    () => {
      const gone = missing()
      if (gone !== null) return gone
      markAgentWrite(() => {
        useEditorStore.getState().removeNodes(nodeIds)
      })
      return null
    },
  )
  if (problem !== null) return problem
  // Deliberately no onTouch: a deleted node cannot anchor where the next node is placed.
  return succeed({ removed: ids })
})

const moveNodes = defineHandler('move_nodes', async ({ positions }, context) => {
  const entries = Object.entries(positions).map(
    ([id, position]) => [asNodeId(id), position] as const,
  )
  const missing = (): Problem =>
    knownNodeIds(
      currentGraph(),
      entries.map(([id]) => id),
    )
      ? null
      : notFound('Some nodes do not exist.')
  const early = missing()
  if (early !== null) return early
  const [first] = entries
  if (first === undefined) return succeed({ moved: [] })

  const problem = await atCursor(
    context,
    () => context.choreograph.arrive({ kind: 'node', nodeId: first[0] }),
    () => {
      const gone = missing()
      if (gone !== null) return gone
      markAgentWrite(() => {
        useEditorStore.getState().commitMove(Object.fromEntries(entries))
      })
      return null
    },
  )
  if (problem !== null) return problem
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

function connectProblem(from: PortRef, to: PortRef): Problem {
  const graph = currentGraph()
  if (!knownNodeIds(graph, [from.nodeId, to.nodeId])) return notFound('Some nodes do not exist.')
  if (!hasPort(graph, from, 'outputs'))
    return notFound(`Node ${from.nodeId} has no output "${from.portId}".`)
  if (!hasPort(graph, to, 'inputs'))
    return notFound(`Node ${to.nodeId} has no input "${to.portId}".`)
  const check = checkConnection(graph, registry, from, to)
  return check.ok ? null : rejected(check.reason)
}

const connectTool = defineHandler('connect', async ({ from: rawFrom, to: rawTo }, context) => {
  const from = toPortRef(rawFrom)
  const to = toPortRef(rawTo)
  const early = connectProblem(from, to)
  if (early !== null) return early
  const graph = currentGraph()

  const problem = await atCursor(
    context,
    async () => {
      await context.choreograph.arrive(
        { kind: 'port', ref: from },
        { pendingWire: { from, to: nodePosition(graph, to.nodeId) } },
      )
      await context.choreograph.arrive({ kind: 'port', ref: to })
    },
    () => {
      const stale = connectProblem(from, to)
      if (stale !== null) return stale
      const connection = markAgentWrite(() => useEditorStore.getState().connect(from, to))
      return connection.ok ? null : rejected(connection.reason)
    },
  )
  if (problem !== null) return problem
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
  markAgentWrite(() => {
    useEditorStore.getState().disconnect(edgeIds.map(asEdgeId))
  })
  for (const edge of edges) if (edge !== undefined) touchEdited(context, edge.to.nodeId)
  return Promise.resolve(succeed({ disconnected: edgeIds }))
})

function inputProblem(ref: PortRef, value: PortValue): Problem {
  const graph = currentGraph()
  if (graph.nodes[ref.nodeId] === undefined) return notFound(`Node ${ref.nodeId} does not exist.`)
  if (!hasPort(graph, ref, 'inputs'))
    return notFound(`Node ${ref.nodeId} has no input "${ref.portId}".`)
  if (Object.values(graph.edges).some((edge) => portKey(edge.to) === portKey(ref))) {
    return invalid(`Input "${ref.portId}" is connected; disconnect it to set a constant.`)
  }
  const portType = resolvePortTypes(graph, registry).inputs.get(portKey(ref))
  if (portType === value.type) return null
  return invalid(
    `Input "${ref.portId}" takes a ${portType ?? 'different'} value, not ${value.type}.`,
  )
}

const setInput = defineHandler(
  'set_input',
  async ({ nodeId: rawNodeId, portId, value }, context) => {
    const ref: PortRef = { nodeId: asNodeId(rawNodeId), portId }
    const early = inputProblem(ref, value)
    if (early !== null) return early

    const problem = await atCursor(
      context,
      () => context.choreograph.arrive({ kind: 'port', ref }),
      () => {
        const stale = inputProblem(ref, value)
        if (stale !== null) return stale
        markAgentWrite(() => {
          useEditorStore.getState().setInputValue(ref, value)
        })
        return null
      },
    )
    if (problem !== null) return problem
    touchEdited(context, ref.nodeId)
    return succeed({ nodeId: rawNodeId, portId })
  },
)

function paramProblem(ref: ParamRef, value: ParamValue): Problem {
  const graph = currentGraph()
  const node = graph.nodes[ref.nodeId]
  if (node === undefined) return notFound(`Node ${ref.nodeId} does not exist.`)
  const definition = registry.get(node.type)
  if (definition !== undefined && findParamDefinition(definition, ref.paramId) === undefined) {
    return notFound(`Node ${ref.nodeId} has no param "${ref.paramId}".`)
  }
  const dryRun = setParam(graph, registry, ref, value)
  return dryRun.ok ? null : fromGraphError(dryRun.error)
}

const setParamTool = defineHandler(
  'set_param',
  async ({ nodeId: rawNodeId, paramId, value }, context) => {
    const ref: ParamRef = { nodeId: asNodeId(rawNodeId), paramId }
    const early = paramProblem(ref, value)
    if (early !== null) return early

    const problem = await atCursor(
      context,
      () => context.choreograph.arrive({ kind: 'node', nodeId: ref.nodeId }),
      () => {
        const stale = paramProblem(ref, value)
        if (stale !== null) return stale
        markAgentWrite(() => {
          useEditorStore.getState().setParam(ref, value)
        })
        return null
      },
    )
    if (problem !== null) return problem
    touchEdited(context, ref.nodeId)
    return succeed({ nodeId: rawNodeId, paramId })
  },
)

/**
 * Applies a pure property edit as one history entry. A refusal (from the edit, or from the graph
 * having changed since) is reported with its property error; nothing changes then.
 */
function applyPropertyEdit(
  edit: (graph: Graph) => Result<Graph, PropertyError>,
): Result<never, AgentError> | null {
  const captured: { refusal: PropertyError | null } = { refusal: null }
  const reason = markAgentWrite(() =>
    useEditorStore.getState().applyGraphChange((graph) => {
      const result = edit(graph)
      if (result.ok) return result
      captured.refusal = result.error
      return err(result.error.code)
    }),
  )
  if (reason === null) return null
  return captured.refusal === null ? invalid(reason) : fromPropertyError(captured.refusal)
}

const addPropertyTool = defineHandler('add_property', ({ kind, name }) => {
  if (name === undefined) {
    const id = markAgentWrite(() => useEditorStore.getState().addProperty(kind))
    if (id === null) return Promise.resolve(invalid('The property could not be added.'))
    return Promise.resolve(succeed({ id }))
  }
  // A requested name is both the label and the reference, so the blackboard shows it as given.
  const id = createPropertyId()
  const spec = PROPERTY_KIND_SPECS[kind]
  const problem = applyPropertyEdit((graph) =>
    addProperty(graph, {
      id,
      label: name,
      name,
      exposed: true,
      type: spec.type,
      ...(spec.widget === undefined ? {} : { widget: spec.widget }),
      value: spec.defaultValue,
    }),
  )
  return Promise.resolve(problem ?? succeed({ id }))
})

function findProperty(id: PropertyId) {
  return currentGraph().properties.find((property) => property.id === id)
}

type PropertyEdit = (graph: Graph) => Result<Graph, PropertyError>

/** Chains pure edits; the first refusal stops the chain. */
const sequence =
  (edits: readonly PropertyEdit[]): PropertyEdit =>
  (graph) => {
    let current: Result<Graph, PropertyError> = ok(graph)
    for (const edit of edits) {
      if (!current.ok) return current
      current = edit(current.value)
    }
    return current
  }

const setPropertyTool = defineHandler(
  'set_property',
  ({ id: rawId, label, name, exposed, value }) => {
    const id = asPropertyId(rawId)
    if (findProperty(id) === undefined)
      return Promise.resolve(fromPropertyError({ code: 'property-not-found', id }))

    // One pure chain, so the whole call is one history entry and a refused field applies nothing.
    const edits: PropertyEdit[] = []
    if (label !== undefined) edits.push((graph) => relabelProperty(graph, id, label))
    if (name !== undefined) edits.push((graph) => renameProperty(graph, id, name))
    if (exposed !== undefined) edits.push((graph) => setPropertyExposed(graph, id, exposed))
    if (value !== undefined) edits.push((graph) => setPropertyValue(graph, id, value))
    if (edits.length === 0) return Promise.resolve(succeed({ id: rawId }))

    const problem = applyPropertyEdit(sequence(edits))
    return Promise.resolve(problem ?? succeed({ id: rawId }))
  },
)

const removePropertyTool = defineHandler('remove_property', ({ id: rawId }) => {
  const id = asPropertyId(rawId)
  if (findProperty(id) === undefined)
    return Promise.resolve(fromPropertyError({ code: 'property-not-found', id }))
  markAgentWrite(() => {
    useEditorStore.getState().removeProperty(id)
  })
  return Promise.resolve(succeed({ id: rawId }))
})

const tidyUp = defineHandler('tidy_up', async (_args, context) => {
  const guard = guardedCommit(context)
  await context.tidyUp(guard.commit)
  return guard.refusal() ?? succeed({})
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
  const guard = guardedCommit(context)
  guard.commit(() => {
    useEditorStore.getState().resetGraph()
  })
  return guard.refusal() ?? succeed({})
})

/** Reads the UI locale at the moment a template opens, so its node names match the interface. */
export type ReadLocale = () => Locale

const browserLocale: ReadLocale = () =>
  readInitialLocale(window.localStorage, window.navigator.language)

const loadTemplateIn = (readLocale: ReadLocale): ToolHandler =>
  defineHandler('load_template', async ({ id }, context) => {
    const templates = listedExamples()
    const example = templates.find((candidate) => candidate.id === id)
    if (example === undefined) {
      return notFound(`Unknown template "${id}".`, {
        templateIds: templates.map((template) => template.id),
      })
    }
    if (!(await isReplacementConfirmed(context, 'load_template'))) return declined('load_template')
    const locale = readLocale()
    const guard = guardedCommit(context)
    const isOpened = await openExample(example, locale, undefined, guard.commit)
    const refusal = guard.refusal()
    if (refusal !== null) return refusal
    if (!isOpened) return invalid(`Template "${id}" could not be opened.`)
    return succeed({ id })
  })

export type WriteTools = Pick<Record<WriteToolName, ToolHandler>, WriteToolName>

/** The write tools, opening templates in the locale `readLocale` gives (the UI's, when mounted). */
export const createWriteTools = (readLocale: ReadLocale): WriteTools => ({
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
  load_template: loadTemplateIn(readLocale),
})

/** The write tools with the locale the editor would start in (stored, else the browser's). */
export const writeTools: WriteTools = createWriteTools(browserLocale)
