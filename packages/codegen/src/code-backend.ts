import type {
  AnyNodeDefinition,
  BlackboardProperty,
  CompileBackend,
  GraphNode,
  MainLightComponent,
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
  /** The Main Light components the compiled graph reads, each a key of `lights`. */
  readonly lights: ReadonlySet<MainLightComponent>
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

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/
const TRAILING_COUNTER = /\d+$/

/** `value.toVar()`: a var declared where the loop's helper puts it, ahead of the loop. */
const toVar = (value: CodeExpression): CodeExpression => compose(`${value.code}.toVar()`, [value])

/** The base name of a captured value: `normalize1` captures as `normalizeVar1`. */
const capturedBase = (value: CodeExpression): string =>
  IDENTIFIER.test(value.code) ? `${value.code.replace(TRAILING_COUNTER, '')}Var` : 'capturedVar'

const listOf = (expressions: readonly CodeExpression[]): string =>
  `[${expressions.map((expression) => expression.code).join(', ')}]`

/** The suffix that tells the outputs of one node apart; a lone or primary output needs none. */
const outputSuffix = (definition: AnyNodeDefinition, portId: string): string =>
  definition.outputs.length === 1 || portId === PRIMARY_OUTPUT_ID
    ? ''
    : capitalize(portId.replace(/[^A-Za-z0-9]/g, ''))

/**
 * Backend that prints the graph as source. Every node output becomes one named constant, read by
 * whatever consumes it; property readers print as the property itself and reroutes as their input.
 * `properties` are the Blackboard names, kept apart from the generated identifiers.
 */
export function createCodeBackend(properties: readonly BlackboardProperty[]): CodeBackend {
  const names = createNameAllocator(
    new Set([...RESERVED_NAMES, ...properties.map((property) => property.name)]),
  )
  const nodeNames = new Map<NodeId, string>()
  const texturePlaceholders = new Set<string>()
  const lights = new Set<MainLightComponent>()
  const facade = createCodeFacade()

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
    tsl: {
      ...facade,
      mainLight: (component) => {
        lights.add(component)
        return facade.mainLight(component)
      },
    },
    texturePlaceholders,
    lights,
    inputValue: (_ref, value, widget) =>
      isVectorValue(value) ? literalOf(value, isColorWidget(widget)) : inlineTexture(),
    property: (property) => {
      if (property.value.type === 'texture') return textureReader(property.name)
      if (property.exposed) return compose(`${UNIFORMS_OBJECT}.${property.name}`, [])
      return literalOf(property.value, isColorWidget(property.widget))
    },
    openRepeat: (_node, initial, readsIndex) => {
      const declare = (base: string, value: CodeExpression): CodeExpression =>
        referenceTo({ name: names.counted(base), value })
      const captured: CodeExpression[] = []
      const index = readsIndex
        ? declare('repeatIndex', compose('float(0).toVar()', [], { imports: ['float'] }))
        : null
      const state = initial.map((value) => declare('repeatValue', toVar(value)))
      return {
        index,
        state,
        capture: (value) => {
          const declared = declare(capturedBase(value), toVar(value))
          captured.push(declared)
          return declared
        },
        close: (iterations, next) => {
          const call = compose(
            `repeatLoop(${iterations.code}, ${listOf(captured)}, ${index?.code ?? 'null'}, ${listOf(state)}, ${listOf(next)})`,
            [iterations, ...captured, ...(index === null ? [] : [index]), ...state, ...next],
            { helpers: ['repeatLoop'] },
          )
          const results = declare('repeatResults', call)
          return state.map((_, slot) => compose(`${results.code}[${String(slot)}]`, [results]))
        },
      }
    },
    nameOutput: (node, definition, portId, expression) => {
      // A property reader prints as the property itself, and a reroute as what feeds it.
      if (definition.reads === 'property' || definition.passthrough === true) return expression
      const name = `${nodeName(node, definition)}${outputSuffix(definition, portId)}`
      return referenceTo({ name, value: expression })
    },
  }
}
