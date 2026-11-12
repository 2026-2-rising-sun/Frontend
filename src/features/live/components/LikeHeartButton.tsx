import { useEffect, useRef, useState } from 'react'
import styles from './LiveInteraction.module.css'

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  )
}

export function LikeHeartButton({ liked, busy, pending, disabled, onToggle }: {
  liked: boolean
  busy: boolean
  pending: boolean
  disabled: boolean
  onToggle: () => Promise<boolean | undefined>
}) {
  const [burst, setBurst] = useState<number | null>(null)
  const sequence = useRef(0)
  const mounted = useRef(false)
  const inFlight = useRef(false)
  const label = busy ? '확인 중…' : pending ? '같은 요청 다시 확인' : liked ? '좋아요 취소' : '좋아요 보내기'

  useEffect(() => {
    mounted.current = true
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const stopMotion = () => { if (preference.matches) setBurst(null) }
    preference.addEventListener('change', stopMotion)
    return () => {
      mounted.current = false
      preference.removeEventListener('change', stopMotion)
    }
  }, [])

  useEffect(() => {
    if (burst === null) return
    const timer = window.setTimeout(() => setBurst(null), 1200)
    return () => window.clearTimeout(timer)
  }, [burst])

  async function toggle() {
    if (disabled || inFlight.current) return
    inFlight.current = true
    setBurst(null)
    try {
      const confirmedLike = await onToggle()
      if (mounted.current && confirmedLike && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setBurst(++sequence.current)
      }
    } finally {
      inFlight.current = false
    }
  }

  return (
    <div className={styles.heartControl}>
      <div className={styles.heartStage}>
        <button type="button" className={styles.heartButton} disabled={disabled} aria-label={label} title={label} aria-pressed={liked} aria-busy={busy} onClick={() => { void toggle() }}>
          <HeartIcon filled={liked} />
        </button>
        {burst !== null && (
          <div key={burst} className={styles.heartBurst} aria-hidden="true" data-testid="like-burst">
            {Array.from({ length: 6 }, (_, index) => <span key={index}><HeartIcon filled /></span>)}
          </div>
        )}
      </div>
      {(busy || pending) && <span className={styles.heartStatus} role="status">{label}</span>}
    </div>
  )
}
