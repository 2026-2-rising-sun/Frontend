import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { EyeIcon, RefreshIcon } from '../../components/icons'
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

/**
 * 메인 맨 아래 "조회 급상승, 인기템". 왼쪽에 고른 상품을 크게, 오른쪽에 순위 5개를 보인다.
 * 순위에 마우스를 올리거나 포커스하면 왼쪽 상품이 바뀌고, 누르면 상품으로 간다. 업데이트를 누르면 순위를 다시 불러온다.
 */
export function TrendingViews() {
  const api = useApi()
  const trending = useAsync(() => loadTrending(api), [api])
  const [page, setPage] = useState(0)
  const [picked, setPicked] = useState(0)
  const products = trending.data ?? []
  const pages = Math.ceil(products.length / TRENDING_PER_PAGE)
  const current = Math.min(page, Math.max(pages - 1, 0))
  const shown = products.slice(current * TRENDING_PER_PAGE, current * TRENDING_PER_PAGE + TRENDING_PER_PAGE)
  const featured = shown[Math.min(picked, shown.length - 1)]
  const turn = (next: number) => { setPage(next); setPicked(0) }
  const update = () => { setPicked(0); trending.reload() }

  return <section className={styles.section} aria-labelledby="trending-views-heading">
    <div className={styles.head}>
      <h2 id="trending-views-heading" className={styles.title}>조회 급상승, 인기템</h2>
      <div className={styles.actions}>
        {trending.updatedAt && <span className={styles.updated} aria-live="polite">{time(trending.updatedAt)} 기준</span>}
        <button type="button" className={styles.update} onClick={update} disabled={trending.loading} aria-busy={trending.loading}>
          <RefreshIcon size={14} />업데이트
        </button>
        <PageNumbers label="조회 급상승 페이지" count={pages} current={current} onChange={turn} />
      </div>
    </div>
    {!trending.data && !trending.error ? <div className={styles.body}><Skeleton height={240} radius={8} /><Skeleton height={240} radius={8} /></div>
      : trending.error && !trending.data ? <div className={styles.empty}><p>인기템을 불러오지 못했어요.</p><Button variant="secondary" size="S" onClick={trending.reload}>다시 조회</Button></div>
        : !featured ? <p className={styles.empty}>지금 보고 있는 상품이 아직 없어요.</p>
          : <div className={styles.body}>
            <Featured product={featured} />
            <ol className={styles.list} start={current * TRENDING_PER_PAGE + 1}>
              {shown.map((product, index) => <li key={product.id}>
                <Link to={`/products/${product.id}`} className={[styles.row, product === featured && styles.picked].filter(Boolean).join(' ')}
                  aria-current={product === featured ? 'true' : undefined} onMouseEnter={() => setPicked(index)} onFocus={() => setPicked(index)}>
                  <span className={styles.rank}>{current * TRENDING_PER_PAGE + index + 1}</span>
                  <span className={styles.rowName}>{product.name}</span>
                </Link>
              </li>)}
            </ol>
          </div>}
  </section>
}

/** 왼쪽에 크게 보이는 상품: 보고 있는 사람 수, 브랜드, 이름, 가격, 혜택 칩 */
function Featured({ product }: { product: Product }) {
  const shown = displayPrice(product)
  const chips = [
    shown.deal && { label: '베리특가', tone: styles.berry },
    shown.before !== null && { label: '세일', tone: styles.sale },
    product.freeShipping && { label: '무료배송', tone: styles.free },
    product.delivery && { label: DELIVERY_LABEL[product.delivery], tone: styles.fast },
  ].filter(chip => !!chip)
  return <Link to={`/products/${product.id}`} className={styles.featured} aria-label={`${product.name}, ${(product.viewingCount ?? 0).toLocaleString('ko-KR')}명이 보고 있어요`}>
    <Thumbnail src={product.imageUrl} alt="" ratio="1 / 1" className={styles.thumb} />
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
