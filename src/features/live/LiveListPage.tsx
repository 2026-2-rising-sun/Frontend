import { useState } from 'react'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { SegmentedControl, Skeleton } from '../../components/ui'
import type { LiveStatus } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { LiveCard } from './components/LiveCard'
import styles from './LiveListPage.module.css'

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
  const lives = useAsync(() => api.lives.list(status), [api, status])

  return (
    <PageContainer>
      <h1 className="t-h1">방송</h1>
      <SegmentedControl aria-label="방송 상태" value={status} options={OPTIONS} onChange={setStatus} />
      <AsyncView
        state={lives}
        skeleton={
          <div className={styles.grid} aria-busy="true">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={200} radius={14} />
            ))}
          </div>
        }
        isEmpty={(list) => list.length === 0}
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
      </AsyncView>
    </PageContainer>
  )
}
