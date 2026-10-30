import { OrbitControls } from '@react-three/drei'
import type { RefObject } from 'react'
import type { Group } from 'three'

import type {
  PreviewBackdrop,
  PreviewEnvironment,
  PreviewToneMapping,
} from '@/features/panels/panel-state'

import { CheckerRoom } from './checker-room'
import { GridFloor } from './grid-floor'
import { KEY_LIGHT_INTENSITY, KEY_LIGHT_POSITION } from './key-light'
import type { OrbitView } from './orbit-view'
import { PreviewLook } from './preview-look'
import { PreviewMesh } from './preview-mesh'
import type { PreviewMaterials } from './preview-materials'
import type { PreviewShape } from './preview-shape'
import { useValidatedMaterial } from './use-validated-material'
import type { MaterialStatusHandler } from './use-validated-material'

const SKY_COLOR = '#ffffff'
const GROUND_COLOR = '#6b6b6b'
/**
 * The sky-and-ground fill that stands in for an environment when there is none. With an
 * environment, the environment is the fill, and lighting both would double the shadow side.
 */
const FILL_LIGHT_INTENSITY = 1.2
const MIN_ORBIT_DISTANCE = 1.5
const MAX_ORBIT_DISTANCE = 12

export interface PreviewSceneProps {
  /** The newest materials that compiled; they are checked against the renderer before shown. */
  candidate: PreviewMaterials | null
  shape: PreviewShape
  model: Group | null
  backgroundColor: string
  backdrop: PreviewBackdrop
  toneMapping: PreviewToneMapping
  exposure: number
  environment: PreviewEnvironment
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
  toneMapping,
  exposure,
  environment,
  orbitRef,
  onMaterialStatus,
}: PreviewSceneProps) {
  const materials = useValidatedMaterial(candidate, onMaterialStatus)

  return (
    <>
      <color attach="background" args={[backgroundColor]} />
      <PreviewLook toneMapping={toneMapping} exposure={exposure} environment={environment} />
      {environment === 'none' && (
        <hemisphereLight args={[SKY_COLOR, GROUND_COLOR, FILL_LIGHT_INTENSITY]} />
      )}
      <directionalLight position={KEY_LIGHT_POSITION} intensity={KEY_LIGHT_INTENSITY} />
      {backdrop === 'grid' && <GridFloor />}
      {backdrop === 'checker-room' && <CheckerRoom />}
      {materials !== null && <PreviewMesh shape={shape} materials={materials} model={model} />}
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
