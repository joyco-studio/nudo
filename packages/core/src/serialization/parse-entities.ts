import type { NodeRegistry } from '../registry/node-registry'
import type { GraphEdge, GraphNode, ParamValue, PortRef, XY } from '../types/graph'
import type { AnyNodeDefinition } from '../types/node-definition'
import { asEdgeId, asNodeId } from '../types/ids'
import { PROPERTY_ID_PARAM } from '../types/param-definition'
import type { PortValue } from '../types/port-value'
import type { Result } from '../types/result'
import { err, ok } from '../types/result'
import { findParamDefinition, isValidParamValue } from '../validation/param-validation'
import { invalidShape, isFiniteNumber, isRecord, joinPath } from './json-guards'
import type { ParseError } from './schema-version'

const isNumberArrayOfLength = (value: unknown, length: number): value is readonly number[] =>
  Array.isArray(value) && value.length === length && value.every(isFiniteNumber)

const isVec2 = (value: unknown): value is readonly [number, number] =>
  isNumberArrayOfLength(value, 2)

const isVec3 = (value: unknown): value is readonly [number, number, number] =>
  isNumberArrayOfLength(value, 3)

const isVec4 = (value: unknown): value is readonly [number, number, number, number] =>
  isNumberArrayOfLength(value, 4)

type ValueParser<T> = (input: unknown, path: string, key: string) => Result<T, ParseError>

/** Parses a JSON object into a record. Built with `fromEntries`, so a `__proto__` key stays plain data. */
export function parseRecord<T>(
  input: unknown,
  path: string,
  parseValue: ValueParser<T>,
): Result<Readonly<Record<string, T>>, ParseError> {
  if (!isRecord(input)) return invalidShape(path)
  const entries: [string, T][] = []
  for (const [key, raw] of Object.entries(input)) {
    const parsed = parseValue(raw, joinPath(path, key), key)
    if (!parsed.ok) return parsed
    entries.push([key, parsed.value])
  }
  return ok(Object.fromEntries(entries))
}

/** Parses a JSON array into a list; item paths use the index (`nodes.0`). */
export function parseList<T>(
  input: unknown,
  path: string,
  parseItem: ValueParser<T>,
): Result<readonly T[], ParseError> {
  if (!Array.isArray(input)) return invalidShape(path)
  const items: T[] = []
  for (const [index, raw] of input.entries()) {
    const parsed = parseItem(raw, joinPath(path, index), String(index))
    if (!parsed.ok) return parsed
    items.push(parsed.value)
  }
  return ok(items)
}

export function parsePortValue(input: unknown, path: string): Result<PortValue, ParseError> {
  if (!isRecord(input)) return invalidShape(path)
  const valuePath = joinPath(path, 'value')
  switch (input.type) {
    case 'float':
      return isFiniteNumber(input.value)
        ? ok({ type: 'float', value: input.value })
        : invalidShape(valuePath)
    case 'vec2':
      return isVec2(input.value)
        ? ok({ type: 'vec2', value: input.value })
        : invalidShape(valuePath)
    case 'vec3':
      return isVec3(input.value)
        ? ok({ type: 'vec3', value: input.value })
        : invalidShape(valuePath)
    case 'vec4':
      return isVec4(input.value)
        ? ok({ type: 'vec4', value: input.value })
        : invalidShape(valuePath)
    case 'texture':
      return input.assetId === null || typeof input.assetId === 'string'
        ? ok({ type: 'texture', assetId: input.assetId })
        : invalidShape(joinPath(path, 'assetId'))
    default:
      return invalidShape(joinPath(path, 'type'))
  }
}

function parseParamValue(input: unknown, path: string): Result<ParamValue, ParseError> {
  if (typeof input === 'string' || typeof input === 'boolean') return ok(input)
  return isFiniteNumber(input) ? ok(input) : invalidShape(path)
}

function parsePosition(input: unknown, path: string): Result<XY, ParseError> {
  if (!isRecord(input)) return invalidShape(path)
  const { x, y } = input
  if (!isFiniteNumber(x)) return invalidShape(joinPath(path, 'x'))
  if (!isFiniteNumber(y)) return invalidShape(joinPath(path, 'y'))
  return ok({ x, y })
}

function parsePortRef(input: unknown, path: string): Result<PortRef, ParseError> {
  if (!isRecord(input)) return invalidShape(path)
  const { nodeId, portId } = input
  if (typeof nodeId !== 'string') return invalidShape(joinPath(path, 'nodeId'))
  if (typeof portId !== 'string') return invalidShape(joinPath(path, 'portId'))
  return ok({ nodeId: asNodeId(nodeId), portId })
}

/** Params must be declared (or universal) and fit their definition; readers need a `propertyId`. */
function validateParams(
  definition: AnyNodeDefinition,
  params: Readonly<Record<string, ParamValue>>,
  path: string,
): Result<void, ParseError> {
  for (const [paramId, value] of Object.entries(params)) {
    const param = findParamDefinition(definition, paramId)
    if (param === undefined || !isValidParamValue(param, value)) {
      return invalidShape(joinPath(path, paramId))
    }
  }
  const isMissingPropertyId =
    definition.reads === 'property' && typeof params[PROPERTY_ID_PARAM] !== 'string'
  return isMissingPropertyId ? invalidShape(joinPath(path, PROPERTY_ID_PARAM)) : ok(undefined)
}

/** Validates the node shape, then that its type is registered. */
export function parseNode(
  input: unknown,
  path: string,
  registry: NodeRegistry,
): Result<GraphNode, ParseError> {
  if (!isRecord(input)) return invalidShape(path)
  const { id, type } = input
  if (typeof id !== 'string') return invalidShape(joinPath(path, 'id'))
  if (typeof type !== 'string') return invalidShape(joinPath(path, 'type'))
  const position = parsePosition(input.position, joinPath(path, 'position'))
  if (!position.ok) return position
  const inputValues = parseRecord(input.inputValues, joinPath(path, 'inputValues'), parsePortValue)
  if (!inputValues.ok) return inputValues
  const params = parseRecord(input.params, joinPath(path, 'params'), parseParamValue)
  if (!params.ok) return params
  const definition = registry.get(type)
  if (definition === undefined) return err({ code: 'unknown-node-type', type })
  const inputIds = new Set(definition.inputs.map((input) => input.id))
  const unknownKey = Object.keys(inputValues.value).find((key) => !inputIds.has(key))
  if (unknownKey !== undefined)
    return invalidShape(joinPath(joinPath(path, 'inputValues'), unknownKey))
  const paramsCheck = validateParams(definition, params.value, joinPath(path, 'params'))
  if (!paramsCheck.ok) return paramsCheck

  return ok({
    id: asNodeId(id),
    type,
    position: position.value,
    inputValues: inputValues.value,
    params: params.value,
  })
}

export function parseEdge(input: unknown, path: string): Result<GraphEdge, ParseError> {
  if (!isRecord(input)) return invalidShape(path)
  const { id } = input
  if (typeof id !== 'string') return invalidShape(joinPath(path, 'id'))
  const from = parsePortRef(input.from, joinPath(path, 'from'))
  if (!from.ok) return from
  const to = parsePortRef(input.to, joinPath(path, 'to'))
  if (!to.ok) return to
  return ok({ id: asEdgeId(id), from: from.value, to: to.value })
}
