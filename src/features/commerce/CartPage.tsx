import { useState } from 'react'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { AsyncView } from '../../components/AsyncView'
import { Alert, Button, ButtonLink, Input, Skeleton, Thumbnail } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import type { CartItem } from '../../domain/ports'
import { formatPrice } from '../../lib/format'
import styles from './OrderLookupPage.module.css'
export function CartPage() {
  const api = useApi(); const data = useAsync(() => api.cart.list(), [api])
  return <PageContainer narrow><h1 className="t-h1">장바구니</h1><p>상품별로 주문할 수 있어요.</p>
    <AsyncView state={data} skeleton={<Skeleton height={200} />} isEmpty={items => !items.length} emptyTitle="장바구니가 비어 있어요">
      {items => items.map(item => <CartRow key={`${item.id}:${item.version}`} item={item} reload={data.reload} />)}
    </AsyncView>
  </PageContainer>
}
function CartRow({ item, reload }: { item: CartItem; reload: () => void }) {
  const api = useApi(); const p = useAsync(() => api.products.get(item.productId), [api, item.productId])
  const [quantity, setQuantity] = useState(String(item.quantity)); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  async function change(remove = false) {
    if (busy) return
    const value = Number(quantity)
    if (!remove && (!Number.isSafeInteger(value) || value < 1 || value > 2147483647)) { setError('수량을 양의 정수로 입력해 주세요.'); return }
    setBusy(true); setError('')
    try { if (remove) await api.cart.remove(item.id); else await api.cart.update(item.id, value); reload() }
    catch (e) { setError(e instanceof Error ? e.message : '처리하지 못했어요.') }
    finally { setBusy(false) }
  }
  return <section className={styles.card}>
    {p.data ? <><Thumbnail src={p.data.imageUrl} alt={p.data.name} /><h2>{p.data.name}</h2><p>{formatPrice(p.data.price)}</p></> : <p>{p.loading ? '상품 조회 중…' : '현재 구매할 수 없는 상품이에요.'}</p>}
    {error && <Alert type="danger" title="처리하지 못했어요">{error}</Alert>}
    <Input label="수량" inputMode="numeric" value={quantity} onChange={e => setQuantity(e.target.value)} disabled={busy} />
    <Button variant="secondary" onClick={() => change()} disabled={busy}>수량 저장</Button>
    <Button variant="secondary" onClick={() => change(true)} disabled={busy}>삭제</Button>
    {p.data?.status === 'SELLING' && item.quantity <= p.data.stock && !busy && quantity === String(item.quantity) && <ButtonLink to={`/checkout?productId=${item.productId}&quantity=${item.quantity}&cartItemId=${item.id}`}>이 상품 주문</ButtonLink>}
  </section>
}
