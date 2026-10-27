import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { MASTER_NODE_ID, parseGraph, setParam } from '@nudo-tsl/core'
import type { Graph } from '@nudo-tsl/core'
import { createDefaultRegistry } from '@nudo-tsl/nodes'
import ts from 'typescript'
import { DataTexture } from 'three'
import { Node, TextureNode } from 'three/webgpu'
import { afterEach, describe, expect, it } from 'vitest'
import { createCatalogGraph } from './fixtures/catalog-graph'
import { unwrap } from './fixtures/unwrap'
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
      expect(Object.keys(textures)).toEqual(['albedo', 'mask', 'texture1'])
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

    it('builds an unlit material from the same graph', async () => {
      const loaded = await loadGenerated(withMasterParams(catalog, { lighting: 'unlit' }))

      expect(expectEverySlotIsANode(loaded)).toEqual([
        'positionNode',
        'colorNode',
        'opacityNode',
        'alphaTestNode',
      ])
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
