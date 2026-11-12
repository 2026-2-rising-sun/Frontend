import { useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { Chip } from '../../components/ui'
import { PRODUCT_CATEGORIES, isProductCategory } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { ProductCard } from './components/ProductCard'
import { ProductGridSkeleton } from './components/ProductGrid'
import { loadRanking } from './rankingProducts'
import styles from './RankingPage.module.css'

/** 랭킹 화면. 순위 기준은 loadRanking 을 따른다. */
export function RankingPage() {
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const raw = params.get('category')?.toUpperCase()
  const category = isProductCategory(raw) ? raw : undefined
  const ranking = useAsync(() => loadRanking(api, category), [api, category])
  const select = (value?: string) => setParams(value ? { category: value.toLowerCase() } : {})

  return <PageContainer>
    <div className={styles.head}>
      <h1 className="t-h1">랭킹</h1>
      <p className={styles.caption}>인기 집계를 준비하는 동안 새로 들어온 판매 상품 순서로 보여드려요.</p>
    </div>
    <div className={styles.chips} role="group" aria-label="랭킹 카테고리">
      <Chip selected={!category} onClick={() => select()}>전체</Chip>
      {PRODUCT_CATEGORIES.map(item => <Chip key={item.value} selected={category === item.value} onClick={() => select(item.value)}>{item.label}</Chip>)}
    </div>
    <AsyncView state={ranking} skeleton={<ProductGridSkeleton />} isEmpty={items => items.length === 0} emptyTitle="순위에 올릴 상품이 아직 없어요" emptyMessage="다른 카테고리를 선택해 보세요.">
      {items => <ol className={styles.grid}>
        {items.map((product, index) => <li key={product.id} className={styles.item}>
          <span className={[styles.rank, index < 3 && styles.top].filter(Boolean).join(' ')} aria-label={`${index + 1}위`}>{index + 1}</span>
          <ProductCard product={product} />
        </li>)}
      </ol>}
    </AsyncView>
  </PageContainer>
}
