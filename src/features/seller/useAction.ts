import { useState } from 'react'
import { ApiError } from '../../domain/errors'

/**
 * 관리 화면의 "저장/전환" 같은 쓰기 동작 하나를 실행한다.
 * - 동시에 두 번 실행되지 않는다(중복 클릭 방지).
 * - 실패하면 ApiError 를 보관해 화면이 안내하고, 성공 여부를 반환한다.
 */
export function useAction() {
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<ApiError | null>(null)

  const run = async (key: string, fn: () => Promise<unknown>): Promise<boolean> => {
    if (busy) return false
    setBusy(key)
    setError(null)
    try {
      await fn()
      return true
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError('UNKNOWN', '요청을 처리하지 못했어요.'))
      return false
    } finally {
      setBusy(null)
    }
  }

  return { busy, error, run, clearError: () => setError(null) }
}
