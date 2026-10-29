import { templateTexture } from '../template-texture'
import { PAPER_GRAIN } from './bundled-textures'
import type { ExampleSpec } from './example-spec'
import { node } from './example-spec'

/**
 * A test fixture, not a template people see: the smallest graph that bundles a texture. The
 * paper grain, sampled at the mesh UV, is the whole color. The dev server lists it in the
 * templates browser only when the page is opened with `?template-fixtures` (see `examples/index.ts`).
 */
export const TEXTURE_FIXTURE: ExampleSpec = {
  textures: [PAPER_GRAIN],
  properties: [],
  groups: [
    {
      id: 'grain',
      title: 'Paper grain',
      body: 'A bundled texture: opening the template stores it and fills this slot.',
      es: {
        title: 'Grano de papel',
        body: 'Una textura incluida: al abrir la plantilla se guarda y llena este espacio.',
      },
      nodes: [
        node('grain', 'texture/sample-texture-2d', { texture: templateTexture(PAPER_GRAIN.id) }),
      ],
    },
  ],
  wires: [['grain.rgb', 'master.baseColor']],
  master: { params: { lighting: 'unlit' } },
}
