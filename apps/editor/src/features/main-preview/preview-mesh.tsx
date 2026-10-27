import { Suspense, useLayoutEffect } from 'react'
import type { Group, Material } from 'three'

import { applyMaterialToModel } from './glb-model'
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
  material: Material
}

function ModelMesh({ model, material }: ModelMeshProps) {
  // Layout effect: the file's own materials are swapped out before the next frame draws them.
  useLayoutEffect(() => {
    applyMaterialToModel(model, material)
  }, [model, material])
  return <primitive object={model} />
}

export interface PreviewMeshProps {
  shape: PreviewShape
  material: Material
  model: Group | null
}

/** The mesh that wears the compiled material. */
export function PreviewMesh({ shape, material, model }: PreviewMeshProps) {
  if (shape === 'model') {
    return model === null ? null : <ModelMesh model={model} material={material} />
  }
  if (shape === 'suzanne') {
    return (
      <Suspense fallback={null}>
        <SuzanneMesh material={material} />
      </Suspense>
    )
  }
  return (
    <mesh material={material}>
      <GeneratedGeometry shape={shape} />
    </mesh>
  )
}
