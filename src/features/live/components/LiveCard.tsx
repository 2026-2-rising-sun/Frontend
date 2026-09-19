import { Link } from 'react-router-dom'
import { StatusBadge, Thumbnail, liveBadge } from '../../../components/ui'
import { UserIcon } from '../../../components/icons'
import type { LiveSummary } from '../../../domain/types'
import { formatDateTime } from '../../../lib/format'
import styles from './LiveCard.module.css'

const metaOf = (live: LiveSummary) => {
  if (live.status === 'LIVE') return '지금 방송 중'
  if (live.status === 'READY') return `${formatDateTime(live.scheduledAt)} 시작`
  return live.endedAt ? `${formatDateTime(live.endedAt)} 종료` : '방송 종료'
}

/** Figma "Live Card" (Live · Scheduled · Ended). 예정 시각이 지나도 시작 전이면 "방송 예정"으로 둔다. */
export function LiveCard({ live }: { live: LiveSummary }) {
  return (
    <Link to={`/lives/${live.id}`} className={styles.card}>
      <Thumbnail src={live.thumbnailUrl} alt={live.title} ratio="16 / 9" className={styles.thumb}>
        {!live.thumbnailUrl && <span className={styles.videoBg} aria-hidden="true" />}
        <StatusBadge status={liveBadge(live.status)} className={styles.badge} />
      </Thumbnail>
      <div className={styles.info}>
        <span className={[styles.avatar, live.status === 'LIVE' && styles.avatarLive].filter(Boolean).join(' ')} aria-hidden="true">
          <UserIcon size={18} />
        </span>
        <div className={styles.text}>
          <p className={[styles.title, live.status === 'ENDED' && styles.ended].filter(Boolean).join(' ')}>{live.title}</p>
          <p className={styles.meta}>
            {live.hostName} · {metaOf(live)}
          </p>
        </div>
      </div>
    </Link>
  )
}
