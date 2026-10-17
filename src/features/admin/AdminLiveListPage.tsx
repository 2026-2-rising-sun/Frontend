import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PagedView } from '../../components/PagedView'
import { Button, ButtonLink, Chip, Skeleton, StatusBadge, Thumbnail, liveBadge } from '../../components/ui'
import type { LiveStatus, LiveSummary } from '../../domain/types'
import { usePaged } from '../../hooks/usePaged'
import { formatDateTime } from '../../lib/format'
import { ViewerCount } from '../live/ViewerCount'
import styles from './admin.module.css'

type Filter = 'ALL' | LiveStatus
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'READY', label: '준비 중' },
  { value: 'LIVE', label: '진행 중' },
  { value: 'ENDED', label: '종료' },
]
const timeText = (live: LiveSummary) => {
  if (live.status === 'LIVE' && live.startedAt) return `${formatDateTime(live.startedAt)} 시작`
  if (live.status === 'ENDED' && live.endedAt) return `${formatDateTime(live.endedAt)} 종료`
  return `${formatDateTime(live.scheduledAt)} 예정`
}
const NEXT_ACTION = {
  READY: { label: '방송 준비', hint: '방송 정보와 연결 상품을 확인하고 시작하세요.' },
  LIVE: { label: '방송 운영', hint: '진행 중인 방송의 상품과 프로모션을 관리하세요.' },
  ENDED: { label: '방송 상세', hint: '종료된 방송의 정보와 연결 상품을 확인하세요.' },
}

export function AdminLiveListPage() {
  const api = useApi()
  const [filter, setFilter] = useState<Filter>('ALL')
  const lives = usePaged((page) => api.admin.lives.list({ status: filter === 'ALL' ? undefined : filter, page, size: 20 }), [api, filter])
  return <>
    <header className={styles.pageHead}>
      <p className={styles.eyebrow}>SELLER CENTER</p>
      <div className={styles.pageTitle}>
        <div><h1 className="t-h1">방송 관리</h1><p className={styles.pageDescription}>방송 준비부터 진행 중인 운영까지, 한곳에서 관리하세요.</p></div>
        <ButtonLink to="/admin/lives/new" className={styles.primaryAction}>+ 방송 등록</ButtonLink>
      </div>
    </header>
    <section className={styles.listSection} aria-label="방송 목록">
      <div className={styles.listToolbar}>
        <div className={styles.chips} role="group" aria-label="방송 상태">
          {FILTERS.map(f => <Chip key={f.value} selected={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</Chip>)}
        </div>
        <Button variant="secondary" onClick={lives.reload} disabled={lives.loading || lives.loadingMore}>새로고침</Button>
      </div>
      <p className={styles.resultCount} role="status">{lives.loading ? '방송을 불러오고 있어요…' : lives.error ? '방송을 불러오지 못했어요.' : `${FILTERS.find(f => f.value === filter)?.label} · ${lives.items.length}개 불러옴`}</p>
      <PagedView state={lives} skeleton={<Skeleton height={220} radius={14} />} emptyTitle="해당하는 방송이 없어요" emptyMessage="다른 상태를 선택하거나 새 방송을 등록해 보세요.">
        {items => <div className={styles.productList}>{items.map(live => <article key={live.id} className={styles.productCard}>
          <div className={styles.productIdentity}>
            <Thumbnail src={live.thumbnailUrl} alt="" className={styles.productThumb} />
            <div className={styles.rowText}><span className={styles.rowMeta}>{live.hostName}</span><Link to={`/admin/lives/${live.id}`} className={styles.productName}>{live.title}</Link></div>
            <StatusBadge status={liveBadge(live.status)} label={live.status === 'READY' ? '준비 중' : undefined} className={styles.productBadge} />
          </div>
          <div className={styles.liveTime}><p>{timeText(live)}</p><ViewerCount liveId={live.id} status={live.status} watching={false} compact /></div>
          <div className={styles.productFooter}>
            <p>{NEXT_ACTION[live.status].hint}</p>
            <div className={styles.actions}>
              {live.status === 'LIVE' && <ButtonLink to={`/lives/${live.id}`} variant="secondary" size="S">시청 화면</ButtonLink>}
              <ButtonLink to={`/admin/lives/${live.id}`} variant={live.status === 'LIVE' ? 'primary' : 'tonal'} size="S" aria-label={`${live.title} ${NEXT_ACTION[live.status].label}`}>{NEXT_ACTION[live.status].label} →</ButtonLink>
            </div>
          </div>
        </article>)}</div>}
      </PagedView>
    </section>
  </>
}
