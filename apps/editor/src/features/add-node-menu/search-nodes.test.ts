import { createDefaultRegistry } from '@nudo-tsl/nodes'
import { describe, expect, it } from 'vitest'

import { searchNodes } from './search-nodes'

const definitions = createDefaultRegistry().list()

function summarize(groups: ReturnType<typeof searchNodes>) {
  return groups.map((group) => ({
    category: group.category,
    types: group.items.map((item) => item.type),
  }))
}

describe('searchNodes', () => {
  it('finds Lerp under interpolation by its "mix" keyword', () => {
    expect(summarize(searchNodes(definitions, 'mix'))).toEqual([
      { category: 'interpolation', types: ['interpolation/lerp'] },
    ])
  })

  it('returns every category except the master, in category order, for an empty query', () => {
    expect(summarize(searchNodes(definitions, ''))).toEqual([
      {
        category: 'input',
        types: ['input/float', 'input/color', 'input/time', 'input/uv', 'input/normal'],
      },
      { category: 'math', types: ['math/add', 'math/multiply', 'math/sin'] },
      { category: 'interpolation', types: ['interpolation/lerp'] },
      { category: 'effects', types: ['effects/fresnel'] },
    ])
  })

  it('matches the label case-insensitively and ignores surrounding spaces', () => {
    expect(summarize(searchNodes(definitions, '  FRES '))).toEqual([
      { category: 'effects', types: ['effects/fresnel'] },
    ])
  })

  it('matches the type id', () => {
    expect(summarize(searchNodes(definitions, 'math/'))).toEqual([
      { category: 'math', types: ['math/add', 'math/multiply', 'math/sin'] },
    ])
  })

  it('never returns the master, even when its keywords match', () => {
    expect(searchNodes(definitions, 'master')).toEqual([])
    expect(searchNodes(definitions, 'output')).toEqual([])
  })

  it('returns no groups when nothing matches', () => {
    expect(searchNodes(definitions, 'zzz-no-such-node')).toEqual([])
  })
})
