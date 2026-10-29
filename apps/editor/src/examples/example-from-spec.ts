import type { ExampleSpec } from './build/example-spec'
import type { Example } from './index'
import { spanishComments } from './localize-comments'

/** What an example takes straight from its spec, so the two can't drift apart. */
export type SpecDerived = Pick<Example, 'textures' | 'comments'>

/** The spec's bundled textures, and its comment frames in every language besides English. */
export function fromSpec(spec: ExampleSpec): SpecDerived {
  return { textures: spec.textures ?? [], comments: { es: spanishComments(spec) } }
}
