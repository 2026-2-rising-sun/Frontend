import { useSession } from '../auth/useSession'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Alert, Button, ButtonLink, QuantityStepper, Skeleton, StatusBadge, Thumbnail, productBadge } from '../../components/ui'
import type { Product } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import styles from './ProductDetailPage.module.css'

export function ProductDetailPage() {
  const { productId = '' } = useParams()
  const api = useApi()
  const product = useAsync(() => api.products.get(productId), [api, productId])

  return (
    <PageContainer className={styles.page}>
      <AsyncView
        state={product}
        skeleton={
          <div className={styles.layout}>
            <Skeleton height={0} style={{ aspectRatio: '1 / 1', height: 'auto' }} radius={20} />
            <div className={styles.info}>
              <Skeleton width={80} height={24} radius={12} />
              <Skeleton width="70%" height={32} />
              <Skeleton width={120} height={32} />
            </div>
          </div>
        }
      >
        {(p) => <ProductDetail product={p} />}
      </AsyncView>
    </PageContainer>
  )
}

function ProductDetail({ product }: { product: Product }) {
  const api = useApi(); const navigate = useNavigate(); const session = useSession()
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState('')
  async function addCart() {
    if (!session) { navigate('/login', { state: { from: `/products/${product.id}` } }); return }
    if (busy) return
    setBusy(true); setNotice('')
    try { await api.cart.add(product.id, quantity); setNotice('장바구니에 담았어요.') }
    catch (e) { setNotice(e instanceof Error ? e.message : '장바구니에 담지 못했어요.') }
    finally { setBusy(false) }
  }
  const [quantity, setQuantity] = useState(1)
  const buyable = product.status === 'SELLING' && product.stock > 0

  return (
    <div className={styles.layout}>
      <Thumbnail src={product.imageUrl} alt={product.name} className={styles.image} />

      <div className={styles.info}>
        <StatusBadge status={productBadge(product.status)} />
        <h1 className={`t-h1 ${styles.name}`}>{product.name}</h1>
        <p className="t-price-lg">{formatPrice(product.price)}</p>
        <p className={`t-body-lg ${styles.desc}`}>{product.description}</p>
        {buyable && product.stock <= 10 && <p className={styles.stock}>재고 {product.stock}개 남음</p>}

        {product.featuredLive && (
          <Link to={`/lives/${product.featuredLive.id}`} className={styles.live}>
            <StatusBadge status="live" />
            <span>{product.featuredLive.title}에서 소개된 상품이에요</span>
          </Link>
        )}

        {/* 모바일: 하단 고정 바 / 데스크톱: 정보 영역 안의 구매 블록 */}
        <div className={styles.actions}>
          <div className={styles.qtyRow}>
            <span className={styles.qtyLabel}>수량</span>
            <QuantityStepper value={quantity} onChange={setQuantity} max={product.stock} disabled={!buyable} />
          </div>
          <div className={styles.totalRow}>
            <span>총 상품 금액</span>
            <span className="t-price-lg">{formatPrice(product.price * quantity)}</span>
          </div>
          {notice && <Alert type="info" title={notice} />}
          {buyable && <Button variant="secondary" disabled={busy} onClick={addCart}>장바구니 담기</Button>}
          {buyable ? (
            <ButtonLink size="L" className={styles.buy} to={`/checkout?productId=${product.id}&quantity=${quantity}`}>
              바로 구매
            </ButtonLink>
          ) : (
            <Button size="L" className={styles.buy} disabled>
              {product.status === 'SOLD_OUT' || product.stock === 0 ? '품절' : '구매할 수 없어요'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
