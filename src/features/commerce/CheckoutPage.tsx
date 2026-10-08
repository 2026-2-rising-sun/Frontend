import { useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, Checkbox, Input, QuantityStepper, Skeleton } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import { requestIdentity } from './checkoutRecovery'
import { ActivePaymentGroup } from './ActivePaymentGroup'
import { useSession } from '../auth/useSession'
import { formatPrice } from '../../lib/format'
import type { Product } from '../../domain/types'
import { OrderSummary } from './components/OrderSummary'
import styles from './CheckoutPage.module.css'
export function CheckoutPage() {
  const api = useApi(); const [params] = useSearchParams()
  const productId = params.get('productId') ?? ''
  const quantity = Number(params.get('quantity') ?? 1)
  const cartItemId = params.get('cartItemId') ?? undefined
  const data = useAsync(async () => {
    let id = productId; let selectedQuantity = Number.isSafeInteger(quantity) && quantity > 0 ? quantity : 1
    if (cartItemId) {
      const item = (await api.cart.list()).find(item => item.id === cartItemId)
      if (!item) throw new Error('장바구니 항목이 없어요. 장바구니에서 다시 선택해 주세요.')
      id = item.productId; selectedQuantity = item.quantity
    }
    return { product: await api.products.get(id), quantity: selectedQuantity }
  }, [api, productId, cartItemId, quantity])
  return <PageContainer><h1 className="t-h1">주문서</h1><ActivePaymentGroup /><AsyncView state={data} skeleton={<Skeleton height={320} />}>
    {value => <CheckoutForm key={`${value.product.id}:${value.quantity}`} product={value.product} initialQuantity={value.quantity} cartItemId={cartItemId} />}
  </AsyncView></PageContainer>
}
function CheckoutForm({ product, initialQuantity, cartItemId }: { product: Product; initialQuantity: number; cartItemId?: string }) {
  const api = useApi(); const navigate = useNavigate(); const session = useSession()
  const [quantity, setQuantity] = useState(cartItemId ? initialQuantity : Math.min(initialQuantity, Math.max(product.stock, 1)))
  const [name, setName] = useState(session?.displayName ?? ''); const [phone, setPhone] = useState('')
  const [agreed, setAgreed] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const checkout = useAsync(() => api.orders.checkout(product.id, quantity), [api, product.id, quantity])
  const quote = checkout.data
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy || !quote?.orderable || checkout.loading || checkout.error) return
    if (!name.trim() || name.trim().length > 64 || !/^[0-9-]{9,32}$/.test(phone.trim()) || !agreed) { setError('이름·연락처·결제 동의를 확인해 주세요.'); return }
    const input = { productId: product.id, quantity, expectedUnitPrice: quote.unitPrice, ordererName: name.trim(), ordererPhone: phone.trim(), cartItemId }
    setBusy(true); setError('')
    try {
      const check = await api.products.check(product.id, quantity)
      if (!check.orderable) throw new Error('현재 재고로 주문할 수 없어요. 수량을 다시 확인해 주세요.')
      const identity = requestIdentity(session?.memberId ?? 'anonymous', 'direct-order', input)
      const order = await api.orders.create({ ...input, idempotencyKey: identity.key })
      identity.clear()
      if (order.groupNumber) { navigate(`/payment-groups/${encodeURIComponent(order.groupNumber)}`, { replace: true }); return }
      // The saved order is the recovery point if payment start or its response is lost.
      let paymentId: string | undefined
      try { paymentId = String((await api.payments.start(order.orderNumber)).paymentId) } catch { /* result page offers a retry */ }
      navigate(`/orders/${encodeURIComponent(order.orderNumber)}`, { replace: true, state: { paymentId } })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '주문하지 못했어요.')
      try { const active = await api.paymentGroups.active(); if (active) { requestIdentity(session?.memberId ?? 'anonymous', 'direct-order', input).clear(); navigate(`/payment-groups/${encodeURIComponent(active.groupNumber)}`, { replace: true }) } } catch { /* retry keeps original key */ }
    }
    finally { setBusy(false) }
  }
  return <form className={styles.layout} onSubmit={submit}>
    <div className={styles.main}>
      {error && <Alert type="danger" title="주문을 확인해 주세요">{error}</Alert>}
      <section className={styles.card}><h2 className="t-h4">주문 상품</h2>
        <OrderSummary productName={product.name} unitPrice={quote?.unitPrice ?? product.price} quantity={quantity} imageUrl={product.imageUrl} />
        <QuantityStepper value={quantity} onChange={setQuantity} max={Math.max(product.stock, 1)} disabled={busy || !!cartItemId} />
        {cartItemId && <p className="t-caption">수량은 장바구니에서 변경할 수 있어요.</p>}
      </section>
      <section className={styles.card}><h2 className="t-h4">주문자 정보</h2>
        <Input label="주문자 이름" autoComplete="name" maxLength={64} value={name} onChange={e => setName(e.target.value)} disabled={busy} required />
        <Input label="연락처" autoComplete="tel" inputMode="tel" maxLength={32} value={phone} onChange={e => setPhone(e.target.value)} disabled={busy} required />
      </section>
    </div>
    <aside className={styles.side}><section className={styles.card}><h2 className="t-h4">결제 금액</h2>
      {checkout.error && <Alert type="danger" title="최신 금액을 확인하지 못했어요">{checkout.error.message}<Button variant="secondary" onClick={checkout.reload}>다시 조회</Button></Alert>}
      {quote && !quote.orderable && <Alert type="warning" title="지금은 주문할 수 없어요">판매 상태와 재고를 확인해 주세요.</Alert>}
      <strong className="t-price-lg">{formatPrice(quote?.totalAmount ?? product.price * quantity)}</strong>
      <Checkbox label="주문 내용을 확인했으며 결제에 동의합니다" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={busy} />
      <Button type="submit" size="L" fullWidth disabled={busy || checkout.loading || !!checkout.error || !quote?.orderable}>{busy ? '처리 중…' : '결제하기'}</Button>
    </section></aside>
  </form>
}
