import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PagedView } from '../../components/PagedView'
import { ButtonLink, Chip, Skeleton, StatusBadge, liveBadge } from '../../components/ui'
import type { LiveStatus, LiveSummary } from '../../domain/types'
import { usePaged } from '../../hooks/usePaged'
import { formatDateTime } from '../../lib/format'
import styles from './admin.module.css'

type Filter = 'ALL' | LiveStatus

const PAGE_SIZE = 20

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

/** 방송 관리 목록. 준비 중·진행 중·종료를 구분해 보여주고, 상태에 맞는 편집 화면으로 이동한다. */
export function AdminLiveListPage() {
  const api = useApi()
  const [filter, setFilter] = useState<Filter>('ALL')
  const lives = usePaged((page) => api.admin.lives.list({ status: filter === 'ALL' ? undefined : filter, page, size: PAGE_SIZE }), [api, filter])

  return (
    <>
      <div className={styles.pageHead}>
        <div className={styles.pageTitle}>
          <h1 className="t-h1">방송 관리</h1>
          <ButtonLink to="/admin/lives/new" size="M" style={{ marginLeft: 'auto' }}>
            방송 등록
          </ButtonLink>
        </div>
        <div className={styles.chips} role="group" aria-label="방송 상태">
          {FILTERS.map((f) => (
            <Chip key={f.value} selected={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      <PagedView state={lives} skeleton={<Skeleton height={64} radius={14} />} emptyTitle="해당하는 방송이 없어요" emptyMessage="방송 등록으로 새 방송을 준비할 수 있어요.">
        {(items) => (
          <div className={styles.list}>
            {items.map((live) => (
              <div key={live.id} className={styles.row}>
                <div className={styles.rowMain}>
                  <div className={styles.rowText}>
                    <Link to={`/admin/lives/${live.id}`} className={styles.rowName}>
                      {live.title}
                    </Link>
                    <span className={styles.rowMeta}>
                      {live.hostName} · {timeText(live)}
                    </span>
                  </div>
                </div>
                <span className={styles.colStatus}>
                  <StatusBadge status={liveBadge(live.status)} label={live.status === 'READY' ? '준비 중' : undefined} />
                </span>
                <div className={styles.rowActions}>
                  <ButtonLink to={`/admin/lives/${live.id}`} size="S" variant="secondary">
                    {live.status === 'ENDED' ? '조회' : '편집'}
                  </ButtonLink>
                </div>
              </div>
            ))}
          </div>
        )}
      </PagedView>
    </>
  )
}
