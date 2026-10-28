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
import { Mesh, Vector3 } from 'three'
import { describe, expect, it, vi } from 'vitest'

import { registry } from '@/store/registry'

import { createPreviewEngine } from './preview-engine'
import type {
  NodePreviewSnapshot,
  PreviewEngineOptions,
  PreviewRenderer,
  PreviewRendererResult,
} from './preview-engine'
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

interface FakeRendererBehaviour {
  /** Every render throws, like a pipeline the backend rejects. */
  failRender?: boolean
  /** Every compile rejects, like a material whose shader does not build. */
  failCompile?: boolean
}

/** Stands in for WebGPURenderer: records what each render drew instead of drawing it. */
function createFakeRenderer(behaviour: FakeRendererBehaviour = {}) {
  const rendered: Object3D[] = []
  const dispose = vi.fn()
  const renderer: PreviewRenderer = {
    domElement: document.createElement('canvas'),
    setPixelRatio: () => {},
    setSize: () => {},
    setClearColor: () => {},
    render: (scene: Object3D) => {
      rendered.push(scene)
      if (behaviour.failRender === true) throw new Error('render failed')
    },
    compileAsync: () =>
      behaviour.failCompile === true
        ? Promise.reject(new Error('compile failed'))
        : Promise.resolve(),
    dispose,
  }
  return { renderer, rendered, dispose }
}

function setUp(
  overrides: Partial<PreviewEngineOptions> = {},
  behaviour: FakeRendererBehaviour = {},
) {
  const manual = createManualClock()
  const { renderer, rendered, dispose: disposeRenderer } = createFakeRenderer(behaviour)
  /** Called once for every preview material the engine disposes. */
  const materialDisposed = vi.fn()
  const buildMaterial = vi.fn((graph: Graph, ref: PortRef): MaterialBuild => {
    const build = createPreviewMaterial(graph, registry, ref)
    build.material?.addEventListener('dispose', materialDisposed)
    return build
  })
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
    disposeRenderer,
    materialDisposed,
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

/** Time feeding Fract: an animated preview that is due again every frame interval. */
const TIME_TO_FRACT = withEdge(
  graphWith([
    ['time', 'input/time'],
    ['fract', 'math/fract'],
  ]),
  port('time', 'out'),
  port('fract', 'in'),
)
const FRACT_OUT = port('fract', 'out')

describe('preview engine errors', () => {
  it('an animated preview whose render throws stops rendering until its upstream changes', async () => {
    const harness = setUp({}, { failRender: true })
    harness.engine.update(TIME_TO_FRACT)
    harness.show(FRACT_OUT)
    await harness.settle(4)
    expect(harness.rendered).toHaveLength(1)

    for (let frame = 0; frame < 20; frame += 1) await harness.manual.frame(100)

    // One failed attempt, then nothing: no retries every frame interval, no budget taken.
    expect(harness.snapshots.get('fract')?.status).toBe('error')
    expect(harness.rendered).toHaveLength(1)
    expect(harness.materialDisposed).toHaveBeenCalledOnce()
    expect(harness.manual.hasPendingFrame()).toBe(false)
  })

  it('a compile that fails releases the material and renders nothing', async () => {
    const harness = setUp({}, { failCompile: true })
    harness.engine.update(TIME_TO_FRACT)
    harness.show(FRACT_OUT)
    await harness.settle()
    for (let frame = 0; frame < 10; frame += 1) await harness.manual.frame(100)

    expect(harness.snapshots.get('fract')?.status).toBe('error')
    expect(harness.materialDisposed).toHaveBeenCalledOnce()
    expect(harness.rendered).toHaveLength(0)
    expect(harness.manual.hasPendingFrame()).toBe(false)
  })

  it('a failed preview is built again once its upstream changes', async () => {
    const failing = vi.fn((graph: Graph, ref: PortRef): MaterialBuild => {
      const build = createPreviewMaterial(graph, registry, ref)
      return failing.mock.calls.length === 1 ? { ...build, material: null } : build
    })
    const harness = setUp({ buildMaterial: failing })
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    await harness.settle()
    expect(harness.snapshots.get('color')?.status).toBe('error')

    harness.engine.update(unwrap(setInputValue(COLOR_GRAPH, port('color', 'color'), vec3(0, 1, 0))))
    await harness.manual.frame(REBUILD_DELAY_MS)
    await harness.settle()

    expect(failing).toHaveBeenCalledTimes(2)
    expect(harness.snapshots.get('color')?.status).toBe('ready')
  })

  it('a value that disappears rebuilds only the previews reading that node, after the pause', async () => {
    const graph = graphWith([
      ['a', 'input/color'],
      ['b', 'input/color'],
    ])
    const withValues = unwrap(
      setInputValue(
        unwrap(setInputValue(graph, port('a', 'color'), vec3(1, 0, 0))),
        port('b', 'color'),
        vec3(0, 0, 1),
      ),
    )
    const harness = setUp()
    harness.engine.update(withValues)
    harness.show(port('a', 'out'))
    harness.show(port('b', 'out'))
    await harness.settle()

    const nodeA = withValues.nodes[id('a')]
    if (nodeA === undefined) throw new Error('No node a')
    harness.engine.update({
      ...withValues,
      nodes: { ...withValues.nodes, [nodeA.id]: { ...nodeA, inputValues: {} } },
    })
    await harness.manual.frame()
    expect(harness.buildsOf('a')).toBe(1)

    await harness.manual.frame(REBUILD_DELAY_MS)
    await harness.settle()
    expect(harness.buildsOf('a')).toBe(2)
    expect(harness.buildsOf('b')).toBe(1)
  })
})

describe('combined value updates', () => {
  it('applies a value change in place even when the same update removes a value elsewhere', async () => {
    const graph = graphWith([
      ['x', 'input/color'],
      ['y', 'input/color'],
    ])
    const withValues = unwrap(
      setInputValue(
        unwrap(setInputValue(graph, port('x', 'color'), vec3(1, 0, 0))),
        port('y', 'color'),
        vec3(0, 0, 1),
      ),
    )
    const harness = setUp()
    harness.engine.update(withValues)
    harness.show(port('x', 'out'))
    harness.show(port('y', 'out'))
    await harness.settle()

    // One update: X loses its inline value while Y's value changes.
    const changedY = unwrap(setInputValue(withValues, port('y', 'color'), vec3(0, 1, 0)))
    const nodeX = changedY.nodes[id('x')]
    if (nodeX === undefined) throw new Error('No node x')
    harness.engine.update({
      ...changedY,
      nodes: { ...changedY.nodes, [nodeX.id]: { ...nodeX, inputValues: {} } },
    })
    await harness.manual.frame()

    expect(harness.latestBuildOf('y').uniforms.get('y:color')?.value).toEqual(new Vector3(0, 1, 0))
    expect(harness.buildsOf('y')).toBe(1)
    await harness.manual.frame(REBUILD_DELAY_MS)
    await harness.settle()
    expect(harness.buildsOf('x')).toBe(2)
    expect(harness.buildsOf('y')).toBe(1)
  })
})

const isMesh = (object: Object3D): object is Mesh => object instanceof Mesh

describe('preview engine lifecycle', () => {
  it('disposes the material when a preview is unregistered', async () => {
    const harness = setUp()
    harness.engine.update(COLOR_GRAPH)
    const unregister = harness.engine.register(COLOR_OUT, document.createElement('canvas'))
    harness.engine.setVisible(id('color'), true)
    await harness.settle()
    expect(harness.materialDisposed).not.toHaveBeenCalled()

    unregister()

    expect(harness.materialDisposed).toHaveBeenCalledOnce()
  })

  it('disposes the old material when the same node registers again', async () => {
    const harness = setUp()
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    await harness.settle()

    harness.show(COLOR_OUT)
    await harness.settle()

    expect(harness.materialDisposed).toHaveBeenCalledOnce()
    expect(harness.buildsOf('color')).toBe(2)
  })

  it('disposes the renderer, the shared geometry and every material with the engine', async () => {
    const harness = setUp()
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    await harness.settle()
    const [scene] = harness.rendered
    const mesh = scene?.children[0]
    if (mesh === undefined || !isMesh(mesh)) throw new Error('Nothing rendered')
    const geometryDisposed = vi.fn()
    mesh.geometry.addEventListener('dispose', geometryDisposed)

    harness.engine.dispose()

    expect(harness.disposeRenderer).toHaveBeenCalledOnce()
    expect(harness.materialDisposed).toHaveBeenCalledOnce()
    expect(geometryDisposed).toHaveBeenCalledOnce()
  })

  it('disposes a renderer that finishes starting after the engine is gone', async () => {
    const { renderer, dispose } = createFakeRenderer()
    let finishStarting: (result: PreviewRendererResult) => void = () => {}
    const harness = setUp({
      createRenderer: () =>
        new Promise<PreviewRendererResult>((resolve) => {
          finishStarting = resolve
        }),
    })
    harness.engine.update(COLOR_GRAPH)
    harness.show(COLOR_OUT)
    harness.engine.dispose()

    finishStarting({ ok: true, renderer, backend: 'webgl2' })
    await Promise.resolve()
    await Promise.resolve()

    expect(dispose).toHaveBeenCalledOnce()
  })
})
