import { useLoader } from '@react-three/fiber'
import type { BufferGeometry, Material, Object3D } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

import { isMesh } from './glb-model'
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
  material: Material
}

/**
 * Blender's monkey at subdivision level 2, with normals and UVs, so textures and vertex
 * displacement read on it. Suspends while the file loads; the loader caches it afterwards.
 */
export function SuzanneMesh({ material }: SuzanneMeshProps) {
  const gltf = useLoader(GLTFLoader, suzanneUrl)
  return <mesh geometry={suzanneGeometry(gltf.scene)} material={material} scale={SUZANNE_SCALE} />
}
