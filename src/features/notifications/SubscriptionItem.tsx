import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { Button } from '../../components/ui'
import type { AlertKind, AlertSubscription } from '../../domain/notifications'
import { useAsync } from '../../hooks/useAsync'
import styles from './notifications.module.css'

export function SubscriptionItem({ kind, item, busy, onRemove }: { kind: AlertKind; item: AlertSubscription; busy: boolean; onRemove: () => void }) {
  const api = useApi()
  const target = useAsync(async () => kind === 'broadcast'
    ? (await api.lives.get(item.targetId)).title
    : (await api.products.get(item.targetId)).name, [api, kind, item.targetId])
  const label = kind === 'broadcast' ? '방송' : '상품'
  const unavailable = target.error?.code === 'NOT_FOUND' || target.error?.code === 'FORBIDDEN'
  const name = target.error ? undefined : target.data
  return <li className={styles.card}>
    <strong>{name || `${label} #${item.targetId}`}</strong>
    {name && <span className={styles.meta}>{label} #{item.targetId}</span>}
    {target.loading && <span className={styles.meta}>이름을 불러오는 중이에요.</span>}
    {target.error && <div className={styles.row}><span className={styles.meta}>{unavailable ? '삭제되었거나 공개되지 않은 대상이에요.' : '이름을 확인하지 못했어요.'}</span><Button size="S" variant="secondary" disabled={busy || target.loading} onClick={target.reload}>이름 다시 확인</Button></div>}
    <time className={styles.meta} dateTime={item.createdAt}>신청일 {new Date(item.createdAt).toLocaleString('ko-KR')}</time>
    <div className={styles.row}>{!unavailable && <Link to={`/${kind === 'broadcast' ? 'lives' : 'products'}/${encodeURIComponent(item.targetId)}`}>상세 보기</Link>}<Button size="S" variant="secondary" disabled={busy} onClick={onRemove}>알림 해제</Button></div>
  </li>
}
