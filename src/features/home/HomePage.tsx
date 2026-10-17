import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { AsyncView } from '../../components/AsyncView'
import { PagedView } from '../../components/PagedView'
import { PageContainer } from '../../components/PageContainer'
import { SearchBox } from '../../components/SearchBox'
import { VideoIcon } from '../../components/icons'
import { Alert, Button, ButtonLink, Chip, Select, Skeleton, StatusBadge, Thumbnail, liveBadge } from '../../components/ui'
import type { LiveSummary, Product, ProductSort, ProductStatusFilter } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { usePaged } from '../../hooks/usePaged'
import { formatDateTime } from '../../lib/format'
import { ViewerCount } from '../live/ViewerCount'
import { ProductCard } from '../shopping/components/ProductCard'
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
  const lives = useAsync(async () => {
    const pages = await Promise.allSettled([
      api.lives.list({ status: 'LIVE', size: 3 }),
      api.lives.list({ status: 'READY', size: 3 }),
    ])
    const available = pages.flatMap(page => page.status === 'fulfilled' ? page.value.items : [])
    if (pages[0].status === 'rejected' && pages[1].status === 'rejected') throw pages[0].reason
    const unique = [...new Map(available.map(live => [live.id, live])).values()]
    const items = unique.filter(live => live.status !== 'ENDED').toSorted((a, b) => {
      if (a.status !== b.status) return a.status === 'LIVE' ? -1 : 1
      return Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)
    }).slice(0, 3)
    return { items, incomplete: pages.some(page => page.status === 'rejected') }
  }, [api])
  const products = usePaged((page, cursor) => api.products.list({ cursor, page, size: PRODUCT_PAGE_SIZE, query, status, sort }), [api, query, status, sort])

  return <div className={styles.surface}><PageContainer className={styles.page}>
    <SearchBox className={styles.mobileSearch} />
    <AsyncView state={lives} skeleton={<Skeleton height={280} radius={20} />}>
      {data => <>
        {data.incomplete && <Alert type="warning" title="일부 방송을 확인하지 못했어요"><Button variant="secondary" size="S" onClick={lives.reload}>방송 다시 조회</Button></Alert>}
        {data.items.length ? <LiveDiscovery key={data.items.map(live => live.id).join(':')} lives={data.items} /> : data.incomplete ? null : <section className={styles.liveEmpty} aria-label="방송 안내"><h2 className="t-h3">새로운 라이브를 준비하고 있어요</h2><p>진행 중이거나 예정된 방송이 없어요. 아래 상품은 바로 둘러볼 수 있어요.</p><Link to="/lives" className={styles.more}>방송 전체 보기 →</Link></section>}
      </>}
    </AsyncView>

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

  </PageContainer></div>
}

interface LiveProductGroup {
  live: LiveSummary
  products: Product[]
  failed: boolean
}

function LiveDiscovery({ lives }: { lives: LiveSummary[] }) {
  const api = useApi()
  const [selectedId, setSelectedId] = useState(lives[0].id)
  const groups = useAsync(async (): Promise<LiveProductGroup[]> => {
    const results = await Promise.allSettled(lives.map(live => api.lives.listProducts(live.id)))
    return lives.map((live, index) => {
      const result = results[index]
      return { live, failed: result.status === 'rejected', products: result.status === 'fulfilled'
        ? result.value.filter(product => !product.missing && (product.status === 'SELLING' || product.status === 'SOLD_OUT')) : [] }
    })
  }, [api, lives])
  const featured = lives[0]
  const selected = lives.find(live => live.id === selectedId) ?? featured
  const group = groups.data?.find(item => item.live.id === selected.id)
  const imageFor = (live: LiveSummary) => live.thumbnailUrl ?? groups.data?.find(item => item.live.id === live.id)?.products.find(product => product.imageUrl)?.imageUrl ?? null

  return <>
    <FeaturedLive live={featured} imageUrl={imageFor(featured)} />
    <section className={styles.section} aria-labelledby="live-products-heading">
      <div className={styles.head}><div><h2 id="live-products-heading" className="t-h2">방송별 소개 상품</h2><p className={styles.caption}>방송을 선택하고, 방송에서 소개하는 상품을 만나보세요.</p></div></div>
      <div className={styles.broadcastChoices} role="group" aria-label="소개 상품을 볼 방송">
        {lives.map(live => <Chip key={live.id} selected={live.id === selected.id} onClick={() => setSelectedId(live.id)}>{live.title}</Chip>)}
      </div>
      <div className={styles.selectedBroadcast}><StatusBadge status={liveBadge(selected.status)} /><Link to={`/lives/${selected.id}`}>{selected.title} →</Link></div>
      {!group ? <ProductGridSkeleton count={4} /> : group.failed ? <Alert type="warning" title="이 방송의 상품을 불러오지 못했어요"><Button variant="secondary" size="S" onClick={groups.reload} disabled={groups.loading}>상품 다시 조회</Button></Alert>
        : group.products.length ? <>
          <div className={styles.broadcastProducts}>{group.products.slice(0, 4).map(product => <ProductCard key={product.id} product={product} />)}</div>
          <Link to={`/lives/${selected.id}`} className={styles.more}>{group.products.length > 4 ? `방송 상품 ${group.products.length}개 모두 보기` : '상품과 함께 방송 보기'} →</Link>
        </> : <p className={styles.liveEmpty}>아직 공개된 소개 상품이 없어요. 방송 정보는 확인할 수 있어요.</p>}
    </section>

    <section className={styles.section} aria-labelledby="live-heading">
      <div className={styles.head}><div><h2 id="live-heading" className="t-h2">추천 라이브</h2><p className={styles.caption}>진행 중인 방송을 먼저, 예정 방송은 시작이 빠른 순으로 보여드려요.</p></div><Link to="/lives" className={styles.more}>방송 전체 보기 →</Link></div>
      <div className={styles.liveGrid}>{lives.slice(0, 2).map(live => <Link key={live.id} to={`/lives/${live.id}`} className={styles.liveCard}>
        {imageFor(live) ? <Thumbnail key={imageFor(live)} src={imageFor(live)} alt="" className={styles.liveThumb} /> : <span className={styles.livePlaceholder} aria-hidden="true"><VideoIcon size={28} /></span>}
        <div className={styles.liveText}><StatusBadge status={liveBadge(live.status)} /><h3 className="t-h4">{live.title}</h3>{live.hostName && <p>{live.hostName}</p>}<ViewerCount liveId={live.id} status={live.status} watching={false} compact /><p>{live.status === 'LIVE' ? '지금 방송 중' : `${formatDateTime(live.scheduledAt)} 시작`}</p></div><span className={styles.liveArrow} aria-hidden="true">→</span>
      </Link>)}</div>
    </section>
  </>
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
