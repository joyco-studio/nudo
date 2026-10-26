import {
  Fn,
  cameraFar,
  cameraNear,
  clamp,
  max,
  perspectiveDepthToViewZ,
  positionView,
  viewportDepthTexture,
} from 'three/tsl'
import type { Node } from 'three/webgpu'

const MIN_FADE_DISTANCE = 0.0001

/**
 * 0 where the surface touches the scene behind it, 1 once the scene is `distance` further away.
 *
 * View-space Z is negative in front of the camera, so geometry further away has a more negative
 * Z. `fragmentZ - sceneZ` is therefore the (positive) gap between this fragment and the opaque
 * scene behind it, and it is 0 at the intersection.
 */
export const sceneDepthFade = Fn(([distance]: [Node<'float'>]) => {
  const sceneViewZ = perspectiveDepthToViewZ(viewportDepthTexture(), cameraNear, cameraFar)
  const gap = positionView.z.sub(sceneViewZ)
  return clamp(gap.div(max(distance, MIN_FADE_DISTANCE)), 0, 1)
})
