import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three'
import type { Object3D } from 'three'
import { describe, expect, it } from 'vitest'

import { createOutlineCopy, isMesh } from './glb-model'

function twoMeshModel(): { model: Group; meshes: readonly Mesh[] } {
  const surface = new MeshBasicMaterial()
  const meshes = [new Mesh(new BoxGeometry(), surface), new Mesh(new BoxGeometry(), surface)]
  const scene = new Group()
  scene.add(...meshes)
  scene.position.set(1, 2, 3)
  const model = new Group()
  model.add(scene)
  model.scale.setScalar(0.5)
  return { model, meshes }
}

function meshesOf(root: Object3D): Mesh[] {
  const found: Mesh[] = []
  root.traverse((object) => {
    if (isMesh(object)) found.push(object)
  })
  return found
}

describe('createOutlineCopy', () => {
  it('puts the outline on a copy of every mesh, sharing the geometry and the transforms', () => {
    const { model, meshes } = twoMeshModel()
    const outline = new MeshBasicMaterial()

    const copy = createOutlineCopy(model, outline)
    const copied = meshesOf(copy)

    expect(copy).not.toBe(model)
    expect(copy.scale.x).toBe(0.5)
    expect(copied.map((mesh) => mesh.geometry)).toEqual(meshes.map((mesh) => mesh.geometry))
    expect(copied.every((mesh) => mesh.material === outline)).toBe(true)
    expect(copied.every((mesh) => !meshes.includes(mesh))).toBe(true)
  })

  it('leaves the model wearing its own material', () => {
    const { model, meshes } = twoMeshModel()
    const before = meshes.map((mesh) => mesh.material)

    createOutlineCopy(model, new MeshBasicMaterial())

    expect(meshes.map((mesh) => mesh.material)).toEqual(before)
  })
})
