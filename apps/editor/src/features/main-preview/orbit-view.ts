import type { OrbitControls } from '@react-three/drei'
import type { ComponentRef } from 'react'

/** The orbit controls instance behind the preview camera, for the toolbar to drive. */
export type OrbitView = ComponentRef<typeof OrbitControls>

export const ZOOM_IN_FACTOR = 0.8
export const ZOOM_OUT_FACTOR = 1.25

/** Moves the camera toward (factor < 1) or away from (factor > 1) the orbit target. */
export function zoomView(
  view: Pick<OrbitView, 'object' | 'target' | 'update'>,
  factor: number,
): void {
  const offset = view.object.position.clone().sub(view.target).multiplyScalar(factor)
  view.object.position.copy(view.target).add(offset)
  view.update()
}
