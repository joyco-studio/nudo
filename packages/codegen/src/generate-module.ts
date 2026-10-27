import { MASTER_NODE_ID, compile } from '@nudo-tsl/core'
import type { BlackboardProperty, CompileError, Graph, NodeRegistry } from '@nudo-tsl/core'
import { createCodeBackend, uniformExpression } from './code-backend'
import {
  createNodeEntries,
  materialClassOf,
  readMasterSettings,
  resolveTransparent,
} from './master-output'
import type { MasterSettings } from './master-output'
import { printModule } from './print-module'
import type { ModulePlan, NamedExpression } from './print-module'
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

const THREE_RELEASE_PATTERN = /^(?:r|0\.)?(\d+)(?:\.\d+)*$/

/** `0.186.1` and `186` both read `r186`; anything unrecognised is printed as given. */
function formatThreeVersion(version: string): string {
  const release = THREE_RELEASE_PATTERN.exec(version)?.[1]
  return release === undefined ? version : `r${release}`
}

/** One live uniform per exposed non-texture property, in Blackboard order. */
function uniformsOf(properties: readonly BlackboardProperty[]): readonly NamedExpression[] {
  return properties.flatMap((property) =>
    property.exposed && isVectorValue(property.value)
      ? [{ name: property.name, expression: uniformExpression(property.value, property.widget) }]
      : [],
  )
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

  const settings = readMasterSettings(graph)
  const slots = result.output.slots
  const transparent = resolveTransparent(settings, graph, registry)
  const entries = createNodeEntries(backend.tsl, slots, settings.lighting)
  const plan: ModulePlan = {
    threeVersion: formatThreeVersion(options.threeVersion ?? DEFAULT_THREE_VERSION),
    materialClass: materialClassOf(settings.lighting),
    surfaceHints: describeSurface(
      settings,
      transparent,
      entries.some((entry) => entry.property === 'alphaTestNode'),
    ),
    uniforms: uniformsOf(graph.properties),
    texturePlaceholders: texturePlaceholdersOf(graph.properties, backend.texturePlaceholders),
    entries,
    transparent,
    doubleSided: settings.twoSided,
  }
  return { code: printModule(plan), errors: [] }
}
