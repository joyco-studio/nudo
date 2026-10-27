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
  setParam,
  vec3,
} from '@nudo-tsl/core'
import type { BlackboardProperty, Graph, ParamValue, PortRef, PortValue } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'
import { describe, expect, it } from 'vitest'
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

    expect(code).toContain('Replace each null with a THREE.Texture')
    expect(code).toContain('export const textures = {\n  albedo: null,\n  texture1: null,\n}')
    expect(code).toContain('const albedoTexture = texture(textures.albedo)')
    expect(code).toContain('albedoTexture.sample(uv())')
    expect(code).toContain('texture(textures.texture1).sample(uv())')
  })

  it('lists an exposed texture property that nothing reads, and skips an unread hidden one', () => {
    const graph = withProperty(
      withProperty(createGraph(), textureProperty('mask', true)),
      textureProperty('hidden', false),
    )
    const code = generate(graph)

    expect(code).toContain('  mask: null,')
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

  it('prints the three release it was given, in the r<number> form', () => {
    const graph = createGraph()

    expect(lines(generate(graph, { threeVersion: '0.186.1' }))[1]).toContain('three r186 ·')
    expect(lines(generate(graph, { threeVersion: 'r190' }))[1]).toContain('three r190 ·')
    expect(lines(generate(graph, { threeVersion: 'dev' }))[1]).toContain('three dev ·')
  })

  it('is deterministic', () => {
    expect(generate(waterGraph())).toBe(generate(waterGraph()))
  })

  it('reports compile errors and prints no code', () => {
    const result = generateModule(createGraph(), createNodeRegistry())

    expect(result.code).toBe('')
    expect(result.errors.map((error) => error.code)).toEqual(['missing-definition'])
  })
})

interface MasterSettingsOverride {
  readonly lighting?: 'standard' | 'unlit'
  readonly surface?: 'auto' | 'opaque' | 'transparent'
  readonly twoSided?: boolean
}

function withMasterSettings(graph: Graph, settings: MasterSettingsOverride): Graph {
  const master = MASTER
  let updated = graph
  if (settings.lighting !== undefined) {
    updated = withParam(updated, master, 'lighting', settings.lighting)
  }
  if (settings.surface !== undefined)
    updated = withParam(updated, master, 'surface', settings.surface)
  if (settings.twoSided !== undefined) {
    updated = withParam(updated, master, 'twoSided', settings.twoSided)
  }
  return updated
}
