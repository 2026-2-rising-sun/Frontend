import { NavLink, useParams, useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PagedView } from '../../components/PagedView'
import { PageContainer } from '../../components/PageContainer'
import { PRODUCT_CATEGORIES } from '../../domain/types'
import { usePaged } from '../../hooks/usePaged'
import { NotFoundPage } from '../../app/NotFoundPage'
import { ProductGrid, ProductGridSkeleton } from './components/ProductGrid'
import { FilterChips, SortButton } from './components/ProductListToolbar'
import { readFilter, writeFilter, type ProductFilter } from './productFilter'
import styles from './CategoryPage.module.css'

const PAGE_SIZE = 12

/** 1단계 분류별 공개 상품 목록. 주소는 /categories/beauty 처럼 소문자 분류값을 쓴다. 정렬(기본 랭킹순)과 무료배송, 가격 필터는 주소에 담는다. */
export function CategoryPage() {
  const { category: slug = '' } = useParams()
  const category = PRODUCT_CATEGORIES.find(item => item.value === slug.toUpperCase())
  if (!category) return <NotFoundPage />
  return <CategoryProducts key={category.value} value={category.value} label={category.label} />
}

function CategoryProducts({ value, label }: { value: (typeof PRODUCT_CATEGORIES)[number]['value']; label: string }) {
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const filter = readFilter(params)
  const update = (next: ProductFilter) => setParams(writeFilter(params, next), { replace: true })
  const products = usePaged((page, cursor) => api.products.list({ cursor, page, size: PAGE_SIZE, category: value, sort: filter.sort, freeShipping: filter.freeShipping, minPrice: filter.minPrice, maxPrice: filter.maxPrice }),
    [api, value, filter.sort, filter.freeShipping, filter.minPrice, filter.maxPrice])
  return <PageContainer>
    <nav className={styles.tabs} aria-label="카테고리">
      {PRODUCT_CATEGORIES.map(item => <NavLink key={item.value} to={`/categories/${item.value.toLowerCase()}`} className={({ isActive }) => [styles.tab, isActive && styles.active].filter(Boolean).join(' ')}>{item.label}</NavLink>)}
    </nav>
    <section className={styles.section} aria-labelledby="category-heading">
      <div className={styles.head}>
        <h1 id="category-heading" className="t-h2">{label}</h1>
        <SortButton sort={filter.sort} onChange={sort => update({ ...filter, sort })} />
      </div>
      <FilterChips filter={filter} onChange={update} />
      <PagedView infinite state={products} skeleton={<ProductGridSkeleton />}
        emptyTitle={filter.freeShipping || filter.minPrice !== undefined || filter.maxPrice !== undefined ? '조건에 맞는 상품이 없어요' : `${label} 상품이 아직 없어요`}
        emptyMessage={filter.freeShipping || filter.minPrice !== undefined || filter.maxPrice !== undefined ? '필터를 바꿔 보세요.' : '다른 카테고리를 둘러보세요.'}>
        {items => <ProductGrid products={items} />}
      </PagedView>
    </section>
  </PageContainer>
}
