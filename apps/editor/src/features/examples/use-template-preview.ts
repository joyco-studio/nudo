import { useEffect, useRef, useState } from 'react'
import { createMaterial } from '@nudo-tsl/runtime'
import type { RuntimeMaterial } from '@nudo-tsl/runtime'

import { exampleGraph, findExample } from '@/examples'
import type { ExampleId } from '@/examples'
import { textureCache } from '@/features/assets/texture-cache'
import { registry } from '@/store/registry'

import { createTemplatePreviewScheduler } from './template-preview-scheduler'
import type { TemplatePreviewScheduler, TemplatePreviewState } from './template-preview-scheduler'

/** Arrowing through the list faster than this compiles only the row it stops on. */
const COMPILE_DEBOUNCE_MS = 150

export type TemplatePreview = TemplatePreviewState<ExampleId, RuntimeMaterial>

/**
 * Builds the template's own material, apart from the editor graph: the Main Preview, its compile
 * count and the node errors never hear of it.
 */
function compileTemplate(id: ExampleId): RuntimeMaterial | null {
  const example = findExample(id)
  if (example === undefined) return null
  // The comment words are the only thing the locale changes; a material doesn't read them.
  const graph = exampleGraph(example, 'en')
  if (!graph.ok) return null
  return createMaterial(graph.value, registry, {
    resolveTexture: (assetId) => textureCache.peek(assetId),
  }).material
}

const releaseMaterial = (material: RuntimeMaterial): void => {
  material.dispose()
}

/**
 * The selected template's material, compiled after a short pause. Every material it built is
 * released when the browser closes (the hook unmounts).
 */
export function useTemplatePreview(id: ExampleId): TemplatePreview {
  const [preview, setPreview] = useState<TemplatePreview>({ status: 'idle' })
  const schedulerRef = useRef<TemplatePreviewScheduler<ExampleId> | null>(null)

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

  return preview
}
