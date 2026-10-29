import { MASTER_NODE_ID } from '@nudo-tsl/core'
import type { BlackboardProperty, Graph } from '@nudo-tsl/core'
import { commentNode } from '@nudo-tsl/nodes'

import { exampleGraph } from '@/examples'
import type { Example } from '@/examples'
import { templateTextureIdOf } from '@/examples/template-texture'
import type { TemplateTexture } from '@/examples/template-texture'
import { PROPERTY_KIND_SPECS, propertyKindOf } from '@/features/blackboard/property-kinds'
import { linearToSrgb, srgbToHex } from '@/shared/components/color-picker/color-math'

/** What the templates browser says about a template besides its words. */
export interface TemplateFacts {
  /** Nodes that do the work: the master and the comment frames are not counted. */
  readonly nodeCount: number
  readonly properties: readonly BlackboardProperty[]
}

/** Parsing (and migrating) the pond is not free, and a template never changes: each is read once. */
const graphCache = new WeakMap<Example, Graph | null>()

/**
 * The template's graph, parsed once and kept; null when its document does not parse. Comment
 * words are the only thing a locale changes, and neither the facts nor a material read them.
 */
export function templateGraph(example: Example): Graph | null {
  const cached = graphCache.get(example)
  if (cached !== undefined) return cached
  const parsed = exampleGraph(example, 'en')
  const graph = parsed.ok ? parsed.value : null
  graphCache.set(example, graph)
  return graph
}

/** The template's node count and properties; null when its document does not parse. */
export function templateFacts(example: Example): TemplateFacts | null {
  const graph = templateGraph(example)
  if (graph === null) return null
  const nodeCount = Object.values(graph.nodes).filter(
    (node) => node.id !== MASTER_NODE_ID && node.type !== commentNode.type,
  ).length
  return { nodeCount, properties: graph.properties }
}

/** How a property's value reads in a compact list. */
export type PropertyDisplay =
  | { readonly kind: 'color'; readonly chip: string; readonly hex: string }
  | { readonly kind: 'number'; readonly chip: string; readonly text: string }
  /** `label`: the bundled image the template fills it with; null when it starts empty. */
  | { readonly kind: 'texture'; readonly chip: string; readonly label: string | null }

/** Enough digits to tell values apart in a list, without a long tail of float noise. */
const MAX_FRACTION_DIGITS = 3

const formatNumber = (value: number): string => String(Number(value.toFixed(MAX_FRACTION_DIGITS)))

/** The label of the bundled texture a template's value names, if the template bundles it. */
function bundledTextureLabel(
  assetId: string | null,
  textures: readonly TemplateTexture[],
): string | null {
  const textureId = templateTextureIdOf(assetId)
  return textures.find((texture) => texture.id === textureId)?.label ?? null
}

/** `textures`: the template's bundled images, which its texture properties may start with. */
export function propertyDisplay(
  property: BlackboardProperty,
  textures: readonly TemplateTexture[] = [],
): PropertyDisplay {
  const kind = propertyKindOf(property)
  const { chip } = PROPERTY_KIND_SPECS[kind]
  const { value } = property
  if (value.type === 'texture') {
    return { kind: 'texture', chip, label: bundledTextureLabel(value.assetId, textures) }
  }
  if (kind === 'color' && value.type === 'vec3') {
    return { kind: 'color', chip, hex: srgbToHex(linearToSrgb(value.value)) }
  }
  const channels = value.type === 'float' ? [value.value] : value.value
  return { kind: 'number', chip, text: channels.map(formatNumber).join(', ') }
}
