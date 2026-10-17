import { useRef, useState } from 'react'
import { useApi } from '../../app/apiContext'
import { useSession } from '../auth/useSession'
import { useAsync } from '../../hooks/useAsync'
import { Alert, Button, ButtonLink } from '../../components/ui'
import type { MemberCoupon, ProductCoupon } from '../../domain/coupons'
import { couponStatusLabel } from '../../domain/coupons'
import { formatFullDateTime, formatPrice } from '../../lib/format'
import { useCouponClock } from './useCouponClock'
import styles from './ProductCoupons.module.css'

export function ProductCoupons({ productId, price }: { productId: string; price: number }) {
  const session = useSession()
  return <ProductCouponScope key={`${productId}:${session?.memberId ?? 'guest'}`} productId={productId} price={price} memberId={session?.memberId} />
}

function ProductCouponScope({ productId, price, memberId }: { productId: string; price: number; memberId?: string }) {
  const api = useApi()
  const data = useAsync(() => api.coupons.product(productId), [api, productId])
  return <section className={styles.stack} aria-label="상품 쿠폰">
    <h2 className="t-h4">쿠폰 혜택</h2>
    {data.error ? <Alert type="warning" title="쿠폰 혜택을 확인하지 못했어요"><Button variant="secondary" size="S" onClick={data.reload} disabled={data.loading}>다시 조회</Button></Alert>
      : data.data === undefined ? <p className={styles.muted} role="status">상품 쿠폰을 확인하고 있어요.</p>
      : data.data.length ? <CouponBenefits key={data.data.map(c => c.couponId).join(':')} coupons={data.data} productId={productId} price={price} memberId={memberId} refreshing={data.loading} />
      : <p className={styles.muted}>지금 받을 수 있는 상품 쿠폰이 없어요. 보유 쿠폰의 적용 여부는 주문서에서 확인해 주세요.</p>}
  </section>
}

function CouponBenefits({ coupons, productId, price, memberId, refreshing }: { coupons: ProductCoupon[]; productId: string; price: number; memberId?: string; refreshing: boolean }) {
  const api = useApi()
  const mine = useAsync(async () => {
    if (!memberId) return []
    const remaining = new Set(coupons.map(c => c.couponId))
    const matches: MemberCoupon[] = []
    // 첫 페이지에서 찾지 못한 쿠폰을 미보유로 잘못 표시하지 않는다.
    for (let page = 0; ; page++) {
      const items = await api.coupons.mine(page)
      for (const item of items) if (remaining.delete(item.couponId)) matches.push(item)
      if (!remaining.size || items.length < 20) return matches
    }
  }, [api, memberId])
  const [received, setReceived] = useState<MemberCoupon[]>([])
  const [busy, setBusy] = useState('')
  const lock = useRef(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const now = useCouponClock([...coupons.flatMap(c => [c.startsAt, c.endsAt, c.expiresAt]), ...(mine.data ?? []).map(c => c.expiresAt), ...received.map(c => c.expiresAt)])
  const owned = new Map([...(mine.data ?? []), ...received].map(c => [c.couponId, c]))

  function reloadOwned() { setReceived([]); mine.reload() }

  async function claim(id: string) {
    if (lock.current || mine.loading || mine.error || refreshing || owned.has(id)) return
    lock.current = true; setBusy(id); setMessage(''); setError('')
    try {
      const coupon = await api.coupons.claim(id)
      setReceived(previous => [...previous, coupon])
      setMessage('쿠폰을 받았어요. 주문서에서 선택해 주세요.')
    } catch (e) {
      setError(e instanceof Error ? e.message : '쿠폰을 받지 못했어요.')
      reloadOwned()
    } finally { lock.current = false; setBusy('') }
  }

  return <>
    {message && <Alert type="success" title={message} />}
    {error && <Alert type="warning" title="쿠폰을 확인해 주세요">{error}</Alert>}
    {memberId && mine.error && <Alert type="warning" title="보유 여부를 확인하지 못했어요"><Button variant="secondary" size="S" onClick={reloadOwned} disabled={mine.loading}>보유 쿠폰 다시 조회</Button></Alert>}
    {coupons.map(coupon => {
      const memberCoupon = owned.get(coupon.couponId)
      const status = memberCoupon && (Date.parse(memberCoupon.expiresAt) <= now ? 'EXPIRED' : memberCoupon.status)
      const issuance = Date.parse(coupon.expiresAt) <= now ? '사용 기간 만료'
        : Date.parse(coupon.endsAt) <= now ? '받기 종료'
        : Date.parse(coupon.startsAt) > now ? '발급 예정'
        : coupon.soldOut ? '수량 소진' : null
      const discount = memberCoupon?.fixedDiscount ?? coupon.fixedDiscount
      const checking = !!memberId && (mine.loading || refreshing)
      const label = checking ? '보유 여부 확인 중' : mine.error ? '보유 여부 확인 필요' : status ? couponStatusLabel[status] : issuance ?? '받을 수 있어요'
      return <article className={styles.card} key={coupon.couponId} aria-label={coupon.name}>
        <div className={styles.heading}>
          <h3>{coupon.name} · {formatPrice(discount)} 할인</h3>
          {memberCoupon ? <Button variant="secondary" size="S" disabled>받은 쿠폰</Button>
            : issuance ? <Button variant="secondary" size="S" disabled>{issuance}</Button>
            : memberId ? <Button variant="secondary" size="S" disabled={!!busy || checking || !!mine.error} onClick={() => claim(coupon.couponId)}>{busy === coupon.couponId ? '받는 중…' : '쿠폰 받기'}</Button>
            : <ButtonLink to="/login" size="S" variant="secondary" state={{ from: `/products/${productId}` }}>로그인하고 쿠폰 받기</ButtonLink>}
        </div>
        <p className={styles.state} role="status">{memberCoupon ? '보유 · ' : ''}{label}</p>
        {(!issuance && !memberCoupon || status === 'AVAILABLE') && <p className={styles.expected}>쿠폰 적용 예상가 {formatPrice(Math.max(0, price - discount))}</p>}
        <p className={styles.muted}>{!memberCoupon && <>받기 {formatFullDateTime(coupon.endsAt)}까지 · </>}사용 {formatFullDateTime(memberCoupon?.expiresAt ?? coupon.expiresAt)}까지</p>
      </article>
    })}
    <p className={styles.muted}>사용 가능한 쿠폰은 주문서에서 선택해 주세요. 이 상품의 최종 적용 여부와 할인액은 주문서에서 확인해요.</p>
  </>
}
