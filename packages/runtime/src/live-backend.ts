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
import { texture, uniform } from 'three/tsl'
import type { TextureNode, UniformNode } from 'three/webgpu'
import { createLiveFacade } from './live-facade'
import type { LiveNode } from './live-facade'
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

const SHADER_NAME_PREFIX = 'nudo_'

/**
 * The name a property's uniform carries into generated shader code. The prefix keeps a property
 * called `vec3`, `sample` or `fn` clear of shader keywords and built-ins, and `$` (legal in a
 * JS identifier) is not legal in WGSL or GLSL.
 */
const toShaderName = (propertyName: string): string =>
  `${SHADER_NAME_PREFIX}${propertyName.replaceAll('$', '_')}`

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
  }
}
