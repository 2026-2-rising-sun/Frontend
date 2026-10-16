import { useEffect, useState } from 'react'
import { useApi } from '../../app/apiContext'
import { Alert, Button } from '../../components/ui'
import { visiblePromotions } from '../../domain/promotions'
import type { LiveStatus } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import styles from './promotions.module.css'
export function PromotionBanner({ liveId, status, refreshKey = 0 }: { liveId: string; status: LiveStatus; refreshKey?: number }) {
  const api = useApi()
  const promotions = useAsync(() => api.promotions.publicList(liveId), [api, liveId, status, refreshKey])
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (status !== 'LIVE') return
    const clock = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(clock)
  }, [status])
  if (status !== 'LIVE') return null
  const items = visiblePromotions((promotions.data ?? []).filter(item => item.broadcastId === liveId), now)
  return <section aria-label="방송 이벤트" className={styles.list}>
    {promotions.error && <Alert type="warning" title="방송 이벤트를 갱신하지 못했어요"><Button size="S" variant="secondary" onClick={promotions.reload}>다시 시도</Button></Alert>}
    {items.map(item => <div key={item.id} className={`${styles.card} ${styles.unread}`} role="status"><strong>방송 중 이벤트 · {item.title}</strong>{item.closesAt && <p className={styles.meta}><time dateTime={item.closesAt}>{new Date(item.closesAt).toLocaleTimeString('ko-KR')}</time>까지 진행해요.</p>}</div>)}
  </section>
}
