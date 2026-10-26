import type { DataType, VectorType } from '../types/data-type'
import { componentCount } from './widest-type'

export type Conversion = {
  readonly kind: 'splat' | 'truncate' | 'pad'
  readonly from: VectorType
  readonly to: VectorType
}

export type ConversionCheck = { ok: true; conversion: Conversion | null } | { ok: false }

const isVectorType = (type: DataType): type is VectorType => type !== 'texture'

const conversionKind = (from: VectorType, to: VectorType): Conversion['kind'] => {
  if (from === 'float') return 'splat'
  return componentCount(to) < componentCount(from) ? 'truncate' : 'pad'
}

/** Whether a value of type `from` can feed a port of type `to`, and which conversion that implies. */
export const getConversion = (from: DataType, to: DataType): ConversionCheck => {
  if (from === to) return { ok: true, conversion: null }
  if (!isVectorType(from) || !isVectorType(to)) return { ok: false }
  return { ok: true, conversion: { kind: conversionKind(from, to), from, to } }
}
