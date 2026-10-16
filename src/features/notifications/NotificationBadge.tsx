import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { useAsync } from '../../hooks/useAsync'
import { useSession } from '../auth/useSession'
import styles from './notifications.module.css'
export function NotificationBadge() {
  const api = useApi(); const session = useSession()
  const count = useAsync(() => session ? api.notifications.unreadCount() : Promise.resolve(0), [api, session])
  const reload = count.reload
  useEffect(() => {
    if (!session) return
    const update = () => { if (document.visibilityState === 'visible') reload() }
    const timer = setInterval(update, 30000)
    window.addEventListener('notifications-changed', update); window.addEventListener('focus', update)
    return () => { clearInterval(timer); window.removeEventListener('notifications-changed', update); window.removeEventListener('focus', update) }
  }, [session, reload])
  if (!session) return null
  return <Link to="/notifications" className={styles.badge} aria-label={count.error ? '알림함, 미확인 개수 조회 실패' : `알림함, 안 읽은 알림 ${count.data ?? 0}개`}>알림{count.data !== undefined && count.data > 0 && <span className={styles.count}>{count.data > 99 ? '99+' : count.data}</span>}</Link>
}
