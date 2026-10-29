import type { AnyNodeDefinition, DataType, ParamValue } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'
import {
  PHASE_3_CATALOG_C,
  createDefaultRegistry,
  createRecordingFacade,
  moduloNode,
  posterizeNode,
} from './index'

const CATALOG_C_TYPES = ['math/posterize', 'math/modulo']

const buildWith = (
  definition: AnyNodeDefinition,
  inputs: Readonly<Record<string, string>> = {},
  params: Readonly<Record<string, ParamValue>> = {},
  resolvedTypes: Readonly<Record<string, DataType>> = {},
  property: string | null = null,
): Readonly<Record<string, string>> =>
  definition.build({ tsl: createRecordingFacade(), inputs, resolvedTypes, params, property })

const registry = createDefaultRegistry()

describe('catalog C registration', () => {
  it('catalog-c types registered', () => {
    expect(PHASE_3_CATALOG_C.map((definition) => definition.type)).toEqual(CATALOG_C_TYPES)
    for (const type of CATALOG_C_TYPES) {
      expect(registry.get(type), type).toBeDefined()
    }
  })

  it('every definition has a description and keywords', () => {
    for (const definition of PHASE_3_CATALOG_C) {
      expect(definition.description.trim(), definition.type).not.toBe('')
      expect(definition.keywords.length, definition.type).toBeGreaterThan(0)
    }
  })
})

describe('posterize and modulo', () => {
  it('posterize floors In × Steps back to steps', () => {
    expect(buildWith(posterizeNode, { in: 'x', steps: 's' }).out).toBe('div(floor(mul(x,s)),s)')
  })

  it('modulo is floored, the same on WebGPU and WebGL', () => {
    // WGSL % truncates and GLSL mod floors: A − B × floor(A / B) agrees on both.
    expect(buildWith(moduloNode, { a: 'a', b: 'b' }).out).toBe('sub(a,mul(b,floor(div(a,b))))')
  })
})
