import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { ROOT_PATH, invalidShape, isRecord } from './json-guards'
import { CURRENT_SCHEMA_VERSION } from './schema-version'
import type { ParseError } from './schema-version'

/** Upgrades a document of version `from` to version `from + 1`; `schemaVersion` is stamped by `migrate`. */
export interface Migration {
  readonly from: number
  migrate(input: Readonly<Record<string, unknown>>): Record<string, unknown>
}

const isVersion = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

/** Applies migrations one version at a time until the document reaches the current version. */
export function migrate(
  input: unknown,
  migrations: readonly Migration[],
): Result<Record<string, unknown>, ParseError> {
  if (!isRecord(input)) return invalidShape(ROOT_PATH)
  const startVersion = input.schemaVersion
  if (!isVersion(startVersion)) return invalidShape('schemaVersion')
  if (startVersion > CURRENT_SCHEMA_VERSION) {
    return err({ code: 'unsupported-version', version: startVersion })
  }

  let document: Record<string, unknown> = { ...input }
  for (let version = startVersion; version < CURRENT_SCHEMA_VERSION; version += 1) {
    const step = migrations.find((candidate) => candidate.from === version)
    if (step === undefined) return err({ code: 'unsupported-version', version })
    try {
      document = { ...step.migrate(document), schemaVersion: version + 1 }
    } catch {
      return invalidShape('schemaVersion')
    }
  }
  return ok(document)
}
