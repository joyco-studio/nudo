import { Box3, Group, Mesh, Texture, Vector3 } from 'three'
import type { Material, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/** Longest side of a loaded model after fitting, so any scale of file frames like the sphere. */
const FITTED_EXTENT = 2

/** Materials that came with the file. The preview's own material is never in this set. */
const importedMaterials = new WeakSet<Material>()

function isTexture(value: unknown): value is Texture {
  return value instanceof Texture
}

function disposeImportedMaterial(material: Material): void {
  if (!importedMaterials.has(material)) return
  for (const value of Object.values(material)) {
    if (isTexture(value)) value.dispose()
  }
  material.dispose()
}

function materialsOf(mesh: Mesh): readonly Material[] {
  return Array.isArray(mesh.material) ? mesh.material : [mesh.material]
}

export function isMesh(object: Object3D): object is Mesh {
  return object instanceof Mesh
}

function forEachMesh(root: Object3D, visit: (mesh: Mesh) => void): void {
  root.traverse((object) => {
    if (isMesh(object)) visit(object)
  })
}

/** Wraps the scene in a group that centers it at the origin and scales it to the fitted extent. */
function fitToPreview(scene: Group): Group {
  const bounds = new Box3().setFromObject(scene)
  const size = bounds.getSize(new Vector3())
  const center = bounds.getCenter(new Vector3())
  const longestSide = Math.max(size.x, size.y, size.z)

  scene.position.sub(center)
  const fitted = new Group()
  fitted.add(scene)
  if (longestSide > 0) fitted.scale.setScalar(FITTED_EXTENT / longestSide)
  return fitted
}

/** Parses a glTF or GLB file. The object URL is revoked as soon as the loader is done with it. */
export async function loadGlbModel(file: File): Promise<Group> {
  const url = URL.createObjectURL(file)
  try {
    const gltf = await new GLTFLoader().loadAsync(url)
    forEachMesh(gltf.scene, (mesh) => {
      for (const material of materialsOf(mesh)) importedMaterials.add(material)
    })
    return fitToPreview(gltf.scene)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Shows `material` on every mesh of the model, releasing the file's own materials. */
export function applyMaterialToModel(model: Object3D, material: Material): void {
  forEachMesh(model, (mesh) => {
    if (mesh.material === material) return
    for (const previous of materialsOf(mesh)) disposeImportedMaterial(previous)
    mesh.material = material
  })
}

function containsMesh(root: Object3D): boolean {
  let found = false
  forEachMesh(root, () => {
    found = true
  })
  return found
}

/** Removes every branch with no mesh in it: the file's lights, cameras and empty nodes. */
function pruneMeshlessBranches(root: Object3D): void {
  for (const child of [...root.children]) {
    if (containsMesh(child)) pruneMeshlessBranches(child)
    else root.remove(child)
  }
}

/**
 * A copy of the model's node tree, with the same transforms and the same geometry (shared, not
 * duplicated), every mesh wearing `outline`. Drawn beside the model, it is the model's outline
 * pass, so it keeps only the branches that hold meshes: a light or camera the file brought would
 * otherwise light or count twice. The model owns the geometry: the copy is never disposed, only
 * dropped.
 */
export function createOutlineCopy(model: Object3D, outline: Material): Object3D {
  const copy = model.clone()
  pruneMeshlessBranches(copy)
  forEachMesh(copy, (mesh) => {
    mesh.material = outline
  })
  return copy
}

/** Frees the model's geometry and whatever is left of the file's own materials. */
export function disposeModel(model: Object3D): void {
  forEachMesh(model, (mesh) => {
    mesh.geometry.dispose()
    for (const material of materialsOf(mesh)) disposeImportedMaterial(material)
  })
}
