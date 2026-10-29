import { TEXTURE_FIXTURE } from './build/texture-fixture'
import type { Example } from './index'
import { spanishComments } from './localize-comments'
import textureFixtureGraph from './texture-fixture.graph.json'

/**
 * Templates for the end-to-end tests, not for people: `examples/index.ts` loads this module on the
 * dev server only, and the browser lists them only when the page is opened with
 * `?template-fixtures`. They never get ⌘K commands.
 */

/** The smallest template that bundles a texture (the paper grain). */
export function textureFixtureExample(): Example {
  return {
    id: 'texture-fixture',
    title: 'example.texture-fixture.title',
    graph: textureFixtureGraph,
    previewShape: 'plane',
    tags: [],
    textures: TEXTURE_FIXTURE.textures ?? [],
    comments: { es: spanishComments(TEXTURE_FIXTURE) },
  }
}

/**
 * Functions, not constants, so nothing here runs at import: a production build, which never calls
 * them, drops this module whole, with the specs and files it names.
 */
export function fixtureExamples(): readonly Example[] {
  return [textureFixtureExample()]
}
