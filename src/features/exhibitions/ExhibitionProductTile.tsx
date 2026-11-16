import { Link } from 'react-router-dom'
import { Thumbnail } from '../../components/ui'
import type { Product } from '../../domain/types'
import { formatPrice } from '../../lib/format'
import { displayPrice } from '../shopping/liveDeal'
import { DELIVERY_LABEL } from '../shopping/productCardInfo'
import styles from './ExhibitionProductTile.module.css'

/** 기획전 상품 칸. 가운데 정렬로 사진, 브랜드, 이름 두 줄, 할인 전 가격과 판매가, 혜택 표시를 보여 준다. */
export function ExhibitionProductTile({ product }: { product: Product }) {
  const shown = displayPrice(product)
  const tags = [
    shown.deal ? { label: '베리특가', tone: styles.deal } : shown.before !== null && { label: '세일', tone: styles.sale },
    product.freeShipping && { label: '무료배송', tone: styles.free },
    product.delivery && { label: DELIVERY_LABEL[product.delivery], tone: styles.delivery },
  ].filter(Boolean) as { label: string; tone: string }[]
  return <Link to={`/products/${product.id}`} className={styles.tile}>
    <Thumbnail src={product.imageUrl} alt={product.name} className={styles.thumb} />
    {product.brand && <span className={styles.brand}>{product.brand}</span>}
    <span className={styles.name}>{product.name}</span>
    <span className={styles.price}>
      {shown.before !== null && <del aria-label={`할인 전 ${formatPrice(shown.before)}`}>{formatPrice(shown.before)}</del>}
      <strong>{formatPrice(shown.price)}</strong>
    </span>
    {tags.length > 0 && <span className={styles.tags}>{tags.map(tag => <span key={tag.label} className={tag.tone}>{tag.label}</span>)}</span>}
  </Link>
}
