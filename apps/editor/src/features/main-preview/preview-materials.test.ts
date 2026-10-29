import type { MaterialBuild, OutlineMaterial, RuntimeMaterial } from '@nudo-tsl/runtime'
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import { describe, expect, it, vi } from 'vitest'

import { disposePreviewMaterials, materialsIn, previewMaterialsOf } from './preview-materials'

const buildOf = (
  material: RuntimeMaterial | null,
  outline: OutlineMaterial | null = null,
): MaterialBuild => ({
  material,
  outline,
  uniforms: new Map(),
  properties: new Map(),
  missingTextures: [],
  surface: 'auto',
  errors: [],
})

describe('previewMaterialsOf', () => {
  it('pairs the surface with its outline pass', () => {
    const outline = new MeshBasicNodeMaterial()
    const build = buildOf(new MeshStandardNodeMaterial(), outline)

    expect(previewMaterialsOf(build)).toEqual({ surface: build.material, outline })
  })

  it('has nothing to show for a build that failed', () => {
    expect(previewMaterialsOf(buildOf(null))).toBeNull()
  })
})

describe('materialsIn', () => {
  it('lists the surface, then the outline when there is one', () => {
    const surface = new MeshStandardNodeMaterial()
    const outline = new MeshBasicNodeMaterial()

    expect(materialsIn({ surface, outline: null })).toEqual([surface])
    expect(materialsIn({ surface, outline })).toEqual([surface, outline])
  })
})

describe('disposePreviewMaterials', () => {
  it('frees both passes', () => {
    const surface = new MeshStandardNodeMaterial()
    const outline = new MeshBasicNodeMaterial()
    const disposeSurface = vi.spyOn(surface, 'dispose')
    const disposeOutline = vi.spyOn(outline, 'dispose')

    disposePreviewMaterials({ surface, outline })

    expect(disposeSurface).toHaveBeenCalledOnce()
    expect(disposeOutline).toHaveBeenCalledOnce()
  })
})
