import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useThree } from '@react-three/fiber'
import type { MeshStandardNodeMaterial } from 'three/webgpu'

import { validateMaterial } from './validate-material'

/** Called with a message when the newest material was rejected, and with null once one passes. */
export type MaterialStatusHandler = (rejection: string | null) => void

/** Releases GPU resources of materials that are neither shown nor waiting to be validated. */
function useDisposeRetiredMaterials(
  accepted: MeshStandardNodeMaterial | null,
  candidate: MeshStandardNodeMaterial | null,
): void {
  const known = useRef(new Set<MeshStandardNodeMaterial>())

  useEffect(() => {
    const seen = known.current
    for (const material of [accepted, candidate]) {
      if (material !== null) seen.add(material)
    }
    for (const material of seen) {
      if (material === accepted || material === candidate) continue
      material.dispose()
      seen.delete(material)
    }
  }, [accepted, candidate])

  useEffect(() => {
    const seen = known.current
    return () => {
      for (const material of seen) material.dispose()
      seen.clear()
    }
  }, [])
}

/**
 * Holds the last material the renderer could actually build. A new candidate only replaces it once
 * it compiles, so a broken graph never blanks the preview. Must run inside the R3F canvas.
 */
export function useValidatedMaterial(
  candidate: MeshStandardNodeMaterial | null,
  onStatus: MaterialStatusHandler,
): MeshStandardNodeMaterial | null {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)
  const [accepted, setAccepted] = useState<MeshStandardNodeMaterial | null>(null)
  const reportStatus = useEffectEvent(onStatus)

  useDisposeRetiredMaterials(accepted, candidate)

  useEffect(() => {
    if (candidate === null) return
    let isCurrent = true
    void validateMaterial(gl, scene, camera, candidate).then((validation) => {
      if (!isCurrent) return
      if (validation.ok) setAccepted(candidate)
      reportStatus(validation.ok ? null : validation.message)
    })
    return () => {
      isCurrent = false
    }
  }, [candidate, gl, scene, camera])

  return accepted
}
