import { portKey } from '@nudo-tsl/core'
import type { CompileBackend, PortKey, PortValue } from '@nudo-tsl/core'
import { Vector2, Vector3, Vector4 } from 'three'
import { uniform, vec4 } from 'three/tsl'
import type { UniformNode } from 'three/webgpu'
import { createLiveFacade } from './live-facade'
import type { LiveNode } from './live-facade'

export type LiveUniformValue = number | Vector2 | Vector3 | Vector4
export type LiveUniform = UniformNode<unknown, LiveUniformValue>

export interface LiveBackend extends CompileBackend<LiveNode> {
  readonly uniforms: ReadonlyMap<PortKey, LiveUniform>
}

/** Returns `null` for texture values, which have no uniform representation in phase 1. */
function createUniform(value: PortValue): LiveUniform | null {
  switch (value.type) {
    case 'float':
      return uniform(value.value)
    case 'vec2':
      return uniform(new Vector2(...value.value))
    case 'vec3':
      return uniform(new Vector3(...value.value))
    case 'vec4':
      return uniform(new Vector4(...value.value))
    case 'texture':
      return null
  }
}

export function createLiveBackend(): LiveBackend {
  const uniforms = new Map<PortKey, LiveUniform>()

  return {
    tsl: createLiveFacade(),
    uniforms,
    inputValue: (ref, value) => {
      const created = createUniform(value)
      // Phase 1 has no texture inputs: a texture value compiles to a neutral opaque black.
      if (created === null) return vec4(0, 0, 0, 1)
      uniforms.set(portKey(ref), created)
      return created
    },
    // Replaced in Phase 2 Task 5.
    property: () => {
      throw new Error('not implemented: property')
    },
  }
}
