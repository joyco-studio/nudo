import type { PropertyId } from '../types/ids'

export type PropertyError =
  | { code: 'invalid-name'; name: string }
  | { code: 'duplicate-name'; name: string }
  | { code: 'duplicate-id'; id: PropertyId }
  | { code: 'property-not-found'; id: PropertyId }
  | { code: 'type-mismatch' }
