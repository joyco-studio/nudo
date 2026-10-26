import { Fn, dFdx, dFdy, faceDirection, normalView, positionView, vec2 } from 'three/tsl'
import type { Node } from 'three/webgpu'

/**
 * View-space normal from the screen-space derivatives of a procedural height.
 *
 * three's `bumpMap` cannot be reused: it differentiates by re-sampling a texture node at shifted
 * UVs, which an arbitrary float expression does not support. This is the same surface-gradient
 * perturbation (Morten S. Mikkelsen, "Bump Mapping Unparametrized Surfaces on the GPU") that
 * `bumpMap` applies, fed with `dFdx` / `dFdy` of the height instead. The view-position
 * derivatives are left unnormalized so the height reads in view-space units: the slope is the
 * height change per unit of distance, independent of the pixel footprint.
 */
export const normalFromHeight = Fn(([height, strength]: [Node<'float'>, Node<'float'>]) => {
  const heightGradient = vec2(dFdx(height), dFdy(height)).mul(strength)

  const sigmaX = dFdx(positionView)
  const sigmaY = dFdy(positionView)
  const surfaceNormal = normalView

  const crossY = sigmaY.cross(surfaceNormal)
  const crossX = surfaceNormal.cross(sigmaX)

  const determinant = sigmaX.dot(crossY).mul(faceDirection)
  const surfaceGradient = determinant
    .sign()
    .mul(heightGradient.x.mul(crossY).add(heightGradient.y.mul(crossX)))

  return determinant.abs().mul(surfaceNormal).sub(surfaceGradient).normalize()
})
