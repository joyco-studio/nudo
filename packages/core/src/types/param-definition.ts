export interface EnumParamOption {
  readonly value: string
  readonly label: string
}

/**
 * Declares one structural setting of a node. Hidden params are editor-managed (not shown in the
 * node body); string and number changes still go through `setParam`.
 */
export type ParamDefinition =
  | {
      readonly id: string
      readonly label: string
      readonly kind: 'enum'
      readonly options: readonly EnumParamOption[]
      readonly default: string
    }
  | {
      readonly id: string
      readonly label: string
      readonly kind: 'boolean'
      readonly default: boolean
    }
  | {
      readonly id: string
      readonly label: string
      readonly kind: 'string'
      readonly default: string
      readonly hidden?: boolean
    }
  | {
      readonly id: string
      readonly label: string
      readonly kind: 'number'
      readonly default: number
      readonly min?: number
      readonly max?: number
      readonly hidden?: boolean
    }

/**
 * Hidden string param through which a node with `reads: 'property'` names its Blackboard property.
 * Reserved: only `reads: 'property'` nodes may declare it, and `removeProperty` relies on that.
 */
export const PROPERTY_ID_PARAM = 'propertyId'

/** Universal param: a collapsed node shows only its connected ports. */
export const COLLAPSED_PARAM = 'collapsed'
/** Universal param that shows or hides a node's preview. */
export const SHOW_PREVIEW_PARAM = 'showPreview'
/** Universal param that forces a node preview to 2D or 3D, or leaves it on `auto`. */
export const PREVIEW_MODE_PARAM = 'previewMode'

/**
 * Editor-managed params every node accepts implicitly. They are never part of `topologyKey`
 * (toggling them never recompiles), and `addNode` does not write them: absence means the default.
 * Their ids (`collapsed`, `showPreview`, `previewMode`) are reserved: a definition that redeclares
 * one is ignored in favor of the universal definition.
 */
export const UNIVERSAL_PARAMS: readonly ParamDefinition[] = [
  { id: COLLAPSED_PARAM, label: 'Collapsed', kind: 'boolean', default: false },
  { id: SHOW_PREVIEW_PARAM, label: 'Show preview', kind: 'boolean', default: true },
  {
    id: PREVIEW_MODE_PARAM,
    label: 'Preview mode',
    kind: 'enum',
    options: [
      { value: 'auto', label: 'Auto' },
      { value: '2d', label: '2D' },
      { value: '3d', label: '3D' },
    ],
    default: 'auto',
  },
]

export const UNIVERSAL_PARAM_IDS: ReadonlySet<string> = new Set(
  UNIVERSAL_PARAMS.map((param) => param.id),
)
