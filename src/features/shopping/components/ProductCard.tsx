import { Link } from 'react-router-dom'
import { StatusBadge, Thumbnail, productBadge } from '../../../components/ui'
import type { Product } from '../../../domain/types'
import { formatPrice } from '../../../lib/format'
import { ProductCouponHint } from '../../coupons/ProductCouponHint'
import { displayPrice } from '../liveDeal'
import { reviewCount, satisfiedPercent } from '../satisfaction'
import styles from './ProductCard.module.css'

/**
 * 상품 카드. 정사각 이미지 아래에 브랜드, 상품명, 가격, 만족도와 리뷰 수, 주문중과 무료배송을 보여 준다.
 * 라이브 할인 기간에만 "베리특가"와 구경중을 붙인다. 값이 없는 정보는 그리지 않는다. 품절은 조회 가능, 구매 불가로 표시한다.
 */
export function ProductCard({ product }: { product: Product }) {
  const soldOut = product.status === 'SOLD_OUT'
  const satisfied = satisfiedPercent(product.satisfaction)
  const shown = displayPrice(product)
  const count = (n: number) => n.toLocaleString('ko-KR')
  return (
    <Link to={`/products/${product.id}`} className={[styles.card, soldOut && styles.soldOut].filter(Boolean).join(' ')}>
      <Thumbnail src={product.imageUrl} alt={product.name} ratio="1 / 1" className={styles.thumb}>
        {soldOut && <span className={styles.dim}>품절</span>}
      </Thumbnail>
      <div className={styles.info}>
        {product.brand && <p className={styles.brand}>{product.brand}</p>}
        <p className={styles.name}>{product.name}</p>
        <div className={styles.prices}>
          {shown.before !== null && <del className={styles.original} aria-label={`할인 전 ${formatPrice(shown.before)}`}>{formatPrice(shown.before)}</del>}
          <p className={styles.price}>{shown.deal && <span className={styles.deal}>베리특가</span>}{formatPrice(shown.price)}</p>
        </div>
        {satisfied !== null && <p className={styles.rating}>
          <svg viewBox="0 0 24 24" className={styles.star} aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" /></svg>
          <span>{satisfied}% 만족</span><span className={styles.reviews}>리뷰 {reviewCount(product.satisfaction).toLocaleString('ko-KR')}</span>
        </p>}
        {(product.orderingCount != null || product.freeShipping) && <p className={styles.tags}>
          {product.orderingCount != null && <span className={[styles.tag, styles.live].join(' ')}>주문중 {count(product.orderingCount)}</span>}
          {shown.deal && product.viewingCount != null && <span className={[styles.tag, styles.live].join(' ')}>구경중 {count(product.viewingCount)}</span>}
          {product.freeShipping && <span className={styles.tag}>무료배송</span>}
        </p>}
        {product.status !== 'SELLING' && <StatusBadge status={productBadge(product.status)} />}
        <ProductCouponHint productId={product.id} />
      </div>
    </Link>
  )
}
