import { asNodeId } from '@nudo-tsl/core'
import { describe, expect, it } from 'vitest'

import { isAnimatedPreview } from '@/features/node-previews/preview-graph'
import { registry } from '@/store/registry'

import { buildExampleGraph } from './build-example-graph'
import { GOD_RAYS } from './god-rays'

describe('God rays particle animation', () => {
  const graph = buildExampleGraph(GOD_RAYS, registry)

  it('keeps particle positions and silhouettes independent of time', () => {
    for (const id of ['dustA', 'dustB', 'motesA', 'motesB', 'phaseA', 'phaseB']) {
      expect(isAnimatedPreview(graph, asNodeId(id)), id).toBe(false)
    }
  })

  it('animates the brightness of both particle layers', () => {
    for (const id of ['fadingMotesA', 'fadingMotesB']) {
      expect(isAnimatedPreview(graph, asNodeId(id)), id).toBe(true)
    }
  })
})
