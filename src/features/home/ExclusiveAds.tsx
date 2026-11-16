import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { ChevronRightIcon } from '../../components/icons'
import { Skeleton, Thumbnail } from '../../components/ui'
import type { ExhibitionSummary } from '../../domain/exhibitions'
import type { Product } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import tones from '../exhibitions/tones.module.css'
import { displayPrice } from '../shopping/liveDeal'
import { DELIVERY_LABEL } from '../shopping/productCardInfo'
import { CouponDropPanel } from './DailyCouponDrops'
import { useCouponDrops } from './useCouponDrops'
import { PageNumbers } from './PageNumbers'
import styles from './ExclusiveAds.module.css'

/** 한 번에 보이는 기획전 카드 수 */
const ADS_PER_PAGE = 2
/** 홈에는 앞쪽 기획전만 내세운다. 나머지는 상단바 기획전 메뉴에서 본다. */
const ADS_MAX = 6

/**
 * "Today's Brand". 왼쪽은 매일 선착순 쿠폰(받기, 알림 받기), 오른쪽은 카탈로그가 관리하는 진행 중 기획전 카드다.
 * 기획전 카드는 위쪽 기획전 문구, 대표 상품 하나를 크게, 상품 두 개를 한 줄씩, 맨 아래 더보기 버튼이다.
 * 2개씩 보이고 페이지 번호를 눌러 넘긴다. 쿠폰과 기획전이 모두 없거나 불러오지 못하면 칸을 숨긴다.
 */
export function ExclusiveAds() {
  const api = useApi()
  const exhibitions = useAsync(() => api.exhibitions.list(), [api])
  const drops = useCouponDrops()
  const [page, setPage] = useState(0)
  const ads = (exhibitions.data ?? []).slice(0, ADS_MAX)
  const loading = !exhibitions.data && !exhibitions.error
  if (!loading && !ads.length && !drops.items.length) return null
  const pages = Math.ceil(ads.length / ADS_PER_PAGE)
  const current = Math.min(page, Math.max(0, pages - 1))
  const shown = ads.slice(current * ADS_PER_PAGE, current * ADS_PER_PAGE + ADS_PER_PAGE)
  return <section className={styles.section} aria-labelledby="ads-heading">
    <div className={styles.intro}>
      <h2 id="ads-heading" className={styles.title}>Today’s<br />Brand</h2>
      {drops.hour !== null && <p className={styles.lead}>매일 {drops.hour}시, 선착순 쿠폰을 놓치지 마세요.</p>}
      {drops.items.length > 0 && <CouponDropPanel drops={drops} />}
    </div>
    {(loading || ads.length > 0) && <div className={styles.brands}>
      {pages > 1 && <div className={styles.pager}><PageNumbers label="기획전 페이지" count={pages} current={current} onChange={setPage} /></div>}
      <ul className={styles.ads}>
        {loading ? Array.from({ length: ADS_PER_PAGE }, (_, i) => <li key={i}><Skeleton height={520} radius={20} /></li>)
          : shown.map(ad => <li key={ad.id}><ExhibitionCard exhibition={ad} /></li>)}
      </ul>
    </div>}
  </section>
}

function ExhibitionCard({ exhibition }: { exhibition: ExhibitionSummary }) {
  const to = `/exhibitions/${encodeURIComponent(exhibition.id)}`
  const [featured, ...rest] = exhibition.previewProducts
  return <article className={styles.card} aria-label={exhibition.title}>
    <Link to={to} className={[styles.banner, tones[exhibition.tone]].join(' ')}>
      <span className={styles.logo} aria-hidden="true">{exhibition.art[0]}</span>
      <strong className={styles.headline}>{exhibition.headline.map(line => <span key={line}>{line}</span>)}</strong>
      <span className={styles.art} aria-hidden="true">{exhibition.art.slice(1).join('')}</span>
    </Link>
    {featured && <Featured product={featured} />}
    {rest.length > 0 && <ul className={styles.rows}>
      {rest.slice(0, 2).map(product => <li key={product.id}><ProductRow product={product} /></li>)}
    </ul>}
    <Link to={to} className={styles.more}><strong>{exhibition.title}</strong> 상품 더보기 <ChevronRightIcon size={16} /></Link>
  </article>
}

/** 가격 줄. 라이브 할인 중이면 "베리특가"를 앞에 붙인다. */
function Price({ product }: { product: Product }) {
  const shown = displayPrice(product)
  return <p className={styles.price}>
    {shown.deal && <span className={styles.dealLabel}>베리특가</span>}
    <strong>{formatPrice(shown.price)}</strong>
    {shown.before !== null && <del aria-label={`할인 전 ${formatPrice(shown.before)}`}>{formatPrice(shown.before)}</del>}
  </p>
}

function Chips({ product }: { product: Product }) {
  const chips = [product.delivery && DELIVERY_LABEL[product.delivery], product.freeShipping && '무료배송'].filter(Boolean) as string[]
  if (!chips.length && !product.orderingCount) return null
  return <p className={styles.chips}>
    {!!product.orderingCount && <span className={styles.ordering}>주문중 {product.orderingCount.toLocaleString('ko-KR')}</span>}
    {chips.map(chip => <span key={chip}>{chip}</span>)}
  </p>
}

/** 크게 보이는 대표 상품. 라이브 할인 중이면 LIVE 표시와 그 방송으로 가는 줄을 더한다. */
function Featured({ product }: { product: Product }) {
  const { deal } = displayPrice(product)
  return <div className={styles.featured}>
    <Link to={`/products/${product.id}`} className={styles.featuredProduct}>
      <Thumbnail src={product.imageUrl} alt={product.name} className={styles.featuredThumb}>{deal && <span className={styles.live}>LIVE</span>}</Thumbnail>
      <span className={styles.info}>
        <span className={styles.name}>{product.name}</span>
        <Price product={product} />
        <Chips product={product} />
      </span>
    </Link>
    {deal && <Link to={`/lives/${deal.broadcastId}`} className={styles.liveLink}>
      <span className={styles.liveText}>LIVE</span><span className={styles.liveTitle}>{deal.broadcastTitle}</span><ChevronRightIcon size={16} />
    </Link>}
  </div>
}

function ProductRow({ product }: { product: Product }) {
  const { deal } = displayPrice(product)
  return <Link to={`/products/${product.id}`} className={styles.row}>
    <Thumbnail src={product.imageUrl} alt={product.name} className={styles.rowThumb}>{deal && <span className={styles.live}>LIVE</span>}</Thumbnail>
    <span className={styles.info}>
      <span className={styles.name}>{product.name}</span>
      <Price product={product} />
      <Chips product={product} />
    </span>
  </Link>
}
