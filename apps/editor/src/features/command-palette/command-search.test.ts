import { describe, expect, it } from 'vitest'

import { PALETTE_COMMANDS } from './command-registry'
import { searchCommands, startsWordsFor, wordsOf } from './command-search'

function idsOf(commands: readonly { readonly id: string }[]): readonly string[] {
  return commands.map((command) => command.id)
}

describe('wordsOf and startsWordsFor', () => {
  it('splits on anything but letters, digits and ?', () => {
    expect(wordsOf('Preview layout: Split')).toEqual(['preview', 'layout', 'split'])
    expect(wordsOf('Ctrl/⌘ ?')).toEqual(['ctrl', '?'])
  })

  it('needs every query word to start a word of the text', () => {
    expect(startsWordsFor('Fit all nodes in view', ['fit', 'vie'])).toBe(true)
    expect(startsWordsFor('Fit all nodes in view', ['it'])).toBe(false)
  })
})

describe('searchCommands', () => {
  it('lists every palette command for an empty query', () => {
    expect(idsOf(searchCommands(PALETTE_COMMANDS, '  '))).toEqual(idsOf(PALETTE_COMMANDS))
  })

  it('puts the split layout first for "split"', () => {
    expect(idsOf(searchCommands(PALETTE_COMMANDS, 'split'))[0]).toBe('preview-split')
  })

  it('matches keywords and every word of the query, ignoring case', () => {
    expect(idsOf(searchCommands(PALETTE_COMMANDS, 'DARK'))).toEqual(['toggle-theme'])
    expect(idsOf(searchCommands(PALETTE_COMMANDS, 'hide code'))).toEqual(['toggle-code'])
  })

  it('matches the start of words, not the middle, and ignores punctuation', () => {
    expect(searchCommands(PALETTE_COMMANDS, 'ide')).toEqual([])
    expect(idsOf(searchCommands(PALETTE_COMMANDS, 'layout: full'))[0]).toBe('preview-full')
  })

  it('returns nothing when no command matches', () => {
    expect(searchCommands(PALETTE_COMMANDS, 'zzz-no-such-command')).toEqual([])
  })
})
