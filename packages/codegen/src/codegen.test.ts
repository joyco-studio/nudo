import {
  addNode,
  addProperty,
  addPropertyNode,
  asEdgeId,
  asNodeId,
  asPropertyId,
  connect,
  createGraph,
  createNodeRegistry,
  float,
  parseGraph,
  setInputValue,
  splitEdge,
  setParam,
  vec3,
} from '@nudo-tsl/core'
import type { BlackboardProperty, Graph, ParamValue, PortRef, PortValue } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'
import { describe, expect, it } from 'vitest'
import { createLightsPropertyGraph } from './fixtures/lights-property-graph'
import { unwrap } from './fixtures/unwrap'
import waterGraphV1 from './fixtures/water-graph-v1.json'
import { generateModule } from './index'

const ORIGIN = { x: 0, y: 0 }
const MASTER = asNodeId('master')

const registry = createDefaultRegistry()

const waterGraph = (): Graph => unwrap(parseGraph(waterGraphV1, registry))

const withNode = (graph: Graph, id: string, type: string): Graph =>
  unwrap(addNode(graph, registry, { id: asNodeId(id), type, position: ORIGIN }))

const port = (nodeId: string, portId: string): PortRef => ({ nodeId: asNodeId(nodeId), portId })

const withLink = (graph: Graph, from: PortRef, to: PortRef): Graph =>
  unwrap(
    connect(graph, registry, {
      id: asEdgeId(`${from.nodeId}.${from.portId}-${to.nodeId}.${to.portId}`),
      from,
      to,
    }),
  )

const withParam = (graph: Graph, nodeId: string, paramId: string, value: ParamValue): Graph =>
  unwrap(setParam(graph, registry, { nodeId: asNodeId(nodeId), paramId }, value))

const withInput = (graph: Graph, from: PortRef, value: PortValue): Graph =>
  unwrap(setInputValue(graph, from, value))

const withProperty = (graph: Graph, property: BlackboardProperty): Graph =>
  unwrap(addProperty(graph, property))

const withReader = (graph: Graph, id: string, property: BlackboardProperty): Graph =>
  unwrap(
    addPropertyNode(graph, registry, {
      id: asNodeId(id),
      propertyId: property.id,
      position: ORIGIN,
    }),
  )

const floatProperty = (name: string, exposed: boolean, value: number): BlackboardProperty => ({
  id: asPropertyId(`prop-${name}`),
  label: name,
  name,
  exposed,
  type: 'float',
  value: float(value),
})

const textureProperty = (name: string, exposed: boolean): BlackboardProperty => ({
  id: asPropertyId(`prop-${name}`),
  label: name,
  name,
  exposed,
  type: 'texture',
  value: { type: 'texture', assetId: null },
})

const generate = (graph: Graph, options?: { threeVersion?: string }): string => {
  const result = generateModule(graph, registry, options)
  expect(result.errors).toEqual([])
  return result.code
}

const lines = (code: string): readonly string[] => code.split('\n')

const importLine = (code: string, source: string): string | undefined =>
  lines(code).find((line) => line.startsWith('import ') && line.endsWith(`from '${source}'`))

describe('generateModule', () => {
  it('generates the exact module for the phase-1 water fixture', async () => {
    await expect(generate(waterGraph())).toMatchFileSnapshot('./__snapshots__/water-module.mjs')
  })

  it('imports only the names it uses, sorted', () => {
    const graph = withLink(
      withNode(createGraph(), 'wave', 'math/sin'),
      port('wave', 'out'),
      port('master', 'roughness'),
    )

    expect(importLine(generate(graph), 'three/tsl')).toBe(
      "import { color, float, sin } from 'three/tsl'",
    )
  })

  it('wraps an import that would pass 100 columns, one name per line', () => {
    const code = generate(waterGraph())

    expect(code).toContain('import {\n  clamp,\n  color,\n')
    expect(lines(code).every((line) => !line.startsWith('import {') || line.length <= 100)).toBe(
      true,
    )
  })

  it('names nodes by label with a counter per label', () => {
    let graph = withNode(createGraph(), 'first', 'math/multiply')
    graph = withNode(graph, 'second', 'math/multiply')
    graph = withNode(graph, 'wave', 'math/sin')
    graph = withLink(graph, port('first', 'out'), port('second', 'a'))
    graph = withLink(graph, port('second', 'out'), port('wave', 'in'))
    graph = withLink(graph, port('wave', 'out'), port('master', 'roughness'))
    const code = generate(graph)

    expect(code).toContain('const multiply1 = ')
    expect(code).toContain('const multiply2 = multiply1.mul(')
    expect(code).toContain('const sine1 = sin(multiply2)')
    expect(code).toContain('roughnessNode: sine1,')
  })

  it('suffixes the secondary outputs of a node and leaves the primary one bare', () => {
    let graph = withNode(createGraph(), 'clock', 'input/time')
    graph = withNode(graph, 'split', 'vector/split')
    graph = withNode(graph, 'coords', 'input/uv')
    graph = withLink(graph, port('coords', 'out'), port('split', 'in'))
    graph = withLink(graph, port('clock', 'out'), port('master', 'metalness'))
    graph = withLink(graph, port('clock', 'sineTime'), port('master', 'opacity'))
    graph = withLink(graph, port('split', 'y'), port('master', 'roughness'))
    const code = generate(graph)

    expect(code).toContain('const time1 = time\n')
    expect(code).toContain('const time1SineTime = sin(time)')
    expect(code).toContain('const split1Y = ')
    expect(code).not.toContain('time1CosineTime')
  })

  it('declares a shared node once and only the nodes the master reaches', () => {
    let graph = withNode(createGraph(), 'shared', 'input/time')
    graph = withNode(graph, 'unused', 'input/uv')
    graph = withLink(graph, port('shared', 'out'), port('master', 'metalness'))
    graph = withLink(graph, port('shared', 'out'), port('master', 'roughness'))
    const code = generate(graph)

    expect(code.match(/const time1 = /g)).toHaveLength(1)
    expect(code).toContain('metalnessNode: time1,')
    expect(code).toContain('roughnessNode: time1,')
    expect(code).not.toContain('uv()')
  })

  it('leaves comment frames out, title and body text included', () => {
    let graph = withNode(createGraph(), 'note', 'utility/comment')
    graph = withParam(graph, 'note', 'title', 'Ripple notes')
    graph = withParam(graph, 'note', 'body', 'Tune the foam\nbefore shipping')

    expect(generate(graph)).toBe(generate(createGraph()))
  })

  it('writes inline values as literals, and colors as hex', () => {
    const graph = withInput(createGraph(), port('master', 'baseColor'), vec3(0.5, 0.25, 0.125))
    const code = generate(graph)

    expect(code).toContain('colorNode: color(0x')
    expect(code).toContain('metalnessNode: float(0),')
    expect(code).toContain('opacityNode: float(1),')
  })

  it('keeps a color beyond the displayable range as an exact vec3', () => {
    const graph = withInput(createGraph(), port('master', 'emission'), vec3(4, 0.5, 0))
    const code = generate(graph)

    expect(code).toContain('emissiveNode: vec3(4, 0.5, 0),')
  })

  it('names the property uniforms', () => {
    const speed = floatProperty('waveSpeed', true, 1.5)
    const gain = floatProperty('gain', false, 2)
    let graph = withProperty(withProperty(createGraph(), speed), gain)
    graph = withReader(graph, 'speed-reader', speed)
    graph = withReader(graph, 'gain-reader', gain)
    graph = withNode(graph, 'scaled', 'math/multiply')
    graph = withLink(graph, port('speed-reader', 'out'), port('scaled', 'a'))
    graph = withLink(graph, port('gain-reader', 'out'), port('scaled', 'b'))
    graph = withLink(graph, port('scaled', 'out'), port('master', 'roughness'))
    const code = generate(graph)

    expect(code).toContain('export const uniforms = {\n  waveSpeed: uniform(1.5),\n}')
    expect(code).toContain('const multiply1 = uniforms.waveSpeed.mul(float(2))')
    expect(code).not.toContain('gain')
    expect(code).toMatch(/import \{[^}]*\buniform\b[^}]*\} from 'three\/tsl'/)
  })

  it('exports an exposed property even when no node reads it', () => {
    const graph = withProperty(createGraph(), floatProperty('spare', true, 0.25))

    expect(generate(graph)).toContain('  spare: uniform(0.25),')
  })

  it('does not declare uniforms or import uniform when nothing is exposed', () => {
    const code = generate(waterGraph())

    expect(code).not.toContain('uniforms')
    expect(code).not.toMatch(/\buniform\b/)
  })

  it('exports texture placeholders, for properties and for inline texture inputs', () => {
    const albedo = textureProperty('albedo', true)
    let graph = withProperty(createGraph(), albedo)
    graph = withReader(graph, 'albedo-reader', albedo)
    graph = withNode(graph, 'sampler', 'texture/sample-texture-2d')
    graph = withNode(graph, 'bare-sampler', 'texture/sample-texture-2d')
    graph = withLink(graph, port('albedo-reader', 'out'), port('sampler', 'texture'))
    graph = withLink(graph, port('sampler', 'rgb'), port('master', 'baseColor'))
    graph = withLink(graph, port('bare-sampler', 'rgb'), port('master', 'emission'))
    const code = generate(graph)

    expect(code).toContain(
      "import { DataTexture, FrontSide, RGBAFormat, UnsignedByteType } from 'three'",
    )
    expect(code).toContain('const neutralTexture = new DataTexture(')
    expect(code).toContain('new Uint8Array([128, 128, 128, 255]),')
    expect(code).toContain('textures.albedo.value = myTexture')
    expect(code).not.toContain('Replace each null')
    expect(code).toContain(
      'export const textures = {\n  albedo: texture(neutralTexture),\n  texture1: texture(neutralTexture),\n}',
    )
    expect(code).toContain('const sampleTexture2d1Rgb = textures.albedo.sample(uv()).xyz')
    expect(code).toContain('textures.texture1.sample(uv()).xyz')
    expect(code).not.toContain('null')
  })

  it('declares no neutral texture when the graph has no textures', () => {
    const code = generate(waterGraph())

    expect(code).not.toContain('neutralTexture')
    expect(code).not.toContain('DataTexture')
  })

  it('lists an exposed texture property that nothing reads, and skips an unread hidden one', () => {
    const graph = withProperty(
      withProperty(createGraph(), textureProperty('mask', true)),
      textureProperty('hidden', false),
    )
    const code = generate(graph)

    expect(code).toContain('  mask: texture(neutralTexture),')
    expect(code).not.toContain('hidden')
  })

  it('emits a local helper for simplex noise and none for perlin noise', () => {
    let graph = withNode(createGraph(), 'noise', 'effects/noise')
    graph = withLink(graph, port('noise', 'out'), port('master', 'roughness'))
    const simplex = generate(graph)
    const perlin = generate(withParam(graph, 'noise', 'kind', 'perlin'))

    expect(simplex).toContain('const simplexNoise3 = Fn(([pointInput]) => {')
    expect(simplex).toContain('simplexNoise3(')
    expect(simplex).toMatch(/import \{[^}]*\bFn\b[^}]*\} from 'three\/tsl'/)
    expect(perlin).not.toContain('simplexNoise3')
    expect(perlin).toContain('mx_noise_float(')
    expect(perlin).not.toMatch(/\bFn\b/)
  })

  describe('voronoi', () => {
    const voronoiTo = (outputId: string, distance: string | null = null): Graph => {
      let graph = withNode(createGraph(), 'cells', 'effects/voronoi')
      if (distance !== null) graph = withParam(graph, 'cells', 'distance', distance)
      return withLink(graph, port('cells', outputId), port('master', 'roughness'))
    }

    it('prints a Euclidean voronoi as the MaterialX worley noise it always was', () => {
      const code = generate(voronoiTo('f1'))

      expect(code).toContain('mx_worley_noise_vec2(uv().mul(float(5)), float(1)).x')
      expect(code).not.toContain('mx_worley_noise_vec3')
    })

    it.each([
      ['manhattan', 2],
      ['chebyshev', 3],
    ] as const)('prints a %s voronoi with MaterialX metric %d', (distance, metric) => {
      const code = generate(voronoiTo('f1', distance))

      expect(code).toContain(
        `mx_worley_noise_vec3(uv().mul(float(5)), float(1), ${String(metric)}).xy.x`,
      )
      expect(code).not.toContain('mx_worley_noise_vec2')
    })

    it('declares the cell helpers once for the cell and random outputs', () => {
      let graph = voronoiTo('cell', 'manhattan')
      graph = withNode(graph, 'cells3d', 'effects/voronoi-3d')
      graph = withLink(graph, port('cells3d', 'random'), port('master', 'metalness'))
      const code = generate(graph)

      expect(code).toContain('voronoiCell2(uv().mul(float(5)), float(1), 2)')
      expect(code).toContain(
        'mx_cell_noise_float(floor(voronoiCell3(positionLocal.mul(float(5)), float(1), 1)))',
      )
      expect(code.match(/const voronoiCell2 = Fn\(/g)).toHaveLength(1)
      expect(code.match(/const voronoiCell3 = Fn\(/g)).toHaveLength(1)
    })
  })

  it('emits the scene depth fade and normal-from-height helpers when used', () => {
    let graph = withNode(createGraph(), 'fade', 'scene/depth-fade')
    graph = withNode(graph, 'bump', 'normal/normal-from-height')
    graph = withLink(graph, port('fade', 'out'), port('master', 'opacity'))
    graph = withLink(graph, port('bump', 'out'), port('master', 'normal'))
    const code = generate(graph)

    expect(code).toContain('const sceneDepthFade = Fn(([distance]) => {')
    expect(code).toContain('const normalFromHeight = Fn(([height, strength]) => {')
    expect(code).toContain('normalNode: normalFromHeight1,')
  })

  describe('master settings', () => {
    it('prints the material class, surface hints and material settings', () => {
      const graph = withMasterSettings(createGraph(), {
        surface: 'transparent',
        twoSided: true,
      })
      const code = generate(graph)

      expect(lines(code)[1]).toBe('// three r186 · MeshStandardNodeMaterial')
      expect(lines(code)[2]).toBe('// Surface: transparent · double-sided')
      expect(code).toContain(
        'export const materialSettings = {\n  transparent: true,\n  side: DoubleSide,\n}',
      )
      expect(importLine(code, 'three')).toBe("import { DoubleSide } from 'three'")
    })

    it('resolves an automatic surface from the opacity, like the live material', () => {
      const translucent = withInput(createGraph(), port('master', 'opacity'), float(0.5))
      const wired = withLink(
        withNode(createGraph(), 'clock', 'input/time'),
        port('clock', 'out'),
        port('master', 'opacity'),
      )

      expect(generate(createGraph())).toContain('transparent: false,')
      expect(generate(translucent)).toContain('transparent: true,')
      expect(generate(wired)).toContain('transparent: true,')
      expect(generate(withMasterSettings(translucent, { surface: 'opaque' }))).toContain(
        'transparent: false,',
      )
    })

    it('prints an unlit material as MeshBasicNodeMaterial with only the slots it reads', () => {
      const graph = withMasterSettings(createGraph(), { lighting: 'unlit' })
      const code = generate(graph)

      expect(lines(code)[1]).toBe('// three r186 · MeshBasicNodeMaterial')
      expect(code).toContain('// Apply: Object.assign(new MeshBasicNodeMaterial(), nodes')
      expect(code).toContain('colorNode: color(0xe7e7e7).add(color(0x000000)),')
      expect(code).toContain('opacityNode: float(1),')
      expect(code).not.toContain('metalnessNode')
      expect(code).not.toContain('roughnessNode')
      expect(code).not.toContain('emissiveNode')
    })

    it('prints a physical material as MeshPhysicalNodeMaterial with the enabled features', () => {
      const graph = withMasterSettings(createGraph(), {
        lighting: 'physical',
        useClearcoat: true,
      })
      const code = generate(graph)

      expect(lines(code)[1]).toBe('// three r186 · MeshPhysicalNodeMaterial')
      expect(code).toContain('// Apply: Object.assign(new MeshPhysicalNodeMaterial(), nodes')
      expect(code).toContain('roughnessNode: float(0.5),')
      expect(code).toContain('clearcoatNode: float(0),')
      expect(code).toContain('clearcoatRoughnessNode: float(0),')
      expect(code).not.toContain('transmissionNode')
      expect(code).not.toContain('sheenNode')
      expect(code).not.toContain('iridescenceNode')
    })

    it('prints no outline while the switch is off', () => {
      const code = generate(createGraph())

      expect(code).not.toContain('outline')
      expect(code).not.toContain('BackSide')
    })

    it('exports the outline pass with how to apply it', () => {
      const code = generate(withMasterSettings(createGraph(), { outline: true }))

      expect(lines(code).slice(4, 6)).toEqual([
        '// Outline: draw the geometry again with this, e.g. mesh.add(new Mesh(mesh.geometry, outline))',
        '// const outline = Object.assign(new MeshBasicNodeMaterial(), outlineNodes, outlineMaterialSettings)',
      ])
      expect(importLine(code, 'three')).toBe("import { BackSide, FrontSide } from 'three'")
      expect(code).toContain(
        [
          'export const outlineNodes = {',
          '  positionNode: positionLocal.add(normalLocal.mul(max(float(0.02), float(0))).div(modelScale)),',
          '  colorNode: color(0x111111),',
          '}',
        ].join('\n'),
      )
      expect(code).toContain('export const outlineMaterialSettings = {\n  side: BackSide,\n}')
      expect(code).not.toContain('outlineWidth')
    })

    it('starts the outline from the displaced position the surface uses', () => {
      let graph = withMasterSettings(createGraph(), { outline: true })
      graph = withNode(graph, 'lift', 'input/vector3')
      graph = withLink(graph, port('lift', 'out'), port('master', 'position'))
      const code = generate(graph)

      expect(code).toMatch(/positionNode: (\w+),[\s\S]*outlineNodes[\s\S]*positionNode: \1\.add\(/)
    })

    it('prints no physical slot for a standard material, whatever its switches', () => {
      const graph = withMasterSettings(createGraph(), { useTransmission: true, useSheen: true })
      const code = generate(graph)

      expect(lines(code)[1]).toBe('// three r186 · MeshStandardNodeMaterial')
      expect(code).not.toContain('transmissionNode')
      expect(code).not.toContain('sheenNode')
    })

    it('notes the alpha clip and keeps its threshold on alphaTestNode', () => {
      const graph = withInput(
        withLink(
          withNode(createGraph(), 'mask', 'effects/checkerboard'),
          port('mask', 'out'),
          port('master', 'alphaClip'),
        ),
        port('master', 'opacity'),
        float(1),
      )
      const code = generate(graph)

      expect(lines(code)[2]).toBe('// Surface: opaque · single-sided · alpha clip (alphaTestNode)')
      expect(code).toContain('alphaTestNode: checkerboard1,')
    })
  })

  describe('main light', () => {
    const LIGHTS_EXPORT = [
      'export const lights = {',
      '  mainLightDirection: uniform(vec3(0.424264, 0.565685, 0.707107)),',
      '  mainLightColor: uniform(vec3(2.5, 2.5, 2.5)),',
      '}',
    ].join('\n')

    it('exports the shared light uniforms and reads them by name', () => {
      let graph = withNode(createGraph(), 'sun', 'input/main-light')
      graph = withLink(graph, port('sun', 'halfLambert'), port('master', 'roughness'))
      const code = generate(graph)

      expect(code).toContain(
        "// Main Light: keep in step with your scene's key DirectionalLight, e.g. lights.mainLightDirection.value.copy(light.position).normalize(); lights.mainLightColor.value.setFromColor(light.color).multiplyScalar(light.intensity)",
      )
      expect(code).toContain(LIGHTS_EXPORT)
      expect(code).toContain('dot(normalize(normalWorld), lights.mainLightDirection)')
      expect(importLine(code, 'three/tsl')).toMatch(/\buniform\b.*\bvec3\b/)
    })

    it('prints no lights when nothing reads the main light', () => {
      expect(generate(waterGraph())).not.toContain('lights')
    })

    it('keeps a Blackboard property named lights apart from the lights export', () => {
      const code = generate(createLightsPropertyGraph(registry))
      const topLevelNames = [...code.matchAll(/^(?:export )?const (\w+)/gm)].map(
        (match) => match[1],
      )

      expect(code).toContain('export const uniforms = {\n  lights: uniform(0.5),\n}')
      expect(code).toContain(LIGHTS_EXPORT)
      expect(code).toContain('uniforms.lights.mul(')
      expect(topLevelNames.filter((name, index) => topLevelNames.indexOf(name) !== index)).toEqual(
        [],
      )
    })
  })

  it('prints the three release it was given, in the r<number> form', () => {
    const graph = createGraph()

    expect(lines(generate(graph, { threeVersion: '0.186.1' }))[1]).toContain('three r186 ·')
    expect(lines(generate(graph, { threeVersion: 'r190' }))[1]).toContain('three r190 ·')
    expect(lines(generate(graph, { threeVersion: 'dev' }))[1]).toContain('three dev ·')
  })

  it('prints the same module when every connection runs through a reroute', () => {
    const direct = waterGraph()
    const rerouted = Object.values(direct.edges).reduce(
      (graph, edge) =>
        unwrap(
          splitEdge(graph, registry, {
            edgeId: edge.id,
            node: { id: asNodeId(`dot-${edge.id}`), type: 'utility/reroute', position: ORIGIN },
            inputPortId: 'in',
            outputPortId: 'out',
            edgeIds: [asEdgeId(`into-${edge.id}`), asEdgeId(`out-of-${edge.id}`)],
          }),
        ),
      direct,
    )

    expect(Object.keys(rerouted.nodes).length).toBeGreaterThan(Object.keys(direct.nodes).length)
    expect(generate(rerouted)).toBe(generate(direct))
  })

  it('is deterministic', () => {
    expect(generate(waterGraph())).toBe(generate(waterGraph()))
  })

  it('reports a value a shader cannot hold as an error on its node, and never throws', () => {
    const graph = withInput(
      withNode(createGraph(), 'amount', 'input/float'),
      port('amount', 'x'),
      float(Number.POSITIVE_INFINITY),
    )
    const linked = withLink(graph, port('amount', 'out'), port('master', 'roughness'))
    const result = generateModule(linked, registry)

    expect(result.code).toBe('')
    expect(result.errors.map((error) => [error.nodeId, error.code])).toEqual([
      ['amount', 'build-failed'],
    ])
    expect(result.errors[0]?.message).toContain('Infinity')
  })

  it('reports a property value a shader cannot hold', () => {
    const graph = withProperty(createGraph(), floatProperty('speed', true, Number.NaN))
    const result = generateModule(graph, registry)

    expect(result.code).toBe('')
    expect(result.errors.map((error) => error.code)).toEqual(['build-failed'])
    expect(result.errors[0]?.message).toContain('Property "speed"')
  })

  it('reports compile errors and prints no code', () => {
    const result = generateModule(createGraph(), createNodeRegistry())

    expect(result.code).toBe('')
    expect(result.errors.map((error) => error.code)).toEqual(['missing-definition'])
  })
})

interface MasterSettingsOverride {
  readonly lighting?: 'standard' | 'unlit' | 'physical'
  readonly surface?: 'auto' | 'opaque' | 'transparent'
  readonly twoSided?: boolean
  readonly useTransmission?: boolean
  readonly useClearcoat?: boolean
  readonly useSheen?: boolean
  readonly useIridescence?: boolean
  readonly outline?: boolean
}

const MASTER_SETTING_IDS: readonly (keyof MasterSettingsOverride)[] = [
  'lighting',
  'surface',
  'twoSided',
  'useTransmission',
  'useClearcoat',
  'useSheen',
  'useIridescence',
  'outline',
]

function withMasterSettings(graph: Graph, settings: MasterSettingsOverride): Graph {
  return MASTER_SETTING_IDS.reduce<Graph>((updated, paramId) => {
    const value = settings[paramId]
    return value === undefined ? updated : withParam(updated, MASTER, paramId, value)
  }, graph)
}
