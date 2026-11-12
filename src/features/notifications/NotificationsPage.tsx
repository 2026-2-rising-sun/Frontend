import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { Alert, Button } from '../../components/ui'
import { notificationTarget, type Notification } from '../../domain/notifications'
import { useSession } from '../auth/useSession'
import styles from './notifications.module.css'

export function NotificationsPage() {
  const api = useApi()
  const session = useSession()
  const [items, setItems] = useState<Notification[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [reading, setReading] = useState(false)
  const [notice, setNotice] = useState('')
  const readBusy = useRef(false)
  const generation = useRef(0)
  const busy = useRef(false)
  const load = async (next: string | null, run = generation.current, afterRead = false) => {
    if (busy.current || (readBusy.current && !afterRead)) return
    busy.current = true; setLoading(true); setError('')
    try {
      const page = await api.notifications.list(next)
      if (run !== generation.current) return
      setItems(previous => next ? [...previous, ...page.items.filter(item => !previous.some(old => old.id === item.id))] : page.items)
      setCursor(page.nextCursor); setHasNext(page.hasNext && !!page.nextCursor)
    } catch (e) { if (run === generation.current) setError(e instanceof Error ? e.message : '알림을 불러오지 못했어요.') }
    finally { if (run === generation.current) { busy.current = false; setLoading(false) } }
  }
  useEffect(() => {
    const run = ++generation.current
    busy.current = false; readBusy.current = false
    setItems([]); setCursor(null); setHasNext(false); setLoading(false); setReading(false); setNotice(''); setError('')
    if (session) void load(null, run)
    return () => { generation.current = run + 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, session])
  const markAllRead = async () => {
    if (readBusy.current || busy.current || !session) return
    const run = generation.current
    readBusy.current = true; setReading(true); setError(''); setNotice('')
    try {
      await api.notifications.readAll()
      if (run !== generation.current) return
      setNotice('알림을 모두 읽음 처리했어요.')
      // 목록 재조회가 실패해도 성공한 읽음 처리는 배지에 반영한다.
      window.dispatchEvent(new Event('notifications-changed'))
      await load(null, run, true)
    } catch (e) { if (run === generation.current) setError(e instanceof Error ? e.message : '전체 읽음 처리에 실패했어요.') }
    finally { if (run === generation.current) { readBusy.current = false; setReading(false) } }
  }
  if (!session) return <div className={styles.page}><h1 className="t-h1">알림함</h1><Link to="/login" state={{ from: '/notifications' }}>로그인하고 알림 확인하기</Link></div>
  return <main className={styles.page}>
    <Link to="/notifications/subscriptions">내 알림 신청 관리</Link>
    <div className={styles.row}><h1 className="t-h1">알림함</h1><Button variant="secondary" size="S" disabled={loading || reading} onClick={() => void load(null)}>새로고침</Button><Button size="S" disabled={loading || reading} onClick={() => void markAllRead()}>{reading ? '처리 중…' : '전체 읽음'}</Button></div>
    {notice && <p role="status">{notice}</p>}
    {error && <Alert type="danger" title={error}><Button variant="secondary" size="S" disabled={loading || reading} onClick={() => void load(null)}>다시 시도</Button></Alert>}
    {loading && <p role="status">알림을 불러오는 중이에요.</p>}
    {!loading && !error && !items.length && <div className={styles.card}><h2 className="t-h4">아직 받은 알림이 없어요</h2><p>관심 있는 방송과 품절 상품의 알림을 신청해 보세요.</p><Link to="/lives">방송 둘러보기</Link></div>}
    <ul className={styles.list}>{items.map(item => {
      const target = notificationTarget(item)
      return <li key={item.id} className={`${styles.card} ${!item.readAt ? styles.unread : ''}`}>
        <div className={styles.row}><strong>{item.title}</strong>{!item.readAt && <span className={styles.meta}>새 알림</span>}</div>
        <p>{item.body}</p><time className={styles.meta} dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString('ko-KR')}</time>
        <div className={styles.row}>{target && <Link to={target}>자세히 보기</Link>}</div>
      </li>
    })}</ul>
    {hasNext && <Button variant="secondary" disabled={loading || reading} onClick={() => void load(cursor)}>알림 더 보기</Button>}
  </main>
}
