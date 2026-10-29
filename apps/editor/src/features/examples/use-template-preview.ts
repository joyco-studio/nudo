import { useCallback, useEffect, useRef, useState } from 'react'
import { createMaterial } from '@nudo-tsl/runtime'
import type { RuntimeMaterial } from '@nudo-tsl/runtime'

import { findExample } from '@/examples'
import type { ExampleId } from '@/examples'
import { textureCache } from '@/features/assets/texture-cache'
import { registry } from '@/store/registry'

import { templateGraph } from './template-facts'
import { createTemplatePreviewScheduler } from './template-preview-scheduler'
import type { TemplatePreviewScheduler, TemplatePreviewState } from './template-preview-scheduler'

/** Arrowing through the list faster than this compiles only the row it stops on. */
const COMPILE_DEBOUNCE_MS = 150

export type TemplatePreview = TemplatePreviewState<ExampleId, RuntimeMaterial>

export interface TemplatePreviewHandle {
  readonly preview: TemplatePreview
  /** The scene took this material and frees it from now on (see the scheduler's `handOver`). */
  readonly handOver: (material: RuntimeMaterial) => void
}

/**
 * Builds the template's own material, apart from the editor graph: the Main Preview, its compile
 * count and the node errors never hear of it.
 */
function compileTemplate(id: ExampleId): RuntimeMaterial | null {
  const example = findExample(id)
  const graph = example === undefined ? null : templateGraph(example)
  if (graph === null) return null
  return createMaterial(graph, registry, {
    resolveTexture: (assetId) => textureCache.peek(assetId),
  }).material
}

const releaseMaterial = (material: RuntimeMaterial): void => {
  material.dispose()
}

/**
 * The selected template's material, compiled after a short pause. A material the scene never took
 * is released when the browser closes (the hook unmounts); the scene frees the ones it took.
 */
export function useTemplatePreview(id: ExampleId): TemplatePreviewHandle {
  const [preview, setPreview] = useState<TemplatePreview>({ status: 'idle' })
  const schedulerRef = useRef<TemplatePreviewScheduler<ExampleId, RuntimeMaterial> | null>(null)

  useEffect(() => {
    const scheduler = createTemplatePreviewScheduler({
      delayMs: COMPILE_DEBOUNCE_MS,
      compile: compileTemplate,
      release: releaseMaterial,
      onChange: setPreview,
    })
    schedulerRef.current = scheduler
    return () => {
      scheduler.dispose()
      schedulerRef.current = null
    }
  }, [])

  // Declared after the scheduler's effect, so on mount it selects into the scheduler just made.
  useEffect(() => {
    schedulerRef.current?.select(id)
  }, [id])

  const handOver = useCallback((material: RuntimeMaterial) => {
    schedulerRef.current?.handOver(material)
  }, [])

  return { preview, handOver }
}
