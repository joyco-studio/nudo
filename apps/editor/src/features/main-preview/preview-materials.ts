import type { MaterialBuild, OutlineMaterial, RuntimeMaterial } from '@nudo-tsl/runtime'

/**
 * What a preview draws a graph with: its surface material, and the outline pass drawn on the same
 * geometry while the master's Outline is on. They come from one build and are shown, checked and
 * freed together.
 */
export interface PreviewMaterials {
  readonly surface: RuntimeMaterial
  readonly outline: OutlineMaterial | null
}

/** The materials a build shows; `null` when the graph did not compile. */
export function previewMaterialsOf(build: MaterialBuild): PreviewMaterials | null {
  return build.material === null ? null : { surface: build.material, outline: build.outline }
}

/** Every material of the set, the surface first. */
export function materialsIn(materials: PreviewMaterials): readonly RuntimeMaterial[] {
  return materials.outline === null ? [materials.surface] : [materials.surface, materials.outline]
}

/** Frees the GPU resources of every material of the set. */
export function disposePreviewMaterials(materials: PreviewMaterials): void {
  for (const material of materialsIn(materials)) material.dispose()
}
