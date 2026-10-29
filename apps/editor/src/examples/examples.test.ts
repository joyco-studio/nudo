import { describe, expect, it } from 'vitest'

import { templateTexturesIn } from './bind-template-textures'
import { fixtureExamples } from './fixtures'
import { EXAMPLES, exampleGraph } from './index'

describe.each([...EXAMPLES, ...fixtureExamples()].map((example) => [example.id, example] as const))(
  'the %s example',
  (_, example) => {
    it('bundles exactly the textures its graph file names', () => {
      const graph = exampleGraph(example, 'en')
      if (!graph.ok) throw new Error(JSON.stringify(graph.error))

      const bundled = example.textures.map((texture) => texture.id).sort()
      expect([...templateTexturesIn(graph.value)].sort()).toEqual(bundled)
    })
  },
)
