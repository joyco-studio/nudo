import type { BlackboardProperty, Graph, GraphNode, PortValue } from '@nudo-tsl/core'

import { templateTextureIdOf } from './template-texture'

/** Asset ids of a template's stored textures, by template texture id. */
export type TemplateTextureBindings = ReadonlyMap<string, string>

function boundValue(value: PortValue, bindings: TemplateTextureBindings): PortValue {
  if (value.type !== 'texture') return value
  const textureId = templateTextureIdOf(value.assetId)
  const assetId = textureId === null ? undefined : bindings.get(textureId)
  return assetId === undefined ? value : { type: 'texture', assetId }
}

function boundNode(node: GraphNode, bindings: TemplateTextureBindings): GraphNode {
  const inputValues = Object.fromEntries(
    Object.entries(node.inputValues).map(([portId, value]) => [
      portId,
      boundValue(value, bindings),
    ]),
  )
  return { ...node, inputValues }
}

function boundProperty(
  property: BlackboardProperty,
  bindings: TemplateTextureBindings,
): BlackboardProperty {
  return { ...property, value: boundValue(property.value, bindings) }
}

/**
 * The template's graph with every slot and property that names one of its textures pointing at
 * that texture's stored asset instead. A texture with no binding (it did not load) keeps its
 * reference, which no asset has, so its slots read as a missing texture.
 */
export function bindTemplateTextures(graph: Graph, bindings: TemplateTextureBindings): Graph {
  if (bindings.size === 0) return graph
  const nodes = Object.fromEntries(
    Object.entries(graph.nodes).map(([id, node]) => [id, boundNode(node, bindings)]),
  )
  const properties = graph.properties.map((property) => boundProperty(property, bindings))
  return { ...graph, nodes, properties }
}

function textureIdOf(value: PortValue): string | null {
  return value.type === 'texture' ? templateTextureIdOf(value.assetId) : null
}

/** The template textures a graph names, in its inline slots and its properties. */
export function templateTexturesIn(graph: Graph): ReadonlySet<string> {
  const values = [
    ...Object.values(graph.nodes).flatMap((node) => Object.values(node.inputValues)),
    ...graph.properties.map((property) => property.value),
  ]
  return new Set(values.map(textureIdOf).filter((id) => id !== null))
}
