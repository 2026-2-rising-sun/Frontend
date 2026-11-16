import { useCallback, useRef, useState, type FormEvent } from 'react'
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
import { CouponPicker } from '../coupons/CouponPicker'
import { requestIdentity } from './checkoutRecovery'
import { activeCheckout } from './activeCheckout'
import { rememberSheet } from './sheetRecovery'
import type { CartItem } from '../../domain/ports'
import styles from './CheckoutPage.module.css'
export function CartCheckoutPage() {
  const [params] = useSearchParams(); const session = useSession()
  const ids = params.get('itemIds') ?? ''
  return <CartCheckoutScope key={`${session?.memberId}:${ids}`} ids={ids} />
}
function CartCheckoutScope({ ids }: { ids: string }) {
  const api = useApi(); const [couponId, setCouponId] = useState('')
  const quote = useAsync(async () => {
    const selected = ids.split(',')
    if (!ids || selected.some(id => !/^[1-9][0-9]*$/.test(id)) || new Set(selected).size !== selected.length) throw new ApiError('VALIDATION', '장바구니에서 상품을 다시 선택해 주세요.')
    const cart = await api.cart.list()
    const items = selected.map(id => {
      const item = cart.find(i => i.id === id)
      if (!item) throw new ApiError('CONFLICT', '선택한 상품이 변경되었어요. 장바구니에서 다시 선택해 주세요.')
      return { itemId: item.id, version: item.version }
    })
    return { quote: await api.cart.checkout(items), cart: cart.filter(item => selected.includes(item.id)) }
  }, [api, ids])
  return <PageContainer><h1 className="t-h1">선택 상품 주문서</h1><ActivePaymentGroup />
    {quote.error && quote.data && <Alert type="danger" title="최신 주문서를 확인하지 못했어요">{quote.error.message}<Button onClick={quote.reload}>다시 조회</Button></Alert>}
    <AsyncView state={quote} skeleton={<Skeleton height={320} />}>{value => <CartCheckoutForm quote={value.quote} cart={value.cart} couponId={couponId} onCouponChange={setCouponId} refresh={quote.reload} blocked={quote.loading || !!quote.error} />}</AsyncView>
    <ButtonLink variant="secondary" to="/cart">장바구니에서 다시 선택</ButtonLink>
  </PageContainer>
}
function CartCheckoutForm({ quote, cart, couponId, onCouponChange, refresh, blocked }: { quote: CartCheckout; cart: CartItem[]; couponId: string; onCouponChange: (id: string) => void; refresh: () => void; blocked: boolean }) {
  const api = useApi(); const navigate = useNavigate(); const session = useSession()
  const [targetId, setTargetId] = useState('')
  const target = quote.items.find(item => item.itemId === targetId)
  const canApplyCoupon = useCallback(async (id: string) => {
    const previews = await Promise.all(quote.items.map(item => api.orders.checkout(item.productId, item.quantity, id).catch(cause => { if (cause instanceof ApiError && ['CONFLICT', 'NOT_FOUND', 'VALIDATION'].includes(cause.code)) return null; throw cause })))
    return previews.some(preview => (preview?.discountAmount ?? 0) > 0)
  }, [api, quote])
  const discount = useAsync(async () => {
    if (!couponId) return { couponId, targetId, amount: 0, total: quote.totalAmount }
    if (!target) throw new ApiError('VALIDATION', '쿠폰을 적용할 상품을 선택해 주세요.')
    const preview = await api.orders.checkout(target.productId, target.quantity, couponId)
    if (!preview.orderable || preview.totalAmount !== target.totalAmount || (preview.discountAmount ?? 0) <= 0) throw new ApiError('CONFLICT', '선택 상품의 쿠폰과 최신 금액을 확인해 주세요.')
    return { couponId, targetId, amount: preview.discountAmount ?? 0, total: quote.totalAmount }
  }, [api, couponId, target, quote.totalAmount, targetId])
  const currentDiscount = discount.data?.couponId === couponId && discount.data.targetId === targetId && discount.data.total === quote.totalAmount ? discount.data.amount : undefined
  const payable = quote.totalAmount - (couponId ? currentDiscount ?? 0 : 0)
  const invalid = (couponId && currentDiscount === undefined) || blocked || discount.loading || !!discount.error || payable <= 0 || cart.some(item => !item.skuId)
  const [name, setName] = useState(session?.displayName ?? ''); const [phone, setPhone] = useState('')
  const [agreed, setAgreed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const inFlight = useRef(false)
  const pending = useRef<ReturnType<typeof requestIdentity> | null>(null)
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (inFlight.current || invalid || !session) return
    if (!name.trim() || name.trim().length > 64 || !/^[0-9-]{9,32}$/.test(phone.trim()) || !agreed) { setError('이름·연락처·결제 동의를 확인해 주세요.'); return }
    const couponSkuId = target ? cart.find(item => item.id === target.itemId)?.skuId : undefined
    if (invalid || (couponId && !couponSkuId)) return
    const input = { cartItems: quote.items.map(i => ({ itemId: i.itemId, version: i.version })).sort((a, b) => Number(a.itemId) - Number(b.itemId)), buyerName: name.trim(), buyerPhone: phone.trim(), expectedAmount: payable, ...(couponId && couponSkuId ? { couponId, couponSkuId } : {}) }
    pending.current = requestIdentity(session.memberId, 'sheet-cart', input)
    inFlight.current = true; setBusy(true); setError('')
    try {
      const active = await activeCheckout(api)
      if (active) { navigate(active, { replace: true }); return }
      const view = await api.orderSheets.create(input, pending.current.key)
      rememberSheet(session.memberId, view.order.orderNumber)
      pending.current.clear()
      navigate(`/order-sheets/${encodeURIComponent(view.order.orderNumber)}`, { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '주문 응답을 확인하지 못했어요. 같은 입력으로 재시도해 주세요.')
      // 응답 유실 뒤 같은 입력/키를 유지한다. 새·기존 진행 주문을 구분해 복구한다.
      try { const active = await activeCheckout(api); if (active) navigate(active, { replace: true }) } catch { /* 조회 실패는 원래 키를 보존한다 */ }
    } finally { inFlight.current = false; setBusy(false) }
  }
  return <form className={styles.layout} onSubmit={submit}><div className={styles.main}>
    {cart.some(item => !item.skuId) && <Alert type="warning" title="상품 식별자를 확인해 주세요">장바구니를 다시 조회해 주세요.</Alert>}{error && <Alert type="danger" title="주문을 확인해 주세요">{error}<Button variant="secondary" disabled={busy} onClick={refresh}>최신 주문서 조회</Button></Alert>}
    <section className={styles.card}><h2 className="t-h4">주문 상품 {quote.items.length}개</h2>{quote.items.map(item => <OrderSummary key={item.itemId} productName={item.productName} unitPrice={item.unitPrice} quantity={item.quantity} />)}<p>수량은 장바구니에서 변경할 수 있어요.</p></section>
    <section className={styles.card}><CouponPicker value={couponId} onChange={onCouponChange} disabled={busy || blocked} canApply={canApplyCoupon} />{couponId && <label>쿠폰 적용 상품<select aria-label="쿠폰 적용 상품" value={targetId} onChange={e => setTargetId(e.target.value)} disabled={busy}><option value="">상품을 선택해 주세요</option>{quote.items.map(item => <option key={item.itemId} value={item.itemId}>{item.productName}</option>)}</select></label>}{discount.error && couponId && <Alert type="warning" title="쿠폰을 확인해 주세요">{discount.error.message}</Alert>}</section>
    <section className={styles.card}><h2 className="t-h4">주문자 정보</h2><Input label="주문자 이름" maxLength={64} autoComplete="name" value={name} onChange={e => setName(e.target.value)} disabled={busy} required /><Input label="연락처" autoComplete="tel" inputMode="tel" maxLength={32} value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} required /></section>
  </div><aside className={styles.side}><section className={styles.card}><h2 className="t-h4">통합 결제 금액</h2><p>상품 금액 {formatPrice(quote.totalAmount)}</p>{(currentDiscount ?? 0) > 0 && <p>쿠폰 할인 -{formatPrice(currentDiscount ?? 0)}</p>}<strong className="t-price-lg">{formatPrice(payable)}</strong>{payable === 0 && <p>새 결제 계약은 양수 금액만 지원합니다. 쿠폰 선택을 확인해 주세요.</p>}<Checkbox label="상품별 주문과 통합 결제 금액을 확인했습니다" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={busy} /><Button type="submit" fullWidth size="L" disabled={busy || invalid || !agreed}>{busy ? '주문 생성 중…' : '통합 주문 만들기'}</Button></section></aside></form>
}
