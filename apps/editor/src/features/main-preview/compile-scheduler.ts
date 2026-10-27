import { portKey, topologyKey } from '@nudo-tsl/core'
import type {
  BlackboardProperty,
  Graph,
  NodeRegistry,
  PortKey,
  PortRef,
  PortValue,
  PropertyId,
} from '@nudo-tsl/core'
import { applyBuildInputValue, applyPropertyValue } from '@nudo-tsl/runtime'
import type { ApplyInputValueResult, MaterialBuild } from '@nudo-tsl/runtime'

export interface CompileSchedulerOptions {
  /** Tells `topologyKey` which params are editor-only, so editing them never recompiles. */
  registry: NodeRegistry
  /** Quiet period before a topology change is compiled. */
  delayMs: number
  build(graph: Graph): MaterialBuild
  /** Receives every build, including failed ones. */
  onBuilt(build: MaterialBuild): void
}

export interface CompileScheduler {
  update(graph: Graph): void
  /**
   * Shows a value on the live material right away, without touching the graph or compiling.
   * Whoever previews must end by applying the value the graph holds, because an `update` that
   * leaves that value unchanged does not touch the uniform.
   */
  previewValue(ref: PortRef, value: PortValue): ApplyInputValueResult
  /** `previewValue` for a Blackboard property: same contract, its shared uniform instead. */
  previewPropertyValue(id: PropertyId, value: PortValue): ApplyInputValueResult
  /**
   * Tells the scheduler a texture asset finished loading. If the built material stood in for that
   * asset with the neutral texture, it is built again so the real one shows.
   */
  textureLoaded(assetId: string): void
  dispose(): void
}

interface InlineValueChange {
  ref: PortRef
  value: PortValue
}

function connectedInputKeys(graph: Graph): ReadonlySet<PortKey> {
  return new Set(Object.values(graph.edges).map((edge) => portKey(edge.to)))
}

/**
 * Inline values that differ between two graphs of the same topology, or `null` when a value
 * disappeared (no uniform can represent that). A connected input's inline value is ignored by the
 * compiler, so changing it needs no uniform.
 */
function diffInlineValues(previous: Graph, next: Graph): readonly InlineValueChange[] | null {
  const connected = connectedInputKeys(next)
  const changes: InlineValueChange[] = []

  for (const node of Object.values(next.nodes)) {
    const previousValues = previous.nodes[node.id]?.inputValues ?? {}
    if (Object.keys(previousValues).some((portId) => !(portId in node.inputValues))) return null
    for (const [portId, value] of Object.entries(node.inputValues)) {
      const ref: PortRef = { nodeId: node.id, portId }
      if (previousValues[portId] === value || connected.has(portKey(ref))) continue
      changes.push({ ref, value })
    }
  }
  return changes
}

/** Blackboard properties whose value differs between two graphs, matched by id. */
function changedProperties(previous: Graph, next: Graph): readonly BlackboardProperty[] {
  return next.properties.filter((property) => {
    const before = previous.properties.find((candidate) => candidate.id === property.id)
    return before !== undefined && before.value !== property.value
  })
}

/**
 * Keeps one live material in step with the graph. Inline value edits go straight into the
 * material's uniforms; only a topology change recompiles, after a quiet period so a burst of
 * edits costs a single compile.
 */
export function createCompileScheduler(options: CompileSchedulerOptions): CompileScheduler {
  let pendingTimer: ReturnType<typeof setTimeout> | null = null
  let isDisposed = false
  let latestGraph: Graph | null = null
  /** The graph whose topology and inline values the current build reflects. */
  let builtGraph: Graph | null = null
  let builtKey: string | null = null
  let builtMaterial: MaterialBuild | null = null
  /**
   * True once a value could not be applied in place, or a texture the build stood in for arrived.
   * The pending rebuild is then owed to the
   * material, so returning to the built topology must not cancel it.
   */
  let isRebuildOwed = false

  const cancelPendingRebuild = (): void => {
    if (pendingTimer === null) return
    clearTimeout(pendingTimer)
    pendingTimer = null
  }

  const rebuild = (): void => {
    pendingTimer = null
    isRebuildOwed = false
    if (latestGraph === null) return
    const graph = latestGraph
    const build = options.build(graph)
    builtGraph = graph
    builtKey = topologyKey(graph, options.registry)
    builtMaterial = build
    options.onBuilt(build)
  }

  const scheduleRebuild = (): void => {
    cancelPendingRebuild()
    pendingTimer = setTimeout(rebuild, options.delayMs)
  }

  const applyToBuilt = (ref: PortRef, value: PortValue): ApplyInputValueResult =>
    builtMaterial === null ? 'missing' : applyBuildInputValue(builtMaterial, ref, value)

  const applyPropertyToBuilt = (id: PropertyId, value: PortValue): ApplyInputValueResult =>
    builtMaterial === null ? 'missing' : applyPropertyValue(builtMaterial, id, value)

  /**
   * Returns false when some value needs a rebuild. A value with no uniform (its node cannot
   * reach the master) is not visible anywhere, so it never does.
   */
  const applyValueChanges = (previous: Graph, next: Graph): boolean => {
    const changes = diffInlineValues(previous, next)
    if (changes === null) return false
    // Every change is applied, even after one mismatches: the rebuild replaces them all anyway.
    const inputOutcomes = changes.map(({ ref, value }) => applyToBuilt(ref, value))
    const propertyOutcomes = changedProperties(previous, next).map(({ id, value }) =>
      applyPropertyToBuilt(id, value),
    )
    return ![...inputOutcomes, ...propertyOutcomes].includes('mismatch')
  }

  return {
    update(graph) {
      if (isDisposed) return
      latestGraph = graph

      if (builtGraph === null || builtKey !== topologyKey(graph, options.registry)) {
        scheduleRebuild()
        return
      }

      // Back on the built topology: a rebuild pending for a structural edit that was undone is
      // moot, but one owed to a value that could not be applied in place is not.
      if (!isRebuildOwed) cancelPendingRebuild()
      const isApplied = applyValueChanges(builtGraph, graph)
      builtGraph = graph
      if (isApplied) return
      isRebuildOwed = true
      scheduleRebuild()
    },
    previewValue(ref, value) {
      if (isDisposed) return 'missing'
      return applyToBuilt(ref, value)
    },
    previewPropertyValue(id, value) {
      if (isDisposed) return 'missing'
      return applyPropertyToBuilt(id, value)
    },
    textureLoaded(assetId) {
      if (isDisposed || builtMaterial === null) return
      if (!builtMaterial.missingTextures.includes(assetId)) return
      // Owed like an unappliable value: an update on the built topology must not cancel it.
      isRebuildOwed = true
      scheduleRebuild()
    },
    dispose() {
      isDisposed = true
      isRebuildOwed = false
      cancelPendingRebuild()
    },
  }
}
