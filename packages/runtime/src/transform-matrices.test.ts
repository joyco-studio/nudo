import { TRANSFORM_MATRICES } from '@nudo-tsl/core'
import type { TransformMatrix, TransformSpace } from '@nudo-tsl/core'
import { Matrix3, Matrix4, Mesh, PerspectiveCamera, Vector3 } from 'three'
import { Node } from 'three/webgpu'
import { describe, expect, it } from 'vitest'
import { createLiveFacade } from './live-facade'

const SPACES: readonly TransformSpace[] = ['world', 'object', 'camera']

/** A turned, unevenly scaled mesh seen by a camera that is moved and turned too. */
function scene() {
  const mesh = new Mesh()
  mesh.position.set(1.5, -2, 0.75)
  mesh.rotation.set(0.4, -1.1, 0.25)
  mesh.scale.set(2, 0.5, 3)
  mesh.updateMatrixWorld()
  const camera = new PerspectiveCamera()
  camera.position.set(-3, 4, 8)
  camera.lookAt(0.5, 0, -1)
  camera.updateMatrixWorld()
  const model = mesh.matrixWorld
  const view = camera.matrixWorldInverse
  const matrices: Readonly<Record<TransformMatrix, Matrix4>> = {
    modelWorldMatrix: model,
    modelWorldMatrixInverse: model.clone().invert(),
    cameraViewMatrix: view,
    cameraWorldMatrix: camera.matrixWorld,
    modelViewMatrix: view.clone().multiply(model),
  }
  /** Where each space's coordinates sit in world space: the ground truth. */
  const toWorld: Readonly<Record<TransformSpace, Matrix4>> = {
    world: new Matrix4(),
    object: model,
    camera: camera.matrixWorld,
  }
  return { matrices, toWorld }
}

const product = (
  matrices: Readonly<Record<TransformMatrix, Matrix4>>,
  chain: readonly TransformMatrix[],
): Matrix4 =>
  chain.reduce((result, name) => result.multiply(matrices[name]), new Matrix4().identity())

const expectClose = (actual: Vector3, expected: Vector3): void => {
  expect(actual.distanceTo(expected)).toBeLessThan(1e-9)
}

describe('TRANSFORM_MATRICES', () => {
  const { matrices, toWorld } = scene()
  const sample = new Vector3(0.3, -1.2, 2.5)

  it.each(SPACES.flatMap((from) => SPACES.map((to) => [from, to] as const)))(
    'moves a point from %s to %s like the scene graph does',
    (from, to) => {
      const expected = sample
        .clone()
        .applyMatrix4(toWorld[from])
        .applyMatrix4(toWorld[to].clone().invert())

      expectClose(
        sample.clone().applyMatrix4(product(matrices, TRANSFORM_MATRICES[from][to])),
        expected,
      )
    },
  )

  it.each(SPACES.flatMap((from) => SPACES.map((to) => [from, to] as const)))(
    'keeps a normal from %s to %s perpendicular to the surface it is carried with',
    (from, to) => {
      const forward = product(matrices, TRANSFORM_MATRICES[from][to])
      const back = product(matrices, TRANSFORM_MATRICES[to][from])
      // Two directions along a surface in the From space, and the normal across it.
      const tangent = new Vector3(1, 0.2, -0.4)
      const bitangent = new Vector3(-0.3, 1, 0.6)
      const normal = tangent.clone().cross(bitangent).normalize()
      const carried = normal
        .clone()
        .applyMatrix3(new Matrix3().setFromMatrix4(back).transpose())
        .normalize()

      for (const direction of [tangent, bitangent]) {
        expect(carried.dot(direction.clone().transformDirection(forward))).toBeCloseTo(0, 9)
      }
      expect(carried.length()).toBeCloseTo(1, 12)
    },
  )

  it('keeps the object scale on a vector, as Blender does', () => {
    // The mesh is 3 units deep along its own Z: one unit along it is 3 in world space.
    const carried = new Vector3(0, 0, 1).applyMatrix4(
      product(matrices, TRANSFORM_MATRICES.object.world).clone().setPosition(0, 0, 0),
    )

    expect(carried.length()).toBeCloseTo(3, 9)
  })
})

describe('live transform', () => {
  const tsl = createLiveFacade()
  const value = tsl.construct('vec3', [1, 2, 3])

  it.each(['point', 'vector', 'normal'] as const)(
    'builds a %s for every pair of spaces',
    (kind) => {
      for (const from of SPACES) {
        for (const to of SPACES) {
          const built = tsl.transform(kind, from, to, value)
          expect(built).toBeInstanceOf(Node)
          if (from === to) expect(built).toBe(value)
          else expect(built).not.toBe(value)
        }
      }
    },
  )
})
