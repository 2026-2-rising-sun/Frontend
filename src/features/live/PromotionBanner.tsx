import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSession } from '../auth/useSession'
import type { PublicPromotion } from '../../domain/promotions'
import { useApi } from '../../app/apiContext'
import { Alert, Button } from '../../components/ui'
import { promotionCouponId, visiblePromotions } from '../../domain/promotions'
import type { LiveStatus } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import styles from './promotions.module.css'
export function PromotionBanner({ liveId, status, refreshKey = 0 }: { liveId: string; status: LiveStatus; refreshKey?: number }) {
  const api = useApi()
  const session = useSession()
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
    {items.map(item => <div key={item.id} className={`${styles.card} ${styles.unread}`} role="status"><strong>방송 중 이벤트 · {item.title}</strong>{item.type === 'COUPON_DROP' && <PromotionCouponClaim key={`${item.id}:${session?.memberId}`} promotion={item} />}{item.closesAt && <p className={styles.meta}><time dateTime={item.closesAt}>{new Date(item.closesAt).toLocaleTimeString('ko-KR')}</time>까지 진행해요.</p>}</div>)}
  </section>
}

function PromotionCouponClaim({ promotion }: { promotion: PublicPromotion }) {
  const api = useApi()
  const session = useSession()
  const location = useLocation()
  const couponId = promotionCouponId(promotion)
  const [busy, setBusy] = useState(false)
  const [received, setReceived] = useState(false)
  const [error, setError] = useState('')
  const lock = useRef(false)
  async function claim() {
    if (!session || !couponId || lock.current || received) return
    lock.current = true; setBusy(true); setError('')
    try { await api.coupons.claim(couponId); setReceived(true) }
    catch (cause) { setError(cause instanceof Error ? cause.message : '쿠폰을 받지 못했어요.') }
    finally { lock.current = false; setBusy(false) }
  }
  if (!couponId) return <p className={styles.meta}>쿠폰 정보를 확인할 수 없어요.</p>
  if (!session) return <Link to="/login" state={{ from: location.pathname + location.search }}>로그인하고 쿠폰 받기</Link>
  return <div className={styles.list}>
    <Button size="S" disabled={busy || received} onClick={() => void claim()}>{received ? '쿠폰 받기 완료' : busy ? '받는 중…' : '쿠폰 받기'}</Button>
    {received && <p role="status">쿠폰을 받았어요. <Link to="/coupons">내 쿠폰 확인</Link></p>}
    {error && <Alert type="warning" title="쿠폰을 받지 못했어요">{error}</Alert>}
  </div>
}
