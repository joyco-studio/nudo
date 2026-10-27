import {
  addNode,
  addProperty,
  addPropertyNode,
  asEdgeId,
  asNodeId,
  asPropertyId,
  connect,
  createGraph,
  float,
  moveNodes,
  portKey,
  setInputValue,
  setParam,
  setPropertyValue,
  texture,
  vec3,
} from '@nudo-tsl/core'
import type { Graph, PortRef, Result } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'
import { createMaterial } from '@nudo-tsl/runtime'
import type { MaterialBuild } from '@nudo-tsl/runtime'
import { DataTexture, Vector3 } from 'three'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createCompileScheduler } from './compile-scheduler'

const DELAY_MS = 150
const RAPID_UPDATE_GAP_MS = 50
const ORIGIN = { x: 0, y: 0 }
const registry = createDefaultRegistry()
const MASTER_ID = asNodeId('master')
const BASE_COLOR: PortRef = { nodeId: asNodeId('master'), portId: 'baseColor' }
const OPACITY: PortRef = { nodeId: asNodeId('master'), portId: 'opacity' }

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const withBaseColor = (graph: Graph, red: number, green: number, blue: number): Graph =>
  unwrap(setInputValue(graph, BASE_COLOR, vec3(red, green, blue)))

const withNode = (graph: Graph, id: string, type: string): Graph =>
  unwrap(addNode(graph, registry, { id: asNodeId(id), type, position: ORIGIN }))

/** A float for a vec3 slot: no uniform can hold it, so only a rebuild can represent it. */
const withMismatchedBaseColor = (graph: Graph): Graph =>
  unwrap(setInputValue(graph, BASE_COLOR, float(0.5)))

function setUp(
  build: (graph: Graph) => MaterialBuild = (graph) => createMaterial(graph, registry),
) {
  const buildSpy = vi.fn(build)
  const onBuilt = vi.fn<(result: MaterialBuild) => void>()
  const scheduler = createCompileScheduler({
    registry,
    delayMs: DELAY_MS,
    build: buildSpy,
    onBuilt,
  })
  return { buildSpy, onBuilt, scheduler }
}

describe('createCompileScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('builds the first graph after the debounce delay and reports every build', () => {
    const { buildSpy, onBuilt, scheduler } = setUp()
    const graph = createGraph()

    scheduler.update(graph)
    expect(buildSpy).not.toHaveBeenCalled()

    vi.advanceTimersByTime(DELAY_MS)
    expect(buildSpy).toHaveBeenCalledExactlyOnceWith(graph)
    expect(onBuilt).toHaveBeenCalledOnce()
  })

  it('value-only change applies uniforms without rebuild', () => {
    const { buildSpy, onBuilt, scheduler } = setUp()
    const graph = createGraph()
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)
    const firstBuild = onBuilt.mock.calls[0]?.[0]

    scheduler.update(withBaseColor(graph, 0, 1, 0.5))

    // Applied at once, with no timer involved.
    const uniform = firstBuild?.uniforms.get(portKey(BASE_COLOR))
    expect(uniform?.value).toEqual(new Vector3(0, 1, 0.5))
    vi.advanceTimersByTime(DELAY_MS * 4)
    expect(buildSpy).toHaveBeenCalledOnce()
    expect(onBuilt).toHaveBeenCalledOnce()
  })

  it('resizing a comment never rebuilds, while a structural param does', () => {
    const { buildSpy, scheduler } = setUp()
    const commentId = asNodeId('note')
    const graph = withNode(createGraph(), 'note', 'utility/comment')
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)

    const widened = unwrap(setParam(graph, registry, { nodeId: commentId, paramId: 'width' }, 480))
    const resized = unwrap(
      setParam(widened, registry, { nodeId: commentId, paramId: 'height' }, 260),
    )
    scheduler.update(resized)
    vi.advanceTimersByTime(DELAY_MS * 4)
    expect(buildSpy).toHaveBeenCalledOnce()

    const unlit = unwrap(
      setParam(resized, registry, { nodeId: MASTER_ID, paramId: 'lighting' }, 'unlit'),
    )
    scheduler.update(unlit)
    vi.advanceTimersByTime(DELAY_MS)
    expect(buildSpy).toHaveBeenCalledTimes(2)
  })

  it('topology change rebuilds once after 150ms even with rapid updates', () => {
    const { buildSpy, onBuilt, scheduler } = setUp()
    scheduler.update(createGraph())
    vi.advanceTimersByTime(DELAY_MS)
    expect(buildSpy).toHaveBeenCalledOnce()

    const withTime = withNode(createGraph(), 'time', 'input/time')
    const withTimeAndSine = withNode(withTime, 'sine', 'math/sin')
    const withTimeSineAndUv = withNode(withTimeAndSine, 'uv', 'input/uv')
    for (const graph of [withTime, withTimeAndSine, withTimeSineAndUv]) {
      scheduler.update(graph)
      vi.advanceTimersByTime(RAPID_UPDATE_GAP_MS)
    }
    expect(buildSpy).toHaveBeenCalledOnce()

    vi.advanceTimersByTime(DELAY_MS - RAPID_UPDATE_GAP_MS)
    expect(buildSpy).toHaveBeenCalledTimes(2)
    expect(buildSpy).toHaveBeenLastCalledWith(withTimeSineAndUv)
    expect(onBuilt).toHaveBeenCalledTimes(2)

    vi.advanceTimersByTime(DELAY_MS * 4)
    expect(buildSpy).toHaveBeenCalledTimes(2)
  })

  it('rebuilds with the latest graph when a value changes while a rebuild is pending', () => {
    const { buildSpy, scheduler } = setUp()
    scheduler.update(createGraph())
    vi.advanceTimersByTime(DELAY_MS)

    const withTime = withNode(createGraph(), 'time', 'input/time')
    scheduler.update(withTime)
    const edited = withBaseColor(withTime, 1, 0, 0)
    scheduler.update(edited)
    vi.advanceTimersByTime(DELAY_MS)

    expect(buildSpy).toHaveBeenCalledTimes(2)
    expect(buildSpy).toHaveBeenLastCalledWith(edited)
  })

  it('value change on a connected input is ignored', () => {
    const { buildSpy, scheduler } = setUp()
    const withColor = withNode(createGraph(), 'color', 'input/color')
    const connected = unwrap(
      connect(withColor, registry, {
        id: asEdgeId('color-to-base'),
        from: { nodeId: asNodeId('color'), portId: 'out' },
        to: BASE_COLOR,
      }),
    )
    scheduler.update(connected)
    vi.advanceTimersByTime(DELAY_MS)

    scheduler.update(withBaseColor(connected, 0, 1, 0))
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).toHaveBeenCalledOnce()
  })

  it('value change on a node that cannot reach the master is ignored', () => {
    const { buildSpy, onBuilt, scheduler } = setUp()
    const graph = withNode(createGraph(), 'stray', 'input/color')
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)
    const strayColor: PortRef = { nodeId: asNodeId('stray'), portId: 'color' }
    // Nothing reads the stray node, so the build never created a uniform for it.
    expect(onBuilt.mock.calls[0]?.[0].uniforms.has(portKey(strayColor))).toBe(false)

    scheduler.update(unwrap(setInputValue(graph, strayColor, vec3(0, 1, 0))))
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).toHaveBeenCalledOnce()
  })

  it('a value the uniform cannot hold triggers a rebuild', () => {
    const { buildSpy, scheduler } = setUp()
    const graph = createGraph()
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)
    expect(buildSpy).toHaveBeenCalledOnce()

    const edited = withMismatchedBaseColor(graph)
    scheduler.update(edited)
    expect(buildSpy).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(DELAY_MS)

    expect(buildSpy).toHaveBeenCalledTimes(2)
    expect(buildSpy).toHaveBeenLastCalledWith(edited)
  })

  it('an unappliable value still rebuilds once with the latest graph after a later same-topology update', () => {
    const { buildSpy, scheduler } = setUp()
    const graph = createGraph()
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)

    const edited = withMismatchedBaseColor(graph)
    scheduler.update(edited)
    vi.advanceTimersByTime(RAPID_UPDATE_GAP_MS)
    // A position-only edit of the same topology arrives while the rebuild is still owed.
    const moved = moveNodes(edited, { [asNodeId('master')]: { x: 5, y: 5 } })
    scheduler.update(moved)
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).toHaveBeenCalledTimes(2)
    expect(buildSpy).toHaveBeenLastCalledWith(moved)
  })

  it('a rebuild owed by an unappliable value survives a trip through another topology and back', () => {
    const { buildSpy, scheduler } = setUp()
    const graph = createGraph()
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)

    const edited = withMismatchedBaseColor(graph)
    scheduler.update(edited)
    scheduler.update(withNode(edited, 'time', 'input/time'))
    scheduler.update(edited)
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).toHaveBeenCalledTimes(2)
  })

  it('an opacity edit across 1 switches the transparent path without a rebuild', () => {
    const { buildSpy, onBuilt, scheduler } = setUp()
    const graph = createGraph()
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)
    const material = onBuilt.mock.calls[0]?.[0].material
    expect(material?.transparent).toBe(false)

    const translucent = unwrap(setInputValue(graph, OPACITY, float(0.3)))
    scheduler.update(translucent)
    expect(material?.transparent).toBe(true)

    scheduler.update(unwrap(setInputValue(translucent, OPACITY, float(1))))
    expect(material?.transparent).toBe(false)
    vi.advanceTimersByTime(DELAY_MS * 4)
    expect(buildSpy).toHaveBeenCalledOnce()
  })

  it('previewing an opacity below 1 makes the material transparent at once', () => {
    const { onBuilt, scheduler } = setUp()
    scheduler.update(createGraph())
    vi.advanceTimersByTime(DELAY_MS)
    const material = onBuilt.mock.calls[0]?.[0].material

    scheduler.previewValue(OPACITY, float(0.5))

    expect(material?.transparent).toBe(true)
  })

  it('previewValue applies a value to its uniform without a rebuild or a graph change', () => {
    const { buildSpy, onBuilt, scheduler } = setUp()
    const graph = createGraph()
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)
    const uniform = onBuilt.mock.calls[0]?.[0].uniforms.get(portKey(BASE_COLOR))

    expect(scheduler.previewValue(BASE_COLOR, vec3(0, 1, 0.5))).toBe('applied')
    expect(uniform?.value).toEqual(new Vector3(0, 1, 0.5))
    expect(scheduler.previewValue(BASE_COLOR, vec3(1, 0, 0))).toBe('applied')
    expect(uniform?.value).toEqual(new Vector3(1, 0, 0))

    vi.advanceTimersByTime(DELAY_MS * 4)
    expect(buildSpy).toHaveBeenCalledOnce()
  })

  it('previewValue reports a value that has no uniform or does not fit it', () => {
    const { scheduler } = setUp()
    expect(scheduler.previewValue(BASE_COLOR, vec3(0, 1, 0))).toBe('missing')

    scheduler.update(createGraph())
    vi.advanceTimersByTime(DELAY_MS)

    expect(scheduler.previewValue(BASE_COLOR, float(1))).toBe('mismatch')
    const ghost: PortRef = { nodeId: asNodeId('ghost'), portId: 'x' }
    expect(scheduler.previewValue(ghost, float(1))).toBe('missing')
  })

  it('previewValue does nothing after dispose', () => {
    const { onBuilt, scheduler } = setUp()
    scheduler.update(createGraph())
    vi.advanceTimersByTime(DELAY_MS)
    const uniform = onBuilt.mock.calls[0]?.[0].uniforms.get(portKey(BASE_COLOR))
    scheduler.dispose()

    expect(scheduler.previewValue(BASE_COLOR, vec3(0, 1, 0))).toBe('missing')
    expect(uniform?.value).toEqual(new Vector3(0.8, 0.8, 0.8))
  })

  it('dispose cancels pending rebuild', () => {
    const { buildSpy, onBuilt, scheduler } = setUp()
    scheduler.update(createGraph())

    scheduler.dispose()
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).not.toHaveBeenCalled()
    expect(onBuilt).not.toHaveBeenCalled()
  })

  it('ignores updates after dispose', () => {
    const { buildSpy, scheduler } = setUp()
    scheduler.dispose()

    scheduler.update(createGraph())
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).not.toHaveBeenCalled()
  })
})

describe('texture assets', () => {
  const SAMPLE_TEXTURE: PortRef = { nodeId: asNodeId('sample'), portId: 'texture' }
  const PROPERTY_ID = asPropertyId('albedo')

  const connectEdge = (graph: Graph, id: string, from: PortRef, to: PortRef): Graph =>
    unwrap(connect(graph, registry, { id: asEdgeId(id), from, to }))

  const sampleGraph = (assetId: string | null): Graph => {
    const sampled = connectEdge(
      withNode(createGraph(), 'sample', 'texture/sample-texture-2d'),
      'sample-to-base',
      { nodeId: asNodeId('sample'), portId: 'rgb' },
      BASE_COLOR,
    )
    return unwrap(setInputValue(sampled, SAMPLE_TEXTURE, texture(assetId)))
  }

  const propertyGraph = (assetId: string | null): Graph => {
    const withProperty = unwrap(
      addProperty(sampleGraph(null), {
        id: PROPERTY_ID,
        label: 'Albedo',
        name: 'albedo',
        exposed: true,
        type: 'texture',
        value: texture(assetId),
      }),
    )
    const withReader = unwrap(
      addPropertyNode(withProperty, registry, {
        id: asNodeId('albedo-reader'),
        propertyId: PROPERTY_ID,
        position: ORIGIN,
      }),
    )
    return connectEdge(
      withReader,
      'reader-to-sample',
      { nodeId: asNodeId('albedo-reader'), portId: 'out' },
      SAMPLE_TEXTURE,
    )
  }

  const FLOAT_PROPERTY_ID = asPropertyId('glow')
  const loadedAssets = new Map<string, DataTexture>()

  const floatPropertyGraph = (value: number): Graph => {
    const withProperty = unwrap(
      addProperty(createGraph(), {
        id: FLOAT_PROPERTY_ID,
        label: 'Glow',
        name: 'glow',
        exposed: true,
        type: 'float',
        value: float(value),
      }),
    )
    const withReader = unwrap(
      addPropertyNode(withProperty, registry, {
        id: asNodeId('glow-reader'),
        propertyId: FLOAT_PROPERTY_ID,
        position: ORIGIN,
      }),
    )
    return connectEdge(
      withReader,
      'glow-to-roughness',
      { nodeId: asNodeId('glow-reader'), portId: 'out' },
      { nodeId: MASTER_ID, portId: 'roughness' },
    )
  }

  beforeEach(() => {
    vi.useFakeTimers()
    loadedAssets.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('swapping the asset of a texture input rebuilds with the new asset', () => {
    const { buildSpy, scheduler } = setUp()
    scheduler.update(sampleGraph('first'))
    vi.advanceTimersByTime(DELAY_MS)

    const swapped = sampleGraph('second')
    scheduler.update(swapped)
    expect(buildSpy).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(DELAY_MS)

    expect(buildSpy).toHaveBeenCalledTimes(2)
    expect(buildSpy).toHaveBeenLastCalledWith(swapped)
  })

  it('swapping the asset of a texture property rebuilds', () => {
    const { buildSpy, scheduler } = setUp()
    const graph = propertyGraph('first')
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)

    const swapped = unwrap(setPropertyValue(graph, PROPERTY_ID, texture('second')))
    scheduler.update(swapped)
    vi.advanceTimersByTime(DELAY_MS)

    expect(buildSpy).toHaveBeenCalledTimes(2)
    expect(buildSpy).toHaveBeenLastCalledWith(swapped)
  })

  it('a texture asset that finished loading rebuilds once, when the build was missing it', () => {
    const { buildSpy, scheduler } = setUp()
    scheduler.update(sampleGraph('slow'))
    vi.advanceTimersByTime(DELAY_MS)

    scheduler.textureLoaded('slow')
    scheduler.textureLoaded('slow')
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).toHaveBeenCalledTimes(2)
  })

  it('a loaded asset the build never asked for leaves the material alone', () => {
    const { buildSpy, scheduler } = setUp()
    scheduler.update(sampleGraph('slow'))
    vi.advanceTimersByTime(DELAY_MS)

    scheduler.textureLoaded('unrelated')
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).toHaveBeenCalledOnce()
  })

  it('a loaded asset an already-resolved build used does not rebuild', () => {
    const { buildSpy, scheduler } = setUp((graph) =>
      createMaterial(graph, registry, { resolveTexture: () => new DataTexture() }),
    )
    scheduler.update(sampleGraph('ready'))
    vi.advanceTimersByTime(DELAY_MS)

    scheduler.textureLoaded('ready')
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).toHaveBeenCalledOnce()
  })

  it('a texture that loaded still rebuilds after a same-topology update inside the debounce', () => {
    const { buildSpy, onBuilt, scheduler } = setUp((graph) =>
      createMaterial(graph, registry, {
        resolveTexture: (assetId) => loadedAssets.get(assetId) ?? null,
      }),
    )
    const graph = sampleGraph('slow')
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)
    expect(onBuilt.mock.calls[0]?.[0].missingTextures).toEqual(['slow'])

    loadedAssets.set('slow', new DataTexture())
    scheduler.textureLoaded('slow')
    // A node drag or a value scrub arrives before the debounce is over.
    vi.advanceTimersByTime(DELAY_MS / 2)
    scheduler.update(moveNodes(graph, { [asNodeId('sample')]: { x: 10, y: 10 } }))
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).toHaveBeenCalledTimes(2)
    expect(onBuilt.mock.calls[1]?.[0].missingTextures).toEqual([])
  })

  it('a float property edit applies in place and never rebuilds', () => {
    const { buildSpy, onBuilt, scheduler } = setUp()
    const graph = floatPropertyGraph(0.25)
    scheduler.update(graph)
    vi.advanceTimersByTime(DELAY_MS)

    scheduler.update(unwrap(setPropertyValue(graph, FLOAT_PROPERTY_ID, float(0.75))))
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).toHaveBeenCalledOnce()
    expect(onBuilt.mock.calls[0]?.[0].properties.get(FLOAT_PROPERTY_ID)?.value).toBe(0.75)
  })

  it('textureLoaded does nothing after dispose', () => {
    const { buildSpy, scheduler } = setUp()
    scheduler.update(sampleGraph('slow'))
    vi.advanceTimersByTime(DELAY_MS)
    scheduler.dispose()

    scheduler.textureLoaded('slow')
    vi.advanceTimersByTime(DELAY_MS * 4)

    expect(buildSpy).toHaveBeenCalledOnce()
  })
})
