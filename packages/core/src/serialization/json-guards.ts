import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import type { ParseError } from './schema-version'

export const ROOT_PATH = '$'

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export const joinPath = (parent: string, key: string | number): string =>
  parent === ROOT_PATH ? String(key) : `${parent}.${String(key)}`

export const invalidShape = (path: string) => err({ code: 'invalid-shape', path } as const)

export function parseJson(text: string): Result<unknown, ParseError> {
  try {
    const parsed: unknown = JSON.parse(text)
    return ok(parsed)
  } catch {
    return err({ code: 'invalid-json' })
  }
}
