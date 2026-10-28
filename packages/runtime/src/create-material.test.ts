import {
  addNode,
  addProperty,
  addPropertyNode,
  asEdgeId,
  asNodeId,
  asPropertyId,
  concrete,
  connect,
  createGraph,
  createNodeRegistry,
  defineNode,
  float,
  portKey,
  setInputValue,
  setParam,
  texture,
  vec2,
  vec3,
  vec4,
} from '@nudo-tsl/core'
import type { Graph, NodeRegistry, Result } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'
import { DataTexture, DoubleSide, FrontSide, Vector3 } from 'three'
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  Node,
  OperatorNode,
  TextureNode,
  VarNode,
} from 'three/webgpu'
import { describe, expect, it } from 'vitest'
import { applyBuildInputValue } from './apply-build-input-value'
import { applyInputValue } from './apply-input-value'
import { applyPropertyValue } from './apply-property-value'
import { createMaterial } from './create-material'
import { getNeutralTexture } from './texture-resolution'

const ORIGIN = { x: 0, y: 0 }

const unwrap = <T, E>(result: Result<T, E>): T => {
  if (!result.ok) throw new Error(`Unexpected failure: ${JSON.stringify(result.error)}`)
  return result.value
}

const INLINE_MASTER_SLOTS = ['baseColor', 'emission', 'metalness', 'roughness', 'opacity']

const masterKey = (slot: string) => portKey({ nodeId: asNodeId('master'), portId: slot })

const withNode = (graph: Graph, registry: NodeRegistry, id: string, type: string): Graph =>
  unwrap(addNode(graph, registry, { id: asNodeId(id), type, position: ORIGIN }))

const withEdge = (
  graph: Graph,
  registry: NodeRegistry,
  from: readonly [string, string],
  to: readonly [string, string],
): Graph =>
  unwrap(
    connect(graph, registry, {
      id: asEdgeId(`${from.join('.')}->${to.join('.')}`),
      from: { nodeId: asNodeId(from[0]), portId: from[1] },
      to: { nodeId: asNodeId(to[0]), portId: to[1] },
    }),
  )

describe('createMaterial', () => {
  it('default graph builds a material with colorNode set and no positionNode', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())

    expect(build.errors).toEqual([])
    expect(build.material).not.toBeNull()
    expect(build.material?.colorNode).toBeTruthy()
    expect(build.material?.positionNode).toBeNull()
    expect(build.material?.normalNode).toBeNull()
    expect(build.material?.transparent).toBe(false)
  })

  it('uniform map has an entry per inline input reached', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())

    expect([...build.uniforms.keys()].sort()).toEqual(INLINE_MASTER_SLOTS.map(masterKey).sort())
  })

  it('applyInputValue updates value without rebuilding', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())
    const { material } = build
    const ref = { nodeId: asNodeId('master'), portId: 'baseColor' }

    const applied = applyInputValue(build.uniforms, ref, vec3(1, 0.5, 0.25))

    expect(applied).toBe('applied')
    expect(build.material).toBe(material)
    const uniform = build.uniforms.get(portKey(ref))
    expect(uniform?.value).toBeInstanceOf(Vector3)
    expect(uniform?.value).toEqual(new Vector3(1, 0.5, 0.25))
  })

  it('applyInputValue updates float uniforms', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())
    const ref = { nodeId: asNodeId('master'), portId: 'roughness' }

    expect(applyInputValue(build.uniforms, ref, float(0.9))).toBe('applied')
    expect(build.uniforms.get(portKey(ref))?.value).toBe(0.9)
  })

  it('applyInputValue returns missing for a port without a uniform', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())
    const unknownRef = { nodeId: asNodeId('ghost'), portId: 'x' }

    expect(applyInputValue(build.uniforms, unknownRef, float(1))).toBe('missing')
  })

  it('applyInputValue returns mismatch and leaves the uniform alone on a type mismatch', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())
    const colorRef = { nodeId: asNodeId('master'), portId: 'baseColor' }
    const roughnessRef = { nodeId: asNodeId('master'), portId: 'roughness' }

    expect(applyInputValue(build.uniforms, colorRef, float(1))).toBe('mismatch')
    expect(applyInputValue(build.uniforms, colorRef, vec4(1, 1, 1, 1))).toBe('mismatch')
    expect(applyInputValue(build.uniforms, roughnessRef, vec3(1, 1, 1))).toBe('mismatch')
    expect(build.uniforms.get(portKey(colorRef))?.value).toEqual(new Vector3(0.8, 0.8, 0.8))
    expect(build.uniforms.get(portKey(roughnessRef))?.value).toBe(0.5)
  })

  it('throwing node returns material null and errors', () => {
    const throwingNode = defineNode({
      type: 'test/throwing',
      category: 'utility',
      label: 'Throwing',
      description: 'Always fails to build',
      keywords: [],
      inputs: [],
      outputs: [{ id: 'out', label: 'Out', type: concrete('vec3') }],
      build: () => {
        throw new Error('boom')
      },
    })
    const registry = createDefaultRegistry()
    unwrap(registry.register(throwingNode))
    const graph = withEdge(
      withNode(createGraph(), registry, 'bad', 'test/throwing'),
      registry,
      ['bad', 'out'],
      ['master', 'baseColor'],
    )

    const build = createMaterial(graph, registry)

    expect(build.material).toBeNull()
    expect(build.errors).toEqual([
      { nodeId: asNodeId('bad'), code: 'build-failed', message: 'boom' },
    ])
  })

  it('connected opacity sets transparent', () => {
    const registry = createDefaultRegistry()
    const graph = withEdge(
      withNode(createGraph(), registry, 'alpha', 'input/float'),
      registry,
      ['alpha', 'out'],
      ['master', 'opacity'],
    )

    const build = createMaterial(graph, registry)

    expect(build.errors).toEqual([])
    expect(build.material?.transparent).toBe(true)
    expect(build.material?.opacityNode).toBeTruthy()
  })

  it('an inline opacity below 1 sets transparent, and 1 does not', () => {
    const registry = createDefaultRegistry()
    const opacity = { nodeId: asNodeId('master'), portId: 'opacity' }
    const translucent = unwrap(setInputValue(createGraph(), opacity, float(0.5)))
    const opaque = unwrap(setInputValue(createGraph(), opacity, float(1)))

    expect(createMaterial(translucent, registry).material?.transparent).toBe(true)
    expect(createMaterial(opaque, registry).material?.transparent).toBe(false)
  })

  it('maps connected builtins and optional slots onto the material', () => {
    const registry = createDefaultRegistry()
    const withNormal = withEdge(
      withNode(createGraph(), registry, 'n', 'input/normal'),
      registry,
      ['n', 'out'],
      ['master', 'normal'],
    )
    const graph = withEdge(
      withNode(withNormal, registry, 'p', 'input/normal'),
      registry,
      ['p', 'out'],
      ['master', 'position'],
    )

    const build = createMaterial(graph, registry)

    expect(build.errors).toEqual([])
    expect(build.material?.normalNode).toBeTruthy()
    expect(build.material?.positionNode).toBeTruthy()
  })

  it('builds the fresnel/lerp/time/uv nodes without errors', () => {
    const registry = createDefaultRegistry()
    let graph = createGraph()
    for (const [id, type] of [
      ['fresnel', 'effects/fresnel'],
      ['lerp', 'interpolation/lerp'],
      ['time', 'input/time'],
      ['sin', 'math/sin'],
      ['color', 'input/color'],
    ] as const) {
      graph = withNode(graph, registry, id, type)
    }
    graph = withEdge(graph, registry, ['time', 'out'], ['sin', 'in'])
    graph = withEdge(graph, registry, ['sin', 'out'], ['lerp', 't'])
    graph = withEdge(graph, registry, ['color', 'out'], ['lerp', 'a'])
    graph = withEdge(graph, registry, ['lerp', 'out'], ['master', 'baseColor'])
    graph = withEdge(graph, registry, ['fresnel', 'out'], ['master', 'emission'])

    const build = createMaterial(graph, registry)

    expect(build.errors).toEqual([])
    expect(build.material).not.toBeNull()
  })
})

describe('applyBuildInputValue', () => {
  const opacity = { nodeId: asNodeId('master'), portId: 'opacity' }

  it('toggles transparent and rebuilds the pipeline only when opacity crosses 1', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())
    const { material } = build
    if (material === null) throw new Error('Expected a material')
    const versionBefore = material.version

    expect(applyBuildInputValue(build, opacity, float(0.4))).toBe('applied')
    expect(material.transparent).toBe(true)
    expect(material.version).toBe(versionBefore + 1)

    // Still translucent: nothing about the pipeline changes.
    expect(applyBuildInputValue(build, opacity, float(0.8))).toBe('applied')
    expect(material.transparent).toBe(true)
    expect(material.version).toBe(versionBefore + 1)

    expect(applyBuildInputValue(build, opacity, float(1))).toBe('applied')
    expect(material.transparent).toBe(false)
    expect(material.version).toBe(versionBefore + 2)
    expect(build.uniforms.get(portKey(opacity))?.value).toBe(1)
  })

  it('leaves transparent alone for other inputs', () => {
    const build = createMaterial(createGraph(), createDefaultRegistry())
    const roughness = { nodeId: asNodeId('master'), portId: 'roughness' }
    const versionBefore = build.material?.version

    expect(applyBuildInputValue(build, roughness, float(0.1))).toBe('applied')
    expect(build.material?.transparent).toBe(false)
    expect(build.material?.version).toBe(versionBefore)
  })

  it('keeps a connected opacity transparent', () => {
    const registry = createDefaultRegistry()
    const graph = withEdge(
      withNode(createGraph(), registry, 'alpha', 'input/float'),
      registry,
      ['alpha', 'out'],
      ['master', 'opacity'],
    )
    const build = createMaterial(graph, registry)

    expect(applyBuildInputValue(build, opacity, float(1))).toBe('missing')
    expect(build.material?.transparent).toBe(true)
  })

  it('reports a missing uniform for a build that failed', () => {
    const build = createMaterial(createGraph(), createNodeRegistry())

    expect(applyBuildInputValue(build, opacity, float(0.5))).toBe('missing')
  })
})

describe('empty registry', () => {
  it('reports a missing master definition instead of throwing', () => {
    const build = createMaterial(createGraph(), createNodeRegistry())

    expect(build.material).toBeNull()
    expect(build.errors[0]?.code).toBe('missing-definition')
  })
})

const MASTER = asNodeId('master')

/** TSL wraps constructed values in a VarNode; this reaches the expression inside it. */
function unwrapVar(node: Node | null | undefined): Node {
  if (node === null || node === undefined) throw new Error('Expected a node')
  const inner: unknown = node instanceof VarNode ? Reflect.get(node, 'node') : node
  if (!(inner instanceof Node)) throw new Error('Expected a node inside the variable')
  return inner
}

const withMasterParam = (
  graph: Graph,
  registry: NodeRegistry,
  paramId: string,
  value: string | boolean,
): Graph => unwrap(setParam(graph, registry, { nodeId: MASTER, paramId }, value))

describe('master settings', () => {
  const registry = createDefaultRegistry()

  it('builds a standard material by default', () => {
    const { material } = createMaterial(createGraph(), registry)

    expect(material).toBeInstanceOf(MeshStandardNodeMaterial)
    expect(material?.side).toBe(FrontSide)
  })

  it('unlit master builds MeshBasicNodeMaterial', () => {
    const graph = withMasterParam(createGraph(), registry, 'lighting', 'unlit')

    const build = createMaterial(graph, registry)

    expect(build.errors).toEqual([])
    expect(build.material).toBeInstanceOf(MeshBasicNodeMaterial)
    expect(build.material).not.toBeInstanceOf(MeshStandardNodeMaterial)
    expect(build.material?.colorNode).toBeTruthy()
  })

  it('unlit adds emission to the base color', () => {
    const graph = withMasterParam(createGraph(), registry, 'lighting', 'unlit')

    const { material } = createMaterial(graph, registry)

    const color = unwrapVar(material?.colorNode)
    expect(color).toBeInstanceOf(OperatorNode)
    expect(Reflect.get(color, 'op')).toBe('+')
  })

  it('unlit ignores metalness, roughness and normal', () => {
    const unlit = withMasterParam(createGraph(), registry, 'lighting', 'unlit')
    let connected = withNode(unlit, registry, 'amount', 'input/float')
    connected = withNode(connected, registry, 'facing', 'input/normal')
    connected = withEdge(connected, registry, ['amount', 'out'], ['master', 'metalness'])
    connected = withEdge(connected, registry, ['amount', 'out'], ['master', 'roughness'])
    connected = withEdge(connected, registry, ['facing', 'out'], ['master', 'normal'])

    const baseline = createMaterial(unlit, registry).material
    const { material, errors } = createMaterial(connected, registry)

    expect(errors).toEqual([])
    expect(material).toBeInstanceOf(MeshBasicNodeMaterial)
    expect(material).not.toHaveProperty('metalnessNode')
    expect(material).not.toHaveProperty('roughnessNode')
    expect(material?.normalNode).toBeNull()
    expect(material?.transparent).toBe(baseline?.transparent)
    expect(material?.opacityNode).toBeInstanceOf(Node)
    expect(Reflect.get(material?.opacityNode ?? {}, 'value')).toBe(
      Reflect.get(baseline?.opacityNode ?? {}, 'value'),
    )
    expect(unwrapVar(material?.colorNode)).toBeInstanceOf(OperatorNode)
    expect(Reflect.get(unwrapVar(material?.colorNode), 'op')).toBe('+')
  })

  it('unlit still reads position, opacity and alpha clip', () => {
    let graph = withMasterParam(createGraph(), registry, 'lighting', 'unlit')
    graph = withNode(graph, registry, 'n', 'input/normal')
    graph = withNode(graph, registry, 'amount', 'input/float')
    graph = withEdge(graph, registry, ['n', 'out'], ['master', 'position'])
    graph = withEdge(graph, registry, ['amount', 'out'], ['master', 'opacity'])
    graph = withEdge(graph, registry, ['amount', 'out'], ['master', 'alphaClip'])

    const { material, errors } = createMaterial(graph, registry)

    expect(errors).toEqual([])
    expect(material?.positionNode).toBeTruthy()
    expect(material?.opacityNode).toBeTruthy()
    expect(material?.alphaTestNode).toBeTruthy()
    expect(material?.transparent).toBe(true)
  })

  it('maps the alpha clip slot to alphaTestNode and omits it when unconnected', () => {
    const unconnected = createMaterial(createGraph(), registry)
    let graph = withNode(createGraph(), registry, 'threshold', 'input/float')
    graph = withEdge(graph, registry, ['threshold', 'out'], ['master', 'alphaClip'])
    const connected = createMaterial(graph, registry)

    expect(unconnected.material?.alphaTestNode).toBeNull()
    expect(connected.material?.alphaTestNode).toBeTruthy()
  })

  it('two sided renders both faces', () => {
    const graph = withMasterParam(createGraph(), registry, 'twoSided', true)

    expect(createMaterial(graph, registry).material?.side).toBe(DoubleSide)
  })

  it('an opaque surface is never transparent, even with a connected translucent opacity', () => {
    let graph = withNode(createGraph(), registry, 'alpha', 'input/float')
    graph = withEdge(graph, registry, ['alpha', 'out'], ['master', 'opacity'])
    graph = withMasterParam(graph, registry, 'surface', 'opaque')

    expect(createMaterial(graph, registry).material?.transparent).toBe(false)
  })

  it('a transparent surface is always transparent, even at full opacity', () => {
    const graph = withMasterParam(createGraph(), registry, 'surface', 'transparent')

    expect(createMaterial(graph, registry).material?.transparent).toBe(true)
  })

  it('opacity edits leave an explicit surface alone', () => {
    const opacity = { nodeId: MASTER, portId: 'opacity' }
    const opaque = createMaterial(
      withMasterParam(createGraph(), registry, 'surface', 'opaque'),
      registry,
    )
    const transparent = createMaterial(
      withMasterParam(createGraph(), registry, 'surface', 'transparent'),
      registry,
    )

    expect(applyBuildInputValue(opaque, opacity, float(0.2))).toBe('applied')
    expect(applyBuildInputValue(transparent, opacity, float(1))).toBe('applied')
    expect(opaque.material?.transparent).toBe(false)
    expect(transparent.material?.transparent).toBe(true)
  })
})

describe('properties', () => {
  const registry = createDefaultRegistry()
  const propertyId = asPropertyId('prop-glow')

  const withFloatProperty = (): Graph => {
    let graph = unwrap(
      addProperty(createGraph(), {
        id: propertyId,
        label: 'Glow',
        name: 'glow',
        exposed: true,
        type: 'float',
        value: float(0.25),
      }),
    )
    graph = unwrap(
      addPropertyNode(graph, registry, {
        id: asNodeId('glow-reader'),
        propertyId,
        position: ORIGIN,
      }),
    )
    return withEdge(graph, registry, ['glow-reader', 'out'], ['master', 'roughness'])
  }

  it('creates one named uniform per property', () => {
    const { properties, errors } = createMaterial(withFloatProperty(), registry)

    expect(errors).toEqual([])
    expect([...properties.keys()]).toEqual([propertyId])
    expect(properties.get(propertyId)?.name).toBe('nudo_glow')
    expect(properties.get(propertyId)?.value).toBe(0.25)
  })

  it.each([
    ['vec3', 'nudo_vec3'],
    ['sample', 'nudo_sample'],
    ['fn', 'nudo_fn'],
    ['my$glow', 'nudo_my_glow'],
  ])('property %s reaches the shader as %s', (name, shaderName) => {
    const graph = unwrap(
      addProperty(createGraph(), {
        id: propertyId,
        label: name,
        name,
        exposed: true,
        type: 'float',
        value: float(1),
      }),
    )
    const withReader = unwrap(
      addPropertyNode(graph, registry, { id: asNodeId('reader'), propertyId, position: ORIGIN }),
    )

    const build = createMaterial(
      withEdge(withReader, registry, ['reader', 'out'], ['master', 'roughness']),
      registry,
    )

    expect(build.properties.get(propertyId)?.name).toBe(shaderName)
  })

  it('shares a single uniform between every reader of a property', () => {
    let graph = withFloatProperty()
    graph = unwrap(
      addPropertyNode(graph, registry, {
        id: asNodeId('second-reader'),
        propertyId,
        position: ORIGIN,
      }),
    )
    graph = withEdge(graph, registry, ['second-reader', 'out'], ['master', 'metalness'])

    expect(createMaterial(graph, registry).properties.size).toBe(1)
  })

  it('property value applies without rebuild', () => {
    const build = createMaterial(withFloatProperty(), registry)
    const { material } = build

    expect(applyPropertyValue(build, propertyId, float(0.9))).toBe('applied')

    expect(build.properties.get(propertyId)?.value).toBe(0.9)
    expect(build.material).toBe(material)
  })

  it('reports a missing property and a mismatching value', () => {
    const build = createMaterial(withFloatProperty(), registry)
    const before = build.properties.get(propertyId)?.value

    expect(applyPropertyValue(build, asPropertyId('ghost'), float(1))).toBe('missing')
    expect(applyPropertyValue(build, propertyId, vec2(1, 2))).toBe('mismatch')
    expect(applyPropertyValue(build, propertyId, texture('asset'))).toBe('mismatch')
    expect(build.properties.get(propertyId)?.value).toBe(before)
  })

  it('fails with a compile error when a reader points at a removed property', () => {
    const graph = { ...withFloatProperty(), properties: [] }

    const build = createMaterial(graph, registry)

    expect(build.material).toBeNull()
    expect(build.errors[0]?.code).toBe('missing-property')
  })
})

describe('textures', () => {
  const registry = createDefaultRegistry()
  const SAMPLE_INPUT = { nodeId: asNodeId('sample'), portId: 'texture' }

  const withSampledTexture = (assetId: string | null): Graph => {
    let graph = withNode(createGraph(), registry, 'sample', 'texture/sample-texture-2d')
    graph = unwrap(setInputValue(graph, SAMPLE_INPUT, texture(assetId)))
    return withEdge(graph, registry, ['sample', 'rgb'], ['master', 'baseColor'])
  }

  const realTexture = new DataTexture(new Uint8Array([255, 0, 0, 255]), 1, 1)

  it('missing texture uses neutral fallback and is reported', () => {
    const build = createMaterial(withSampledTexture('ghost-asset'), registry, {
      resolveTexture: () => null,
    })

    expect(build.errors).toEqual([])
    expect(build.material).not.toBeNull()
    expect(build.missingTextures).toEqual(['ghost-asset'])
  })

  it('changing the asset of an inline texture input asks for a rebuild', () => {
    const build = createMaterial(withSampledTexture('first'), registry, {
      resolveTexture: () => realTexture,
    })

    expect(applyInputValue(build.uniforms, SAMPLE_INPUT, texture('second'))).toBe('mismatch')
    expect(applyBuildInputValue(build, SAMPLE_INPUT, texture(null))).toBe('mismatch')
  })

  it('reports a missing asset once however many readers ask for it', () => {
    const graph = withEdge(
      withSampledTexture('ghost-asset'),
      registry,
      ['sample', 'a'],
      ['master', 'roughness'],
    )

    const build = createMaterial(graph, registry, { resolveTexture: () => null })

    expect(build.missingTextures).toEqual(['ghost-asset'])
  })

  it('uses the resolved texture and reports nothing when the asset exists', () => {
    const resolved: string[] = []
    const build = createMaterial(withSampledTexture('present'), registry, {
      resolveTexture: (assetId) => {
        resolved.push(assetId)
        return realTexture
      },
    })

    expect(build.missingTextures).toEqual([])
    expect(resolved).toEqual(['present'])
  })

  it('treats an unassigned texture as neutral without reporting it', () => {
    const build = createMaterial(withSampledTexture(null), registry, {
      resolveTexture: () => realTexture,
    })

    expect(build.errors).toEqual([])
    expect(build.missingTextures).toEqual([])
  })

  it('builds without options: every asset is missing', () => {
    const build = createMaterial(withSampledTexture('asset'), registry)

    expect(build.material).not.toBeNull()
    expect(build.missingTextures).toEqual(['asset'])
  })

  it('the neutral texture is a shared 1x1 half-grey opaque pixel', () => {
    const neutral = getNeutralTexture()

    expect(getNeutralTexture()).toBe(neutral)
    expect(neutral.image.width).toBe(1)
    expect(neutral.image.height).toBe(1)
    expect(Array.from(neutral.image.data ?? [])).toEqual([128, 128, 128, 255])
  })

  it('a texture property compiles to a texture node holding the resolved texture', () => {
    const id = asPropertyId('prop-albedo')
    let graph = unwrap(
      addProperty(createGraph(), {
        id,
        label: 'Albedo',
        name: 'albedo',
        exposed: true,
        type: 'texture',
        value: texture('albedo-asset'),
      }),
    )
    graph = unwrap(
      addPropertyNode(graph, registry, {
        id: asNodeId('albedo-reader'),
        propertyId: id,
        position: ORIGIN,
      }),
    )
    graph = withNode(graph, registry, 'sample', 'texture/sample-texture-2d')
    graph = withEdge(graph, registry, ['albedo-reader', 'out'], ['sample', 'texture'])
    graph = withEdge(graph, registry, ['sample', 'rgb'], ['master', 'baseColor'])

    const build = createMaterial(graph, registry, { resolveTexture: () => realTexture })

    expect(build.errors).toEqual([])
    const property = build.properties.get(id)
    expect(property).toBeInstanceOf(TextureNode)
    expect(property instanceof TextureNode && property.value).toBe(realTexture)
    expect(applyPropertyValue(build, id, texture('another'))).toBe('mismatch')
  })
})

describe('new catalog nodes', () => {
  const registry = createDefaultRegistry()

  it.each(['perlin', 'simplex'] as const)('builds a %s noise node', (kind) => {
    let graph = withNode(createGraph(), registry, 'noise', 'effects/noise')
    graph = withEdge(graph, registry, ['noise', 'out'], ['master', 'emission'])
    graph = unwrap(setParam(graph, registry, { nodeId: asNodeId('noise'), paramId: 'kind' }, kind))

    const build = createMaterial(graph, registry)

    expect(build.errors).toEqual([])
    expect(build.material).toBeInstanceOf(MeshStandardNodeMaterial)
  })

  it.each([
    ['effects/noise', 'out'],
    ['effects/voronoi', 'f1'],
    ['effects/checkerboard', 'out'],
    ['normal/normal-from-height', 'out'],
    ['scene/depth-fade', 'out'],
    ['scene/scene-color', 'out'],
  ] as const)('%s compiles into a master slot', (type, output) => {
    const slot = type === 'normal/normal-from-height' ? 'normal' : 'emission'
    const graph = withEdge(
      withNode(createGraph(), registry, 'subject', type),
      registry,
      ['subject', output],
      ['master', slot],
    )

    const build = createMaterial(graph, registry)

    expect(build.errors).toEqual([])
    expect(build.material).not.toBeNull()
  })
})

describe('reroute', () => {
  const registry = createDefaultRegistry()

  /** A Float feeding Opacity, with a reroute on the connection when asked. */
  const floatToOpacity = (rerouted: boolean): Graph => {
    const graph = withNode(createGraph(), registry, 'value', 'input/float')
    if (!rerouted) return withEdge(graph, registry, ['value', 'out'], ['master', 'opacity'])
    const withDot = withNode(graph, registry, 'dot', 'utility/reroute')
    const fed = withEdge(withDot, registry, ['value', 'out'], ['dot', 'in'])
    return withEdge(fed, registry, ['dot', 'out'], ['master', 'opacity'])
  }

  it('passes the value through: the same uniforms, and the slot reads the source as is', () => {
    const direct = createMaterial(floatToOpacity(false), registry)
    const rerouted = createMaterial(floatToOpacity(true), registry)
    const valueUniform = rerouted.uniforms.get(portKey({ nodeId: asNodeId('value'), portId: 'x' }))

    expect(rerouted.errors).toEqual([])
    expect([...rerouted.uniforms.keys()]).toEqual([...direct.uniforms.keys()])
    expect(valueUniform).toBeDefined()
    expect(rerouted.material?.opacityNode).toBe(valueUniform)
  })
})
