import { useLoader } from '@react-three/fiber'
import type { BufferGeometry, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { isMesh } from './glb-model'
import type { PreviewMaterials } from './preview-materials'
import suzanneUrl from './models/suzanne.glb?url'

/** Name of the mesh inside the bundled file, as Blender exports it. */
const SUZANNE_MESH_NAME = 'Suzanne'
/** The file is about 2.7 units wide; this frames it like the sphere. */
const SUZANNE_SCALE = 0.8

function suzanneGeometry(scene: Object3D): BufferGeometry {
  const object = scene.getObjectByName(SUZANNE_MESH_NAME)
  if (object === undefined || !isMesh(object)) {
    throw new Error(`The bundled Suzanne model has no mesh named "${SUZANNE_MESH_NAME}".`)
  }
  return object.geometry
}

interface SuzanneMeshProps {
  materials: PreviewMaterials
}

/**
 * Blender's monkey at subdivision level 2, with normals and UVs, so textures and vertex
 * displacement read on it; the outline pass, when on, shares its geometry. Suspends while the file
 * loads; the loader caches it afterwards.
 */
export function SuzanneMesh({ materials }: SuzanneMeshProps) {
  const gltf = useLoader(GLTFLoader, suzanneUrl)
  const geometry = suzanneGeometry(gltf.scene)
  return (
    <>
      <mesh geometry={geometry} material={materials.surface} scale={SUZANNE_SCALE} />
      {materials.outline !== null && (
        <mesh geometry={geometry} material={materials.outline} scale={SUZANNE_SCALE} />
      )}
    </>
  )
}
