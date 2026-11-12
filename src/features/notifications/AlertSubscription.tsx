import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { Alert, Button } from '../../components/ui'
import { useSession } from '../auth/useSession'
import styles from './notifications.module.css'
export function AlertSubscription({ kind, targetId }: { kind: 'broadcast' | 'restock'; targetId: string }) {
  const session = useSession(); const location = useLocation()
  const label = kind === 'broadcast' ? '방송 시작' : '재입고'
  if (!session) return <Link to="/login" state={{ from: location.pathname }}>로그인하고 {label} 알림 신청</Link>
  return <SubscriptionForm key={`${session.memberId}:${kind}:${targetId}`} kind={kind} targetId={targetId} />
}
function SubscriptionForm({ kind, targetId }: { kind: 'broadcast' | 'restock'; targetId: string }) {
  const api = useApi()
  const label = kind === 'broadcast' ? '방송 시작' : '재입고'
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('')
  const generation = useRef(0); const lock = useRef(false)
  const load = async (run: number) => {
    setLoading(true); setError('')
    try {
      const state = await api.notifications.subscriptionState(kind, targetId)
      if (run === generation.current) setSubscribed(state)
    } catch (e) { if (run === generation.current) setError(e instanceof Error ? e.message : '신청 상태를 불러오지 못했어요.') }
    finally { if (run === generation.current) setLoading(false) }
  }
  useEffect(() => {
    const run = ++generation.current
    void load(run)
    return () => { generation.current = run + 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, kind, targetId])
  const change = async (subscribe: boolean) => {
    if (lock.current) return
    const run = generation.current; lock.current = true; setPending(true); setNotice(''); setError('')
    try {
      if (kind === 'broadcast') await (subscribe ? api.notifications.registerBroadcast(targetId) : api.notifications.unregisterBroadcast(targetId))
      else await (subscribe ? api.notifications.registerRestock(targetId) : api.notifications.unregisterRestock(targetId))
      if (run === generation.current) { setSubscribed(subscribe); setNotice(`${label} 알림을 ${subscribe ? '신청했어요' : '해제했어요'}.`) }
    } catch (e) { if (run === generation.current) setError(e instanceof Error ? e.message : '알림 설정에 실패했어요.') }
    finally { if (run === generation.current) { lock.current = false; setPending(false) } }
  }
  return <section className={styles.card} aria-label={`${label} 알림`}><strong>{label} 소식 받아보기</strong><p className={styles.meta} role="status">{loading ? '신청 상태를 확인하고 있어요.' : subscribed === null ? '신청 상태를 확인하지 못했어요.' : subscribed ? '알림을 신청한 상태예요.' : '알림을 신청하지 않았어요.'}</p><div className={styles.row}>{subscribed !== null && <Button size="S" variant={subscribed ? 'secondary' : 'primary'} disabled={pending || loading} onClick={() => void change(!subscribed)}>{subscribed ? '알림 해제' : '알림 신청'}</Button>}<Button size="S" variant="secondary" disabled={pending || loading} onClick={() => void load(generation.current)}>상태 새로고침</Button><Link to="/notifications/subscriptions">내 알림 신청</Link></div>{notice && <Alert type="success" title={notice} />}{error && <Alert type="danger" title={error} />}</section>
}
