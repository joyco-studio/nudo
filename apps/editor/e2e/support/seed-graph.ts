import type { Page } from '@playwright/test'

/** Mirrors `AUTOSAVE_KEY` in src/store/autosave.ts. */
export const AUTOSAVE_KEY = 'nudo-tsl:autosave'

type Vector = readonly number[]

interface SeedValue {
  type: 'float' | 'vec2' | 'vec3' | 'vec4'
  value: number | Vector
}

interface SeedNode {
  id: string
  type: string
  position: { x: number; y: number }
  inputValues?: Record<string, SeedValue>
}

interface SeedEdge {
  id: string
  from: [nodeId: string, portId: string]
  to: [nodeId: string, portId: string]
}

export const MASTER_POSITION = { x: 600, y: 0 }

/** Builds the autosave document (schema version 1) the editor restores on start. */
export function graphDocument(nodes: readonly SeedNode[], edges: readonly SeedEdge[]): string {
  const allNodes: SeedNode[] = [
    { id: 'master', type: 'master/stack', position: MASTER_POSITION },
    ...nodes,
  ]
  return JSON.stringify({
    schemaVersion: 1,
    nodes: Object.fromEntries(
      allNodes.map((node) => [
        node.id,
        {
          id: node.id,
          type: node.type,
          position: node.position,
          inputValues: node.inputValues ?? {},
          params: {},
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
    properties: [],
  })
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

/** Writes `rawText` to the autosave key before any page script runs. */
export async function seedAutosave(page: Page, rawText: string): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value)
    },
    [AUTOSAVE_KEY, rawText] as const,
  )
}
