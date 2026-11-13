import { useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { PagedView } from '../../components/PagedView'
import { PageContainer } from '../../components/PageContainer'
import { SearchBox } from '../../components/SearchBox'
import { VideoIcon } from '../../components/icons'
import { ButtonLink, Chip, Select, Skeleton, StatusBadge, Thumbnail, liveBadge } from '../../components/ui'
import type { LiveSummary, ProductSort, ProductStatusFilter } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { usePaged } from '../../hooks/usePaged'
import { formatDateTime } from '../../lib/format'
import { ViewerCount } from '../live/ViewerCount'
import { ProductGrid, ProductGridSkeleton } from '../shopping/components/ProductGrid'
import { ExclusiveLives } from './ExclusiveLives'
import { HeroCarousel } from './HeroCarousel'
import { HomePicks } from './HomePicks'
import { HourlyRanking } from './HourlyRanking'
import { PromoSlide } from './PromoSlide'
import { PROMOS } from './promos'
import styles from './HomePage.module.css'

const PRODUCT_PAGE_SIZE = 12
const PROMO_SLIDES = PROMOS.map(promo => ({ key: `promo-${promo.key}`, node: <PromoSlide promo={promo} /> }))
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
 * 메인. 배너, 주목·추천 상품, "오직 베리온에서만", 시간별 판매 인기 순서로 보여 준다.
 * 헤더 검색어(?q=)가 있으면 그 자리에 검색 결과 목록을 보여 준다.
 */
export function HomePage() {
  const [params] = useSearchParams()
  const query = params.get('q') ?? ''
  return <div className={styles.surface}><PageContainer className={styles.page}>
    <SearchBox className={styles.mobileSearch} />
    {query ? <SearchResults query={query} /> : <>
      <HomeHero />
      <HomePicks />
      <ExclusiveLives />
      <HourlyRanking />
    </>}
  </PageContainer></div>
}

function SearchResults({ query }: { query: string }) {
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const status = STATUS_OPTIONS.find(o => o.value === params.get('status'))?.value ?? 'ALL'
  const sort = SORT_OPTIONS.find(o => o.value === params.get('sort'))?.value ?? 'LATEST'
  const setParam = (key: string, value: string, fallback: string) => setParams(prev => {
    const next = new URLSearchParams(prev)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    return next
  })
  const products = usePaged((page, cursor) => api.products.list({ cursor, page, size: PRODUCT_PAGE_SIZE, query, status, sort }), [api, query, status, sort])

  return <section id="products" className={styles.section} aria-labelledby="product-heading">
    <div className={styles.head}>
      <h1 id="product-heading" className="t-h2">'{query}' 상품 검색</h1>
      <ButtonLink to="/" variant="secondary" size="S">홈으로</ButtonLink>
    </div>
    <div className={styles.tools}>
      <div className={styles.chips} role="group" aria-label="판매 상태">
        {STATUS_OPTIONS.map(o => <Chip key={o.value} selected={status === o.value} onClick={() => setParam('status', o.value, 'ALL')}>{o.label}</Chip>)}
      </div>
      <Select aria-label="정렬 기준" value={sort} options={SORT_OPTIONS} onChange={v => setParam('sort', v, 'LATEST')} />
    </div>
    <PagedView infinite state={products} skeleton={<ProductGridSkeleton />} emptyTitle="조건에 맞는 상품이 없어요" emptyMessage="검색어나 판매 상태를 변경해 보세요.">
      {items => <ProductGrid products={items} variant="random" />}
    </PagedView>
  </section>
}

/** 메인 배너. 진행·예정 방송 다음에 기획전 배너가 이어진다. 방송 조회가 실패해도 기획전 배너는 보여 준다. */
function HomeHero() {
  const api = useApi()
  const lives = useAsync(async () => {
    const pages = await Promise.allSettled([
      api.lives.list({ status: 'LIVE', size: 3 }),
      api.lives.list({ status: 'READY', size: 3 }),
    ])
    const available = pages.flatMap(page => page.status === 'fulfilled' ? page.value.items : [])
    const unique = [...new Map(available.map(live => [live.id, live])).values()]
    const items = unique.filter(live => live.status !== 'ENDED').toSorted((a, b) => {
      if (a.status !== b.status) return a.status === 'LIVE' ? -1 : 1
      return Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)
    }).slice(0, 3)
    // 방송 썸네일이 없으면 소개 상품 사진을 대신 쓴다.
    const linked = await Promise.allSettled(items.filter(live => !live.thumbnailUrl).map(async live => [live.id, (await api.lives.listProducts(live.id)).find(product => product.imageUrl)?.imageUrl ?? null] as const))
    const images = new Map(linked.flatMap(result => result.status === 'fulfilled' ? [result.value] : []))
    return items.map(live => ({ live, imageUrl: live.thumbnailUrl ?? images.get(live.id) ?? null }))
  }, [api])

  if (!lives.data && !lives.error) return <Skeleton height={280} radius={20} />
  const slides = (lives.data ?? []).map(({ live, imageUrl }) => ({ key: `live-${live.id}`, node: <FeaturedLive live={live} imageUrl={imageUrl} /> }))
  return <HeroCarousel key={slides.map(slide => slide.key).join(':')} slides={[...slides, ...PROMO_SLIDES]} />
}

function FeaturedLive({ live, imageUrl }: { live: LiveSummary; imageUrl: string | null }) {
  const onAir = live.status === 'LIVE'
  return <section className={styles.hero} aria-label={onAir ? '진행 중인 방송' : '추천 예정 방송'}>
    <div className={styles.heroText}>
      <StatusBadge status={liveBadge(live.status)} label={onAir ? 'LIVE · 방송 중' : '방송 예정'} />
      <h2 className="t-h1">{live.title}</h2>
      {live.hostName && <p>{live.hostName}</p>}
      <ViewerCount liveId={live.id} status={live.status} watching={false} compact />
      <p>{onAir ? '방송에서 만나고, 마음에 들면 바로 구매하세요.' : `${formatDateTime(live.scheduledAt)}에 만나요. 소개 상품을 먼저 둘러보세요.`}</p>
      <ButtonLink to={`/lives/${live.id}`} className={styles.heroButton}>{onAir ? '라이브 보러가기' : '방송 미리보기'} →</ButtonLink>
    </div>
    {imageUrl ? <Thumbnail key={imageUrl} src={imageUrl} alt={live.title} ratio="auto" className={styles.heroImage} /> : <div className={styles.heroPlaceholder} aria-hidden="true"><VideoIcon size={56} /></div>}
  </section>
}
