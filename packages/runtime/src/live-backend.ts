import { portKey } from '@nudo-tsl/core'
import type {
  BlackboardProperty,
  CompileBackend,
  PortKey,
  PortValue,
  PropertyId,
  VectorPortValue,
} from '@nudo-tsl/core'
import { Vector2, Vector3, Vector4 } from 'three'
import { Var, float, texture, uniform } from 'three/tsl'
import type { Node, TextureNode, UniformNode } from 'three/webgpu'
import { createLiveFacade } from './live-facade'
import type { LiveNode } from './live-facade'
import { repeatLoop } from './repeat-loop'
import { toShaderName } from './shader-name'
import { createTextureResolver } from './texture-resolution'
import type { MaterialOptions } from './texture-resolution'

export type LiveUniformValue = number | Vector2 | Vector3 | Vector4
export type LiveUniform = UniformNode<unknown, LiveUniformValue>

/** What a Blackboard property compiles to: a uniform, or a texture node for a texture property. */
export type LiveProperty = LiveUniform | TextureNode

export interface LiveBackend extends CompileBackend<LiveNode> {
  readonly uniforms: ReadonlyMap<PortKey, LiveUniform>
  readonly properties: ReadonlyMap<PropertyId, LiveProperty>
  /** Asset ids the material asked for that the resolver could not provide. */
  readonly missingTextures: ReadonlySet<string>
}

function createUniform(value: VectorPortValue): LiveUniform {
  switch (value.type) {
    case 'float':
      return uniform(value.value)
    case 'vec2':
      return uniform(new Vector2(...value.value))
    case 'vec3':
      return uniform(new Vector3(...value.value))
    case 'vec4':
      return uniform(new Vector4(...value.value))
  }
}

/**
 * A Repeat Input's count is a float input, so the compiler only ever hands over a float node; the
 * graph's types are known at runtime, which a type-erased `Node` cannot show.
 */
// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the count input is declared float; see above
const asFloatNode = (node: LiveNode): Node<'float'> => node as Node<'float'>

export function createLiveBackend(options?: MaterialOptions): LiveBackend {
  const uniforms = new Map<PortKey, LiveUniform>()
  const properties = new Map<PropertyId, LiveProperty>()
  const textures = createTextureResolver(options)

  const createProperty = (property: BlackboardProperty): LiveProperty => {
    const value: PortValue = property.value
    const created =
      value.type === 'texture' ? texture(textures.resolve(value.assetId)) : createUniform(value)
    return created.setName(toShaderName(property.name))
  }

  return {
    tsl: createLiveFacade(),
    uniforms,
    properties,
    missingTextures: textures.missing,
    inputValue: (ref, value) => {
      // Texture inputs are not uniforms: a new asset needs the texture node swapped, not written.
      if (value.type === 'texture') return texture(textures.resolve(value.assetId))
      const created = createUniform(value)
      uniforms.set(portKey(ref), created)
      return created
    },
    property: (property) => {
      const created = createProperty(property)
      properties.set(property.id, created)
      return created
    },
    openRepeat: (_node, initial, readsIndex) => {
      const captured: LiveNode[] = []
      const index = readsIndex ? Var(float(0)) : null
      const state = initial.map((value) => Var(value))
      return {
        index,
        state,
        capture: (value) => {
          const declared = Var(value)
          captured.push(declared)
          return declared
        },
        close: (iterations, next) =>
          repeatLoop(asFloatNode(iterations), captured, index, state, next),
      }
    },
  }
}
