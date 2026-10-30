import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MAIN_LIGHT_DEFAULTS, MASTER_NODE_ID, parseGraph, setParam } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'
import ts from 'typescript'
import { BackSide, DataTexture, Vector3 } from 'three'
import { MeshBasicNodeMaterial, Node, TextureNode, UniformNode } from 'three/webgpu'
import { modelScale, normalLocal, positionLocal, time } from 'three/tsl'
import { afterEach, describe, expect, it } from 'vitest'
import { createCatalogGraph } from './fixtures/catalog-graph'
import { createLightsPropertyGraph } from './fixtures/lights-property-graph'
import { unwrap } from './fixtures/unwrap'
import lavaFlowGraph from '../../../apps/editor/src/examples/lava-flow.graph.json'
import pondGraph from '../../../apps/editor/src/examples/pond.graph.json'
import waterGraphV1 from './fixtures/water-graph-v1.json'
import { generateModule } from './index'
import { TSL_IMPORT_NAMES } from './reserved-names'
import { HELPER_ORDER, TSL_HELPERS } from './tsl-helpers'

/** Inside the package, so `three/tsl` in the generated module resolves through node_modules. */
const PACKAGE_DIRECTORY = fileURLToPath(new URL('..', import.meta.url))
const RUNTIME_SOURCES: Readonly<Record<(typeof HELPER_ORDER)[number], string>> = {
  simplexNoise3: '../../runtime/src/simplex-noise.ts',
  normalFromHeight: '../../runtime/src/normal-from-height.ts',
  sceneDepthFade: '../../runtime/src/scene-depth-fade.ts',
  voronoiCell2: '../../runtime/src/voronoi-cell.ts',
  voronoiCell3: '../../runtime/src/voronoi-cell.ts',
  voronoiMinkowski2: '../../runtime/src/voronoi-minkowski.ts',
  voronoiMinkowski3: '../../runtime/src/voronoi-minkowski.ts',
  voronoiMinkowskiCell2: '../../runtime/src/voronoi-minkowski.ts',
  voronoiMinkowskiCell3: '../../runtime/src/voronoi-minkowski.ts',
  hashFloat: '../../runtime/src/hash-noise.ts',
  hashVec3: '../../runtime/src/hash-noise.ts',
  tiledNoise3: '../../runtime/src/tiled-noise.ts',
  tiledVoronoi2: '../../runtime/src/tiled-voronoi.ts',
}

const registry = createDefaultRegistry()
const tempModules: string[] = []

afterEach(async () => {
  await Promise.all(tempModules.splice(0).map((path) => rm(path, { force: true })))
})

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null

interface LoadedModule {
  readonly code: string
  readonly exports: Readonly<Record<string, unknown>>
}

async function loadGenerated(graph: Graph): Promise<LoadedModule> {
  const generated = generateModule(graph, registry)
  expect(generated.errors).toEqual([])
  const path = `${PACKAGE_DIRECTORY}.parity-${randomUUID()}.mjs`
  tempModules.push(path)
  await writeFile(path, generated.code)
  const imported: unknown = await import(pathToFileURL(path).href)
  if (!isRecord(imported)) throw new Error('The generated module did not load as a module')
  return { code: generated.code, exports: imported }
}

const withMasterParams = (
  graph: Graph,
  params: Readonly<Record<string, string | boolean>>,
): Graph =>
  Object.entries(params).reduce(
    (current, [paramId, value]) =>
      unwrap(setParam(current, registry, { nodeId: MASTER_NODE_ID, paramId }, value)),
    graph,
  )

/** Every node an expression is built from, itself included. */
function nodesIn(root: Node): ReadonlySet<Node> {
  const found = new Set<Node>()
  const visit = (node: Node): void => {
    if (found.has(node)) return
    found.add(node)
    for (const child of node.getChildren()) visit(child)
  }
  visit(root)
  return found
}

function expectEverySlotIsANode(loaded: LoadedModule): readonly string[] {
  const nodes = loaded.exports.nodes
  if (!isRecord(nodes)) throw new Error('The module exports no `nodes` object')
  const entries = Object.entries(nodes)
  expect(entries.length).toBeGreaterThan(0)
  for (const [slot, value] of entries) {
    expect(value, `nodes.${slot}`).toBeInstanceOf(Node)
  }
  expect(loaded.exports.default).toBe(nodes)
  return entries.map(([slot]) => slot)
}

describe('generated module parity', () => {
  it('builds every slot as a three node for the phase-1 water fixture', async () => {
    const loaded = await loadGenerated(unwrap(parseGraph(waterGraphV1, registry)))

    expect(expectEverySlotIsANode(loaded)).toEqual([
      'colorNode',
      'emissiveNode',
      'metalnessNode',
      'roughnessNode',
      'opacityNode',
    ])
  })

  it('builds the pond example, unlit, as three nodes with its palette as uniforms', async () => {
    const loaded = await loadGenerated(unwrap(parseGraph(pondGraph, registry)))

    expect(expectEverySlotIsANode(loaded)).toEqual(['colorNode', 'opacityNode'])
    expect(loaded.code).toContain('MeshBasicNodeMaterial')
    expect(loaded.code).not.toContain('MeshStandardNodeMaterial')
    const uniforms = isRecord(loaded.exports.uniforms) ? Object.keys(loaded.exports.uniforms) : []
    expect(uniforms).toContain('waveSpeed')
    expect(uniforms).toContain('laceSun')
  })

  it('builds the lava flow example as three nodes', async () => {
    const loaded = await loadGenerated(unwrap(parseGraph(lavaFlowGraph, registry)))

    expect(expectEverySlotIsANode(loaded).length).toBeGreaterThan(0)
  })

  it('loads a module whose Blackboard property and main light both read lights', async () => {
    const { exports } = await loadGenerated(createLightsPropertyGraph(registry))

    expect(isRecord(exports.uniforms) ? exports.uniforms.lights : null).toBeInstanceOf(Node)
    expect(isRecord(exports.lights) ? Object.keys(exports.lights) : []).toEqual([
      'mainLightDirection',
      'mainLightColor',
    ])
  })

  describe('catalog fixture', () => {
    const catalog = createCatalogGraph(registry)

    it('contains every node of the catalog except the master', () => {
      const usedTypes = new Set(Object.values(catalog.nodes).map((node) => node.type))
      const missing = registry
        .list()
        .map((definition) => definition.type)
        .filter((type) => !usedTypes.has(type))

      expect(missing).toEqual([])
    })

    it('builds every slot as a three node', async () => {
      const loaded = await loadGenerated(catalog)

      expect(expectEverySlotIsANode(loaded)).toEqual([
        'positionNode',
        'colorNode',
        'emissiveNode',
        'metalnessNode',
        'roughnessNode',
        'normalNode',
        'opacityNode',
        'alphaTestNode',
      ])
    })

    it('exports uniforms as nodes and textures as texture nodes that can be swapped', async () => {
      const { exports } = await loadGenerated(catalog)

      expect(isRecord(exports.uniforms) ? Object.keys(exports.uniforms) : []).toEqual([
        'waveSpeed',
        'tint',
        'bounds',
      ])
      for (const uniformNode of Object.values(isRecord(exports.uniforms) ? exports.uniforms : {})) {
        expect(uniformNode).toBeInstanceOf(Node)
      }
      const textures = isRecord(exports.textures) ? exports.textures : {}
      expect(Object.keys(textures)).toEqual(['albedo', 'mask', 'texture1', 'texture2'])
      for (const [key, textureNode] of Object.entries(textures)) {
        expect(textureNode, `textures.${key}`).toBeInstanceOf(TextureNode)
        expect(textureNode instanceof TextureNode ? textureNode.value : null).not.toBeNull()
      }
      const albedo = textures.albedo
      if (!(albedo instanceof TextureNode)) throw new Error('textures.albedo is not a texture node')
      const replacement = new DataTexture()
      albedo.value = replacement
      expect(albedo.value).toBe(replacement)
    })

    it('exports the main light as uniforms set to the preview key light', async () => {
      const { exports } = await loadGenerated(catalog)
      const lights = isRecord(exports.lights) ? exports.lights : {}

      expect(Object.keys(lights)).toEqual(['mainLightDirection', 'mainLightColor'])
      const values = Object.values(lights).map((light): unknown =>
        light instanceof UniformNode ? light.value : null,
      )
      expect(values).toEqual([
        new Vector3(...MAIN_LIGHT_DEFAULTS.direction),
        new Vector3(...MAIN_LIGHT_DEFAULTS.color),
      ])
    })

    it('builds an unlit material from the same graph', async () => {
      const loaded = await loadGenerated(withMasterParams(catalog, { lighting: 'unlit' }))

      expect(expectEverySlotIsANode(loaded)).toEqual([
        'positionNode',
        'colorNode',
        'opacityNode',
        'alphaTestNode',
      ])
    })

    it('builds a physical material with every feature on from the same graph', async () => {
      const loaded = await loadGenerated(
        withMasterParams(catalog, {
          lighting: 'physical',
          useTransmission: true,
          useClearcoat: true,
          useSheen: true,
          useIridescence: true,
        }),
      )

      expect(loaded.code).toContain('MeshPhysicalNodeMaterial')
      expect(expectEverySlotIsANode(loaded)).toEqual([
        'positionNode',
        'colorNode',
        'emissiveNode',
        'metalnessNode',
        'roughnessNode',
        'normalNode',
        'opacityNode',
        'alphaTestNode',
        'transmissionNode',
        'iorNode',
        'thicknessNode',
        'clearcoatNode',
        'clearcoatRoughnessNode',
        'sheenNode',
        'sheenRoughnessNode',
        'iridescenceNode',
        'iridescenceIORNode',
      ])
    })

    it('builds the outline pass as three nodes on a back-sided basic material', async () => {
      const outlined = withMasterParams(catalog, { outline: true })
      const { exports } = await loadGenerated(outlined)
      const outlineNodes = isRecord(exports.outlineNodes) ? exports.outlineNodes : {}

      // The catalog wires an alpha clip, so the hull is cut by the same mask.
      expect(Object.keys(outlineNodes)).toEqual([
        'positionNode',
        'colorNode',
        'opacityNode',
        'alphaTestNode',
      ])
      for (const [slot, value] of Object.entries(outlineNodes)) {
        expect(value, `outlineNodes.${slot}`).toBeInstanceOf(Node)
      }
      expect(exports.outlineMaterialSettings).toEqual({ side: BackSide })
      const material = Object.assign(
        new MeshBasicNodeMaterial(),
        outlineNodes,
        exports.outlineMaterialSettings,
      )
      expect(material.side).toBe(BackSide)
      expect(material.positionNode).toBe(outlineNodes.positionNode)
    })

    it('pushes the hull out along the normal over the world scale, like the runtime', async () => {
      const { exports } = await loadGenerated(withMasterParams(catalog, { outline: true }))
      const position = isRecord(exports.outlineNodes) ? exports.outlineNodes.positionNode : null
      if (!(position instanceof Node)) throw new Error('outlineNodes.positionNode is not a node')

      const parts = nodesIn(position)
      expect(parts.has(normalLocal)).toBe(true)
      expect(parts.has(modelScale)).toBe(true)
    })

    it('wobbles the hull with a noise drifting with time, from the same builtins as the runtime', async () => {
      const { exports } = await loadGenerated(withMasterParams(catalog, { outline: true }))
      const position = isRecord(exports.outlineNodes) ? exports.outlineNodes.positionNode : null
      if (!(position instanceof Node)) throw new Error('outlineNodes.positionNode is not a node')

      const parts = nodesIn(position)
      expect(parts.has(time)).toBe(true)
      expect(parts.has(positionLocal)).toBe(true)
    })

    it('exports the material settings the master asks for', async () => {
      const loaded = await loadGenerated(
        withMasterParams(catalog, { surface: 'transparent', twoSided: true }),
      )

      expect(loaded.exports.materialSettings).toEqual({ transparent: true, side: 2 })
    })

    it('imports only names the code facade and the helpers declare', async () => {
      const { code } = await loadGenerated(catalog)
      const imported = [...code.matchAll(/import \{([^}]*)\} from 'three\/tsl'/g)]
        .flatMap((match) => (match[1] ?? '').split(','))
        .map((name) => name.trim())
        .filter((name) => name.length > 0)
      const helperImports = HELPER_ORDER.flatMap((name) => TSL_HELPERS[name].imports)
      const known = new Set<string>([...TSL_IMPORT_NAMES, ...helperImports])

      expect(imported.filter((name) => !known.has(name))).toEqual([])
    })
  })
})

/** The JavaScript of a TS or JS source, without comments, imports, `export` or `"use strict"`. */
function toPlainJavaScript(source: string): string {
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: true,
    },
  })
  return outputText
    .replace(/^["']use strict["'];?/, '')
    .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?/gm, '')
    .replace(/^export\s+/gm, '')
}

/** Whitespace, semicolons and trailing commas do not change what the code does. */
const comparableSource = (source: string): string =>
  toPlainJavaScript(source)
    .replace(/\s+/g, '')
    .replace(/;/g, '')
    .replace(/,([)\]}])/g, '$1')

describe('local helpers', () => {
  it.each(HELPER_ORDER)('%s mirrors the live runtime helper', (name) => {
    const runtimeSource = readFileSync(new URL(RUNTIME_SOURCES[name], import.meta.url), 'utf8')

    expect(comparableSource(TSL_HELPERS[name].source)).toBe(comparableSource(runtimeSource))
  })

  it.each(HELPER_ORDER)('%s imports the same three/tsl names as the runtime helper', (name) => {
    const runtimeSource = readFileSync(new URL(RUNTIME_SOURCES[name], import.meta.url), 'utf8')
    const runtimeImports = [...runtimeSource.matchAll(/import \{([^}]*)\} from 'three\/tsl'/g)]
      .flatMap((match) => (match[1] ?? '').split(','))
      .map((identifier) => identifier.trim())
      .filter((identifier) => identifier.length > 0)

    expect([...TSL_HELPERS[name].imports].sort()).toEqual(runtimeImports.sort())
  })

  it.each(HELPER_ORDER)('%s declares only names its body uses', (name) => {
    const { source, imports } = TSL_HELPERS[name]
    const body = toPlainJavaScript(source)
    const usedImports = imports.filter((identifier) => new RegExp(`\\b${identifier}\\b`).test(body))

    expect(usedImports).toEqual(imports)
  })
})
