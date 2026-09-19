import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../domain/errors'
import type { Paged } from '../domain/types'

export interface PagedState<T> {
  items: T[]
  totalCount: number
  hasNext: boolean
  /** 첫 페이지 로딩 중 */
  loading: boolean
  /** "더 보기" 로딩 중 */
  loadingMore: boolean
  /** 첫 페이지 조회 실패 (목록이 비어 있을 때만 화면 전체 오류로 보여준다) */
  error: ApiError | undefined
  /** "더 보기" 실패. 이미 불러온 목록은 유지된다. */
  moreError: ApiError | undefined
  loadMore: () => void
  reload: () => void
}

const toApiError = (e: unknown) => (e instanceof ApiError ? e : new ApiError('UNKNOWN', '알 수 없는 오류가 발생했어요.'))

/**
 * 페이지 단위 목록 훅. deps 가 바뀌면 첫 페이지부터 다시 조회하고 이전 요청의 늦은 응답은 무시한다.
 * 명세: 목록은 일정 개수씩 조회하며, 첫 묶음만 보고 전체가 비었다고 단정하지 않는다.
 */
export function usePaged<T>(fetchPage: (page: number) => Promise<Paged<T>>, deps: readonly unknown[]): PagedState<T> {
  const [state, setState] = useState<{ items: T[]; totalCount: number; page: number; hasNext: boolean; loading: boolean; loadingMore: boolean; error?: ApiError; moreError?: ApiError }>({
    items: [],
    totalCount: 0,
    page: -1,
    hasNext: false,
    loading: true,
    loadingMore: false,
  })
  const [nonce, setNonce] = useState(0)
  const fetchRef = useRef(fetchPage)
  fetchRef.current = fetchPage
  const generation = useRef(0)

  useEffect(() => {
    const current = ++generation.current
    setState({ items: [], totalCount: 0, page: -1, hasNext: false, loading: true, loadingMore: false })
    fetchRef
      .current(0)
      .then((res) => {
        if (current !== generation.current) return
        setState({ items: res.items, totalCount: res.totalCount, page: 0, hasNext: res.hasNext, loading: false, loadingMore: false })
      })
      .catch((e: unknown) => {
        if (current !== generation.current) return
        setState((prev) => ({ ...prev, loading: false, error: toApiError(e) }))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  // 최신 상태를 ref 로 들고 있다가 loadMore 에서 읽는다. (setState 업데이트 함수 안에서 API 를 호출하면
  // StrictMode 에서 두 번 실행되어 같은 페이지가 중복으로 붙는다.)
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  })
  const loadingMoreRef = useRef(false)

  const loadMore = useCallback(() => {
    const prev = stateRef.current
    if (prev.loading || prev.loadingMore || !prev.hasNext || loadingMoreRef.current) return
    const current = generation.current
    loadingMoreRef.current = true
    setState((p) => ({ ...p, loadingMore: true, moreError: undefined }))
    fetchRef
      .current(prev.page + 1)
      .then((res) => {
        if (current !== generation.current) return
        setState((p) => ({ ...p, items: [...p.items, ...res.items], totalCount: res.totalCount, page: res.page, hasNext: res.hasNext, loadingMore: false, moreError: undefined }))
      })
      .catch((e: unknown) => {
        if (current !== generation.current) return
        setState((p) => ({ ...p, loadingMore: false, moreError: toApiError(e) }))
      })
      .finally(() => {
        loadingMoreRef.current = false
      })
  }, [])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { items: state.items, totalCount: state.totalCount, hasNext: state.hasNext, loading: state.loading, loadingMore: state.loadingMore, error: state.error, moreError: state.moreError, loadMore, reload }
}
