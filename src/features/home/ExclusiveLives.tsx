import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { VideoIcon } from '../../components/icons'
import { Button, Skeleton, Thumbnail } from '../../components/ui'
import type { LiveSummary, Product } from '../../domain/types'
import { useAsync } from '../../hooks/useAsync'
import { formatPrice, formatScheduleTime } from '../../lib/format'
import { loadUpcomingLives, weekSchedule } from '../live/liveSchedule'
import { bestActiveDiscount } from '../shopping/saleProducts'
import styles from './ExclusiveLives.module.css'
import sections from './HomeSections.module.css'

const visible = (product: Product) => !product.missing && (product.status === 'SELLING' || product.status === 'SOLD_OUT')

/**
 * "오직 베리온에서만". 오늘부터 일주일 날짜 칸을 두고, 고른 날의 예정 방송을 시작 순서대로 보여 준다.
 * 방송이 없는 날은 회색으로 두고 고를 수 없다.
 */
export function ExclusiveLives() {
  const api = useApi()
  const lives = useAsync(() => loadUpcomingLives(api), [api])
  const days = useMemo(() => weekSchedule(lives.data ?? []), [lives.data])
  const [picked, setPicked] = useState<string | null>(null)
  const selected = days.find(day => day.key === picked && day.lives.length) ?? days.find(day => day.lives.length)

  return <section className={sections.section} aria-labelledby="exclusive-heading">
    <div className={sections.head}>
      <h2 id="exclusive-heading" className={sections.title}>오직 베리온에서만</h2>
      <Link to="/lives" className={sections.more}>더보기 <span aria-hidden="true">›</span></Link>
    </div>
    {!lives.data && !lives.error ? <Skeleton height={320} radius={12} />
      : lives.error && !lives.data ? <div className={sections.empty}><p>예정된 방송을 불러오지 못했어요.</p><Button variant="secondary" size="S" onClick={lives.reload}>방송 다시 조회</Button></div>
        : <>
          <div className={styles.days} role="group" aria-label="방송 날짜">
            {days.map(day => <button key={day.key} type="button" className={styles.day} disabled={!day.lives.length} aria-pressed={day.key === selected?.key}
              aria-label={`${day.label} ${day.date}일${day.lives.length ? ` 방송 ${day.lives.length}개` : ' 방송 없음'}`} onClick={() => setPicked(day.key)}>
              <span className={styles.dayLabel}>{day.label}</span>
              <strong className={styles.dayDate}>{day.date}</strong>
            </button>)}
          </div>
          {selected ? <ol className={styles.list} aria-label={`${selected.label} ${selected.date}일 방송`}>
            {selected.lives.map(live => <ScheduleItem key={live.id} live={live} />)}
          </ol> : <p className={sections.empty}>이번 주에 예정된 방송이 아직 없어요.</p>}
        </>}
  </section>
}

function ScheduleItem({ live }: { live: LiveSummary }) {
  const api = useApi()
  // 방송 대표 상품 하나와 쿠폰 할인율. 실패해도 방송 정보는 그대로 보여 준다.
  const pick = useAsync(async () => {
    const product = (await api.lives.listProducts(live.id)).find(visible)
    if (!product) return null
    const coupons = await api.coupons.product(product.id).catch(() => [])
    const discount = bestActiveDiscount(coupons)
    const sale = Math.min(discount, product.price)
    return { product, price: product.price - sale, percent: product.price ? Math.round(sale / product.price * 100) : 0 }
  }, [api, live.id])
  const product = pick.data?.product
  const percent = pick.data?.percent ?? 0
  const imageUrl = live.thumbnailUrl ?? product?.imageUrl ?? null

  return <li className={styles.item}>
    <Link to={`/lives/${live.id}`} className={styles.poster} tabIndex={-1} aria-hidden="true">
      {imageUrl ? <Thumbnail src={imageUrl} alt="" ratio="2 / 3" /> : <span className={styles.placeholder}><VideoIcon size={32} /></span>}
    </Link>
    <div className={styles.body}>
      <Link to={`/lives/${live.id}`} className={styles.headline}>
        <time className={styles.time} dateTime={live.scheduledAt}>{formatScheduleTime(live.scheduledAt)}</time>
        <span className={styles.liveTitle}>{live.title}</span>
        {live.hostName && <span className={styles.host}>{live.hostName}</span>}
      </Link>
      {product && <Link to={`/products/${product.id}`} className={styles.product}>
        <Thumbnail src={product.imageUrl} alt="" className={styles.productThumb} />
        <span className={styles.productText}>
          <span className={styles.productName}>{product.name}</span>
          <span className={styles.price}>{percent > 0 && <em className={styles.percent}>{percent}%</em>}{formatPrice(pick.data?.price ?? product.price)}</span>
        </span>
      </Link>}
      <button type="button" className={styles.alarm} disabled aria-describedby={`alarm-${live.id}`}>
        <BellPlusIcon /> 알림받기
      </button>
      <span id={`alarm-${live.id}`} className={styles.soon}>방송 알림은 준비 중이에요</span>
    </div>
  </li>
}

const BellPlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
  <path d="M18 9a6 6 0 1 0-12 0c0 7-3 8-3 8h12" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><path d="M19 14v6M16 17h6" />
</svg>
