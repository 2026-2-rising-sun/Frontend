import type { ReactNode } from 'react'
import type { PagedState } from '../hooks/usePaged'
import { Button, ResultState } from './ui'

interface PagedViewProps<T> {
  state: PagedState<T>
  skeleton: ReactNode
  emptyTitle: string
  emptyMessage?: string
  children: (items: T[]) => ReactNode
}

/**
 * 페이지 단위 목록의 로딩 / 오류 / 빈 결과 / 정상 + "더 보기".
 * - 첫 페이지 조회 실패는 화면 오류, 빈 결과와 구분한다.
 * - "더 보기" 실패는 이미 불러온 목록을 유지한 채 재시도만 안내한다.
 */
export function PagedView<T>({ state, skeleton, emptyTitle, emptyMessage, children }: PagedViewProps<T>) {
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
  if (state.items.length === 0) return <ResultState type="empty" title={emptyTitle} message={emptyMessage} />

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
            {state.loadingMore ? '불러오는 중…' : state.moreError ? '다시 시도' : `더 보기 (${state.items.length}/${state.totalCount})`}
          </Button>
        </div>
      )}
    </>
  )
}
