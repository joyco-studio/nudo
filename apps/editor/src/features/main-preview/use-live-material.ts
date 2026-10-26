import { useEffect, useState } from 'react'
import { createMaterial } from '@nudo-tsl/runtime'
import type { MaterialBuild } from '@nudo-tsl/runtime'
import type { Graph } from '@nudo-tsl/core'
import type { MeshStandardNodeMaterial } from 'three/webgpu'

import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'

import { createCompileScheduler } from './compile-scheduler'
import { recordCompile } from './compile-counter'

/** Quiet period after the last structural edit before the graph is compiled again. */
const COMPILE_DEBOUNCE_MS = 150

function buildPreviewMaterial(graph: Graph): MaterialBuild {
  recordCompile()
  return createMaterial(graph, registry)
}

/** Every build reports its errors to the nodes; only a successful one yields a new material. */
function handleBuild(
  build: MaterialBuild,
  onMaterial: (material: MeshStandardNodeMaterial) => void,
) {
  useEditorStore.getState().setCompileErrors(build.errors)
  if (build.material !== null) onMaterial(build.material)
}

/**
 * Keeps the editor graph compiled. Inline value edits reach the material in place; structural
 * edits compile again after a pause. Returns the newest material that compiled, `null` before the
 * first one, so a failing graph keeps showing the last good result.
 */
export function useLiveMaterial(): MeshStandardNodeMaterial | null {
  const [material, setMaterial] = useState<MeshStandardNodeMaterial | null>(null)

  useEffect(() => {
    const scheduler = createCompileScheduler({
      delayMs: COMPILE_DEBOUNCE_MS,
      build: buildPreviewMaterial,
      onBuilt: (build) => {
        handleBuild(build, setMaterial)
      },
    })
    scheduler.update(useEditorStore.getState().graph)
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      if (state.graph !== previousState.graph) scheduler.update(state.graph)
    })
    return () => {
      unsubscribe()
      scheduler.dispose()
    }
  }, [])

  return material
}
