import { useEffect, useRef, type ReactNode } from 'react'
import type { PagedState } from '../hooks/usePaged'
import { Button, ResultState, Spinner } from './ui'

interface PagedViewProps<T> {
  state: PagedState<T>
  skeleton: ReactNode
  emptyTitle: string
  emptyMessage?: string
  children: (items: T[]) => ReactNode
  /** true 면 "더 보기" 버튼 대신 목록 끝에 가까워질 때 다음 묶음을 자동으로 불러온다(무한 스크롤). */
  infinite?: boolean
}

/**
 * 페이지 단위 목록의 로딩 / 오류 / 빈 결과 / 정상 + "더 보기".
 * - 첫 페이지 조회 실패는 화면 오류, 빈 결과와 구분한다.
 * - "더 보기" 실패는 이미 불러온 목록을 유지한 채 재시도만 안내한다.
 * - infinite 면 버튼 대신 목록 끝 감지로 이어서 불러오고, 실패했을 때만 "다시 시도" 버튼을 보여 준다.
 */
export function PagedView<T>({ state, skeleton, emptyTitle, emptyMessage, children, infinite }: PagedViewProps<T>) {
  if (state.loading) return <>{skeleton}</>
  if (state.error && state.items.length === 0) {
    return (
      <ResultState
        type="error"
        title="불러오지 못했어요"
        message={`${state.error.message} 잠시 후 다시 시도해 주세요.`}
        action={
          <Button variant="secondary" onClick={state.reload}>
            다시 시도
          </Button>
        }
      />
    )
  }
  if (state.items.length === 0 && !state.hasNext) return <ResultState type="empty" title={emptyTitle} message={emptyMessage} />

  if (infinite) return <>{children(state.items)}<InfiniteLoader state={state} /></>

  return (
    <>
      {children(state.items)}
      {state.moreError && (
        <p role="alert" style={{ textAlign: 'center', color: 'var(--danger-text)', font: '400 12px/18px var(--font-sans)' }}>
          {state.moreError.message}
        </p>
      )}
      {(state.hasNext || state.moreError) && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button variant="secondary" size="L" onClick={state.loadMore} disabled={state.loadingMore}>
            {state.loadingMore ? '불러오는 중…' : state.moreError ? '다시 시도' : state.totalCount < 0 ? '더 보기' : `더 보기 (${state.items.length}/${state.totalCount})`}
          </Button>
        </div>
      )}
    </>
  )
}

/**
 * 목록 끝 바로 아래의 감지 칸. 화면 아래 400px 안으로 들어오면 다음 묶음을 부른다.
 * 불러온 뒤에도 감지 칸이 계속 보이면(목록이 짧으면) 다시 감지되어 화면이 찰 때까지 이어서 부른다.
 */
function InfiniteLoader<T>({ state }: { state: PagedState<T> }) {
  const ref = useRef<HTMLDivElement>(null)
  const { loadMore } = state
  const ready = state.hasNext && !state.loadingMore && !state.moreError
  useEffect(() => {
    const node = ref.current
    if (!node || !ready) return
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) loadMore() }, { rootMargin: '0px 0px 400px 0px' })
    observer.observe(node)
    return () => observer.disconnect()
  }, [ready, loadMore, state.items.length])
  return <div ref={ref} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-3)', minHeight: 1, padding: state.hasNext || state.moreError ? 'var(--space-4) 0' : 0 }}>
    {state.loadingMore && <Spinner size={28} label="상품을 더 불러오는 중" />}
    {state.moreError && <>
      <p role="alert" style={{ color: 'var(--danger-text)', font: '400 12px/18px var(--font-sans)' }}>{state.moreError.message}</p>
      <Button variant="secondary" onClick={loadMore}>다시 시도</Button>
    </>}
  </div>
}
