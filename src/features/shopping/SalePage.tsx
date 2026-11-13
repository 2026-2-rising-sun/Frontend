import { useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PagedView } from '../../components/PagedView'
import { PageContainer } from '../../components/PageContainer'
import { Chip } from '../../components/ui'
import type { ProductSort } from '../../domain/types'
import { usePaged } from '../../hooks/usePaged'
import { ProductCard } from './components/ProductCard'
import { ProductGridSkeleton } from './components/ProductGrid'
import { fetchSalePage } from './saleProducts'
import styles from './SalePage.module.css'

type SaleSort = ProductSort | 'POPULAR' | 'SALES'
/** 인기순과 판매수량순은 집계 API가 생기면 enabled 를 켠다. */
const SORTS: { value: SaleSort; label: string; enabled: boolean }[] = [
  { value: 'POPULAR', label: '인기순', enabled: false },
  { value: 'LATEST', label: '최근등록순', enabled: true },
  { value: 'SALES', label: '판매수량순', enabled: false },
  { value: 'PRICE_ASC', label: '낮은 가격순', enabled: true },
  { value: 'PRICE_DESC', label: '높은 가격순', enabled: true },
]

/** 세일: 지금 쿠폰 할인을 받을 수 있는 판매 중 상품. 정렬은 서버가 지원하는 기준만 켠다. */
export function SalePage() {
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const sort = (SORTS.find(s => s.enabled && s.value === params.get('sort'))?.value ?? 'LATEST') as ProductSort
  const sale = usePaged((page, cursor) => fetchSalePage(api, sort, page, cursor), [api, sort])

  return <PageContainer>
    <div className={styles.head}>
      <h1 className="t-h1">세일</h1>
      <p className={styles.caption}>지금 쿠폰 할인을 받을 수 있는 상품이에요.</p>
    </div>
    <div className={styles.sorts} role="group" aria-label="정렬 기준">
      {SORTS.map(item => <Chip key={item.value} selected={item.value === sort} disabled={!item.enabled} onClick={() => setParams(item.value === 'LATEST' ? {} : { sort: item.value })}>
        {item.label}{!item.enabled && <span className={styles.soon}> 준비 중</span>}
      </Chip>)}
    </div>
    <PagedView infinite state={sale} skeleton={<ProductGridSkeleton />} emptyTitle="지금 세일 중인 상품이 없어요" emptyMessage="쿠폰 행사가 열리면 이곳에 모아 보여드려요.">
      {items => <ul className={styles.grid}>
        {items.map(({ product, discount }) => <li key={product.id} className={styles.item}>
          <ProductCard product={product} variant="deal" couponDiscount={discount} />
        </li>)}
      </ul>}
    </PagedView>
  </PageContainer>
}
