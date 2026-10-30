import { ok, parseGraph } from '@nudo-tsl/core'
import type { Graph, ParseError, Result } from '@nudo-tsl/core'

import type { PrimitiveShape } from '@/features/main-preview/preview-shape'
import type { Locale } from '@/i18n/locale'
import type { MessageKey } from '@/i18n/translate'
import { registry } from '@/store/registry'

import { BRUSH_TOON } from './build/brush-toon'
import { LAVA_FLOW } from './build/lava-flow'
import { LINES } from './build/lines'
import { PATCH } from './build/patch'
import { POND } from './build/pond'
import { POSTER } from './build/poster'
import {
  INK_SWIRL_SPEC,
  MIDNIGHT_GLAZE_SPEC,
  PASTEL_PLANET_SPEC,
  PEWTER_HAZE_SPEC,
  ROSE_MOON_SPEC,
} from './build/painterly-spheres'
import { SCRIBBLE } from './build/scribble'
import { fromSpec } from './example-from-spec'
import { fixtureExamples } from './fixtures'
import { localizeComments } from './localize-comments'
import type { CommentTexts } from './localize-comments'
import brushToonGraph from './brush-toon.graph.json'
import lavaFlowGraph from './lava-flow.graph.json'
import linesGraph from './lines.graph.json'
import patchGraph from './patch.graph.json'
import pondGraph from './pond.graph.json'
import posterGraph from './poster.graph.json'
import midnightGlazeGraph from './midnight-glaze.graph.json'
import pastelPlanetGraph from './pastel-planet.graph.json'
import pewterHazeGraph from './pewter-haze.graph.json'
import roseMoonGraph from './rose-moon.graph.json'
import inkSwirlGraph from './ink-swirl.graph.json'
import scribbleGraph from './scribble.graph.json'
import type { TemplateTexture } from './template-texture'

/** The templates people see, in the browser and as ⌘K commands. */
export const EXAMPLE_IDS = [
  'pond',
  'poster',
  'lava-flow',
  'lines',
  'scribble',
  'patch',
  'brush-toon',
  'midnight-glaze',
  'pastel-planet',
  'pewter-haze',
  'rose-moon',
  'ink-swirl',
] as const
export type PublishedExampleId = (typeof EXAMPLE_IDS)[number]
/** Templates for the end-to-end tests only: never in a production build, never in ⌘K. */
export const FIXTURE_EXAMPLE_IDS = ['texture-fixture'] as const
export type FixtureExampleId = (typeof FIXTURE_EXAMPLE_IDS)[number]
export type ExampleId = PublishedExampleId | FixtureExampleId

/** What a template is about, as the templates browser lists it under the title. */
export const TEMPLATE_TAGS = [
  'unlit',
  'vertex',
  'noise',
  'voronoi',
  'fresnel',
  'painterly',
] as const
export type TemplateTag = (typeof TEMPLATE_TAGS)[number]

export interface Example {
  readonly id: ExampleId
  /** The example's name in the UI language. */
  readonly title: MessageKey
  /** The `.graph.json` document, validated (and migrated) when it is opened. */
  readonly graph: unknown
  /** The mesh that shows the example best. */
  readonly previewShape: PrimitiveShape
  readonly tags: readonly TemplateTag[]
  /** The images it ships with; opening it stores them and binds its texture slots to them. */
  readonly textures: readonly TemplateTexture[]
  /** What the comment frames say in each language besides English, the one the file stores. */
  readonly comments: Readonly<Partial<Record<Locale, CommentTexts>>>
}

/** The bundled examples, in menu order. Phase 5 turns them into a gallery. */
export const EXAMPLES: readonly Example[] = [
  {
    id: 'pond',
    title: 'example.pond.title',
    graph: pondGraph,
    previewShape: 'plane',
    tags: ['unlit', 'voronoi', 'noise'],
    ...fromSpec(POND),
  },
  {
    id: 'poster',
    title: 'example.poster.title',
    graph: posterGraph,
    previewShape: 'suzanne',
    tags: ['unlit', 'noise', 'fresnel'],
    ...fromSpec(POSTER),
  },
  {
    id: 'lava-flow',
    title: 'example.lava-flow.title',
    graph: lavaFlowGraph,
    previewShape: 'torus',
    tags: ['voronoi', 'noise'],
    ...fromSpec(LAVA_FLOW),
  },
  {
    id: 'lines',
    title: 'example.lines.title',
    graph: linesGraph,
    previewShape: 'knot',
    tags: ['unlit'],
    ...fromSpec(LINES),
  },
  {
    id: 'scribble',
    title: 'example.scribble.title',
    graph: scribbleGraph,
    previewShape: 'suzanne',
    tags: ['unlit', 'noise'],
    ...fromSpec(SCRIBBLE),
  },
  {
    id: 'patch',
    title: 'example.patch.title',
    graph: patchGraph,
    previewShape: 'sphere',
    tags: ['unlit', 'voronoi'],
    ...fromSpec(PATCH),
  },
  {
    id: 'brush-toon',
    title: 'example.brush-toon.title',
    graph: brushToonGraph,
    previewShape: 'sphere',
    tags: ['unlit', 'voronoi', 'noise', 'fresnel'],
    ...fromSpec(BRUSH_TOON),
  },
  {
    id: 'midnight-glaze',
    title: 'example.midnight-glaze.title',
    graph: midnightGlazeGraph,
    previewShape: 'knot',
    tags: ['painterly', 'voronoi', 'noise', 'unlit'],
    ...fromSpec(MIDNIGHT_GLAZE_SPEC),
  },
  {
    id: 'pastel-planet',
    title: 'example.pastel-planet.title',
    graph: pastelPlanetGraph,
    previewShape: 'suzanne',
    tags: ['painterly', 'voronoi', 'noise', 'unlit'],
    ...fromSpec(PASTEL_PLANET_SPEC),
  },
  {
    id: 'pewter-haze',
    title: 'example.pewter-haze.title',
    graph: pewterHazeGraph,
    previewShape: 'knot',
    tags: ['painterly', 'voronoi', 'noise', 'unlit'],
    ...fromSpec(PEWTER_HAZE_SPEC),
  },
  {
    id: 'rose-moon',
    title: 'example.rose-moon.title',
    graph: roseMoonGraph,
    previewShape: 'suzanne',
    tags: ['painterly', 'voronoi', 'noise', 'unlit'],
    ...fromSpec(ROSE_MOON_SPEC),
  },
  {
    id: 'ink-swirl',
    title: 'example.ink-swirl.title',
    graph: inkSwirlGraph,
    previewShape: 'torus',
    tags: ['painterly', 'voronoi', 'noise', 'unlit'],
    ...fromSpec(INK_SWIRL_SPEC),
  },
]

/** The page's query parameter that lists the fixtures in the browser (dev server only). */
export const TEMPLATE_FIXTURES_QUERY = 'template-fixtures'

let listed: readonly Example[] | null = null

/**
 * The templates the browser lists: the published ones and, on the dev server opened with
 * `?template-fixtures`, the test fixtures after them.
 */
export function listedExamples(): readonly Example[] {
  // A production build has no fixtures: `import.meta.env.DEV` is false there, so the fixtures
  // module is never called and drops out of the bundle with the files it names.
  if (!import.meta.env.DEV) return EXAMPLES
  // Read once: the page's address doesn't change while the editor runs.
  listed ??= new URLSearchParams(window.location.search).has(TEMPLATE_FIXTURES_QUERY)
    ? [...EXAMPLES, ...fixtureExamples()]
    : EXAMPLES
  return listed
}

export function findExample(id: ExampleId): Example | undefined {
  return listedExamples().find((example) => example.id === id)
}

/** The example's graph, with its comment frames in the UI language. */
export function exampleGraph(example: Example, locale: Locale): Result<Graph, ParseError> {
  const parsed = parseGraph(example.graph, registry)
  const comments = example.comments[locale]
  if (!parsed.ok || comments === undefined) return parsed
  return ok(localizeComments(parsed.value, comments))
}
