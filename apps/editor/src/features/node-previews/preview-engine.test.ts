import {
  addProperty,
  addPropertyNode,
  asPropertyId,
  float,
  setInputValue,
  vec3,
} from '@nudo-tsl/core'
import type { Graph, PortRef } from '@nudo-tsl/core'
import { createPreviewMaterial } from '@nudo-tsl/runtime'
import type { MaterialBuild } from '@nudo-tsl/runtime'
import type { Object3D } from 'three'
import { Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { registry } from '@/store/registry'

import { createPreviewEngine } from './preview-engine'
import type { NodePreviewSnapshot, PreviewEngineOptions, PreviewRenderer } from './preview-engine'
import type { FrameClock } from './preview-scheduler'
import { graphWith, id, port, unwrap, withEdge, withNode } from './test-graph'

const SIZE = 96
const FPS = 20
const BUDGET = 4
/** One display frame at 60 Hz. */
const FRAME_MS = 1000 / 60
const REBUILD_DELAY_MS = 150

/** A clock whose frames only run when the test asks, so every frame is observable. */
function createManualClock() {
  let time = 0
  let nextHandle = 1
  const pending = new Map<number, (now: number) => void>()
  const clock: FrameClock = {
    now: () => time,
    requestFrame: (callback) => {
      const handle = nextHandle
      nextHandle += 1
      pending.set(handle, callback)
      return handle
    },
    cancelFrame: (handle) => {
      pending.delete(handle)
    },
  }
  return {
    clock,
    hasPendingFrame: () => pending.size > 0,
    /** Runs the frame callbacks due now, then lets compile promises settle. */
    async frame(advanceMs = FRAME_MS): Promise<void> {
      time += advanceMs
      const callbacks = [...pending.values()]
      pending.clear()
      for (const callback of callbacks) callback(time)
      await Promise.resolve()
      await Promise.resolve()
    },
  }
}

/** Stands in for WebGPURenderer: records what each render drew instead of drawing it. */
function createFakeRenderer() {
  const rendered: Object3D[] = []
  const renderer: PreviewRenderer = {
    domElement: document.createElement('canvas'),
    setPixelRatio: () => {},
    setSize: () => {},
    setClearColor: () => {},
    render: (scene: Object3D) => {
      rendered.push(scene)
    },
    compileAsync: () => Promise.resolve(),
    dispose: () => {},
  }
  return { renderer, rendered }
}

function setUp(overrides: Partial<PreviewEngineOptions> = {}) {
  const manual = createManualClock()
  const { renderer, rendered } = createFakeRenderer()
  const buildMaterial = vi.fn((graph: Graph, ref: PortRef): MaterialBuild =>
    createPreviewMaterial(graph, registry, ref),
  )
  const present = vi.fn<(source: HTMLCanvasElement, target: HTMLCanvasElement) => void>()
  const engine = createPreviewEngine({
    size: SIZE,
    fps: FPS,
    budgetPerFrame: BUDGET,
    createRenderer: () => Promise.resolve({ ok: true, renderer, backend: 'webgl2' }),
    pixelRatio: 1,
    rebuildDelayMs: REBUILD_DELAY_MS,
    registry,
    buildMaterial,
    present,
    clock: manual.clock,
    ...overrides,
  })
  const canvases = new Map<string, HTMLCanvasElement>()
  const snapshots = new Map<string, NodePreviewSnapshot>()

  const show = (ref: PortRef): void => {
    const canvas = document.createElement('canvas')
    canvases.set(ref.nodeId, canvas)
    engine.register(ref, canvas, (snapshot) => {
      snapshots.set(ref.nodeId, snapshot)
    })
    engine.setVisible(ref.nodeId, true)
  }
  const buildsOf = (nodeId: string): number =>
    buildMaterial.mock.calls.filter(([, ref]) => ref.nodeId === nodeId).length
  const presentsOf = (nodeId: string): number =>
    present.mock.calls.filter(([, target]) => target === canvases.get(nodeId)).length
  const latestBuildOf = (nodeId: string): MaterialBuild => {
    const builds = buildMaterial.mock.results.filter(
      (_, index) => buildMaterial.mock.calls[index]?.[1].nodeId === nodeId,
    )
    const latest = builds.at(-1)
    if (latest?.type !== 'return') throw new Error(`No build for ${nodeId}`)
    return latest.value
  }
  /** Lets the renderer start, then runs frames until nothing is left to do. */
  const settle = async (maxFrames = 30): Promise<void> => {
    await Promise.resolve()
    for (let index = 0; index < maxFrames && manual.hasPendingFrame(); index += 1) {
      await manual.frame()
    }
  }

  return {
    engine,
    manual,
    rendered,
    present,
    show,
    buildsOf,
    presentsOf,
    latestBuildOf,
    snapshots,
    settle,
  }
}

const COLOR_GRAPH = graphWith([['color', 'input/color']])
const COLOR_OUT = port('color', 'out')

describe('preview engine', () => {
  it('builds, renders and presents a visible preview once', async () => {
    const harness = setUp()
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    await harness.settle()

    expect(harness.buildsOf('color')).toBe(1)
    expect(harness.presentsOf('color')).toBe(1)
    expect(harness.snapshots.get('color')).toEqual({ status: 'ready', shape: '2d' })
    // A static preview that is up to date asks for no more frames.
    expect(harness.manual.hasPendingFrame()).toBe(false)
  })

  it('value change applies to preview uniforms without rebuild', async () => {
    const harness = setUp()
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    await harness.settle()

    harness.engine.update(unwrap(setInputValue(COLOR_GRAPH, port('color', 'color'), vec3(0, 1, 0))))
    await harness.settle()

    expect(harness.buildsOf('color')).toBe(1)
    expect(harness.latestBuildOf('color').uniforms.get('color:color')?.value).toEqual(
      new Vector3(0, 1, 0),
    )
    expect(harness.presentsOf('color')).toBe(2)
  })

  it('a scrubbed value reaches the preview without a rebuild or a graph change', async () => {
    const harness = setUp()
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    await harness.settle()

    harness.engine.previewValue(port('color', 'color'), vec3(0, 0, 1))
    await harness.settle()

    expect(harness.buildsOf('color')).toBe(1)
    expect(harness.latestBuildOf('color').uniforms.get('color:color')?.value).toEqual(
      new Vector3(0, 0, 1),
    )
    expect(harness.presentsOf('color')).toBe(2)
  })

  it('a property value change reaches its readers without a rebuild', async () => {
    const propertyId = asPropertyId('glow')
    const withProperty = unwrap(
      addProperty(COLOR_GRAPH, {
        id: propertyId,
        label: 'Glow',
        name: 'glow',
        exposed: true,
        type: 'float',
        value: float(0.2),
      }),
    )
    const graph = unwrap(
      addPropertyNode(withProperty, registry, {
        id: id('reader'),
        propertyId,
        position: { x: 0, y: 0 },
      }),
    )
    const sine = withEdge(
      withNode(graph, 'sine', 'math/sin'),
      port('reader', 'out'),
      port('sine', 'in'),
    )
    const harness = setUp()
    harness.engine.update(sine)
    harness.show(port('sine', 'out'))
    await harness.settle()

    harness.engine.previewPropertyValue(propertyId, float(0.7))
    await harness.settle()

    expect(harness.buildsOf('sine')).toBe(1)
    expect(harness.latestBuildOf('sine').properties.get(propertyId)?.value).toBe(0.7)
    expect(harness.presentsOf('sine')).toBe(2)
  })

  it("unrelated topology change does not rebuild a node's preview", async () => {
    const graph = graphWith([
      ['color', 'input/color'],
      ['noise', 'effects/noise'],
    ])
    const harness = setUp()
    harness.engine.update(graph)
    harness.show(COLOR_OUT)
    harness.show(port('noise', 'out'))
    await harness.settle()

    const elsewhere = withEdge(
      withNode(graph, 'sine', 'math/sin'),
      port('noise', 'out'),
      port('sine', 'in'),
    )
    harness.engine.update(elsewhere)
    await harness.manual.frame(REBUILD_DELAY_MS)
    await harness.settle()
    expect(harness.buildsOf('color')).toBe(1)
    expect(harness.presentsOf('color')).toBe(1)

    // Feeding the noise changes its own upstream, so that one preview is built again.
    const fed = withEdge(elsewhere, port('color', 'out'), port('noise', 'p'))
    harness.engine.update(fed)
    await harness.manual.frame(REBUILD_DELAY_MS)
    await harness.settle()
    expect(harness.buildsOf('color')).toBe(1)
    expect(harness.buildsOf('noise')).toBe(2)
  })

  it('waits for a quiet period before rebuilding after a topology change', async () => {
    const graph = graphWith([
      ['uv', 'input/uv'],
      ['fract', 'math/fract'],
    ])
    const harness = setUp()
    harness.engine.update(graph)
    harness.show(port('fract', 'out'))
    await harness.settle()

    harness.engine.update(withEdge(graph, port('uv', 'out'), port('fract', 'in')))
    await harness.manual.frame()
    expect(harness.buildsOf('fract')).toBe(1)
    await harness.manual.frame(REBUILD_DELAY_MS)
    await harness.settle()
    expect(harness.buildsOf('fract')).toBe(2)
  })

  it('budget caps renders per frame', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const graph = graphWith(ids.map((nodeId) => [nodeId, 'input/color'] as const))
    const harness = setUp()
    harness.engine.update(graph)
    for (const nodeId of ids) harness.show(port(nodeId, 'out'))
    await Promise.resolve()

    const totalBuilds = (): number => ids.reduce((sum, nodeId) => sum + harness.buildsOf(nodeId), 0)
    const workPerFrame: number[] = []
    for (let frame = 0; frame < 6 && harness.manual.hasPendingFrame(); frame += 1) {
      const rendersBefore = harness.rendered.length
      const buildsBefore = totalBuilds()
      await harness.manual.frame()
      workPerFrame.push(harness.rendered.length - rendersBefore + totalBuilds() - buildsBefore)
    }

    expect(Math.max(...workPerFrame)).toBeLessThanOrEqual(BUDGET)
    for (const nodeId of ids) expect(harness.presentsOf(nodeId)).toBe(1)
  })

  it('serves animated previews round-robin when more are due than the budget allows', async () => {
    const ids = ['a', 'b', 'c', 'd', 'e', 'f']
    const graph = ids.reduce(
      (current, nodeId) =>
        withEdge(withNode(current, nodeId, 'math/fract'), port('time', 'out'), port(nodeId, 'in')),
      graphWith([['time', 'input/time']]),
    )
    // A cap far above the display rate: every animated preview is due every frame.
    const harness = setUp({ fps: 1000 })
    harness.engine.update(graph)
    for (const nodeId of ids) harness.show(port(nodeId, 'out'))
    await harness.settle(4)

    const before = ids.map((nodeId) => harness.presentsOf(nodeId))
    for (let frame = 0; frame < 3; frame += 1) await harness.manual.frame()

    const served = ids.map((nodeId, index) => harness.presentsOf(nodeId) - (before[index] ?? 0))
    expect(served).toEqual([2, 2, 2, 2, 2, 2])
  })

  it('animates a visible Time preview at no more than the frame rate cap', async () => {
    const graph = withEdge(
      graphWith([
        ['time', 'input/time'],
        ['fract', 'math/fract'],
      ]),
      port('time', 'out'),
      port('fract', 'in'),
    )
    const harness = setUp()
    harness.engine.update(graph)
    harness.show(port('fract', 'out'))
    await harness.settle(4)

    const before = harness.presentsOf('fract')
    const oneSecondOfFrames = 60
    for (let frame = 0; frame < oneSecondOfFrames; frame += 1) await harness.manual.frame()

    const renders = harness.presentsOf('fract') - before
    expect(renders).toBeGreaterThan(0)
    expect(renders).toBeLessThanOrEqual(FPS)
  })

  it('invisible animated previews do not render', async () => {
    const graph = ['onScreen', 'offScreen'].reduce(
      (current, nodeId) =>
        withEdge(withNode(current, nodeId, 'math/fract'), port('time', 'out'), port(nodeId, 'in')),
      graphWith([['time', 'input/time']]),
    )
    const harness = setUp()
    harness.engine.update(graph)
    harness.show(port('onScreen', 'out'))
    harness.show(port('offScreen', 'out'))
    await harness.settle(4)

    harness.engine.setVisible(id('offScreen'), false)
    const offScreenBefore = harness.presentsOf('offScreen')
    const onScreenBefore = harness.presentsOf('onScreen')
    for (let frame = 0; frame < 30; frame += 1) await harness.manual.frame(100)

    // The visible one keeps the frames coming; the hidden one is skipped in every one of them.
    expect(harness.presentsOf('onScreen')).toBeGreaterThan(onScreenBefore)
    expect(harness.presentsOf('offScreen')).toBe(offScreenBefore)

    harness.engine.setVisible(id('onScreen'), false)
    await harness.manual.frame()
    // Nothing visible is animating, so the engine stops asking for frames altogether.
    expect(harness.manual.hasPendingFrame()).toBe(false)
  })

  it('a preview scrolled into view after a change catches up then', async () => {
    const harness = setUp()
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    await harness.settle()
    harness.engine.setVisible(id('color'), false)

    harness.engine.update(unwrap(setInputValue(COLOR_GRAPH, port('color', 'color'), vec3(0, 1, 0))))
    await harness.settle()
    expect(harness.presentsOf('color')).toBe(1)

    harness.engine.setVisible(id('color'), true)
    await harness.settle()
    expect(harness.presentsOf('color')).toBe(2)
  })

  it('reports an error when the preview cannot be built', async () => {
    const failing = vi.fn((): MaterialBuild => ({
      material: null,
      uniforms: new Map(),
      properties: new Map(),
      missingTextures: [],
      surface: 'auto',
      errors: [{ nodeId: id('color'), code: 'build-failed', message: 'broken' }],
    }))
    const harness = setUp({ buildMaterial: failing })
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    await harness.settle()

    expect(harness.snapshots.get('color')?.status).toBe('error')
    expect(harness.presentsOf('color')).toBe(0)
  })

  it('reports every preview unavailable when no renderer starts', async () => {
    const harness = setUp({
      createRenderer: () => Promise.resolve({ ok: false, message: 'no WebGPU, no WebGL2' }),
    })
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    await harness.settle()

    expect(harness.snapshots.get('color')?.status).toBe('unavailable')
  })

  it('switches shape without rebuilding when the preview mode changes', async () => {
    const harness = setUp()
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    await harness.settle()

    const node = COLOR_GRAPH.nodes[id('color')]
    if (node === undefined) throw new Error('No color node')
    harness.engine.update({
      ...COLOR_GRAPH,
      nodes: { ...COLOR_GRAPH.nodes, [node.id]: { ...node, params: { previewMode: '3d' } } },
    })
    await harness.settle()

    expect(harness.snapshots.get('color')?.shape).toBe('3d')
    expect(harness.buildsOf('color')).toBe(1)
    expect(harness.presentsOf('color')).toBe(2)
  })

  it('stops presenting to a canvas once it is unregistered', async () => {
    const harness = setUp()
    harness.engine.update(COLOR_GRAPH)
    const canvas = document.createElement('canvas')
    const unregister = harness.engine.register(COLOR_OUT, canvas)
    harness.engine.setVisible(id('color'), true)
    await harness.settle()
    unregister()

    harness.engine.update(unwrap(setInputValue(COLOR_GRAPH, port('color', 'color'), vec3(0, 1, 0))))
    await harness.settle()

    expect(harness.present.mock.calls.filter(([, target]) => target === canvas)).toHaveLength(1)
  })
})
