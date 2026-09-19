import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../domain/errors'

export interface AsyncState<T> {
  data: T | undefined
  error: ApiError | undefined
  loading: boolean
  /** 같은 요청을 다시 실행한다 (오류 화면의 "다시 시도") */
  reload: () => void
}

const toApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError('UNKNOWN', '알 수 없는 오류가 발생했어요.'))

/**
 * 비동기 조회 훅. deps 가 바뀌면 다시 조회하고, 이전 요청의 늦은 응답은 무시한다.
 * (데이터 라이브러리를 도입하기 전까지 쓰는 최소 구현)
 */
export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]): AsyncState<T> {
  const [state, setState] = useState<{ data?: T; error?: ApiError; loading: boolean }>({ loading: true })
  const [nonce, setNonce] = useState(0)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let ignore = false
    setState((prev) => ({ data: prev.data, loading: true }))
    fnRef
      .current()
      .then((data) => !ignore && setState({ data, loading: false }))
      // 이전 데이터는 유지한다. (주기적 갱신이 한 번 실패해도 화면이 오류로 뒤바뀌지 않도록)
      .catch((e: unknown) => !ignore && setState((prev) => ({ data: prev.data, error: toApiError(e), loading: false })))
    return () => {
      ignore = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { data: state.data, error: state.error, loading: state.loading, reload }
}
