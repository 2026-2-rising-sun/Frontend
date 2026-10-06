import { Link } from 'react-router-dom'
import { Button, ButtonLink, Thumbnail } from '../../../components/ui'
import type { Product } from '../../../domain/types'
import { formatPrice } from '../../../lib/format'
import styles from './LiveProductItem.module.css'

/**
 * Figma "Live Product Item" (Selling · SoldOut).
 * 방송 상품은 P1 에서 "바로 구매"만 제공한다 (장바구니는 P2). 주문 화면은 일반 구매와 동일하다.
 */
export function LiveProductItem({ product }: { product: Product }) {
  const soldOut = product.missing || product.status !== 'SELLING' || product.purchasable === false
  return (
    <div className={[styles.item, soldOut && styles.soldOut].filter(Boolean).join(' ')}>
      <Link to={`/products/${product.id}`} className={styles.link}>
        <Thumbnail src={product.imageUrl} alt={product.name} className={styles.thumb} />
        <span className={styles.text}>
          <span className={styles.name}>{product.name}</span>
          <span className={styles.price}>{formatPrice(product.price)}</span>
        </span>
      </Link>
      {soldOut ? (
        <Button size="S" disabled>
          품절
        </Button>
      ) : (
        <ButtonLink size="S" to={`/checkout?productId=${product.id}&quantity=1`}>
          바로 구매
        </ButtonLink>
      )}
    </div>
  )
}
