import { useEffect, useState, type ReactNode } from 'react'
import styles from './HeroCarousel.module.css'

export interface HeroSlide {
  key: string
  node: ReactNode
}

const INTERVAL_MS = 5000
const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true

/**
 * 메인 상단 배너. 5초마다 다음 슬라이드로 넘어가고, 이전·다음·멈춤 버튼과 "현재/전체" 번호를 보여 준다.
 * 마우스를 올리거나 키보드 포커스가 안에 있으면 멈추고, 움직임 줄이기 설정이면 처음부터 멈춘 상태다.
 * 보이지 않는 슬라이드는 visibility: hidden 이라 화면 낭독기와 탭 이동에서도 빠진다.
 */
export function HeroCarousel({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(() => !prefersReducedMotion())
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const count = slides.length
  const current = count ? index % count : 0
  const moving = playing && !hovered && !focused && count > 1

  useEffect(() => {
    if (!moving) return
    const timer = setInterval(() => setIndex(value => (value + 1) % count), INTERVAL_MS)
    return () => clearInterval(timer)
  }, [moving, count, current])

  if (!count) return null
  const go = (step: number) => setIndex((current + step + count) % count)

  return <section className={styles.carousel} aria-roledescription="carousel" aria-label="메인 배너"
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}>
    <div className={styles.track} aria-live={moving ? 'off' : 'polite'}>
      {slides.map((slide, i) => <div key={slide.key} className={[styles.slide, i === current && styles.active].filter(Boolean).join(' ')}
        role="group" aria-roledescription="slide" aria-label={`${i + 1} / ${count}`} aria-hidden={i !== current}>
        {slide.node}
      </div>)}
    </div>
    {count > 1 && <div className={styles.controls}>
      <button type="button" className={styles.control} aria-label="이전 배너" onClick={() => go(-1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <span className={styles.counter}><strong>{current + 1}</strong>/{count}</span>
      <button type="button" className={styles.control} aria-label="다음 배너" onClick={() => go(1)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
      </button>
      <button type="button" className={styles.control} aria-label={playing ? '자동 넘김 멈춤' : '자동 넘김 재생'} aria-pressed={!playing} onClick={() => setPlaying(value => !value)}>
        {playing ? <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
          : <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5l12 7-12 7z" /></svg>}
      </button>
    </div>}
  </section>
}
