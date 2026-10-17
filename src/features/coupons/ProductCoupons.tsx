import { useRef, useState } from 'react'
import { useApi } from '../../app/apiContext'
import { useSession } from '../auth/useSession'
import { useAsync } from '../../hooks/useAsync'
import { Alert, Button, ButtonLink } from '../../components/ui'
import { formatFullDateTime, formatPrice } from '../../lib/format'
import styles from './ProductCoupons.module.css'

export function ProductCoupons({ productId, price }: { productId: string; price: number }) {
  const api = useApi()
  const session = useSession()
  const data = useAsync(() => api.coupons.product(productId), [api, productId])
  const [busy, setBusy] = useState('')
  const lock = useRef(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function claim(id: string) {
    if (lock.current) return
    lock.current = true; setBusy(id); setMessage(''); setError('')
    try { await api.coupons.claim(id); setMessage('쿠폰을 받았어요. 주문서에서 선택해 주세요.') }
    catch (e) { setError(e instanceof Error ? e.message : '쿠폰을 받지 못했어요.') }
    finally { lock.current = false; setBusy('') }
  }
  if (data.error) return <section className={styles.stack} aria-label="상품 쿠폰"><Alert type="warning" title="쿠폰 혜택을 확인하지 못했어요"><Button variant="secondary" size="S" onClick={data.reload}>다시 조회</Button></Alert></section>
  if (data.loading || !data.data?.length) return null
  return <section className={styles.stack} aria-label="상품 쿠폰">
    <h2 className="t-h4">쿠폰 혜택</h2>
    {message && <Alert type="success" title={message} />}
    {error && <Alert type="warning" title="쿠폰을 확인해 주세요">{error}</Alert>}
    {data.data.map(c => <article className={styles.card} key={c.couponId}>
      <div className={styles.heading}><h3>{c.name} · {formatPrice(c.fixedDiscount)} 할인</h3>
        {c.soldOut ? <span className={styles.muted}>수량 소진</span> : session ? <Button variant="secondary" size="S" disabled={!!busy} onClick={() => claim(c.couponId)}>{busy === c.couponId ? '받는 중…' : '쿠폰 받기'}</Button> : <ButtonLink to="/login" size="S" variant="secondary" state={{ from: `/products/${productId}` }}>로그인하고 쿠폰 받기</ButtonLink>}
      </div>
      <p className={styles.expected}>쿠폰 적용 예상가 {formatPrice(Math.max(0, price - c.fixedDiscount))}</p>
      <p className={styles.muted}>받기 {formatFullDateTime(c.endsAt)}까지 · 사용 {formatFullDateTime(c.expiresAt)}까지</p>
    </article>)}
    <p className={styles.muted}>예상 혜택이며 실제 할인액은 주문서에서 확인해요.</p>
  </section>
}
