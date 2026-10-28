import { topologyKey } from '@nudo-tsl/core'
import type { Graph, NodeId, NodeRegistry, PortRef, PortValue, PropertyId } from '@nudo-tsl/core'
import { applyInputValue, applyPropertyValue, createPreviewMaterial } from '@nudo-tsl/runtime'
import type { ApplyInputValueResult, MaterialBuild } from '@nudo-tsl/runtime'
import { Mesh, Scene } from 'three'
import type { Camera, ColorRepresentation, Object3D } from 'three'

import { changedProperties, partitionInlineValues } from '@/shared/lib/graph-value-diff'
import type { RendererBackend } from '@/features/main-preview/create-renderer'
import { registry as defaultRegistry } from '@/store/registry'

import {
  isAnimatedPreview,
  resolvePreviewShape,
  upstreamNodeIds,
  upstreamTopologyKey,
} from './preview-graph'
import type { PreviewShape } from './preview-graph'
import {
  browserFrameClock,
  createFrameLoop,
  frameIntervalMs,
  isRenderDue,
  pickRoundRobin,
} from './preview-scheduler'
import type { FrameClock } from './preview-scheduler'
import { createPreviewStages } from './preview-stage'

/** The part of `WebGPURenderer` the engine uses, so tests can stand in for it. */
export interface PreviewRenderer {
  readonly domElement: HTMLCanvasElement
  setPixelRatio(ratio: number): void
  setSize(width: number, height: number, updateStyle?: boolean): void
  setClearColor(color: ColorRepresentation, alpha?: number): void
  render(scene: Object3D, camera: Camera): void
  compileAsync(scene: Object3D, camera: Camera): Promise<void>
  dispose(): unknown
}

export type PreviewRendererResult =
  { ok: true; renderer: PreviewRenderer; backend: RendererBackend } | { ok: false; message: string }

/**
 * - `pending`: not drawn yet (building, compiling or waiting to scroll into view).
 * - `ready`: the canvas shows the output.
 * - `error`: the output does not compile on its own.
 * - `unavailable`: the browser supports neither WebGPU nor WebGL2.
 */
export type NodePreviewStatus = 'pending' | 'ready' | 'error' | 'unavailable'

export interface NodePreviewSnapshot {
  readonly status: NodePreviewStatus
  readonly shape: PreviewShape
}

export interface PreviewEngine {
  /** Starts previewing `ref` into `canvas`. Returns the function that stops it. */
  register(
    ref: PortRef,
    canvas: HTMLCanvasElement,
    onChange?: (snapshot: NodePreviewSnapshot) => void,
  ): () => void
  /** Off-screen previews never render; one coming into view catches up if it went stale. */
  setVisible(nodeId: NodeId, visible: boolean): void
  /**
   * Follows the graph: a preview whose upstream topology changed is built again after a quiet
   * period, a value change goes into the uniforms in place.
   */
  update(graph: Graph): void
  /** The R21 channel: a value being scrubbed, shown on every preview that reads it. */
  previewValue(ref: PortRef, value: PortValue): void
  previewPropertyValue(id: PropertyId, value: PortValue): void
  /** A texture the previews stood in for finished loading: the ones that use it build again. */
  textureLoaded(assetId: string): void
  dispose(): void
}

export interface PreviewEngineOptions {
  /** Canvas side in CSS pixels. */
  size: number
  /** Frame rate cap for animated (Time) previews. */
  fps: number
  /** Most previews built or rendered in one animation frame. */
  budgetPerFrame: number
  createRenderer: () => Promise<PreviewRendererResult>
  /** Device pixels per CSS pixel the previews render at. */
  pixelRatio?: number
  /** Quiet period after a topology change before the affected previews build again. */
  rebuildDelayMs?: number
  registry?: NodeRegistry
  buildMaterial?: (graph: Graph, ref: PortRef) => MaterialBuild
  /** Copies the rendered frame onto a node's canvas. */
  present?: (source: HTMLCanvasElement, target: HTMLCanvasElement) => void
  clock?: FrameClock
  /** Called with how long each render and copy took, for the dev frame-cost counter. */
  onRendered?: (durationMs: number) => void
}

const DEFAULT_REBUILD_DELAY_MS = 150

interface PreviewEntry {
  readonly ref: PortRef
  readonly canvas: HTMLCanvasElement
  readonly onChange: ((snapshot: NodePreviewSnapshot) => void) | undefined
  readonly scene: Scene
  readonly mesh: Mesh
  shape: PreviewShape
  status: NodePreviewStatus
  isVisible: boolean
  isAnimated: boolean
  isDirty: boolean
  lastRenderAt: number | null
  /** The upstream topology the current build (or the one owed) reflects. */
  builtKey: string | null
  build: MaterialBuild | null
  /** A build is owed; it runs once the preview is visible and `buildAfter` has passed. */
  needsBuild: boolean
  buildAfter: number
  /** Bumped by every build, so a compile that finishes after a newer build is ignored. */
  generation: number
  isCompiling: boolean
}

/** Draws the renderer's frame onto the node canvas, in the same task as the render. */
function drawOnto(source: HTMLCanvasElement, target: HTMLCanvasElement): void {
  const context = target.getContext('2d')
  if (context === null) return
  context.clearRect(0, 0, target.width, target.height)
  context.drawImage(source, 0, 0, target.width, target.height)
}

const isBuilt = (entry: PreviewEntry): entry is PreviewEntry & { build: MaterialBuild } =>
  entry.build !== null && entry.build.material !== null

/**
 * One offscreen renderer for every node preview. Each previewed output gets its own unlit
 * material on a shared quad or sphere; frames render on demand, a few per animation frame,
 * and are copied onto the nodes' 2D canvases.
 */
export function createPreviewEngine(options: PreviewEngineOptions): PreviewEngine {
  const registry = options.registry ?? defaultRegistry
  const clock = options.clock ?? browserFrameClock
  const rebuildDelayMs = options.rebuildDelayMs ?? DEFAULT_REBUILD_DELAY_MS
  const minIntervalMs = frameIntervalMs(options.fps)
  const buildMaterial =
    options.buildMaterial ??
    ((graph: Graph, ref: PortRef) => createPreviewMaterial(graph, registry, ref))
  const present = options.present ?? drawOnto
  const stages = createPreviewStages()
  const entries = new Map<NodeId, PreviewEntry>()

  let graph: Graph | null = null
  let graphTopology: string | null = null
  let renderer: PreviewRenderer | null = null
  let rendererState: 'idle' | 'starting' | 'ready' | 'unavailable' = 'idle'
  let roundRobinStart = 0
  let isDisposed = false

  const notify = (entry: PreviewEntry): void => {
    entry.onChange?.({ status: entry.status, shape: entry.shape })
  }

  const setStatus = (entry: PreviewEntry, status: NodePreviewStatus): void => {
    if (entry.status === status) return
    entry.status = status
    notify(entry)
  }

  const releaseMaterial = (entry: PreviewEntry): void => {
    entry.build?.material?.dispose()
    entry.build = null
  }

  /**
   * A preview that cannot compile or draw drops its material, so it stops rendering (and taking
   * budget) until its upstream changes and it is built again.
   */
  const failEntry = (entry: PreviewEntry): void => {
    entry.isCompiling = false
    entry.isDirty = false
    releaseMaterial(entry)
    setStatus(entry, 'error')
  }

  /** A compile in flight asks for a frame itself when it finishes, so it keeps no loop alive. */
  const hasWork = (entry: PreviewEntry): boolean =>
    entry.isVisible &&
    !entry.isCompiling &&
    (entry.needsBuild || (isBuilt(entry) && (entry.isDirty || entry.isAnimated)))

  const isWorkDue = (entry: PreviewEntry, now: number): boolean => {
    if (!entry.isVisible || entry.isCompiling) return false
    if (entry.needsBuild) return now >= entry.buildAfter
    return isBuilt(entry) && isRenderDue(entry, now, minIntervalMs)
  }

  const compile = (entry: PreviewEntry, activeRenderer: PreviewRenderer): void => {
    const generation = entry.generation
    entry.isCompiling = true
    activeRenderer.compileAsync(entry.scene, stages[entry.shape].camera).then(
      () => {
        if (entry.generation !== generation) return
        entry.isCompiling = false
        entry.isDirty = true
        loop.request()
      },
      () => {
        if (entry.generation !== generation) return
        failEntry(entry)
      },
    )
  }

  const buildEntry = (entry: PreviewEntry, activeRenderer: PreviewRenderer): void => {
    if (graph === null) return
    entry.needsBuild = false
    entry.generation += 1
    entry.builtKey = upstreamTopologyKey(graph, entry.ref, registry)
    releaseMaterial(entry)
    const build = buildMaterial(graph, entry.ref)
    if (build.material === null) {
      failEntry(entry)
      return
    }
    entry.build = build
    entry.mesh.material = build.material
    compile(entry, activeRenderer)
  }

  const renderEntry = (entry: PreviewEntry, activeRenderer: PreviewRenderer, now: number): void => {
    const startedAt = clock.now()
    entry.isDirty = false
    entry.lastRenderAt = now
    try {
      activeRenderer.render(entry.scene, stages[entry.shape].camera)
      present(activeRenderer.domElement, entry.canvas)
    } catch {
      failEntry(entry)
      return
    }
    options.onRendered?.(clock.now() - startedAt)
    setStatus(entry, 'ready')
  }

  const runFrame = (now: number): boolean => {
    if (isDisposed || renderer === null) return false
    const activeRenderer = renderer
    const keys = [...entries.keys()]
    const { picked, nextStart } = pickRoundRobin(
      keys,
      (key) => {
        const entry = entries.get(key)
        return entry !== undefined && isWorkDue(entry, now)
      },
      options.budgetPerFrame,
      roundRobinStart,
    )
    roundRobinStart = nextStart
    for (const key of picked) {
      const entry = entries.get(key)
      if (entry === undefined) continue
      if (entry.needsBuild) buildEntry(entry, activeRenderer)
      else renderEntry(entry, activeRenderer, now)
    }
    return [...entries.values()].some(hasWork)
  }

  const loop = createFrameLoop(runFrame, clock)

  const startRenderer = (): void => {
    if (rendererState !== 'idle') return
    rendererState = 'starting'
    options.createRenderer().then(
      (result) => {
        if (isDisposed) {
          if (result.ok) void result.renderer.dispose()
          return
        }
        if (!result.ok) {
          rendererState = 'unavailable'
          for (const entry of entries.values()) setStatus(entry, 'unavailable')
          return
        }
        const pixelRatio = options.pixelRatio ?? 1
        result.renderer.setPixelRatio(pixelRatio)
        result.renderer.setSize(options.size, options.size, false)
        // Transparent around the sphere: the round mask shows the node card behind it.
        result.renderer.setClearColor(0x000000, 0)
        renderer = result.renderer
        rendererState = 'ready'
        loop.request()
      },
      () => {
        rendererState = 'unavailable'
        for (const entry of entries.values()) setStatus(entry, 'unavailable')
      },
    )
  }

  /** Re-reads what the graph says about one preview: shape, animation and owed rebuilds. */
  const refreshEntry = (entry: PreviewEntry, next: Graph, isTopologyChanged: boolean): void => {
    const shape = resolvePreviewShape(next, entry.ref.nodeId)
    if (shape !== entry.shape) {
      entry.shape = shape
      entry.mesh.geometry = stages[shape].geometry
      entry.isDirty = true
      notify(entry)
    }
    if (!isTopologyChanged) return
    entry.isAnimated = isAnimatedPreview(next, entry.ref.nodeId)
    if (entry.builtKey === upstreamTopologyKey(next, entry.ref, registry)) return
    entry.needsBuild = true
    entry.buildAfter = clock.now() + rebuildDelayMs
  }

  const markForRebuild = (entry: PreviewEntry, delayMs = 0): void => {
    entry.needsBuild = true
    entry.buildAfter = clock.now() + delayMs
  }

  /** Applies a value in place; a value no uniform can hold (a texture swap) rebuilds instead. */
  const applyToEntries = (apply: (build: MaterialBuild) => ApplyInputValueResult): void => {
    for (const entry of entries.values()) {
      if (!isBuilt(entry) || entry.needsBuild) continue
      const outcome = apply(entry.build)
      if (outcome === 'applied') entry.isDirty = true
      else if (outcome === 'mismatch') markForRebuild(entry)
    }
  }

  const readsAnyOf = (entry: PreviewEntry, next: Graph, nodeIds: ReadonlySet<NodeId>): boolean => {
    const upstream = upstreamNodeIds(next, entry.ref.nodeId)
    return [...nodeIds].some((nodeId) => upstream.has(nodeId))
  }

  /** Previews that read one of `nodeIds` upstream (and pass `isEligible`) build again after a pause. */
  const rebuildReaders = (
    next: Graph,
    nodeIds: ReadonlySet<NodeId>,
    isEligible: (entry: PreviewEntry) => boolean,
  ): void => {
    if (nodeIds.size === 0) return
    for (const entry of entries.values()) {
      if (entry.needsBuild || !isEligible(entry) || !readsAnyOf(entry, next, nodeIds)) continue
      markForRebuild(entry, rebuildDelayMs)
    }
  }

  const applyValueChanges = (previous: Graph, next: Graph): void => {
    // Each preview reads only its upstream, so a lost value rebuilds just its readers while every
    // other change still goes into the uniforms in place.
    const { changes, nodesWithRemovedValues } = partitionInlineValues(previous, next)
    rebuildReaders(next, nodesWithRemovedValues, () => true)
    for (const { ref, value } of changes) {
      applyToEntries((build) => applyInputValue(build.uniforms, ref, value))
    }
    for (const { id, value } of changedProperties(previous, next)) {
      applyToEntries((build) => applyPropertyValue(build, id, value))
    }
    // A failed preview has no uniforms to update: a value change upstream gives it another try.
    const changedNodes = new Set(changes.map(({ ref }) => ref.nodeId))
    rebuildReaders(next, changedNodes, (entry) => entry.status === 'error')
  }

  const createEntry = (
    ref: PortRef,
    canvas: HTMLCanvasElement,
    onChange: PreviewEntry['onChange'],
  ): PreviewEntry => {
    const shape = graph === null ? '2d' : resolvePreviewShape(graph, ref.nodeId)
    const mesh = new Mesh(stages[shape].geometry)
    const scene = new Scene()
    scene.add(mesh)
    return {
      ref,
      canvas,
      onChange,
      scene,
      mesh,
      shape,
      status: rendererState === 'unavailable' ? 'unavailable' : 'pending',
      isVisible: false,
      isAnimated: graph !== null && isAnimatedPreview(graph, ref.nodeId),
      isDirty: false,
      lastRenderAt: null,
      builtKey: null,
      build: null,
      needsBuild: rendererState !== 'unavailable',
      buildAfter: 0,
      generation: 0,
      isCompiling: false,
    }
  }

  const removeEntry = (entry: PreviewEntry): void => {
    entry.generation += 1
    releaseMaterial(entry)
    entry.scene.remove(entry.mesh)
    if (entries.get(entry.ref.nodeId) === entry) entries.delete(entry.ref.nodeId)
  }

  return {
    register(ref, canvas, onChange) {
      if (isDisposed) return () => {}
      const existing = entries.get(ref.nodeId)
      if (existing !== undefined) removeEntry(existing)
      const entry = createEntry(ref, canvas, onChange)
      entries.set(ref.nodeId, entry)
      notify(entry)
      startRenderer()
      loop.request()
      return () => {
        removeEntry(entry)
      }
    },
    setVisible(nodeId, visible) {
      const entry = entries.get(nodeId)
      if (entry === undefined || entry.isVisible === visible) return
      entry.isVisible = visible
      if (visible) loop.request()
    },
    update(next) {
      if (isDisposed) return
      const previous = graph
      const nextTopology = topologyKey(next, registry)
      const isTopologyChanged = previous === null || nextTopology !== graphTopology
      graph = next
      graphTopology = nextTopology
      for (const entry of entries.values()) refreshEntry(entry, next, isTopologyChanged)
      if (previous !== null) applyValueChanges(previous, next)
      loop.request()
    },
    previewValue(ref, value) {
      applyToEntries((build) => applyInputValue(build.uniforms, ref, value))
      loop.request()
    },
    previewPropertyValue(id, value) {
      applyToEntries((build) => applyPropertyValue(build, id, value))
      loop.request()
    },
    textureLoaded(assetId) {
      for (const entry of entries.values()) {
        if (entry.build?.missingTextures.includes(assetId) === true) markForRebuild(entry)
      }
      loop.request()
    },
    dispose() {
      isDisposed = true
      loop.dispose()
      for (const entry of [...entries.values()]) removeEntry(entry)
      stages.dispose()
      if (renderer !== null) void renderer.dispose()
      renderer = null
    },
  }
}
