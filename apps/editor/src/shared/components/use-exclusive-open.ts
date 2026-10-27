import { create } from 'zustand'

interface ExclusiveOpenState {
  /** The one select whose list is open, if any. */
  openId: string | null
  setOpenId: (openId: string | null) => void
}

const useExclusiveOpenStore = create<ExclusiveOpenState>((set) => ({
  openId: null,
  setOpenId: (openId) => {
    set({ openId })
  },
}))

export interface ExclusiveOpen {
  isOpen: boolean
  setOpen: (open: boolean) => void
  /** True while a different select has taken over, so this one must not pull focus back. */
  isReplaced: () => boolean
}

/**
 * One select open at a time. Radix treats a press on a second select as a press inside a newer
 * layer, so the first would stay open; here opening one closes whichever was open.
 */
export function useExclusiveOpen(id: string): ExclusiveOpen {
  const isOpen = useExclusiveOpenStore((state) => state.openId === id)
  return {
    isOpen,
    setOpen: (open) => {
      const { openId, setOpenId } = useExclusiveOpenStore.getState()
      if (open) setOpenId(id)
      else if (openId === id) setOpenId(null)
    },
    isReplaced: () => {
      const { openId } = useExclusiveOpenStore.getState()
      return openId !== null && openId !== id
    },
  }
}
