import type { ReactNode } from 'react'
import type { AsyncState } from '../hooks/useAsync'
import { Button, ResultState } from './ui'

interface AsyncViewProps<T> {
  state: AsyncState<T>
  /** 로딩 중 보여줄 자리 표시 */
  skeleton: ReactNode
  /** 데이터가 "비어 있음"인 경우를 판단한다. 조회 실패와는 별개의 상태다. */
  isEmpty?: (data: T) => boolean
  emptyTitle?: string
  emptyMessage?: string
  children: (data: T) => ReactNode
}

/**
 * 로딩 / 오류 / 빈 결과 / 정상을 구분해서 그린다.
 * 명세 공통 완료 조건: "처리 중, 성공, 실패, 조회 결과 없음의 표시를 구분한다."
 */
export function AsyncView<T>({ state, skeleton, isEmpty, emptyTitle = '결과가 없어요', emptyMessage, children }: AsyncViewProps<T>) {
  if (state.error && !state.data) {
    const notFound = state.error.code === 'NOT_FOUND'
    return (
      <ResultState
        type="error"
        title={notFound ? '찾을 수 없어요' : '불러오지 못했어요'}
        message={notFound ? state.error.message : `${state.error.message} 잠시 후 다시 시도해 주세요.`}
        action={
          notFound ? undefined : (
            <Button variant="secondary" onClick={state.reload}>
              다시 시도
            </Button>
          )
        }
      />
    )
  }
  if (state.data === undefined) return <>{skeleton}</>
  if (isEmpty?.(state.data)) return <ResultState type="empty" title={emptyTitle} message={emptyMessage} />
  return <>{children(state.data)}</>
}
