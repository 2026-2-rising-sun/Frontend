import { useRef, useState } from 'react'
import { useApi } from '../../app/apiContext'
import { PageContainer } from '../../components/PageContainer'
import { AsyncView } from '../../components/AsyncView'
import { Alert, Button, ButtonLink, QuantityStepper, ResultState, Skeleton, Thumbnail } from '../../components/ui'
import { useAsync } from '../../hooks/useAsync'
import type { Api, CartItem } from '../../domain/ports'
import type { Product } from '../../domain/types'
import { formatPrice } from '../../lib/format'
import styles from './CartPage.module.css'

type CartEntry = { item: CartItem; product?: Product }
async function readCart(api: Api): Promise<CartEntry[]> {
  const items = await api.cart.list()
  return Promise.all(items.map(async item => {
    try { return { item, product: await api.products.get(item.productId) } }
    catch { return { item } }
  }))
}

export function CartPage() {
  const api = useApi()
  const data = useAsync(() => readCart(api), [api])
  return <PageContainer narrow><h1 className="t-h1">장바구니</h1><p>상품별로 주문할 수 있어요.</p>
    <AsyncView state={data} skeleton={<Skeleton height={200} />}>
      {entries => <CartContents key={data.updatedAt?.getTime()} initial={entries} />}
    </AsyncView>
  </PageContainer>
}

function CartContents({ initial }: { initial: CartEntry[] }) {
  const api = useApi()
  const [entries, setEntries] = useState(initial)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inFlight = useRef(false)

  async function change(id?: string, quantity?: number) {
    if (inFlight.current) return
    if (quantity !== undefined && (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2147483647)) return
    inFlight.current = true; setBusy(true); setError('')
    let mutationError = ''
    try {
      if (id !== undefined) {
        try {
          if (quantity === undefined) await api.cart.remove(id)
          else await api.cart.update(id, quantity)
        } catch (e) { mutationError = e instanceof Error ? e.message : '처리하지 못했어요.' }
      }
      // 실패한 변경도 서버에 반영되었을 수 있으므로, 쓰기를 재시도하지 않고 전체를 조회한다.
      setEntries(await readCart(api))
      setError(mutationError)
    } catch (e) {
      setError([mutationError, e instanceof Error ? e.message : '장바구니를 확인하지 못했어요.'].filter(Boolean).join(' '))
    } finally { inFlight.current = false; setBusy(false) }
  }

  const total = entries.reduce((sum, { item, product }) => sum + (product?.price ?? 0) * item.quantity, 0)
  const pricesKnown = entries.every(entry => entry.product !== undefined) && Number.isSafeInteger(total)
  return <>
    {error && <Alert type="danger" title="장바구니를 다시 확인해 주세요">{error}<Button variant="secondary" onClick={() => { void change() }} disabled={busy}>다시 조회</Button></Alert>}
    {!entries.length ? <ResultState type="empty" title="장바구니가 비어 있어요" /> : <>
      {entries.map(({ item, product }) => <CartRow key={item.id} item={item} product={product} busy={busy} canOrder={!error} change={change} />)}
      <section className={styles.total} aria-label="장바구니 합계" aria-live="polite">
        <span>총 상품 금액</span><strong>{pricesKnown ? formatPrice(total) : '가격 확인 필요'}</strong>
        <small>최종 결제 금액은 주문서에서 확인해 주세요.</small>
      </section>
    </>}
  </>
}

function CartRow({ item, product, busy, canOrder, change }: { item: CartItem; product?: Product; busy: boolean; canOrder: boolean; change: (id?: string, quantity?: number) => Promise<void> }) {
  const amount = product ? product.price * item.quantity : undefined
  return <section className={styles.card}>
    {product ? <div className={styles.summary}><Thumbnail src={product.imageUrl} alt={product.name} /><div className={styles.details}><h2 className="t-h4">{product.name}</h2><p>개당 {formatPrice(product.price)}</p><p aria-label="상품 금액" aria-live="polite"><strong>{amount !== undefined && Number.isSafeInteger(amount) ? formatPrice(amount) : '가격 확인 필요'}</strong></p></div></div> : <p>현재 구매할 수 없는 상품이에요.</p>}
    <div className={styles.actions}>
      <QuantityStepper value={item.quantity} min={1} max={Math.min(Math.max(product?.stock ?? 1, 1), 2147483647)} onChange={quantity => { void change(item.id, quantity) }} disabled={busy || !product} />
      <Button variant="secondary" onClick={() => { void change(item.id) }} disabled={busy}>삭제</Button>
    </div>
    {product?.status === 'SELLING' && item.quantity <= product.stock && !busy && canOrder && <ButtonLink to={`/checkout?productId=${item.productId}&quantity=${item.quantity}&cartItemId=${item.id}`}>이 상품 주문</ButtonLink>}
  </section>
}
