import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

import { setPreviewCapture } from '@/features/agent/capture-preview'

import { createCanvasCapture } from './create-canvas-capture'

/** Lets the agent read the preview while it is mounted; renders nothing. */
export function PreviewCaptureRegistrar() {
  const gl = useThree((state) => state.gl)
  const scene = useThree((state) => state.scene)
  const camera = useThree((state) => state.camera)

  useEffect(() => {
    setPreviewCapture(
      createCanvasCapture(gl.domElement, () => {
        gl.render(scene, camera)
      }),
    )
    return () => {
      setPreviewCapture(null)
    }
  }, [gl, scene, camera])

  return null
}
