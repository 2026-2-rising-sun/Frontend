import { useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, ButtonLink, Checkbox, Input, Skeleton } from '../../components/ui'
import { ApiError } from '../../domain/errors'
import type { CartCheckout } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { useSession } from '../auth/useSession'
import { formatPrice } from '../../lib/format'
import { OrderSummary } from './components/OrderSummary'
import { ActivePaymentGroup } from './ActivePaymentGroup'
import { requestIdentity } from './checkoutRecovery'
import styles from './CheckoutPage.module.css'
export function CartCheckoutPage() {
  const [params] = useSearchParams(); const session = useSession()
  const ids = params.get('itemIds') ?? ''
  return <CartCheckoutScope key={`${session?.memberId}:${ids}`} ids={ids} />
}
function CartCheckoutScope({ ids }: { ids: string }) {
  const api = useApi()
  const quote = useAsync(async () => {
    const selected = ids.split(',')
    if (!ids || selected.some(id => !/^[1-9][0-9]*$/.test(id)) || new Set(selected).size !== selected.length) throw new ApiError('VALIDATION', '장바구니에서 상품을 다시 선택해 주세요.')
    const cart = await api.cart.list()
    const items = selected.map(id => {
      const item = cart.find(i => i.id === id)
      if (!item) throw new ApiError('CONFLICT', '선택한 상품이 변경되었어요. 장바구니에서 다시 선택해 주세요.')
      return { itemId: item.id, version: item.version }
    })
    return api.cart.checkout(items)
  }, [api, ids])
  return <PageContainer><h1 className="t-h1">선택 상품 주문서</h1><ActivePaymentGroup />
    {quote.error && quote.data && <Alert type="danger" title="최신 주문서를 확인하지 못했어요">{quote.error.message}<Button onClick={quote.reload}>다시 조회</Button></Alert>}
    <AsyncView state={quote} skeleton={<Skeleton height={320} />}>{value => <CartCheckoutForm quote={value} refresh={quote.reload} blocked={quote.loading || !!quote.error} />}</AsyncView>
    <ButtonLink variant="secondary" to="/cart">장바구니에서 다시 선택</ButtonLink>
  </PageContainer>
}
function CartCheckoutForm({ quote, refresh, blocked }: { quote: CartCheckout; refresh: () => void; blocked: boolean }) {
  const api = useApi(); const navigate = useNavigate(); const session = useSession()
  const [name, setName] = useState(session?.displayName ?? ''); const [phone, setPhone] = useState('')
  const [agreed, setAgreed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const inFlight = useRef(false)
  const pending = useRef<ReturnType<typeof requestIdentity> | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || blocked || !session) return
    if (!name.trim() || name.trim().length > 64 || !/^[0-9-]{9,32}$/.test(phone.trim()) || !agreed) { setError('이름·연락처·결제 동의를 확인해 주세요.'); return }
    const input = { items: quote.items.map(i => ({ itemId: i.itemId, version: i.version })).sort((a, b) => Number(a.itemId) - Number(b.itemId)), buyerName: name.trim(), buyerPhone: phone.trim(), expectedTotalAmount: quote.totalAmount }
    pending.current = requestIdentity(session.memberId, 'cart-order', input)
    inFlight.current = true; setBusy(true); setError('')
    try {
      const group = await api.cart.order({ ...input, idempotencyKey: pending.current.key })
      pending.current.clear()
      navigate(`/payment-groups/${encodeURIComponent(group.groupNumber)}`, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '주문하지 못했어요.')
      // An active group is the recovery point when the creation response is lost.
      try { const active = await api.paymentGroups.active(); if (active) { pending.current?.clear(); navigate(`/payment-groups/${encodeURIComponent(active.groupNumber)}`, { replace: true }) } } catch { /* retry retains request identity */ }
    } finally { inFlight.current = false; setBusy(false) }
  }
  return <form className={styles.layout} onSubmit={submit}><div className={styles.main}>
    {error && <Alert type="danger" title="주문을 확인해 주세요">{error}<Button variant="secondary" disabled={busy} onClick={refresh}>최신 주문서 조회</Button></Alert>}
    <section className={styles.card}><h2 className="t-h4">주문 상품 {quote.items.length}개</h2>{quote.items.map(item => <OrderSummary key={item.itemId} productName={item.productName} unitPrice={item.unitPrice} quantity={item.quantity} />)}<p>수량은 장바구니에서 변경할 수 있어요.</p></section>
    <section className={styles.card}><h2 className="t-h4">주문자 정보</h2><Input label="주문자 이름" maxLength={64} autoComplete="name" value={name} onChange={e => setName(e.target.value)} disabled={busy} required /><Input label="연락처" autoComplete="tel" inputMode="tel" maxLength={32} value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} required /></section>
  </div><aside className={styles.side}><section className={styles.card}><h2 className="t-h4">통합 결제 금액</h2><strong className="t-price-lg">{formatPrice(quote.totalAmount)}</strong><Checkbox label="상품별 주문과 통합 결제 금액을 확인했습니다" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={busy} /><Button type="submit" fullWidth size="L" disabled={busy || blocked || !agreed}>{busy ? '주문 생성 중…' : '통합 주문 만들기'}</Button></section></aside></form>
}
