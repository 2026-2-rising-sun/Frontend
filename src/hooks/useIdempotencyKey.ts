import { useRef } from 'react'
export function useIdempotencyKey() {
  const last = useRef<{ payload: string; key: string } | null>(null)
  return (payload: unknown) => {
    const value = JSON.stringify(payload)
    if (!last.current || last.current.payload !== value) last.current = { payload: value, key: crypto.randomUUID() }
    return last.current.key
  }
}
