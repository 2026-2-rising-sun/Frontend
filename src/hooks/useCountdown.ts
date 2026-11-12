import { useEffect, useRef, useState } from 'react'

/**
 * 목표 시각(ISO)까지 남은 시간(ms)을 1초마다 갱신한다. target 이 없으면 null.
 * 0 에 도달하면 onElapsed 를 한 번 호출한다. (서버 기준 시각을 쓰므로 새로고침해도 기한이 연장되지 않는다.)
 */
export function useCountdown(target: string | null, onElapsed?: () => void): number | null {
  const [now, setNow] = useState(() => Date.now())
  const callback = useRef(onElapsed)
  useEffect(() => {
    callback.current = onElapsed
  })

  useEffect(() => {
    if (!target) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [target])

  const remaining = target ? Math.max(0, +new Date(target) - now) : null
  const elapsed = remaining === 0

  useEffect(() => {
    if (elapsed) callback.current?.()
  }, [elapsed])

  return remaining
}

/** 예: 04:09 */
export const formatRemaining = (ms: number) => {
  const total = Math.ceil(ms / 1000)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}
