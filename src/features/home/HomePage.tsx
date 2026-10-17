import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PagedView } from '../../components/PagedView'
import { PageContainer } from '../../components/PageContainer'
import { SearchBox } from '../../components/SearchBox'
import { VideoIcon } from '../../components/icons'
import { Button, ButtonLink, Chip, Select, Skeleton, StatusBadge, Thumbnail, liveBadge } from '../../components/ui'
import type { LiveSummary, ProductSort, ProductStatusFilter } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { usePaged } from '../../hooks/usePaged'
import { formatDateTime } from '../../lib/format'
import { ViewerCount } from '../live/ViewerCount'
import { ProductGrid, ProductGridSkeleton } from '../shopping/components/ProductGrid'
import styles from './HomePage.module.css'

const PRODUCT_PAGE_SIZE = 12
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

/** 상품 탐색은 방송 조회의 성공 여부와 독립적으로 유지한다. */
export function HomePage() {
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const status = STATUS_OPTIONS.find(o => o.value === params.get('status'))?.value ?? 'ALL'
  const sort = SORT_OPTIONS.find(o => o.value === params.get('sort'))?.value ?? 'LATEST'
  const query = params.get('q') ?? ''
  const setParam = (key: string, value: string, fallback: string) => setParams(prev => {
    const next = new URLSearchParams(prev)
    if (value === fallback) next.delete(key)
    else next.set(key, value)
    return next
  })
  const lives = useAsync(() => api.lives.list({ size: 6 }), [api])
  const products = usePaged((page, cursor) => api.products.list({ cursor, page, size: PRODUCT_PAGE_SIZE, query, status, sort }), [api, query, status, sort])
  const featured = lives.data?.items.find(l => l.status === 'LIVE')
  const nextLives = lives.data?.items.filter(l => l.status !== 'ENDED' && l.id !== featured?.id).slice(0, 2) ?? []

  return <div className={styles.surface}><PageContainer className={styles.page}>
    <SearchBox className={styles.mobileSearch} />
    {featured && <FeaturedLive key={featured.id} live={featured} />}

    <section id="products" className={styles.section} aria-labelledby="product-heading">
      <div className={styles.head}>
        <h1 id="product-heading" className="t-h2">{query ? `'${query}' 상품 검색` : '지금 만나는 상품'}</h1>
        {(query || status !== 'ALL') && <Button variant="secondary" size="S" onClick={() => setParams({})}>전체 상품 보기</Button>}
      </div>
      <div className={styles.tools}>
        <div className={styles.chips} role="group" aria-label="판매 상태">
          {STATUS_OPTIONS.map(o => <Chip key={o.value} selected={status === o.value} onClick={() => setParam('status', o.value, 'ALL')}>{o.label}</Chip>)}
        </div>
        <Select aria-label="정렬 기준" value={sort} options={SORT_OPTIONS} onChange={v => setParam('sort', v, 'LATEST')} />
      </div>
      <PagedView state={products} skeleton={<ProductGridSkeleton />} emptyTitle={query || status !== 'ALL' ? '조건에 맞는 상품이 없어요' : '상품이 아직 없어요'} emptyMessage={query || status !== 'ALL' ? '검색어나 판매 상태를 변경해 보세요.' : '등록된 상품이 없습니다.'}>
        {items => <ProductGrid products={items} />}
      </PagedView>
    </section>

    <section className={styles.section} aria-labelledby="live-heading">
      <div className={styles.head}><h2 id="live-heading" className="t-h2">다음 라이브도 만나보세요</h2><Link to="/lives" className={styles.more}>방송 전체 보기 →</Link></div>
      <AsyncView state={lives} skeleton={<Skeleton height={112} radius={14} />}>
        {() => nextLives.length ? <div className={styles.liveGrid}>{nextLives.map(live => <Link key={live.id} to={`/lives/${live.id}`} className={styles.liveCard}>
          {live.thumbnailUrl ? <Thumbnail src={live.thumbnailUrl} alt="" className={styles.liveThumb} /> : <span className={styles.livePlaceholder} aria-hidden="true"><VideoIcon size={28} /></span>}
          <div className={styles.liveText}><StatusBadge status={liveBadge(live.status)} /><h3 className="t-h4">{live.title}</h3><p>{live.hostName}</p><ViewerCount liveId={live.id} status={live.status} watching={false} compact /><p>{live.status === 'LIVE' ? '지금 방송 중' : `${formatDateTime(live.scheduledAt)} 시작`}</p></div><span className={styles.liveArrow} aria-hidden="true">→</span>
        </Link>)}</div> : <p className={styles.liveEmpty}>{featured ? '다음 방송이 준비되면 이곳에서 안내할게요.' : '예정된 방송이 없어요. 상품은 쇼핑에서 바로 구매할 수 있어요.'}</p>}
      </AsyncView>
    </section>
  </PageContainer></div>
}

function FeaturedLive({ live }: { live: LiveSummary }) {
  const api = useApi()
  // 썸네일이 없으면 대표 방송에 연결된 실제 상품만 조회한다. 다른 상품 사진을 임의로 사용하지 않는다.
  const linked = useAsync(() => live.thumbnailUrl ? Promise.resolve([]) : api.lives.listProducts(live.id), [api, live.id, live.thumbnailUrl])
  const imageUrl = live.thumbnailUrl ?? linked.data?.find(p => p.imageUrl)?.imageUrl ?? null
  return <section className={styles.hero} aria-label="진행 중인 방송">
    <div className={styles.heroText}><StatusBadge status="live" label="LIVE · 방송 중" /><h2 className="t-h1">{live.title}</h2><p>{live.hostName}</p><ViewerCount liveId={live.id} status={live.status} watching={false} compact /><p>방송에서 만나고, 마음에 들면 바로 구매하세요.</p><ButtonLink to={`/lives/${live.id}`} className={styles.heroButton}>라이브 보러가기 →</ButtonLink></div>
    {imageUrl ? <Thumbnail key={imageUrl} src={imageUrl} alt={live.title} ratio="auto" className={styles.heroImage} /> : <div className={styles.heroPlaceholder} aria-hidden="true"><VideoIcon size={56} /></div>}
  </section>
}
