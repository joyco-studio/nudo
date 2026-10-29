import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PreviewMaterials } from './preview-materials'
import type { MaterialValidation } from './validate-material'
import { useValidatedMaterial } from './use-validated-material'
import type { MaterialStatusHandler } from './use-validated-material'

const mocks = vi.hoisted(() => ({
  validateMaterials: vi.fn(),
  threeState: { gl: {}, scene: {}, camera: {} },
}))

vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: object) => unknown) => select(mocks.threeState),
}))
vi.mock('./validate-material', () => ({ validateMaterials: mocks.validateMaterials }))

type Candidate = PreviewMaterials | null

const surfaceOnly = (): PreviewMaterials => ({
  surface: new MeshStandardNodeMaterial(),
  outline: null,
})

interface HarnessProps {
  candidate: Candidate
  onAccepted: (accepted: Candidate) => void
  onStatus: MaterialStatusHandler
}

function Harness({ candidate, onAccepted, onStatus }: HarnessProps) {
  const accepted = useValidatedMaterial(candidate, onStatus)
  useEffect(() => {
    onAccepted(accepted)
  })
  return null
}

const ACCEPTED: MaterialValidation = { ok: true }

describe('useValidatedMaterial', () => {
  let root: Root
  let accepted: Candidate = null
  const onStatus = vi.fn<MaterialStatusHandler>()

  const show = async (candidate: Candidate): Promise<void> => {
    await act(() => {
      root.render(
        <Harness
          candidate={candidate}
          onAccepted={(next) => {
            accepted = next
          }}
          onStatus={onStatus}
        />,
      )
      return Promise.resolve()
    })
  }

  beforeEach(() => {
    Reflect.set(globalThis, 'IS_REACT_ACT_ENVIRONMENT', true)
    root = createRoot(document.createElement('div'))
    accepted = null
    onStatus.mockReset()
    mocks.validateMaterials.mockReset()
  })

  afterEach(async () => {
    await act(() => {
      root.unmount()
      return Promise.resolve()
    })
  })

  it('shows a candidate once it passes validation', async () => {
    mocks.validateMaterials.mockResolvedValue(ACCEPTED)
    const materials = surfaceOnly()

    await show(materials)

    expect(accepted).toBe(materials)
    expect(onStatus).toHaveBeenLastCalledWith(null)
  })

  it('checks the outline pass along with the surface', async () => {
    mocks.validateMaterials.mockResolvedValue(ACCEPTED)
    const materials = {
      surface: new MeshStandardNodeMaterial(),
      outline: new MeshBasicNodeMaterial(),
    }

    await show(materials)

    expect(mocks.validateMaterials).toHaveBeenCalledWith(
      mocks.threeState.gl,
      mocks.threeState.scene,
      mocks.threeState.camera,
      [materials.surface, materials.outline],
      expect.any(Function),
    )
    expect(accepted).toBe(materials)
  })

  it('frees both passes of materials that were replaced', async () => {
    mocks.validateMaterials.mockResolvedValue(ACCEPTED)
    const first = { surface: new MeshStandardNodeMaterial(), outline: new MeshBasicNodeMaterial() }
    const disposeOutline = vi.spyOn(first.outline, 'dispose')
    await show(first)

    await show(surfaceOnly())

    expect(disposeOutline).toHaveBeenCalledOnce()
  })

  it('keeps the last accepted material and reports why a newer one was rejected', async () => {
    const first = surfaceOnly()
    const second = surfaceOnly()
    mocks.validateMaterials.mockResolvedValueOnce(ACCEPTED)
    await show(first)

    mocks.validateMaterials.mockResolvedValueOnce({
      ok: false,
      rejection: { text: 'shader exploded' },
    })
    await show(second)

    expect(accepted).toBe(first)
    expect(onStatus).toHaveBeenLastCalledWith({ text: 'shader exploded' })
  })

  it('tells a queued validation to skip once its candidate is superseded', async () => {
    const isCancelledChecks: (() => boolean)[] = []
    mocks.validateMaterials.mockImplementation(
      (
        _renderer: unknown,
        _scene: unknown,
        _camera: unknown,
        _material: unknown,
        isCancelled: () => boolean,
      ) => {
        isCancelledChecks.push(isCancelled)
        return new Promise<MaterialValidation>(() => undefined)
      },
    )

    await show(surfaceOnly())
    await show(surfaceOnly())

    const [superseded, current] = isCancelledChecks
    expect(superseded?.()).toBe(true)
    expect(current?.()).toBe(false)
  })
})
