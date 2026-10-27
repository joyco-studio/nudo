import type { Page } from '@playwright/test'

/** Mirrors `AUTOSAVE_KEY` in src/store/autosave.ts. */
export const AUTOSAVE_KEY = 'nudo-tsl:autosave'

type Vector = readonly number[]

interface SeedNumericValue {
  type: 'float' | 'vec2' | 'vec3' | 'vec4'
  value: number | Vector
}

interface SeedTextureValue {
  type: 'texture'
  assetId: string | null
}

type SeedValue = SeedNumericValue | SeedTextureValue

interface SeedNode {
  id: string
  type: string
  position: { x: number; y: number }
  inputValues?: Record<string, SeedValue>
  params?: Record<string, string | number | boolean>
}

interface SeedProperty {
  id: string
  label: string
  name: string
  exposed: boolean
  type: SeedValue['type']
  value: SeedValue
}

interface SeedEdge {
  id: string
  from: [nodeId: string, portId: string]
  to: [nodeId: string, portId: string]
}

export const MASTER_POSITION = { x: 600, y: 0 }

function documentBody(nodes: readonly SeedNode[], edges: readonly SeedEdge[]) {
  const allNodes: SeedNode[] = [
    { id: 'master', type: 'master/stack', position: MASTER_POSITION },
    ...nodes,
  ]
  return {
    nodes: Object.fromEntries(
      allNodes.map((node) => [
        node.id,
        {
          id: node.id,
          type: node.type,
          position: node.position,
          inputValues: node.inputValues ?? {},
          params: node.params ?? {},
        },
      ]),
    ),
    edges: Object.fromEntries(
      edges.map((edge) => [
        edge.id,
        {
          id: edge.id,
          from: { nodeId: edge.from[0], portId: edge.from[1] },
          to: { nodeId: edge.to[0], portId: edge.to[1] },
        },
      ]),
    ),
  }
}

/**
 * Builds a phase-1 autosave document (schema version 1) the editor restores on start. It stays at
 * v1 on purpose: every e2e that seeds it also exercises the v1 to v2 migration.
 */
export function graphDocument(nodes: readonly SeedNode[], edges: readonly SeedEdge[]): string {
  return JSON.stringify({ schemaVersion: 1, ...documentBody(nodes, edges), properties: [] })
}

/** A schema version 2 document, for graphs that need Blackboard properties. */
export function graphDocumentV2(
  nodes: readonly SeedNode[],
  edges: readonly SeedEdge[],
  properties: readonly SeedProperty[],
): string {
  return JSON.stringify({ schemaVersion: 2, ...documentBody(nodes, edges), properties })
}

/** A Color node feeding the master's Base Color. */
export const COLOR_TO_BASE_COLOR = graphDocument(
  [
    {
      id: 'color',
      type: 'input/color',
      position: { x: 200, y: 40 },
      inputValues: { color: { type: 'vec3', value: [1, 0.2, 0.05] } },
    },
  ],
  [{ id: 'color-to-base', from: ['color', 'out'], to: ['master', 'baseColor'] }],
)

/** A Sample Texture 2D node, with no image chosen yet, feeding the master's Base Color. */
export const SAMPLE_TEXTURE_TO_BASE_COLOR = sampleTextureDocument(null)

/** Like `SAMPLE_TEXTURE_TO_BASE_COLOR`, with its texture input pointing at `assetId`. */
export function sampleTextureDocument(assetId: string | null): string {
  return graphDocument(
    [
      {
        id: 'sample',
        type: 'texture/sample-texture-2d',
        position: { x: 200, y: 40 },
        inputValues: assetId === null ? {} : { texture: { type: 'texture', assetId } },
      },
    ],
    [{ id: 'sample-to-base', from: ['sample', 'rgb'], to: ['master', 'baseColor'] }],
  )
}

const TIME_NODE: SeedNode = { id: 'time', type: 'input/time', position: { x: 0, y: 100 } }
const SINE_NODE: SeedNode = { id: 'sine', type: 'math/sin', position: { x: 300, y: 100 } }

/** A Time node and a Sine node with nothing connected. */
export const TIME_AND_SINE = graphDocument([TIME_NODE, SINE_NODE], [])

/** Time feeding Sine's input: two nodes joined by one edge, apart from the master. */
export const TIME_TO_SINE = graphDocument(
  [TIME_NODE, SINE_NODE],
  [{ id: 'time-to-sine', from: ['time', 'out'], to: ['sine', 'in'] }],
)

/** Writes `rawText` to the autosave key before any page script runs. */
export async function seedAutosave(page: Page, rawText: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value)
    },
    [AUTOSAVE_KEY, rawText] as const,
  )
}

/** sessionStorage flag that marks the tab as seeded; it survives reloads, unlike page state. */
const SEEDED_FLAG = 'nudo-tsl:e2e-seeded'

/**
 * Like `seedAutosave`, but only on the first load of the tab: a reload keeps what the editor
 * saved since, so a test can check that an edit survives it.
 */
export async function seedAutosaveOnce(page: Page, rawText: string): Promise<void> {
  await page.addInitScript(
    ([key, value, flag]) => {
      if (sessionStorage.getItem(flag) !== null) return
      sessionStorage.setItem(flag, 'true')
      localStorage.setItem(key, value)
    },
    [AUTOSAVE_KEY, rawText, SEEDED_FLAG] as const,
  )
}
