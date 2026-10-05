import { useState } from 'react'
import { useApi } from '../../app/apiContext'
import { PagedView } from '../../components/PagedView'
import { PageContainer } from '../../components/PageContainer'
import { SegmentedControl, Skeleton } from '../../components/ui'
import type { LiveStatus } from '../../domain/types'
import { usePaged } from '../../hooks/usePaged'
import { LiveCard } from './components/LiveCard'
import styles from './LiveListPage.module.css'

/** 1·2·3열 그리드에 나누어떨어지도록 6개 */
const LIVE_PAGE_SIZE = 6

const OPTIONS: { value: LiveStatus; label: string }[] = [
  { value: 'LIVE', label: '진행 중' },
  { value: 'READY', label: '예정' },
  { value: 'ENDED', label: '종료' },
]

const EMPTY_TEXT: Record<LiveStatus, string> = {
  LIVE: '진행 중인 방송이 없어요',
  READY: '예정된 방송이 없어요',
  ENDED: '종료된 방송이 없어요',
}

export function LiveListPage() {
  const api = useApi()
  const [status, setStatus] = useState<LiveStatus>('LIVE')
  const lives = usePaged((page) => api.lives.list({ status, page, size: LIVE_PAGE_SIZE }), [api, status])

  return (
    <PageContainer>
      <h1 className="t-h1">방송</h1>
      <SegmentedControl aria-label="방송 상태" value={status} options={OPTIONS} onChange={setStatus} />
      <p className="t-caption">상태는 불러온 페이지에서 구분합니다. 더 보기로 다음 방송을 확인하세요.</p>
      <PagedView
        state={lives}
        skeleton={
          <div className={styles.grid} aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={200} radius={14} />
            ))}
          </div>
        }
        emptyTitle={EMPTY_TEXT[status]}
        emptyMessage="방송이 없어도 상품은 쇼핑에서 바로 구매할 수 있어요."
      >
        {(list) => (
          <div className={styles.grid}>
            {list.map((live) => (
              <LiveCard key={live.id} live={live} />
            ))}
          </div>
        )}
      </PagedView>
    </PageContainer>
  )
}
