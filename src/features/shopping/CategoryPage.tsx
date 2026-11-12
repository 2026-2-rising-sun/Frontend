import { NavLink, useParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PagedView } from '../../components/PagedView'
import { PageContainer } from '../../components/PageContainer'
import { PRODUCT_CATEGORIES } from '../../domain/types'
import { usePaged } from '../../hooks/usePaged'
import { NotFoundPage } from '../../app/NotFoundPage'
import { ProductGrid, ProductGridSkeleton } from './components/ProductGrid'
import styles from './CategoryPage.module.css'

const PAGE_SIZE = 12

/** 1단계 분류별 공개 상품 목록. 주소는 /categories/beauty 처럼 소문자 분류값을 쓴다. */
export function CategoryPage() {
  const { category: slug = '' } = useParams()
  const category = PRODUCT_CATEGORIES.find(item => item.value === slug.toUpperCase())
  if (!category) return <NotFoundPage />
  return <CategoryProducts key={category.value} value={category.value} label={category.label} />
}

function CategoryProducts({ value, label }: { value: (typeof PRODUCT_CATEGORIES)[number]['value']; label: string }) {
  const api = useApi()
  const products = usePaged((page, cursor) => api.products.list({ cursor, page, size: PAGE_SIZE, category: value }), [api, value])
  return <PageContainer>
    <nav className={styles.tabs} aria-label="카테고리">
      {PRODUCT_CATEGORIES.map(item => <NavLink key={item.value} to={`/categories/${item.value.toLowerCase()}`} className={({ isActive }) => [styles.tab, isActive && styles.active].filter(Boolean).join(' ')}>{item.label}</NavLink>)}
    </nav>
    <section className={styles.section} aria-labelledby="category-heading">
      <h1 id="category-heading" className="t-h2">{label}</h1>
      <PagedView state={products} skeleton={<ProductGridSkeleton />} emptyTitle={`${label} 상품이 아직 없어요`} emptyMessage="다른 카테고리를 둘러보세요.">
        {items => <ProductGrid products={items} />}
      </PagedView>
    </section>
  </PageContainer>
}
