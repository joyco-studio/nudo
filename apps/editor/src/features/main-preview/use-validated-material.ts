import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'

import { disposePreviewMaterials, materialsIn } from './preview-materials'
import type { PreviewMaterials } from './preview-materials'
import { validateMaterials } from './validate-material'
import type { MaterialRejection } from './validate-material'

/** Called with the reason when the newest material was rejected, and with null once one passes. */
export type MaterialStatusHandler = (rejection: MaterialRejection | null) => void

/** Releases GPU resources of materials that are neither shown nor waiting to be validated. */
function useDisposeRetiredMaterials(
  accepted: PreviewMaterials | null,
  candidate: PreviewMaterials | null,
): void {
  const known = useRef(new Set<PreviewMaterials>())

  useEffect(() => {
    const seen = known.current
    for (const materials of [accepted, candidate]) {
      if (materials !== null) seen.add(materials)
    }
    for (const materials of seen) {
      if (materials === accepted || materials === candidate) continue
      disposePreviewMaterials(materials)
      seen.delete(materials)
    }
  }, [accepted, candidate])

  useEffect(() => {
    const seen = known.current
    return () => {
      for (const materials of seen) disposePreviewMaterials(materials)
      seen.clear()
    }
  }, [])
}

/**
 * Holds the last materials (a surface and its outline pass) the renderer could actually build. A
 * new candidate only replaces them once both compile, so a broken graph never blanks the preview.
 * Must run inside the R3F canvas.
 */
export function useValidatedMaterial(
  candidate: PreviewMaterials | null,
  onStatus: MaterialStatusHandler,
): PreviewMaterials | null {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const [accepted, setAccepted] = useState<PreviewMaterials | null>(null)
  const reportStatus = useEffectEvent(onStatus)

  useDisposeRetiredMaterials(accepted, candidate)

  useEffect(() => {
    if (candidate === null) return
    let isCurrent = true
    const materials = materialsIn(candidate)
    void validateMaterials(gl, scene, camera, materials, () => !isCurrent).then((validation) => {
      if (!isCurrent) return
      if (validation.ok) setAccepted(candidate)
      reportStatus(validation.ok ? null : validation.rejection)
    })
    return () => {
      isCurrent = false
    }
  }, [candidate, gl, scene, camera])

  return accepted
}
