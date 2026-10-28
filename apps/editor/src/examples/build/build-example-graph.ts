import type { Graph, NodeRegistry } from '@nudo-tsl/core'

import { assembleGraph } from './assemble-graph'
import type { ExampleSpec } from './example-spec'
import { layoutExample } from './layout-example'

/** The example's graph: built with core operations, then framed and laid out like Tidy up. */
export function buildExampleGraph(spec: ExampleSpec, registry: NodeRegistry): Graph {
  return layoutExample(assembleGraph(spec, registry), spec, registry)
}
