import type { NodeRegistry } from '../registry/node-registry'
import type { BlackboardProperty } from '../types/blackboard-property'
import { DATA_TYPES } from '../types/data-type'
import type { GraphNode } from '../types/graph'
import { asPropertyId } from '../types/ids'
import { PROPERTY_ID_PARAM } from '../types/param-definition'
import type { Result } from '../types/result'
import { ok } from '../types/result'
import { isValidIdentifier } from '../validation/is-valid-identifier'
import { invalidShape, isRecord, joinPath } from './json-guards'
import { parseList, parsePortValue } from './parse-entities'
import type { ParseError } from './schema-version'

type WidgetResult = Result<BlackboardProperty['widget'], ParseError>

function parseWidget(input: unknown, path: string): WidgetResult {
  if (input === undefined) return ok(undefined)
  return input === 'color' ? ok('color') : invalidShape(path)
}

function parseProperty(input: unknown, path: string): Result<BlackboardProperty, ParseError> {
  if (!isRecord(input)) return invalidShape(path)
  const { id, label, name, exposed } = input
  if (typeof id !== 'string') return invalidShape(joinPath(path, 'id'))
  if (typeof label !== 'string') return invalidShape(joinPath(path, 'label'))
  if (typeof name !== 'string' || !isValidIdentifier(name)) {
    return invalidShape(joinPath(path, 'name'))
  }
  if (typeof exposed !== 'boolean') return invalidShape(joinPath(path, 'exposed'))
  const type = DATA_TYPES.find((candidate) => candidate === input.type)
  if (type === undefined) return invalidShape(joinPath(path, 'type'))
  const widget = parseWidget(input.widget, joinPath(path, 'widget'))
  if (!widget.ok) return widget
  const valuePath = joinPath(path, 'value')
  const value = parsePortValue(input.value, valuePath)
  if (!value.ok) return value
  if (value.value.type !== type) return invalidShape(joinPath(valuePath, 'type'))

  const base = { id: asPropertyId(id), label, name, exposed, type, value: value.value }
  return ok(widget.value === undefined ? base : { ...base, widget: widget.value })
}

/** Rejects a repeated id or reference name; the second occurrence is reported. */
function validateUniqueProperties(
  properties: readonly BlackboardProperty[],
): Result<void, ParseError> {
  const ids = new Set<string>()
  const names = new Set<string>()
  for (const [index, property] of properties.entries()) {
    const path = joinPath('properties', index)
    if (ids.has(property.id)) return invalidShape(joinPath(path, 'id'))
    if (names.has(property.name)) return invalidShape(joinPath(path, 'name'))
    ids.add(property.id)
    names.add(property.name)
  }
  return ok(undefined)
}

export function parseProperties(input: unknown): Result<readonly BlackboardProperty[], ParseError> {
  const properties = parseList(input, 'properties', parseProperty)
  if (!properties.ok) return properties
  const unique = validateUniqueProperties(properties.value)
  return unique.ok ? properties : unique
}

/** Every node that reads a property must point at one that exists in the Blackboard. */
export function validatePropertyReaders(
  nodes: readonly GraphNode[],
  registry: NodeRegistry,
  properties: readonly BlackboardProperty[],
): Result<void, ParseError> {
  const propertyIds = new Set<string>(properties.map((property) => property.id))
  for (const node of nodes) {
    if (registry.get(node.type)?.reads !== 'property') continue
    const propertyId = node.params[PROPERTY_ID_PARAM]
    if (typeof propertyId !== 'string' || !propertyIds.has(propertyId)) {
      return invalidShape(
        joinPath(joinPath(joinPath('nodes', node.id), 'params'), PROPERTY_ID_PARAM),
      )
    }
  }
  return ok(undefined)
}
