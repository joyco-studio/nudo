import type {
  AnyNodeDefinition,
  BlackboardProperty,
  CompileBackend,
  GraphNode,
  NodeId,
  VectorPortValue,
} from '@nudo-tsl/core'
import { compose, referenceTo } from './code-expression'
import type { CodeExpression } from './code-expression'
import { createCodeFacade } from './code-facade'
import { formatNumber, isVectorValue, literalOf } from './literals'
import { capitalize, createNameAllocator, toCamelCase } from './naming'
import { RESERVED_NAMES } from './reserved-names'

const TEXTURES_OBJECT = 'textures'
const UNIFORMS_OBJECT = 'uniforms'
const INLINE_TEXTURE_BASE = 'texture'

export interface CodeBackend extends CompileBackend<CodeExpression> {
  /** Keys of `textures` the compiled graph reads (exposed texture properties come on top). Each is a texture node. */
  readonly texturePlaceholders: ReadonlySet<string>
}

const isColorWidget = (widget: string | undefined): boolean => widget === 'color'

/** `uniform(1.5)`, `uniform(vec3(...))` or `uniform(color(0x...))`. */
export function uniformExpression(
  value: VectorPortValue,
  widget: string | undefined,
): CodeExpression {
  // A float uniform takes the bare number: `uniform(1.5)` is already a float.
  if (value.type === 'float') {
    return compose(`uniform(${formatNumber(value.value)})`, [], { imports: ['uniform'] })
  }
  const literal = literalOf(value, isColorWidget(widget))
  return compose(`uniform(${literal.code})`, [literal], { imports: ['uniform'] })
}

const PRIMARY_OUTPUT_ID = 'out'

/** The suffix that tells the outputs of one node apart; a lone or primary output needs none. */
const outputSuffix = (definition: AnyNodeDefinition, portId: string): string =>
  definition.outputs.length === 1 || portId === PRIMARY_OUTPUT_ID
    ? ''
    : capitalize(portId.replace(/[^A-Za-z0-9]/g, ''))

/**
 * Backend that prints the graph as source. Every node output becomes one named constant, read by
 * whatever consumes it; property readers are the exception and print as the property itself.
 * `properties` are the Blackboard names, kept apart from the generated identifiers.
 */
export function createCodeBackend(properties: readonly BlackboardProperty[]): CodeBackend {
  const names = createNameAllocator(
    new Set([...RESERVED_NAMES, ...properties.map((property) => property.name)]),
  )
  const nodeNames = new Map<NodeId, string>()
  const texturePlaceholders = new Set<string>()

  const nodeName = (node: GraphNode, definition: AnyNodeDefinition): string => {
    const known = nodeNames.get(node.id)
    if (known !== undefined) return known
    const created = names.counted(toCamelCase(definition.label))
    nodeNames.set(node.id, created)
    return created
  }

  /** A reader of the `textures` entry `key`: a texture node whose `.value` the user can swap. */
  const textureReader = (key: string): CodeExpression => {
    texturePlaceholders.add(key)
    return compose(`${TEXTURES_OBJECT}.${key}`, [])
  }

  const inlineTexture = (): CodeExpression => textureReader(names.counted(INLINE_TEXTURE_BASE))

  return {
    tsl: createCodeFacade(),
    texturePlaceholders,
    inputValue: (_ref, value, widget) =>
      isVectorValue(value) ? literalOf(value, isColorWidget(widget)) : inlineTexture(),
    property: (property) => {
      if (property.value.type === 'texture') return textureReader(property.name)
      if (property.exposed) return compose(`${UNIFORMS_OBJECT}.${property.name}`, [])
      return literalOf(property.value, isColorWidget(property.widget))
    },
    nameOutput: (node, definition, portId, expression) => {
      if (definition.reads === 'property') return expression
      const name = `${nodeName(node, definition)}${outputSuffix(definition, portId)}`
      return referenceTo({ name, value: expression })
    },
  }
}
