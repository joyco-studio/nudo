import { DEFAULT_MASTER_SETTINGS, portKey, compile, resolvePortTypes } from '@nudo-tsl/core'
import type { Graph, NodeRegistry, OutputPreview, PortRef } from '@nudo-tsl/core'
import { MeshBasicNodeMaterial } from 'three/webgpu'
import { createLiveBackend } from './live-backend'
import { failedBuild } from './create-material'
import type { MaterialBuild } from './create-material'
import { toPreviewColor, toPreviewValue } from './preview-color'
import type { MaterialOptions } from './texture-resolution'

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

/** The display hint the previewed output's definition declares, if any. */
function previewHintOf(
  graph: Graph,
  registry: NodeRegistry,
  ref: PortRef,
): OutputPreview | undefined {
  const node = graph.nodes[ref.nodeId]
  const definition = node === undefined ? undefined : registry.get(node.type)
  return definition?.outputs.find((output) => output.id === ref.portId)?.preview
}

/**
 * An opaque, unlit material that shows one node output as a color, for per-node previews.
 * Compiling only what the port depends on keeps previews cheap.
 */
export function createPreviewMaterial(
  graph: Graph,
  registry: NodeRegistry,
  ref: PortRef,
  options?: MaterialOptions,
): MaterialBuild {
  const backend = createLiveBackend(options)
  const result = compile(graph, registry, backend, { kind: 'port', ref })
  if (!result.ok) return failedBuild(result.errors)
  if (result.output.kind !== 'port') {
    return failedBuild([
      { nodeId: ref.nodeId, code: 'build-failed', message: 'Compiler returned no port output' },
    ])
  }

  const type = resolvePortTypes(graph, registry).outputs.get(portKey(ref))
  if (type === undefined) {
    return failedBuild([
      {
        nodeId: ref.nodeId,
        code: 'unresolved-type',
        message: `Output ${portKey(ref)} has no type`,
      },
    ])
  }

  try {
    const material = new MeshBasicNodeMaterial()
    const shown = toPreviewValue(
      backend.tsl,
      result.output.expression,
      previewHintOf(graph, registry, ref),
    )
    Object.assign(material, { colorNode: toPreviewColor(backend.tsl, shown, type) })
    return {
      material,
      uniforms: backend.uniforms,
      properties: backend.properties,
      missingTextures: [...backend.missingTextures],
      surface: DEFAULT_MASTER_SETTINGS.surface,
      errors: [],
    }
  } catch (error) {
    return failedBuild([
      { nodeId: ref.nodeId, code: 'build-failed', message: describeError(error) },
    ])
  }
}
