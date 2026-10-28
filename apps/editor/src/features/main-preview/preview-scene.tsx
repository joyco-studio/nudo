import { OrbitControls } from '@react-three/drei'
import type { RefObject } from 'react'
import type { Group } from 'three'
import type { RuntimeMaterial } from '@nudo-tsl/runtime'

import type { PreviewBackdrop } from '@/features/panels/panel-state'

import { CheckerRoom } from './checker-room'
import { GridFloor } from './grid-floor'
import type { OrbitView } from './orbit-view'
import { PreviewMesh } from './preview-mesh'
import type { PreviewShape } from './preview-shape'
import { useValidatedMaterial } from './use-validated-material'
import type { MaterialStatusHandler } from './use-validated-material'

const SKY_COLOR = '#ffffff'
const GROUND_COLOR = '#6b6b6b'
const FILL_LIGHT_INTENSITY = 1.2
const KEY_LIGHT_POSITION = [3, 4, 5] as const
const KEY_LIGHT_INTENSITY = 2.5
const MIN_ORBIT_DISTANCE = 1.5
const MAX_ORBIT_DISTANCE = 12

export interface PreviewSceneProps {
  /** The newest material that compiled; it is checked against the renderer before it is shown. */
  candidate: RuntimeMaterial | null
  shape: PreviewShape
  model: Group | null
  backgroundColor: string
  backdrop: PreviewBackdrop
  orbitRef: RefObject<OrbitView | null>
  onMaterialStatus: MaterialStatusHandler
}

/** Everything inside the R3F canvas. */
export function PreviewScene({
  candidate,
  shape,
  model,
  backgroundColor,
  backdrop,
  orbitRef,
  onMaterialStatus,
}: PreviewSceneProps) {
  const material = useValidatedMaterial(candidate, onMaterialStatus)

  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <hemisphereLight args={[SKY_COLOR, GROUND_COLOR, FILL_LIGHT_INTENSITY]} />
      <directionalLight position={KEY_LIGHT_POSITION} intensity={KEY_LIGHT_INTENSITY} />
      {backdrop === 'grid' && <GridFloor />}
      {backdrop === 'checker-room' && <CheckerRoom />}
      {material !== null && <PreviewMesh shape={shape} material={material} model={model} />}
      <OrbitControls
        ref={orbitRef}
        makeDefault
        enableDamping
        keyEvents
        minDistance={MIN_ORBIT_DISTANCE}
        maxDistance={MAX_ORBIT_DISTANCE}
      />
    </>
  )
}
