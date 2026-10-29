import {
  MASTER_NODE_ID,
  compile,
  isOpacityConnected,
  masterMaterialAssignments,
  outlineMaterialAssignments,
  readInlineOpacity,
  readMasterSettings,
  resolveTransparency,
} from '@nudo-tsl/core'
import type {
  BlackboardProperty,
  CompileError,
  Graph,
  MasterLighting,
  MasterSettings,
  NodeRegistry,
} from '@nudo-tsl/core'
import { createCodeBackend, uniformExpression } from './code-backend'
import { printModule } from './print-module'
import type { MaterialClass, ModulePlan, NamedExpression } from './print-module'
import { isVectorValue } from './literals'

/** The three release the pinned `three` dependency of this repo belongs to (0.186.1). */
const DEFAULT_THREE_VERSION = 'r186'

export interface GenerateOptions {
  /** `r186`, `0.186.1` or `186`; defaults to the release this repo pins. */
  readonly threeVersion?: string
}

export interface GeneratedModule {
  /** The module source; empty when `errors` is not. */
  readonly code: string
  readonly errors: readonly CompileError[]
}

const MATERIAL_CLASSES: Readonly<Record<MasterLighting, MaterialClass>> = {
  standard: 'MeshStandardNodeMaterial',
  unlit: 'MeshBasicNodeMaterial',
  physical: 'MeshPhysicalNodeMaterial',
}

const THREE_RELEASE_PATTERN = /^(?:r|0\.)?(\d+)(?:\.\d+)*$/

/** `0.186.1` and `186` both read `r186`; anything unrecognised is printed as given. */
function formatThreeVersion(version: string): string {
  const release = THREE_RELEASE_PATTERN.exec(version)?.[1]
  return release === undefined ? version : `r${release}`
}

interface PropertyUniforms {
  readonly uniforms: readonly NamedExpression[]
  readonly errors: readonly CompileError[]
}

/**
 * One live uniform per exposed non-texture property, in Blackboard order. A value a shader cannot
 * hold (NaN, infinity) is reported as an error instead of being printed.
 */
function uniformsOf(properties: readonly BlackboardProperty[]): PropertyUniforms {
  const uniforms: NamedExpression[] = []
  const errors: CompileError[] = []
  for (const property of properties) {
    if (!property.exposed || !isVectorValue(property.value)) continue
    try {
      uniforms.push({
        name: property.name,
        expression: uniformExpression(property.value, property.widget),
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      // A property belongs to no node, so the error is reported on the master.
      errors.push({
        nodeId: MASTER_NODE_ID,
        code: 'build-failed',
        message: `Property "${property.name}": ${reason}`,
      })
    }
  }
  return { uniforms, errors }
}

/** Exposed texture properties are always listed; the rest only when the graph reads them. */
function texturePlaceholdersOf(
  properties: readonly BlackboardProperty[],
  read: ReadonlySet<string>,
): readonly string[] {
  const exposed = properties
    .filter((property) => property.exposed && property.value.type === 'texture')
    .map((property) => property.name)
  return [...new Set([...exposed, ...read])]
}

function describeSurface(settings: MasterSettings, transparent: boolean, hasAlphaClip: boolean) {
  return [
    transparent ? 'transparent' : 'opaque',
    settings.twoSided ? 'double-sided' : 'single-sided',
    ...(hasAlphaClip ? ['alpha clip (alphaTestNode)'] : []),
  ]
}

/** Turns the graph's master stack into a readable TSL module. Never throws. */
export function generateModule(
  graph: Graph,
  registry: NodeRegistry,
  options: GenerateOptions = {},
): GeneratedModule {
  const backend = createCodeBackend(graph.properties)
  const result = compile(graph, registry, backend, { kind: 'master' })
  if (!result.ok) return { code: '', errors: result.errors }
  if (result.output.kind !== 'master') {
    const error: CompileError = {
      nodeId: MASTER_NODE_ID,
      code: 'build-failed',
      message: 'Compiler returned no master output',
    }
    return { code: '', errors: [error] }
  }

  const propertyUniforms = uniformsOf(graph.properties)
  if (propertyUniforms.errors.length > 0) return { code: '', errors: propertyUniforms.errors }

  const settings = readMasterSettings(graph, registry)
  const slots = result.output.slots
  const transparent = resolveTransparency({
    surface: settings.surface,
    opacityConnected: isOpacityConnected(graph),
    inlineOpacity: readInlineOpacity(graph, registry),
  })
  const entries = masterMaterialAssignments(backend.tsl, slots, settings)
  const plan: ModulePlan = {
    threeVersion: formatThreeVersion(options.threeVersion ?? DEFAULT_THREE_VERSION),
    materialClass: MATERIAL_CLASSES[settings.lighting],
    surfaceHints: describeSurface(
      settings,
      transparent,
      entries.some((entry) => entry.property === 'alphaTestNode'),
    ),
    uniforms: propertyUniforms.uniforms,
    texturePlaceholders: texturePlaceholdersOf(graph.properties, backend.texturePlaceholders),
    lights: [...backend.lights],
    entries,
    outline: outlineMaterialAssignments(backend.tsl, slots, settings),
    transparent,
    doubleSided: settings.twoSided,
  }
  return { code: printModule(plan), errors: [] }
}
