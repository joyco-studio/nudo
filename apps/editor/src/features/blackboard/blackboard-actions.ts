import type { PortValue, PropertyError, PropertyId } from '@nudo-tsl/core'

import type { PropertyKind } from './property-kinds'

/** What the Properties panel asks of the editor. The container wires these to the store. */
export interface BlackboardActions {
  /** Adds a property (one history entry). Returns its id, or null when it was not added. */
  addProperty: (kind: PropertyKind) => PropertyId | null
  renameLabel: (id: PropertyId, label: string) => PropertyError | null
  renameReference: (id: PropertyId, name: string) => PropertyError | null
  setExposed: (id: PropertyId, exposed: boolean) => void
  setValue: (id: PropertyId, value: PortValue) => void
  /** Shows a value on the material while it is scrubbed or picked, without committing it. */
  previewValue: (id: PropertyId, value: PortValue) => void
  endPreview: () => void
  /** Removes the property and every node that reads it (one history entry). */
  remove: (id: PropertyId) => void
  /** Adds a reader node at the viewport center and focuses it. */
  addToCanvas: (id: PropertyId) => void
}
