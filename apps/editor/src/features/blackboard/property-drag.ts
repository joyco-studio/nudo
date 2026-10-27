import { asPropertyId } from '@nudo-tsl/core'
import type { PropertyId } from '@nudo-tsl/core'

/** The drag data a property row carries to the canvas: the property id. */
export const PROPERTY_DRAG_TYPE = 'application/x-nudo-property'

/** What a drag from a property row needs: the subset of `DataTransfer` it touches. */
type DragData = Pick<DataTransfer, 'types' | 'getData' | 'setData' | 'effectAllowed'>

export function startPropertyDrag(dataTransfer: DragData, id: PropertyId): void {
  dataTransfer.setData(PROPERTY_DRAG_TYPE, id)
  dataTransfer.effectAllowed = 'copy'
}

/** Whether a drag comes from a property row (its data is readable only on drop). */
export function carriesProperty(dataTransfer: Pick<DataTransfer, 'types'>): boolean {
  return dataTransfer.types.includes(PROPERTY_DRAG_TYPE)
}

/** The dropped property's id, or null for any other drop. */
export function droppedPropertyId(dataTransfer: Pick<DataTransfer, 'getData'>): PropertyId | null {
  const raw = dataTransfer.getData(PROPERTY_DRAG_TYPE)
  return raw === '' ? null : asPropertyId(raw)
}
