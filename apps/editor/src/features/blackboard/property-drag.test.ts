import { asPropertyId } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { carriesProperty, droppedPropertyId, startPropertyDrag } from './property-drag'

/** The part of `DataTransfer` the helpers use, backed by a map. */
function fakeDataTransfer(): Pick<DataTransfer, 'types' | 'getData' | 'setData' | 'effectAllowed'> {
  const data = new Map<string, string>()
  return {
    effectAllowed: 'none',
    get types() {
      return [...data.keys()]
    },
    getData: (format: string) => data.get(format) ?? '',
    setData: (format: string, value: string) => {
      data.set(format, value)
    },
  }
}

describe('property drag data', () => {
  it('carries the property id from the row to the canvas', () => {
    const transfer = fakeDataTransfer()
    startPropertyDrag(transfer, asPropertyId('speed'))

    expect(transfer.effectAllowed).toBe('copy')
    expect(carriesProperty(transfer)).toBe(true)
    expect(droppedPropertyId(transfer)).toBe('speed')
  })

  it('ignores drops that are not properties', () => {
    const transfer = fakeDataTransfer()
    transfer.setData('text/plain', 'hello')

    expect(carriesProperty(transfer)).toBe(false)
    expect(droppedPropertyId(transfer)).toBeNull()
  })
})
