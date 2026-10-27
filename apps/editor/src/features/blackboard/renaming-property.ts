import type { PropertyId } from '@nudo-tsl/core'
import { create } from 'zustand'

interface RenamingState {
  /** The property whose label is being edited in place, if any. */
  propertyId: PropertyId | null
}

/**
 * Which property row shows its inline rename field. Shared because the "+" menu (in the panel
 * header) opens a new property straight into rename mode.
 */
const useRenamingStore = create<RenamingState>(() => ({ propertyId: null }))

export function startRenaming(propertyId: PropertyId): void {
  useRenamingStore.setState({ propertyId })
}

export function stopRenaming(): void {
  useRenamingStore.setState({ propertyId: null })
}

export function useIsRenaming(propertyId: PropertyId): boolean {
  return useRenamingStore((state) => state.propertyId === propertyId)
}
