import { act, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { MeshStandardNodeMaterial } from 'three/webgpu'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { MaterialValidation } from './validate-material'
import { useValidatedMaterial } from './use-validated-material'

const mocks = vi.hoisted(() => ({
  validateMaterial: vi.fn(),
  threeState: { gl: {}, scene: {}, camera: {} },
}))

vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: object) => unknown) => select(mocks.threeState),
}))
vi.mock('./validate-material', () => ({ validateMaterial: mocks.validateMaterial }))

type Candidate = MeshStandardNodeMaterial | null

interface HarnessProps {
  candidate: Candidate
  onAccepted: (accepted: Candidate) => void
  onStatus: (rejection: string | null) => void
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
  const onStatus = vi.fn<(rejection: string | null) => void>()

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
    mocks.validateMaterial.mockReset()
  })

  afterEach(async () => {
    await act(() => {
      root.unmount()
      return Promise.resolve()
    })
  })

  it('shows a candidate once it passes validation', async () => {
    mocks.validateMaterial.mockResolvedValue(ACCEPTED)
    const material = new MeshStandardNodeMaterial()

    await show(material)

    expect(accepted).toBe(material)
    expect(onStatus).toHaveBeenLastCalledWith(null)
  })

  it('keeps the last accepted material and reports why a newer one was rejected', async () => {
    const first = new MeshStandardNodeMaterial()
    const second = new MeshStandardNodeMaterial()
    mocks.validateMaterial.mockResolvedValueOnce(ACCEPTED)
    await show(first)

    mocks.validateMaterial.mockResolvedValueOnce({ ok: false, message: 'shader exploded' })
    await show(second)

    expect(accepted).toBe(first)
    expect(onStatus).toHaveBeenLastCalledWith('shader exploded')
  })

  it('tells a queued validation to skip once its candidate is superseded', async () => {
    const isCancelledChecks: (() => boolean)[] = []
    mocks.validateMaterial.mockImplementation(
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

    await show(new MeshStandardNodeMaterial())
    await show(new MeshStandardNodeMaterial())

    const [superseded, current] = isCancelledChecks
    expect(superseded?.()).toBe(true)
    expect(current?.()).toBe(false)
  })
})
