import type { Page } from '@playwright/test'

import { AUTOSAVE_KEY } from './seed-graph'

export interface StoredNode {
  readonly id: string
  readonly type: unknown
  readonly position: unknown
  readonly inputValues: Readonly<Record<string, unknown>>
  readonly params: Readonly<Record<string, unknown>>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toStoredNode(id: string, value: unknown): StoredNode | null {
  if (!isRecord(value)) return null
  const inputValues = isRecord(value.inputValues) ? value.inputValues : {}
  const params = isRecord(value.params) ? value.params : {}
  return { id, type: value.type, position: value.position, inputValues, params }
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

/** Counts the edges of the autosave document in localStorage (zero while nothing is saved). */
export async function readStoredEdgeCount(page: Page): Promise<number> {
  const rawText = await page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY)
  if (rawText === null) return 0
  const document: unknown = JSON.parse(rawText)
  if (!isRecord(document) || !isRecord(document.edges)) return 0
  return Object.keys(document.edges).length
}

export interface StoredProperty {
  readonly id: unknown
  readonly label: unknown
  readonly name: unknown
  readonly exposed: unknown
  readonly value: unknown
}

/** Reads the Blackboard properties of the autosave document (empty while nothing is saved). */
export async function readStoredProperties(page: Page): Promise<readonly StoredProperty[]> {
  const rawText = await page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY)
  if (rawText === null) return []
  const document: unknown = JSON.parse(rawText)
  if (!isRecord(document) || !Array.isArray(document.properties)) return []
  return document.properties.flatMap((value: unknown) =>
    isRecord(value)
      ? [
          {
            id: value.id,
            label: value.label,
            name: value.name,
            exposed: value.exposed,
            value: value.value,
          },
        ]
      : [],
  )
}

/** The schema version of the autosave document in localStorage (null while nothing is saved). */
export async function readStoredSchemaVersion(page: Page): Promise<unknown> {
  const rawText = await page.evaluate((key) => localStorage.getItem(key), AUTOSAVE_KEY)
  if (rawText === null) return null
  const document: unknown = JSON.parse(rawText)
  return isRecord(document) ? document.schemaVersion : null
}
