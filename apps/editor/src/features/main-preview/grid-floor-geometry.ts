import { BufferGeometry, Matrix4, PlaneGeometry, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import type { FlatQuad } from './grid-floor-layout'

const QUARTER_TURN = Math.PI / 2
const FLAT = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -QUARTER_TURN)
const UNIT_SCALE = new Vector3(1, 1, 1)
const ROLL_AXIS = new Vector3(0, 0, 1)

/**
 * Bakes thin quads, laid flat at height `lift`, into one static geometry drawn in a single plain
 * call: planes, not lines, so WebGPU and WebGL2 agree. The grid never moves, so it is not
 * instanced: a draw of over a thousand instances keeps a software rasterizer (SwiftShader, as in
 * headless Chrome) busy for the whole frame, which starves the page's main thread.
 */
export function createFlatQuadsGeometry(
  width: number,
  height: number,
  quads: readonly FlatQuad[],
  lift: number,
): BufferGeometry {
  const matrix = new Matrix4()
  const position = new Vector3()
  const rotation = new Quaternion()
  const parts = quads.map((quad) => {
    rotation.setFromAxisAngle(ROLL_AXIS, quad.roll).premultiply(FLAT)
    matrix.compose(position.set(quad.x, lift, quad.z), rotation, UNIT_SCALE)
    return new PlaneGeometry(width, height).applyMatrix4(matrix)
  })
  const merged = mergeGeometries(parts)
  for (const part of parts) part.dispose()
  return merged
}
