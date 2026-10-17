import { useApi } from '../../app/apiContext'
import { useAsync } from '../../hooks/useAsync'
import { useCouponClock } from './useCouponClock'
import styles from './ProductCoupons.module.css'

/** 목록에서는 상품 쿠폰의 존재만 알리고, 회원별 보유·적용 상태는 상세에서 확인한다. */
export function ProductCouponHint({ productId }: { productId: string }) {
  const api = useApi()
  const coupons = useAsync(() => api.coupons.product(productId), [api, productId])
  const now = useCouponClock(coupons.data?.flatMap(c => [c.startsAt, c.endsAt, c.expiresAt]) ?? [])
  if (coupons.loading || coupons.error || !coupons.data?.length) return null
  const active = coupons.data.filter(c => Date.parse(c.endsAt) > now && Date.parse(c.expiresAt) > now && !(Date.parse(c.startsAt) > now))
  if (!active.length) return null
  return <span className={styles.hint}>{active.some(c => !c.soldOut) ? '쿠폰 혜택' : '쿠폰 수량 소진'}</span>
}
