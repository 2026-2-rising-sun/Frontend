import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PageContainer } from '../../components/PageContainer'
import { SearchBox } from '../../components/SearchBox'
import { ButtonLink, Chip, Select, Skeleton, StatusBadge } from '../../components/ui'
import type { ProductSort, ProductStatusFilter } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { LiveCard } from '../live/components/LiveCard'
import { ProductGrid, ProductGridSkeleton } from '../shopping/components/ProductGrid'
import styles from './HomePage.module.css'

const STATUS_OPTIONS: { value: ProductStatusFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'SELLING', label: '판매 중' },
  { value: 'SOLD_OUT', label: '품절' },
]

const SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: 'LATEST', label: '최신 등록순' },
  { value: 'PRICE_ASC', label: '낮은 가격순' },
  { value: 'PRICE_DESC', label: '높은 가격순' },
]

/**
 * 쇼핑 홈. 상품 목록은 방송과 무관하게 항상 조회·구매할 수 있어야 하므로,
 * 방송 영역과 상품 영역은 각각 따로 조회하고 서로의 실패가 전파되지 않는다.
 */
export function HomePage() {
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as ProductStatusFilter) ?? 'ALL'
  const sort = (params.get('sort') as ProductSort) ?? 'LATEST'
  const query = params.get('q') ?? ''

  const setParam = (key: string, value: string, fallback: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      if (value === fallback) next.delete(key)
      else next.set(key, value)
      return next
    })

  const lives = useAsync(() => api.lives.list(), [api])
  const products = useAsync(() => api.products.list({ status, sort, query }), [api, status, sort, query])
  const featured = lives.data?.find((l) => l.status === 'LIVE')
  const liveList = lives.data?.filter((l) => l.status !== 'ENDED').slice(0, 3)

  return (
    <PageContainer>
      <SearchBox className={styles.mobileSearch} />

      {featured && (
        <section className={styles.hero} aria-label="진행 중인 방송">
          <div className={styles.heroText}>
            <StatusBadge status="live" />
            <h1 className={`t-display ${styles.heroTitle}`}>{featured.title}</h1>
            <p className={`t-body-lg ${styles.heroDesc}`}>지금 방송을 보면서 바로 구매하세요. 방송이 끝나도 상품은 계속 구매할 수 있어요.</p>
            <ButtonLink to={`/lives/${featured.id}`} size="L" className={styles.heroButton}>
              방송 보러가기
            </ButtonLink>
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="live-heading">
        <div className={styles.head}>
          <h2 id="live-heading" className="t-h2">
            지금 볼 수 있는 방송
          </h2>
          <Link to="/lives" className={styles.more}>
            전체 보기
          </Link>
        </div>
        <AsyncView
          state={lives}
          skeleton={<Skeleton height={180} radius={14} />}
          isEmpty={() => !liveList?.length}
          emptyTitle="예정된 방송이 없어요"
          emptyMessage="방송이 없어도 아래 상품은 바로 구매할 수 있어요."
        >
          {() => (
            <div className={styles.liveGrid}>
              {liveList?.map((live) => (
                <LiveCard key={live.id} live={live} />
              ))}
            </div>
          )}
        </AsyncView>
      </section>

      <section className={styles.section} aria-labelledby="product-heading">
        <div className={styles.head}>
          <h2 id="product-heading" className="t-h2">
            {query ? `'${query}' 검색 결과` : '전체 상품'}
          </h2>
          <div className={styles.tools}>
            <div className={styles.chips} role="group" aria-label="판매 상태">
              {STATUS_OPTIONS.map((o) => (
                <Chip key={o.value} selected={status === o.value} onClick={() => setParam('status', o.value, 'ALL')}>
                  {o.label}
                </Chip>
              ))}
            </div>
            <Select aria-label="정렬 기준" value={sort} options={SORT_OPTIONS} onChange={(v) => setParam('sort', v, 'LATEST')} />
          </div>
        </div>
        <AsyncView
          state={products}
          skeleton={<ProductGridSkeleton />}
          isEmpty={(list) => list.length === 0}
          emptyTitle={query ? '검색 결과가 없어요' : '상품이 아직 없어요'}
          emptyMessage={query ? '다른 검색어로 찾아보세요.' : '등록된 판매 중 상품이 없습니다.'}
        >
          {(list) => <ProductGrid products={list} />}
        </AsyncView>
      </section>
    </PageContainer>
  )
}
