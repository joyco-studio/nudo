import { TSL_HELPERS } from './tsl-helpers'

/** Top-level names every module owns. */
const MODULE_EXPORT_NAMES = [
  'uniforms',
  'lights',
  'textures',
  'nodes',
  'materialSettings',
  'outlineNodes',
  'outlineMaterialSettings',
] as const

/** `three` names the module may import, and the neutral texture it declares. */
const THREE_CONSTANT_NAMES = [
  'BackSide',
  'DoubleSide',
  'FrontSide',
  'DataTexture',
  'RGBAFormat',
  'UnsignedByteType',
  'neutralTexture',
] as const

/** Top-level names the helper sources declare besides the helpers themselves. */
const HELPER_INTERNAL_NAMES = [
  'mod289',
  'permute',
  'integerQuotient',
  'taylorInverseSqrt',
  'cellDistance2',
  'cellDistance3',
  'minkowskiDistance2',
  'minkowskiDistance3',
  'keepNearest',
  'searchMinkowski2',
  'searchMinkowski3',
  'scrambledPoint',
  'mixAxes',
] as const

/**
 * Every `three/tsl` export the code facade can print. Node names always end in a counter, so only
 * names that end in a digit could ever collide (`vec3`); the rest are listed for completeness.
 */
export const TSL_IMPORT_NAMES = [
  'abs',
  'cameraPosition',
  'checker',
  'clamp',
  'color',
  'cos',
  'deltaTime',
  'distance',
  'dot',
  'equal',
  'exp',
  'float',
  'floor',
  'fract',
  'fwidth',
  'greaterThan',
  'greaterThanEqual',
  'length',
  'lessThan',
  'lessThanEqual',
  'max',
  'min',
  'mix',
  'modelScale',
  'mx_cell_noise_float',
  'mx_noise_float',
  'mx_worley_noise_vec2',
  'mx_worley_noise_vec3',
  'normalize',
  'normalLocal',
  'normalView',
  'normalWorld',
  'oneMinus',
  'positionLocal',
  'positionView',
  'positionViewDirection',
  'positionWorld',
  'pow',
  'remap',
  'screenUV',
  'select',
  'sin',
  'smoothstep',
  'sRGBTransferEOTF',
  'sRGBTransferOETF',
  'step',
  'texture',
  'time',
  'uniform',
  'uv',
  'vec2',
  'vec3',
  'vec4',
  'viewportSharedTexture',
] as const

/** Names no generated identifier may take. */
export const RESERVED_NAMES: ReadonlySet<string> = new Set<string>([
  ...MODULE_EXPORT_NAMES,
  ...THREE_CONSTANT_NAMES,
  ...HELPER_INTERNAL_NAMES,
  ...TSL_IMPORT_NAMES,
  ...Object.keys(TSL_HELPERS),
  ...Object.values(TSL_HELPERS).flatMap((helper) => helper.imports),
])
