import { useRef, useState } from 'react'
import type { DragEvent } from 'react'

/** File-only drops leave text, links and the editor's property dragging untouched. */
export function useImageDrop(onFile: (file: File) => void, enabled = true) {
  const [isDropTarget, setIsDropTarget] = useState(false)
  const depth = useRef(0)
  const takes = (event: DragEvent) => enabled && event.dataTransfer.types.includes('Files')
  const claim = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
  }

  return {
    isDropTarget,
    onDragEnter: (event: DragEvent) => {
      if (!takes(event)) return
      claim(event)
      depth.current++
      setIsDropTarget(true)
    },
    onDragOver: (event: DragEvent) => {
      if (!takes(event)) return
      claim(event)
      setIsDropTarget(true)
    },
    onDragLeave: (event: DragEvent) => {
      if (!takes(event)) return
      event.stopPropagation()
      depth.current = Math.max(0, depth.current - 1)
      if (depth.current === 0) setIsDropTarget(false)
    },
    onDrop: (event: DragEvent) => {
      if (!takes(event)) return
      claim(event)
      depth.current = 0
      setIsDropTarget(false)
      const [file] = event.dataTransfer.files
      if (file) onFile(file)
    },
  }
}
