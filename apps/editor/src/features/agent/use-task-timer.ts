import { useEffect, useState } from 'react'

const MS_PER_SECOND = 1_000
const SECONDS_PER_MINUTE = 60
const SECONDS_WIDTH = 2

/** "0:14", "12:03": whole minutes and zero-padded seconds, for the chip and the panel header. */
export function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / MS_PER_SECOND))
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE
  return `${String(minutes)}:${String(seconds).padStart(SECONDS_WIDTH, '0')}`
}

/**
 * The time since `startedAt`, formatted, re-rendering once a second while `isRunning`. Stopped, it
 * keeps the value it last showed.
 */
export function useTaskTimer(startedAt: number | null, isRunning: boolean): string {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isRunning) return
    const interval = setInterval(() => {
      setNow(Date.now())
    }, MS_PER_SECOND)
    return () => {
      clearInterval(interval)
    }
  }, [isRunning, startedAt])

  return startedAt === null ? formatElapsed(0) : formatElapsed(now - startedAt)
}
