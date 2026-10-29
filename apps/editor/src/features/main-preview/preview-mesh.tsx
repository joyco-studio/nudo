import { Suspense, useLayoutEffect, useMemo } from 'react'
import type { Group } from 'three'

import { applyMaterialToModel, createOutlineCopy } from './glb-model'
import type { PreviewMaterials } from './preview-materials'
import type { PreviewShape, PrimitiveShape } from './preview-shape'
import { SuzanneMesh } from './suzanne-mesh'

/** Shapes three.js can build in code; the rest load from a file. */
type GeneratedShape = Exclude<PrimitiveShape, 'suzanne'>

/** Segment counts are high enough that vertex-displacement nodes have something to move. */
const SPHERE_ARGS = [1, 96, 48] as const
const CUBE_ARGS = [1.5, 1.5, 1.5, 24, 24, 24] as const
const PLANE_ARGS = [2.4, 2.4, 96, 96] as const
const TORUS_ARGS = [0.85, 0.35, 64, 128] as const
/** A (2,3) trefoil: curvature and self-occlusion change everywhere, so shading reads at every angle. */
const KNOT_ARGS = [0.6, 0.2, 256, 48, 2, 3] as const

function GeneratedGeometry({ shape }: { shape: GeneratedShape }) {
  switch (shape) {
    case 'sphere':
      return <sphereGeometry args={SPHERE_ARGS} />
    case 'cube':
      return <boxGeometry args={CUBE_ARGS} />
    case 'plane':
      return <planeGeometry args={PLANE_ARGS} />
    case 'torus':
      return <torusGeometry args={TORUS_ARGS} />
    case 'knot':
      return <torusKnotGeometry args={KNOT_ARGS} />
  }
}

interface ModelMeshProps {
  model: Group
  materials: PreviewMaterials
}

/** The model's meshes wear the surface; a copy on the same geometry wears the outline. */
function ModelMesh({ model, materials }: ModelMeshProps) {
  const { surface, outline } = materials
  // Layout effect: the file's own materials are swapped out before the next frame draws them.
  useLayoutEffect(() => {
    applyMaterialToModel(model, surface)
  }, [model, surface])
  const outlineCopy = useMemo(
    () => (outline === null ? null : createOutlineCopy(model, outline)),
    [model, outline],
  )
  return (
    <>
      <primitive object={model} />
      {outlineCopy !== null && <primitive object={outlineCopy} />}
    </>
  )
}

export interface PreviewMeshProps {
  shape: PreviewShape
  materials: PreviewMaterials
  model: Group | null
}

/** The mesh that wears the compiled material, drawn again with the outline pass when it is on. */
export function PreviewMesh({ shape, materials, model }: PreviewMeshProps) {
  if (shape === 'model') {
    return model === null ? null : <ModelMesh model={model} materials={materials} />
  }
  if (shape === 'suzanne') {
    return (
      <Suspense fallback={null}>
        <SuzanneMesh materials={materials} />
      </Suspense>
    )
  }
  return (
    <>
      <mesh material={materials.surface}>
        <GeneratedGeometry shape={shape} />
      </mesh>
      {materials.outline !== null && (
        <mesh material={materials.outline}>
          <GeneratedGeometry shape={shape} />
        </mesh>
      )}
    </>
  )
}
