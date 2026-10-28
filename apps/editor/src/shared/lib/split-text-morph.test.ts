import { describe, expect, it } from 'vitest'

import { splitTextMorph } from './split-text-morph'

describe('splitTextMorph', () => {
  it('keeps the letters both labels share and swaps the rest', () => {
    expect(splitTextMorph('Copy', 'Copied')).toEqual({
      head: 'Cop',
      outgoing: 'y',
      incoming: 'ied',
      tail: '',
    })
    expect(splitTextMorph('Copiar', 'Copiado')).toEqual({
      head: 'Copia',
      outgoing: 'r',
      incoming: 'do',
      tail: '',
    })
  })

  it('keeps a shared ending too, without counting a letter twice', () => {
    expect(splitTextMorph('Check in', 'Checked in')).toEqual({
      head: 'Check',
      outgoing: '',
      incoming: 'ed',
      tail: ' in',
    })
    expect(splitTextMorph('aa', 'aaa')).toEqual({ head: 'aa', outgoing: '', incoming: 'a', tail: '' })
  })

  it('swaps everything when nothing is shared, and nothing when the label is the same', () => {
    expect(splitTextMorph('Done', 'Wait')).toEqual({
      head: '',
      outgoing: 'Done',
      incoming: 'Wait',
      tail: '',
    })
    expect(splitTextMorph('Copy', 'Copy')).toEqual({
      head: 'Copy',
      outgoing: '',
      incoming: '',
      tail: '',
    })
  })
})
