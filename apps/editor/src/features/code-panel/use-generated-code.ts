import { useSyncExternalStore } from 'react'
import { generateModule } from '@nudo-tsl/codegen'
import type { GeneratedModule } from '@nudo-tsl/codegen'
import type { CompileError, Graph } from '@nudo-tsl/core'

import { useEditorStore } from '@/store/editor-store'
import { registry } from '@/store/registry'

/** A burst of edits (a drag, typing a value) regenerates the module once, this long after the last. */
export const CODE_DEBOUNCE_MS = 150

/** Where the graph comes from: its current value and a way to hear that it changed. */
export interface GraphFeed {
  readonly read: () => Graph
  /** Calls `onChange` whenever the graph is replaced; returns the stop. */
  readonly subscribe: (onChange: () => void) => () => void
}

/** The live module, in the shape `useSyncExternalStore` reads. */
export interface GeneratedCodeSource {
  readonly subscribe: (listener: () => void) => () => void
  readonly getSnapshot: () => GeneratedModule
}

const isSameError = (a: CompileError, b: CompileError | undefined): boolean =>
  b !== undefined && a.nodeId === b.nodeId && a.code === b.code && a.message === b.message

function isSameModule(a: GeneratedModule, b: GeneratedModule): boolean {
  return (
    a.code === b.code &&
    a.errors.length === b.errors.length &&
    a.errors.every((error, index) => isSameError(error, b.errors[index]))
  )
}

interface Generated {
  readonly graph: Graph
  readonly module: GeneratedModule
}

/**
 * One generated module shared by every reader (the code view and the Copy button), regenerated
 * `delayMs` after the graph stops changing. Ephemeral preview values (a scrub, a picker drag) never
 * replace the graph, so they never regenerate. A regeneration that prints the same module (a node
 * moved) keeps the previous snapshot, so nothing re-renders.
 */
export function createGeneratedCodeSource(
  feed: GraphFeed,
  generate: (graph: Graph) => GeneratedModule,
  delayMs: number = CODE_DEBOUNCE_MS,
): GeneratedCodeSource {
  const listeners = new Set<() => void>()
  let current: Generated | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let stopFeed: (() => void) | null = null

  /** Brings the module up to the feed's graph, keeping the old snapshot when it prints the same. */
  const catchUp = (): Generated => {
    const graph = feed.read()
    if (current?.graph === graph) return current
    const module = generate(graph)
    const isUnchanged = current !== null && isSameModule(current.module, module)
    current = { graph, module: isUnchanged && current !== null ? current.module : module }
    return current
  }

  const cancelPending = (): void => {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  const scheduleCatchUp = (): void => {
    cancelPending()
    timer = setTimeout(() => {
      timer = null
      const previous = current?.module
      if (catchUp().module === previous) return
      for (const listener of listeners) listener()
    }, delayMs)
  }

  return {
    subscribe: (listener) => {
      listeners.add(listener)
      if (stopFeed === null) {
        stopFeed = feed.subscribe(scheduleCatchUp)
        // An edit between the first read and this subscription would otherwise wait for the next.
        if (current !== null && current.graph !== feed.read()) scheduleCatchUp()
      }
      return () => {
        listeners.delete(listener)
        if (listeners.size > 0) return
        stopFeed?.()
        stopFeed = null
        cancelPending()
      }
    },
    getSnapshot: () => {
      // With nobody listening nothing tracks the graph: catch up at once rather than show it stale.
      if (current === null || listeners.size === 0) return catchUp().module
      return current.module
    },
  }
}

const editorGraphFeed: GraphFeed = {
  read: () => useEditorStore.getState().graph,
  subscribe: (onChange) =>
    useEditorStore.subscribe((state, previous) => {
      if (state.graph !== previous.graph) onChange()
    }),
}

const editorCodeSource = createGeneratedCodeSource(editorGraphFeed, (graph) =>
  generateModule(graph, registry),
)

/** The editor graph as a TSL module, kept live (debounced) while a component reads it. */
export function useGeneratedCode(): GeneratedModule {
  return useSyncExternalStore(editorCodeSource.subscribe, editorCodeSource.getSnapshot)
}
