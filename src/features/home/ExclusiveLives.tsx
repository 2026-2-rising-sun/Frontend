import { useEffect, useMemo, useRef, useState } from 'react'
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

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * "오직 베리온에서만". 오늘부터 일주일 날짜 칸을 화면 위에 붙여 두고, 그 아래에 일주일치 예정 방송을 시작 순서대로 이어 보여 준다.
 * 날짜를 누르면 그날 첫 방송으로 스크롤하고, 스크롤하면 지금 보이는 방송의 날짜가 선택된다. 방송이 없는 날은 회색으로 두고 고를 수 없다.
 */
export function ExclusiveLives() {
  const api = useApi()
  const lives = useAsync(() => loadUpcomingLives(api), [api])
  const days = useMemo(() => weekSchedule(lives.data ?? []), [lives.data])
  const items = useMemo(() => days.flatMap(day => day.lives.map(live => ({ live, day: day.key }))), [days])
  const [active, setActive] = useState<string | null>(null)
  const selected = active ?? items[0]?.day
  const headerHeight = useHeaderHeight()
  const daysRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const lock = useRef<{ timer?: number } | null>(null)

  // 날짜 칸 바로 아래 줄을 넘어간 마지막 방송의 날짜를 선택한다. 날짜를 눌러 이동하는 동안에는 누른 날짜를 지킨다.
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const list = listRef.current, bar = daysRef.current
      if (!list || !bar) return
      const line = bar.getBoundingClientRect().bottom + 1
      const passed = [...list.querySelectorAll<HTMLElement>('[data-day]')].filter(item => item.getBoundingClientRect().top <= line).at(-1)
      setActive(passed?.dataset.day ?? null)
    }
    const onScroll = () => {
      const held = lock.current
      if (held) {
        window.clearTimeout(held.timer)
        held.timer = window.setTimeout(() => { lock.current = null }, 150)
        return
      }
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(frame) }
  }, [items])

  const goTo = (day: string) => {
    const target = listRef.current?.querySelector<HTMLElement>(`[data-day="${day}"]`)
    if (!target) return
    window.clearTimeout(lock.current?.timer)
    lock.current = {}
    setActive(day)
    const offset = headerHeight + (daysRef.current?.offsetHeight ?? 0) + 16
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: reducedMotion() ? 'auto' : 'smooth' })
  }

  return <section className={sections.section} aria-labelledby="exclusive-heading">
    <div className={sections.head}>
      <h2 id="exclusive-heading" className={sections.title}>오직 베리온에서만</h2>
      <Link to="/lives" className={sections.more}>더보기 <span aria-hidden="true">›</span></Link>
    </div>
    {!lives.data && !lives.error ? <Skeleton height={320} radius={12} />
      : lives.error && !lives.data ? <div className={sections.empty}><p>예정된 방송을 불러오지 못했어요.</p><Button variant="secondary" size="S" onClick={lives.reload}>방송 다시 조회</Button></div>
        : <>
          <div ref={daysRef} className={styles.days} style={{ top: headerHeight }} role="group" aria-label="방송 날짜">
            {days.map(day => <button key={day.key} type="button" className={styles.day} disabled={!day.lives.length} aria-pressed={day.key === selected}
              aria-label={`${day.label} ${day.date}일${day.lives.length ? ` 방송 ${day.lives.length}개` : ' 방송 없음'}`} onClick={() => goTo(day.key)}>
              <span className={styles.dayLabel}>{day.label}</span>
              <strong className={styles.dayDate}>{day.date}</strong>
            </button>)}
          </div>
          {items.length ? <ol ref={listRef} className={styles.list} aria-label="이번 주 예정 방송">
            {items.map(({ live, day }, index) => <ScheduleItem key={live.id} live={live} day={items[index - 1]?.day === day ? undefined : day} />)}
          </ol> : <p className={sections.empty}>이번 주에 예정된 방송이 아직 없어요.</p>}
        </>}
  </section>
}

/** 화면 위에 붙는 머리글 높이. 날짜 칸을 그 바로 아래에 붙인다. */
function useHeaderHeight() {
  const [height, setHeight] = useState(0)
  useEffect(() => {
    const header = document.querySelector('header')
    if (!header) return
    const measure = () => setHeight(header.getBoundingClientRect().height)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(header)
    return () => observer.disconnect()
  }, [])
  return height
}

/** day 는 그날 첫 방송에만 붙여 날짜 이동의 기준점으로 쓴다. */
function ScheduleItem({ live, day }: { live: LiveSummary; day?: string }) {
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

  return <li className={styles.item} data-day={day}>
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
