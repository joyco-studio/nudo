import { portKey, topologyKey } from '@nudo-tsl/core'
import type { Graph, PortKey, PortRef, PortValue } from '@nudo-tsl/core'
import { applyInputValue } from '@nudo-tsl/runtime'
import type { LiveUniform, MaterialBuild } from '@nudo-tsl/runtime'

export interface CompileSchedulerOptions {
  /** Quiet period before a topology change is compiled. */
  delayMs: number
  build(graph: Graph): MaterialBuild
  /** Receives every build, including failed ones. */
  onBuilt(build: MaterialBuild): void
}

export interface CompileScheduler {
  update(graph: Graph): void
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
  let builtUniforms: ReadonlyMap<PortKey, LiveUniform> = new Map()
  /**
   * True once a value could not be applied in place. The pending rebuild is then owed to the
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
    builtKey = topologyKey(graph)
    builtUniforms = build.uniforms
    options.onBuilt(build)
  }

  const scheduleRebuild = (): void => {
    cancelPendingRebuild()
    pendingTimer = setTimeout(rebuild, options.delayMs)
  }

  /** Returns false when some value could not be applied in place. */
  const applyValueChanges = (previous: Graph, next: Graph): boolean => {
    const changes = diffInlineValues(previous, next)
    if (changes === null) return false
    // Every change is applied, even after one fails: the rebuild replaces them all anyway.
    const outcomes = changes.map(({ ref, value }) => applyInputValue(builtUniforms, ref, value))
    return outcomes.every(Boolean)
  }

  return {
    update(graph) {
      if (isDisposed) return
      latestGraph = graph

      if (builtGraph === null || builtKey !== topologyKey(graph)) {
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
    dispose() {
      isDisposed = true
      isRebuildOwed = false
      cancelPendingRebuild()
    },
  }
}
