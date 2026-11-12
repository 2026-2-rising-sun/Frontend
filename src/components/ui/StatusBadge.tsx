import { BADGE_LABEL, type BadgeStatus } from './badgeStatus'
import styles from './StatusBadge.module.css'

interface StatusBadgeProps {
  status: BadgeStatus
  /** 기본 라벨 대신 표시할 문구 (예: 방송 "준비 중") */
  label?: string
  className?: string
}

/** Figma "Status Badge". 색은 상태별 토큰(live / success / warning / danger / info / neutral). */
export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span className={[styles.badge, styles[status], className].filter(Boolean).join(' ')}>
      <span className={styles.dot} aria-hidden="true" />
      {label ?? BADGE_LABEL[status]}
    </span>
  )
}
