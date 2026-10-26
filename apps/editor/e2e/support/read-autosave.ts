import type { Page } from '@playwright/test'

import { AUTOSAVE_KEY } from './seed-graph'

export interface StoredNode {
  readonly id: string
  readonly type: unknown
  readonly position: unknown
  readonly inputValues: Readonly<Record<string, unknown>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toStoredNode(id: string, value: unknown): StoredNode | null {
  if (!isRecord(value)) return null
  const inputValues = isRecord(value.inputValues) ? value.inputValues : {}
  return { id, type: value.type, position: value.position, inputValues }
}

/** Reads the nodes of the autosave document in localStorage (empty while nothing is saved). */
export async function readStoredNodes(page: Page): Promise<readonly StoredNode[]> {
  const rawText = await page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY)
  if (rawText === null) return []
  const document: unknown = JSON.parse(rawText)
  if (!isRecord(document) || !isRecord(document.nodes)) return []
  return Object.entries(document.nodes).flatMap(([id, value]) => {
    const node = toStoredNode(id, value)
    return node === null ? [] : [node]
  })
}
