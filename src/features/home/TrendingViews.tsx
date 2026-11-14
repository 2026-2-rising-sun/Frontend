import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { EyeIcon, PauseIcon, PlayIcon, RefreshIcon } from '../../components/icons'
import { Button, Skeleton, Thumbnail } from '../../components/ui'
import type { Product } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice } from '../../lib/format'
import { displayPrice } from '../shopping/liveDeal'
import { DELIVERY_LABEL } from '../shopping/productCardInfo'
import { PageNumbers } from './PageNumbers'
import { TRENDING_PER_PAGE, loadTrending } from './viewingRanking'
import styles from './TrendingViews.module.css'

const time = (date: Date) => date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' })
/** 자동으로 다음 순위로 넘어가는 간격 */
export const TRENDING_INTERVAL_MS = 5000

/**
 * 메인 맨 아래 "조회 급상승, 인기템". 왼쪽에 고른 상품을 크게, 오른쪽에 순위 5개를 보인다.
 * 왼쪽 상품은 5초마다 1위부터 10위까지 위로 밀려 올라가며 바뀌고, 6위가 되면 오른쪽 순위도 2페이지로 넘어간다.
 * 순위를 누르면 그 상품이 왼쪽에 크게 보이고, 왼쪽 상품을 누르면 상품으로 간다.
 * 마우스를 올리거나 포커스하는 동안, 또는 멈춤 버튼을 누르면 넘김을 멈춘다.
 */
export function TrendingViews() {
  const api = useApi()
  const trending = useAsync(() => loadTrending(api), [api])
  /** 지금 크게 보이는 순위(0부터) */
  const [active, setActive] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [stopped, setStopped] = useState(false)
  const products = trending.data ?? []
  const total = products.length
  const at = total ? Math.min(active, total - 1) : 0
  const pages = Math.ceil(total / TRENDING_PER_PAGE)
  const current = Math.floor(at / TRENDING_PER_PAGE)
  const shown = products.slice(current * TRENDING_PER_PAGE, current * TRENDING_PER_PAGE + TRENDING_PER_PAGE)
  const featured = products[at]
  const update = () => { setActive(0); trending.reload() }

  useEffect(() => {
    if (hovered || stopped || total < 2) return
    const timer = setTimeout(() => setActive(index => (index + 1) % total), TRENDING_INTERVAL_MS)
    return () => clearTimeout(timer)
  }, [at, hovered, stopped, total])

  return <section className={styles.section} aria-labelledby="trending-views-heading">
    <div className={styles.head}>
      <h2 id="trending-views-heading" className={styles.title}>조회 급상승, 인기템</h2>
      <div className={styles.actions}>
        {trending.updatedAt && <span className={styles.updated} aria-live="polite">{time(trending.updatedAt)} 기준</span>}
        <button type="button" className={styles.update} onClick={update} disabled={trending.loading} aria-busy={trending.loading}>
          <RefreshIcon size={14} />업데이트
        </button>
        <PageNumbers label="조회 급상승 페이지" count={pages} current={current} onChange={page => setActive(page * TRENDING_PER_PAGE)} />
        {total > 1 && <button type="button" className={styles.pause} aria-label={stopped ? '자동 넘김 다시 시작' : '자동 넘김 멈춤'} aria-pressed={stopped} onClick={() => setStopped(value => !value)}>
          {stopped ? <PlayIcon size={12} /> : <PauseIcon size={12} />}
        </button>}
      </div>
    </div>
    {!trending.data && !trending.error ? <div className={styles.body}><Skeleton height={240} radius={8} /><Skeleton height={240} radius={8} /></div>
      : trending.error && !trending.data ? <div className={styles.empty}><p>인기템을 불러오지 못했어요.</p><Button variant="secondary" size="S" onClick={trending.reload}>다시 조회</Button></div>
        : !featured ? <p className={styles.empty}>지금 보고 있는 상품이 아직 없어요.</p>
          : <div className={styles.body} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
            onFocus={() => setHovered(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setHovered(false) }}>
            <div className={styles.viewport}>
              <div key={featured.id} className={styles.slide}><Featured product={featured} rank={at + 1} /></div>
            </div>
            <ol className={styles.list} start={current * TRENDING_PER_PAGE + 1}>
              {shown.map((product, index) => {
                const rank = current * TRENDING_PER_PAGE + index
                return <li key={product.id}>
                  <button type="button" className={[styles.row, rank === at && styles.picked].filter(Boolean).join(' ')}
                    aria-pressed={rank === at} onClick={() => setActive(rank)}>
                    <span className={styles.rank}>{rank + 1}</span>
                    <span className={styles.rowName}>{product.name}</span>
                  </button>
                </li>
              })}
            </ol>
          </div>}
  </section>
}

/** 왼쪽에 크게 보이는 상품: 보고 있는 사람 수, 브랜드, 이름, 가격, 혜택 칩 */
function Featured({ product, rank }: { product: Product; rank: number }) {
  const shown = displayPrice(product)
  const chips = [
    shown.deal && { label: '베리특가', tone: styles.berry },
    shown.before !== null && { label: '세일', tone: styles.sale },
    product.freeShipping && { label: '무료배송', tone: styles.free },
    product.delivery && { label: DELIVERY_LABEL[product.delivery], tone: styles.fast },
  ].filter(chip => !!chip)
  return <Link to={`/products/${product.id}`} className={styles.featured} aria-label={`${rank}위 ${product.name}, ${(product.viewingCount ?? 0).toLocaleString('ko-KR')}명이 보고 있어요`}>
    <Thumbnail src={product.imageUrl} alt="" ratio="1 / 1" className={styles.thumb}><span className={styles.badge} aria-hidden="true">{rank}</span></Thumbnail>
    <div className={styles.info}>
      <p className={styles.viewing}><EyeIcon size={16} /><strong>{(product.viewingCount ?? 0).toLocaleString('ko-KR')}</strong>명이 보고있어요</p>
      {product.brand && <p className={styles.brand}>{product.brand}</p>}
      <p className={styles.name}>{product.name}</p>
      {shown.before !== null && <del className={styles.original}>{formatPrice(shown.before)}</del>}
      <p className={styles.price}>{formatPrice(shown.price)}</p>
      {chips.length > 0 && <p className={styles.chips}>{chips.map(chip => <span key={chip.label} className={[styles.chip, chip.tone].join(' ')}>{chip.label}</span>)}</p>}
    </div>
  </Link>
}
