import type { AgentSlice, EditorSliceCreator } from './store-types'

export const createAgentSlice: EditorSliceCreator<AgentSlice> = (set) => ({
  agentConnection: 'off',
  agentTask: null,
  agentPresence: null,
  setAgentConnection: (status) => {
    set({ agentConnection: status })
  },
  setAgentTask: (task) => {
    set({ agentTask: task })
  },
  setAgentPresence: (presence) => {
    set({ agentPresence: presence })
  },
})
