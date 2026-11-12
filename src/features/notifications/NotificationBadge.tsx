import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { useSession } from '../auth/useSession'
import styles from './notifications.module.css'
export function NotificationBadge() {
  const api = useApi(); const session = useSession()
  const [count, setCount] = useState<{ session: typeof session; api: typeof api; value?: number; failed?: boolean }>()
  useEffect(() => {
    if (!session) return
    let generation = 0
    const update = () => {
      if (document.visibilityState !== 'visible') return
      const run = ++generation
      void api.notifications.unreadCount().then(value => {
        if (run === generation) setCount({ session, api, value })
      }).catch(() => {
        if (run === generation) setCount(previous => ({ session, api, value: previous?.session === session && previous.api === api ? previous.value : undefined, failed: true }))
      })
    }
    update()
    const timer = setInterval(update, 30000)
    window.addEventListener('notifications-changed', update); window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      generation++
      clearInterval(timer); window.removeEventListener('notifications-changed', update); window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [api, session])
  if (!session) return null
  const current = count?.session === session && count.api === api ? count : undefined
  return <Link to="/notifications" className={styles.badge} aria-label={current?.failed ? '알림함, 미확인 개수 조회 실패' : `알림함, 안 읽은 알림 ${current?.value ?? 0}개`}>알림{current?.value !== undefined && current.value > 0 && <span className={styles.count}>{current.value > 99 ? '99+' : current.value}</span>}</Link>
}
