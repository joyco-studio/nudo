import { ok, parseGraph } from '@nudo-tsl/core'
import type { Graph, ParseError, Result } from '@nudo-tsl/core'

import type { PrimitiveShape } from '@/features/main-preview/preview-shape'
import type { Locale } from '@/i18n/locale'
import type { MessageKey } from '@/i18n/translate'
import { registry } from '@/store/registry'

import { frameIdOf } from './build/example-spec'
import type { ExampleSpec } from './build/example-spec'
import { IRIDESCENT_BLOB } from './build/iridescent-blob'
import { POND } from './build/pond'
import iridescentBlobGraph from './iridescent-blob.graph.json'
import { localizeComments } from './localize-comments'
import type { CommentTexts } from './localize-comments'
import pondGraph from './pond.graph.json'

export const EXAMPLE_IDS = ['pond', 'iridescent-blob'] as const
export type ExampleId = (typeof EXAMPLE_IDS)[number]

export interface Example {
  readonly id: ExampleId
  /** The example's name in the UI language. */
  readonly title: MessageKey
  /** The `.graph.json` document, validated (and migrated) when it is opened. */
  readonly graph: unknown
  /** The mesh that shows the example best. */
  readonly previewShape: PrimitiveShape
  /** What the comment frames say in each language besides English, the one the file stores. */
  readonly comments: Readonly<Partial<Record<Locale, CommentTexts>>>
}

function spanishComments(spec: ExampleSpec): CommentTexts {
  return Object.fromEntries(spec.groups.map((group) => [frameIdOf(group.id), group.es]))
}

/** The bundled examples, in menu order. Phase 5 turns them into a gallery. */
export const EXAMPLES: readonly Example[] = [
  {
    id: 'pond',
    title: 'example.pond.title',
    graph: pondGraph,
    previewShape: 'plane',
    comments: { es: spanishComments(POND) },
  },
  {
    id: 'iridescent-blob',
    title: 'example.iridescent-blob.title',
    graph: iridescentBlobGraph,
    previewShape: 'knot',
    comments: { es: spanishComments(IRIDESCENT_BLOB) },
  },
]

export function findExample(id: ExampleId): Example | undefined {
  return EXAMPLES.find((example) => example.id === id)
}

/** The example's graph, with its comment frames in the UI language. */
export function exampleGraph(example: Example, locale: Locale): Result<Graph, ParseError> {
  const parsed = parseGraph(example.graph, registry)
  const comments = example.comments[locale]
  if (!parsed.ok || comments === undefined) return parsed
  return ok(localizeComments(parsed.value, comments))
}
