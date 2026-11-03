import type { Graph } from '@nudo-tsl/core'
import { useEditorStore } from '@/store/editor-store'
import { completeTask } from './task-state'

interface UndoAllState {
  /** The graph as it was when the task began; null when there is nothing to undo. */
  snapshot: Graph | null
  /** The snapshot and every graph an agent write produced. Undo/redo landing on one is not a user edit. */
  agentGraphs: WeakSet<Graph>
  userEditedDuringTask: boolean
  /** How many `markAgentWrite` calls are running; nested calls are allowed. */
  agentWriteDepth: number
}

const state: UndoAllState = {
  snapshot: null,
  agentGraphs: new WeakSet(),
  userEditedDuringTask: false,
  agentWriteDepth: 0,
}

const snapshotListeners = new Set<() => void>()

const notifySnapshotChange = (): void => {
  for (const listener of snapshotListeners) listener()
}

/** Calls `listener` whenever a snapshot is taken or dropped; for `useSyncExternalStore`. */
export function subscribeSnapshot(listener: () => void): () => void {
  snapshotListeners.add(listener)
  return () => {
    snapshotListeners.delete(listener)
  }
}

/** Keeps the graph as it is now, so Undo all can return to it. Starts a new task's tracking. */
export function beginSnapshot(): void {
  const graph = useEditorStore.getState().graph
  state.snapshot = graph
  state.agentGraphs = new WeakSet([graph])
  state.userEditedDuringTask = false
  notifySnapshotChange()
}

/** Forgets the snapshot, so Undo all has nothing to do until the next task begins. */
export function discardSnapshot(): void {
  state.snapshot = null
  state.agentGraphs = new WeakSet()
  state.userEditedDuringTask = false
  notifySnapshotChange()
}

export const hasSnapshot = (): boolean => state.snapshot !== null

export const didUserEditDuringTask = (): boolean => state.userEditedDuringTask

/**
 * Runs an agent store action. The graphs it produces are remembered as the agent's, so neither the
 * write itself nor a later undo/redo back to it is taken for a user edit.
 */
export function markAgentWrite<T>(apply: () => T): T {
  state.agentWriteDepth += 1
  try {
    return apply()
  } finally {
    state.agentWriteDepth -= 1
    state.agentGraphs.add(useEditorStore.getState().graph)
  }
}

function trackGraphChange(graph: Graph): void {
  if (state.agentWriteDepth > 0) {
    state.agentGraphs.add(graph)
    return
  }
  if (state.snapshot === null || state.agentGraphs.has(graph)) return
  state.userEditedDuringTask = true
}

useEditorStore.subscribe((current, previous) => {
  if (current.graph !== previous.graph) trackGraphChange(current.graph)
})

/**
 * Returns the graph to the snapshot as one undo entry, so one Ctrl+Z brings the agent's work back.
 * Asks `confirm` first only when the person edited during the task, since their edits go too.
 * An active task is finished; a stopped one stays stopped, so the agent still has to ask.
 * Resolves whether the graph was restored.
 */
export async function undoAll(confirm: () => Promise<boolean>): Promise<boolean> {
  const snapshot = state.snapshot
  if (snapshot === null) return false
  if (state.userEditedDuringTask && !(await confirm())) return false
  // A new task may have begun while the person was deciding; its snapshot is not this one.
  if (state.snapshot !== snapshot) return false

  const store = useEditorStore.getState()
  markAgentWrite(() => {
    store.replaceGraph(snapshot)
  })
  discardSnapshot()
  const task = useEditorStore.getState().agentTask
  if (task?.status === 'active') store.setAgentTask(completeTask(task, null))
  return true
}
