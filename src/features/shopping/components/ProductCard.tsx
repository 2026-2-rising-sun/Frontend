import { Link } from 'react-router-dom'
import { StatusBadge, Thumbnail, productBadge } from '../../../components/ui'
import type { Product } from '../../../domain/types'
import { formatPrice } from '../../../lib/format'
import { ProductCouponHint } from '../../coupons/ProductCouponHint'
import { reviewCount, satisfiedPercent } from '../satisfaction'
import styles from './ProductCard.module.css'

/**
 * 상품 카드. 정사각 이미지 아래에 브랜드, 상품명, 원가와 베리특가, 만족도와 리뷰 수, 무료배송을 보여 준다.
 * 브랜드, 원가, 만족도, 무료배송은 값이 있을 때만 그린다. 품절은 조회 가능, 구매 불가로 표시한다.
 */
export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.status === 'SOLD_OUT'
  const satisfied = satisfiedPercent(product.satisfaction)
  return (
    <Link to={`/products/${product.id}`} className={[styles.card, soldOut && styles.soldOut].filter(Boolean).join(' ')}>
      <Thumbnail src={product.imageUrl} alt={product.name} ratio="1 / 1" className={styles.thumb}>
        {soldOut && <span className={styles.dim}>품절</span>}
      </Thumbnail>
      <div className={styles.info}>
        {product.brand && <p className={styles.brand}>{product.brand}</p>}
        <p className={styles.name}>{product.name}</p>
        <div className={styles.prices}>
          {product.originalPrice && <del className={styles.original} aria-label={`원가 ${formatPrice(product.originalPrice)}`}>{formatPrice(product.originalPrice)}</del>}
          <p className={styles.price}>{product.originalPrice && <span className={styles.deal}>베리특가</span>}{formatPrice(product.price)}</p>
        </div>
        {satisfied !== null && <p className={styles.rating}>
          <svg viewBox="0 0 24 24" className={styles.star} aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>
          <span>{satisfied}% 만족</span><span className={styles.reviews}>리뷰 {reviewCount(product.satisfaction).toLocaleString('ko-KR')}</span>
        </p>}
        {product.freeShipping && <p className={styles.tags}><span className={styles.tag}>무료배송</span></p>}
        {product.status !== 'SELLING' && <StatusBadge status={productBadge(product.status)} />}
        <ProductCouponHint productId={product.id} />
      </div>
    </Link>
  )
}
