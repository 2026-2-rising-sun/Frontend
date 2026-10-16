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
  const [pending, setPending] = useState(false); const [notice, setNotice] = useState(''); const [error, setError] = useState('')
  const generation = useRef(0); const lock = useRef(false)
  useEffect(() => { const run = ++generation.current; return () => { generation.current = run + 1 } }, [])
  const change = async (subscribe: boolean) => {
    if (lock.current) return
    const run = generation.current; lock.current = true; setPending(true); setNotice(''); setError('')
    try {
      if (kind === 'broadcast') await (subscribe ? api.notifications.registerBroadcast(targetId) : api.notifications.unregisterBroadcast(targetId))
      else await (subscribe ? api.notifications.registerRestock(targetId) : api.notifications.unregisterRestock(targetId))
      if (run === generation.current) setNotice(`${label} 알림을 ${subscribe ? '신청했어요' : '해제했어요'}.`)
    } catch (e) { if (run === generation.current) setError(e instanceof Error ? e.message : '알림 설정에 실패했어요.') }
    finally { if (run === generation.current) { lock.current = false; setPending(false) } }
  }
  return <section className={styles.card} aria-label={`${label} 알림`}><strong>{label} 소식 받아보기</strong><p className={styles.meta}>현재 신청 상태는 조회할 수 없어요. 신청하거나 해제할 수 있어요.</p><div className={styles.row}><Button size="S" disabled={pending} onClick={() => void change(true)}>알림 신청</Button><Button size="S" variant="secondary" disabled={pending} onClick={() => void change(false)}>알림 해제</Button></div>{notice && <Alert type="success" title={notice} />}{error && <Alert type="danger" title={error} />}</section>
}
