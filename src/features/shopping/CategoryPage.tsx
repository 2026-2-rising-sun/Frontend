import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PagedView } from '../../components/PagedView'
import { PageContainer } from '../../components/PageContainer'
import { subcategoriesOf } from '../../domain/subcategories'
import { PRODUCT_CATEGORIES } from '../../domain/types'
import { usePaged } from '../../hooks/usePaged'
import { NotFoundPage } from '../../app/NotFoundPage'
import { ProductGrid, ProductGridSkeleton } from './components/ProductGrid'
import { FilterChips, SortButton } from './components/ProductListToolbar'
import { readFilter, writeFilter, type ProductFilter } from './productFilter'
import styles from './CategoryPage.module.css'

const PAGE_SIZE = 12
/** 식품, 생활은 양과 묶음을 비교하는 상품이 많아 단위가격을 보이는 가성비형 카드를 쓴다. */
const VALUE_CATEGORIES: readonly string[] = ['FOOD', 'LIVING']

/**
 * 1단계 분류별 공개 상품 목록. 주소는 /categories/beauty 처럼 소문자 분류값을 쓴다.
 * 위 칩은 그 분류의 세부 분류(?sub=)를 고른다. 정렬(기본 랭킹순)과 무료배송, 가격 필터도 주소에 담는다.
 */
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
  const subcategories = subcategoriesOf(value)
  const sub = subcategories.find(item => item.value === params.get('sub')) ?? null
  /** 세부 분류만 바꾼 주소. 정렬과 필터는 그대로 둔다. */
  const subSearch = (next: string | null) => { const search = new URLSearchParams(params); if (next) search.set('sub', next); else search.delete('sub'); return `?${search}` }
  const products = usePaged((page, cursor) => api.products.list({ cursor, page, size: PAGE_SIZE, category: value, subcategory: sub?.value, sort: filter.sort, freeShipping: filter.freeShipping, minPrice: filter.minPrice, maxPrice: filter.maxPrice }),
    [api, value, sub?.value, filter.sort, filter.freeShipping, filter.minPrice, filter.maxPrice])
  return <PageContainer>
    <nav className={styles.tabs} aria-label={`${label} 세부 카테고리`}>
      {[{ value: null, label: '전체' }, ...subcategories].map(item => <Link key={item.value ?? 'all'} to={subSearch(item.value)} replace
        aria-current={item.value === (sub?.value ?? null) ? 'page' : undefined} className={[styles.tab, item.value === (sub?.value ?? null) && styles.active].filter(Boolean).join(' ')}>{item.label}</Link>)}
    </nav>
    <section className={styles.section} aria-labelledby="category-heading">
      <div className={styles.head}>
        <h1 id="category-heading" className="t-h2">{sub ? sub.label : label}</h1>
        <SortButton sort={filter.sort} onChange={sort => update({ ...filter, sort })} />
      </div>
      <FilterChips filter={filter} onChange={update} />
      <PagedView infinite state={products} skeleton={<ProductGridSkeleton />}
        emptyTitle={filter.freeShipping || filter.minPrice !== undefined || filter.maxPrice !== undefined ? '조건에 맞는 상품이 없어요' : `${sub?.label ?? label} 상품이 아직 없어요`}
        emptyMessage={filter.freeShipping || filter.minPrice !== undefined || filter.maxPrice !== undefined ? '필터를 바꿔 보세요.' : '다른 카테고리를 둘러보세요.'}>
        {items => <ProductGrid products={items} variant={VALUE_CATEGORIES.includes(value) ? 'value' : 'standard'} />}
      </PagedView>
    </section>
  </PageContainer>
}
