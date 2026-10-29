import { Suspense, useEffect, useLayoutEffect, useMemo } from 'react'
import type { Group } from 'three'

import { applyMaterialToModel, createOutlineCopy } from './glb-model'
import type { PreviewMaterials } from './preview-materials'
import type { PreviewShape } from './preview-shape'
import { createHullGeometry, createPrimitiveGeometry, shapeHasHull } from './primitive-geometry'
import type { GeneratedShape } from './primitive-geometry'
import { SuzanneMesh } from './suzanne-mesh'

interface GeneratedMeshProps {
  shape: GeneratedShape
  materials: PreviewMaterials
}

/**
 * A shape three.js builds in code. The outline pass draws the same buffers again, with smoothed
 * normals so the hull stays closed over hard edges; the plane gets no hull.
 */
function GeneratedMesh({ shape, materials }: GeneratedMeshProps) {
  const geometries = useMemo(() => {
    const surface = createPrimitiveGeometry(shape)
    return { surface, hull: shapeHasHull(shape) ? createHullGeometry(surface) : null }
  }, [shape])
  // The hull shares the surface's buffers, so both go together. Three.js re-uploads a disposed
  // geometry on its next draw, so a Strict Mode remount is safe.
  useEffect(
    () => () => {
      geometries.hull?.dispose()
      geometries.surface.dispose()
    },
    [geometries],
  )
  return (
    <>
      <mesh geometry={geometries.surface} material={materials.surface} />
      {materials.outline !== null && geometries.hull !== null && (
        <mesh geometry={geometries.hull} material={materials.outline} />
      )}
    </>
  )
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
  return <GeneratedMesh shape={shape} materials={materials} />
}
