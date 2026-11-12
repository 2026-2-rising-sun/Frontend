import { Link } from 'react-router-dom'
import { StatusBadge, Thumbnail, productBadge } from '../../../components/ui'
import type { Product } from '../../../domain/types'
import { formatPrice } from '../../../lib/format'
import { ProductCouponHint } from '../../coupons/ProductCouponHint'
import styles from './ProductCard.module.css'

/** Figma "Product Card" (Selling · SoldOut). 품절은 조회 가능·구매 불가로 표시한다. */
export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.status === 'SOLD_OUT'
  return (
    <Link to={`/products/${product.id}`} className={[styles.card, soldOut && styles.soldOut].filter(Boolean).join(' ')}>
      <Thumbnail src={product.imageUrl} alt={product.name} ratio="282 / 240" className={styles.thumb}>
        {soldOut && <span className={styles.dim}>품절</span>}
      </Thumbnail>
      <div className={styles.info}>
        <p className={styles.name}>{product.name}</p>
        <p className={styles.price}>{formatPrice(product.price)}</p>
        <p className={styles.stock}>{product.stock === null ? '재고 확인 필요' : `남은 재고 ${product.stock.toLocaleString('ko-KR')}개`}</p>
        {product.status !== 'SELLING' && <StatusBadge status={productBadge(product.status)} />}
        <ProductCouponHint productId={product.id} />
      </div>
    </Link>
  )
}
