import { Skeleton } from '../../../components/ui'
import type { Product } from '../../../domain/types'
import { ProductCard } from './ProductCard'
import styles from './ProductGrid.module.css'

/** 반응형 상품 그리드: 모바일 2열 → 태블릿 3열 → 데스크톱 4열 */
export function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className={styles.grid}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={styles.grid} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.skeletonCard}>
          <Skeleton height={0} style={{ aspectRatio: '1 / 1', height: 'auto' }} radius={14} />
          <Skeleton width="80%" />
          <Skeleton width="40%" />
        </div>
      ))}
    </div>
  )
}
