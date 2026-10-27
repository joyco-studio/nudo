import { useEffect, useState } from 'react'
import { createMaterial } from '@nudo-tsl/runtime'
import type { MaterialBuild, RuntimeMaterial } from '@nudo-tsl/runtime'
import type { Graph } from '@nudo-tsl/core'

import { textureCache } from '@/features/assets/texture-cache'
import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'

import { createCompileScheduler } from './compile-scheduler'
import { recordCompile } from './compile-counter'
import { recordPreviewApply } from './preview-apply-counter'

/** Quiet period after the last structural edit before the graph is compiled again. */
const COMPILE_DEBOUNCE_MS = 150

function buildPreviewMaterial(graph: Graph): MaterialBuild {
  recordCompile()
  // Asking the cache for an asset also starts loading it; the scheduler builds again once it is in.
  return createMaterial(graph, registry, {
    resolveTexture: (assetId) => textureCache.peek(assetId),
  })
}

export interface LiveMaterial {
  /** The newest material that compiled, `null` before the first one. */
  material: RuntimeMaterial | null
  /** True when the latest build failed, so `material` is an older graph's. */
  buildFailed: boolean
}

const NO_MATERIAL_YET: LiveMaterial = { material: null, buildFailed: false }

/** Every build reports its errors to the nodes; only a successful one yields a new material. */
function nextLiveMaterial(current: LiveMaterial, build: MaterialBuild): LiveMaterial {
  return { material: build.material ?? current.material, buildFailed: build.material === null }
}

/**
 * Keeps the editor graph compiled. Inline value edits, and the values a scrub previews before it
 * commits, reach the material in place; structural edits, and a texture asset arriving, compile
 * again after a pause. A failing graph keeps the last good material.
 */
export function useLiveMaterial(): LiveMaterial {
  const [live, setLive] = useState<LiveMaterial>(NO_MATERIAL_YET)

  useEffect(() => {
    const scheduler = createCompileScheduler({
      registry,
      delayMs: COMPILE_DEBOUNCE_MS,
      build: buildPreviewMaterial,
      onBuilt: (build) => {
        useEditorStore.getState().setCompileErrors(build.errors)
        setLive((current) => nextLiveMaterial(current, build))
      },
    })
    scheduler.update(useEditorStore.getState().graph)
    const unsubscribe = useEditorStore.subscribe((state, previousState) => {
      if (state.graph !== previousState.graph) scheduler.update(state.graph)
      const { inputPreview } = state
      if (inputPreview === null || inputPreview === previousState.inputPreview) return
      if (scheduler.previewValue(inputPreview.ref, inputPreview.value) === 'applied') {
        recordPreviewApply()
      }
    })
    const unsubscribeTextures = textureCache.subscribe((assetId, state) => {
      // An asset that turned out missing changes nothing on the material.
      if (state === 'ready') scheduler.textureLoaded(assetId)
    })
    return () => {
      unsubscribe()
      unsubscribeTextures()
      scheduler.dispose()
    }
  }, [])

  return live
}
