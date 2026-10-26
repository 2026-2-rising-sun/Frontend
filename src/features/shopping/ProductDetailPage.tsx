import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, ButtonLink, QuantityStepper, Skeleton, StatusBadge, Thumbnail, productBadge } from '../../components/ui'
import type { Product } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import { ProductCoupons } from '../coupons/ProductCoupons'
import { AlertSubscription } from '../notifications/AlertSubscription'
import { useSession } from '../auth/useSession'
import styles from './ProductDetailPage.module.css'

export function ProductDetailPage() {
  const { productId = '' } = useParams()
  return <ProductPage key={productId} productId={productId} />
}

function ProductPage({ productId }: { productId: string }) {
  const api = useApi()
  const product = useAsync(() => api.products.get(productId), [api, productId])
  return <div className={styles.surface}><PageContainer className={styles.page}>
    <nav aria-label="현재 위치" className={styles.breadcrumb}><Link to="/">쇼핑</Link><span aria-hidden="true">/</span><span>상품 상세</span></nav>
    <AsyncView state={product} skeleton={<div className={styles.layout}><Skeleton height={0} style={{ aspectRatio: '672 / 520', height: 'auto' }} radius={20} /><Skeleton height={320} radius={14} /></div>}>
      {p => <ProductDetail product={p} />}
    </AsyncView>
  </PageContainer></div>
}

function ProductDetail({ product }: { product: Product }) {
  const api = useApi()
  const navigate = useNavigate()
  const session = useSession()
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ type: 'success' | 'danger'; text: string } | null>(null)
  const [quantity, setQuantity] = useState(1)
  const inFlight = useRef(false)
  const productRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const buyable = product.status === 'SELLING' && product.stock !== null && product.stock > 0

  // 오류 안내와 글자 크기에 따라 달라지는 모바일 구매 바의 높이만큼 여백을 확보한다.
  useEffect(() => {
    const actions = actionsRef.current
    if (!actions) return
    const observer = new ResizeObserver(() => productRef.current?.style.setProperty('--purchase-bar-height', `${actions.getBoundingClientRect().height}px`))
    observer.observe(actions)
    return () => observer.disconnect()
  }, [])

  async function addCart() {
    if (!session) { navigate('/login', { state: { from: `/products/${product.id}` } }); return }
    if (inFlight.current || !buyable) return
    inFlight.current = true; setBusy(true); setNotice(null)
    try { await api.cart.add(product.id, quantity); setNotice({ type: 'success', text: '장바구니에 담았어요.' }) }
    catch (e) { setNotice({ type: 'danger', text: e instanceof Error ? e.message : '장바구니에 담지 못했어요.' }) }
    finally { inFlight.current = false; setBusy(false) }
  }

  return <div className={styles.product} ref={productRef}>
    <div className={styles.layout}>
      <div className={styles.gallery}><Thumbnail src={product.imageUrl} alt={product.name} ratio="672 / 520" className={styles.image} /><p>상품 이미지</p></div>
      <div className={styles.info}>
        {product.status !== 'SELLING' && <StatusBadge status={productBadge(product.status)} />}
        <h1 className={`t-h1 ${styles.name}`}>{product.name}</h1>
        <p className="t-price-lg">{formatPrice(product.price)}</p>
        {product.description && <a href="#product-description" className={styles.summary}>{product.description}</a>}
        {buyable && product.stock !== null && product.stock <= 10 && <p className={styles.stock}>재고 {product.stock}개 남음</p>}
        {product.featuredLive && <Link to={`/lives/${product.featuredLive.id}`} className={styles.live}><StatusBadge status="live" /><span>{product.featuredLive.title}에서 소개된 상품이에요</span></Link>}
        <ProductCoupons productId={product.id} price={product.price} />
        {product.status === 'SOLD_OUT' && <AlertSubscription kind="restock" targetId={product.id} />}
        <div className={styles.actions} ref={actionsRef}>
          <div className={styles.purchaseSummary}>
            <div className={styles.qtyRow}><span>수량</span><QuantityStepper value={quantity} onChange={setQuantity} max={product.stock ?? 1} disabled={!buyable || busy} /></div>
            <div className={styles.totalRow}><span>총 상품 금액</span><strong className="t-price-lg">{formatPrice(product.price * quantity)}</strong></div>
          </div>
          {notice && <Alert type={notice.type} title={notice.text} />}
          <div className={styles.buttons}>
            {buyable && <Button size="L" variant="secondary" disabled={busy} onClick={addCart}>{busy ? '담는 중…' : '장바구니 담기'}</Button>}
            {buyable ? <ButtonLink size="L" to={`/checkout?productId=${product.id}&quantity=${quantity}`}>바로 구매</ButtonLink> : <Button size="L" fullWidth disabled>{product.status === 'SOLD_OUT' || product.stock === 0 ? '품절' : '구매할 수 없어요'}</Button>}
          </div>
        </div>
      </div>
    </div>
    <section id="product-description" className={styles.description} aria-labelledby="description-heading"><h2 id="description-heading" className="t-h2">상품 설명</h2><p>{product.description || '등록된 상품 설명이 없어요.'}</p></section>
  </div>
}
