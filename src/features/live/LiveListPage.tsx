import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, Skeleton } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { LiveScheduleList } from './components/LiveScheduleList'
import { isTodayLive, loadLiveSchedule } from './liveSchedule'
import styles from './LiveListPage.module.css'

interface LiveSchedulePageProps {
  /** true 면 진행 중이거나 오늘 시작하는 방송만 보여 준다 (오특) */
  todayOnly?: boolean
}

/** 라이브: 오늘을 포함한 앞으로의 방송 시간표를 시작이 임박한 순서로 보여 준다. 오특은 그중 오늘 방송만 모은다. */
export function LiveListPage({ todayOnly = false }: LiveSchedulePageProps) {
  const api = useApi()
  const schedule = useAsync(() => loadLiveSchedule(api), [api])
  return (
    <PageContainer>
      <div className={styles.head}>
        <h1 className="t-h1">{todayOnly ? '오특' : '라이브'}</h1>
        <p className={styles.caption}>{todayOnly ? '오늘 진행하는 라이브만 모았어요.' : '오늘부터 앞으로의 라이브를 시작이 가까운 순서로 보여드려요.'}</p>
      </div>
      <AsyncView
        state={schedule}
        skeleton={<div className={styles.grid} aria-busy="true">{[0, 1, 2].map(i => <Skeleton key={i} height={200} radius={14} />)}</div>}
        isEmpty={data => !data.incomplete && !data.items.some(live => !todayOnly || isTodayLive(live))}
        emptyTitle={todayOnly ? '오늘 예정된 라이브가 없어요' : '예정된 라이브가 없어요'}
        emptyMessage={todayOnly ? '앞으로의 라이브 일정은 라이브 메뉴에서 볼 수 있어요.' : '방송이 없어도 상품은 바로 구매할 수 있어요.'}
      >
        {data => <>
          {data.incomplete && <Alert type="warning" title="일부 방송을 확인하지 못했어요"><Button variant="secondary" size="S" onClick={schedule.reload}>방송 다시 조회</Button></Alert>}
          <LiveScheduleList lives={todayOnly ? data.items.filter(live => isTodayLive(live)) : data.items} />
        </>}
      </AsyncView>
    </PageContainer>
  )
}
