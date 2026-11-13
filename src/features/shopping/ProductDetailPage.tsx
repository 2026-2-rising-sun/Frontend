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
import { ProductOptions } from './components/ProductOptions'
import { SatisfactionSummary } from './components/SatisfactionSummary'
import { Stars } from './components/Stars'
import { recordRecentProduct } from './recentProducts'
import { reviewCount, satisfiedPercent } from './satisfaction'
import styles from './ProductDetailPage.module.css'

export function ProductDetailPage() {
  const { productId = '' } = useParams()
  return <ProductPage key={productId} productId={productId} />
}

function ProductPage({ productId }: { productId: string }) {
  const api = useApi()
  const product = useAsync(() => api.products.get(productId), [api, productId])
  // 홈의 "최근 본 상품과 연관 추천 상품"에 쓰도록 실제로 조회된 상품만 기록한다.
  useEffect(() => { if (product.data) recordRecentProduct(product.data.id) }, [product.data])
  return <div className={styles.surface}><PageContainer className={styles.page}>
    <nav aria-label="현재 위치" className={styles.breadcrumb}><Link to="/">홈</Link><span aria-hidden="true">/</span><span>상품 상세</span></nav>
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
  // 옵션 묶음마다 고른 값의 순번. 모두 골라야 담기와 구매를 할 수 있고, 고른 값의 추가 금액을 단가에 더한다.
  const groups = product.options ?? []
  const [chosen, setChosen] = useState(() => groups.map(() => ''))
  const picked = groups.map((group, index) => chosen[index] === '' ? null : group.values[Number(chosen[index])])
  const ready = picked.every(Boolean)
  const unitPrice = product.price + picked.reduce((sum, value) => sum + (value?.extraPrice ?? 0), 0)

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
    if (inFlight.current || !buyable || !ready) return
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
        <div className={styles.titleBlock}>
          {product.brand && <p className={styles.brand}>{product.brand}</p>}
          <h1 className={`t-h1 ${styles.name}`}>{product.name}</h1>
          <ReviewLine product={product} />
          {product.freeShipping && <p className={styles.tags}><span className={styles.tag}>무료배송</span></p>}
        </div>
        <div className={styles.prices}>
          {product.originalPrice && <del className={styles.original} aria-label={`원가 ${formatPrice(product.originalPrice)}`}>{formatPrice(product.originalPrice)}</del>}
          <p className="t-price-lg">{product.originalPrice && <span className={styles.deal}>베리특가</span>}{formatPrice(product.price)}</p>
        </div>
        {product.description && <a href="#product-description" className={styles.summary}>{product.description}</a>}
        {product.featuredLive && <Link to={`/lives/${product.featuredLive.id}`} className={styles.live}><StatusBadge status="live" /><span>{product.featuredLive.title}에서 소개된 상품이에요</span></Link>}
        <ProductCoupons productId={product.id} price={product.price} />
        {product.status === 'SOLD_OUT' && <AlertSubscription kind="restock" targetId={product.id} />}
        {groups.length > 0 && <ProductOptions groups={groups} chosen={chosen} onChange={setChosen} disabled={!buyable || busy} />}
        <div className={styles.actions} ref={actionsRef}>
          <div className={styles.purchaseSummary}>
            <div className={styles.qtyRow}><span>수량</span><QuantityStepper value={quantity} onChange={setQuantity} max={product.stock ?? 1} disabled={!buyable || busy} /></div>
            <div className={styles.totalRow}><span>총 상품 금액</span><strong className="t-price-lg">{formatPrice(unitPrice * quantity)}</strong></div>
          </div>
          {groups.length > 0 && <p className={styles.picked} aria-live="polite">{ready ? `선택한 옵션: ${picked.map(value => value!.label).join(', ')}` : '옵션을 모두 선택해 주세요'}</p>}
          {notice && <Alert type={notice.type} title={notice.text} />}
          <div className={styles.buttons}>
            {buyable && <Button size="L" variant="secondary" disabled={busy || !ready} onClick={addCart}>{busy ? '담는 중…' : '장바구니 담기'}</Button>}
            {buyable && !ready ? <Button size="L" disabled>바로 구매</Button> : buyable ? <ButtonLink size="L" to={`/checkout?productId=${product.id}&quantity=${quantity}`}>바로 구매</ButtonLink> : <Button size="L" fullWidth disabled>{product.status === 'SOLD_OUT' || product.stock === 0 ? '품절' : '구매할 수 없어요'}</Button>}
          </div>
        </div>
      </div>
    </div>
    {product.satisfaction && <SatisfactionSummary satisfaction={product.satisfaction} />}
    <section id="product-description" className={styles.description} aria-labelledby="description-heading"><h2 id="description-heading" className="t-h2">상품 설명</h2><p>{product.description || '등록된 상품 설명이 없어요.'}</p></section>
  </div>
}

/** 제목 아래 별점 줄. 평균 단계만큼 별을 칠하고, 리뷰 수를 누르면 상품 만족도로 이동한다. 리뷰가 없으면 숨긴다. */
function ReviewLine({ product }: { product: Product }) {
  const s = product.satisfaction
  const total = reviewCount(s)
  if (!s || !total) return null
  const average = (s.veryGood * 4 + s.good * 3 + s.bad * 2 + s.veryBad) / total
  return <p className={styles.reviewLine}>
    <Stars filled={Math.round(average)} tone="gold" />
    <span>{satisfiedPercent(s)}% 만족</span>
    <a href="#satisfaction" className={styles.reviewLink}>리뷰 {total.toLocaleString('ko-KR')}</a>
  </p>
}
