import { useCallback, useEffect, useRef, useState } from 'react'
import { createMaterial } from '@nudo-tsl/runtime'

import { findExample } from '@/examples'
import type { ExampleId } from '@/examples'
import { textureCache } from '@/features/assets/texture-cache'
import {
  disposePreviewMaterials,
  previewMaterialsOf,
} from '@/features/main-preview/preview-materials'
import type { PreviewMaterials } from '@/features/main-preview/preview-materials'
import { registry } from '@/store/registry'

import { templateGraph } from './template-facts'
import { createTemplatePreviewScheduler } from './template-preview-scheduler'
import type { TemplatePreviewScheduler, TemplatePreviewState } from './template-preview-scheduler'

/** Arrowing through the list faster than this compiles only the row it stops on. */
const COMPILE_DEBOUNCE_MS = 150

export type TemplatePreview = TemplatePreviewState<ExampleId, PreviewMaterials>

export interface TemplatePreviewHandle {
  readonly preview: TemplatePreview
  /** The scene took these materials and frees them from now on (see the scheduler's `handOver`). */
  readonly handOver: (materials: PreviewMaterials) => void
}

/**
 * Builds the template's own materials (its outline pass included), apart from the editor graph:
 * the Main Preview, its compile count and the node errors never hear of it.
 */
function compileTemplate(id: ExampleId): PreviewMaterials | null {
  const example = findExample(id)
  const graph = example === undefined ? null : templateGraph(example)
  if (graph === null) return null
  return previewMaterialsOf(
    createMaterial(graph, registry, {
      resolveTexture: (assetId) => textureCache.peek(assetId),
    }),
  )
}

/**
 * The selected template's material, compiled after a short pause. A material the scene never took
 * is released when the browser closes (the hook unmounts); the scene frees the ones it took.
 */
export function useTemplatePreview(id: ExampleId): TemplatePreviewHandle {
  const [preview, setPreview] = useState<TemplatePreview>({ status: 'idle' })
  const schedulerRef = useRef<TemplatePreviewScheduler<ExampleId, PreviewMaterials> | null>(null)

  useEffect(() => {
    const scheduler = createTemplatePreviewScheduler({
      delayMs: COMPILE_DEBOUNCE_MS,
      compile: compileTemplate,
      release: disposePreviewMaterials,
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

  const handOver = useCallback((materials: PreviewMaterials) => {
    schedulerRef.current?.handOver(materials)
  }, [])

  return { preview, handOver }
}
