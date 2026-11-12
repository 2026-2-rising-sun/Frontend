import type { LiveSummary } from '../../../domain/types'
import { kstDay } from '../liveSchedule'
import { LiveCard } from './LiveCard'
import styles from './LiveScheduleList.module.css'

const dayFormatter = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' })

/** 방송을 날짜별로 묶고, 전체 순서대로 순위 번호를 붙여 보여 준다. 진행 중 방송은 "지금 방송 중" 묶음이 된다. */
export function LiveScheduleList({ lives, now = new Date() }: { lives: LiveSummary[]; now?: Date }) {
  const today = kstDay(now.toISOString())
  const groups: { key: string; label: string; items: { live: LiveSummary; rank: number }[] }[] = []
  lives.forEach((live, index) => {
    const key = live.status === 'LIVE' ? 'on-air' : kstDay(live.scheduledAt)
    const label = key === 'on-air' ? '지금 방송 중' : key === today ? `오늘 ${dayFormatter.format(new Date(live.scheduledAt))}` : dayFormatter.format(new Date(live.scheduledAt))
    const group = groups.at(-1)?.key === key ? groups.at(-1)! : (groups.push({ key, label, items: [] }), groups.at(-1)!)
    group.items.push({ live, rank: index + 1 })
  })
  return <div className={styles.schedule}>
    {groups.map(group => <section key={group.key} className={styles.day} aria-label={group.label}>
      <h2 className={styles.dayTitle}>{group.label}</h2>
      <ol className={styles.grid}>
        {group.items.map(({ live, rank }) => <li key={live.id} className={styles.item}>
          <span className={[styles.rank, rank <= 3 && styles.top].filter(Boolean).join(' ')} aria-label={`${rank}번째`}>{rank}</span>
          <LiveCard live={live} />
        </li>)}
      </ol>
    </section>)}
  </div>
}
