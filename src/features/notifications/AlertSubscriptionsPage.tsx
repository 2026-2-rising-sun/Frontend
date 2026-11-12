import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../../app/apiContext'
import { Alert, Button } from '../../components/ui'
import type { AlertKind, AlertSubscription } from '../../domain/notifications'
import { useSession } from '../auth/useSession'
import { SubscriptionItem } from './SubscriptionItem'
import styles from './notifications.module.css'

export function AlertSubscriptionsPage() {
  const session = useSession()
  return <main className={styles.page}><h1 className="t-h1">내 알림 신청</h1><Link to="/notifications">알림함으로 이동</Link>
    <p className={styles.meta}>대상 번호가 큰 순서로 표시해요. 삭제되거나 비공개인 대상은 상세 화면을 열 수 없지만 신청은 해제할 수 있어요.</p>
    {session && <><SubscriptionList key={`${session.memberId}:broadcast`} kind="broadcast" /><SubscriptionList key={`${session.memberId}:restock`} kind="restock" /></>}
  </main>
}
function SubscriptionList({ kind }: { kind: AlertKind }) {
  const api = useApi()
  const [items, setItems] = useState<AlertSubscription[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasNext, setHasNext] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const lock = useRef(false)
  const label = kind === 'broadcast' ? '방송 시작' : '재입고'
  const load = async (next: string | null, run = generation.current) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError('')
    try {
      const page = await api.notifications.subscriptions(kind, next)
      if (run !== generation.current) return
      setItems(old => next ? [...old, ...page.items.filter(item => !old.some(previous => previous.targetId === item.targetId))] : page.items)
      setCursor(page.nextCursor); setHasNext(page.hasNext && !!page.nextCursor)
    } catch (e) { if (run === generation.current) setError(e instanceof Error ? e.message : '신청 목록을 불러오지 못했어요.') }
    finally { if (run === generation.current) { lock.current = false; setBusy(false) } }
  }
  useEffect(() => {
    const run = ++generation.current; lock.current = false
    void load(null, run)
    return () => { generation.current = run + 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, kind])
  const remove = async (id: string) => {
    if (lock.current) return
    const run = generation.current
    lock.current = true; setBusy(true); setError('')
    try {
      await (kind === 'broadcast' ? api.notifications.unregisterBroadcast(id) : api.notifications.unregisterRestock(id))
      if (run === generation.current) setItems(old => old.filter(item => item.targetId !== id))
    } catch (e) { if (run === generation.current) setError(e instanceof Error ? e.message : '알림 해제에 실패했어요.') }
    finally { if (run === generation.current) { lock.current = false; setBusy(false) } }
  }
  return <section aria-label={`${label} 신청 목록`}>
    <div className={styles.row}><h2 className="t-h3">{label} 알림</h2><Button size="S" variant="secondary" disabled={busy} onClick={() => void load(null)}>새로고침</Button></div>
    <p className={styles.meta}>{kind === 'broadcast' ? '방송 알림은 발송 후에도 신청 기록이 남아요. 현재 방송 상태나 발송 대기 여부를 뜻하지 않아요.' : '재입고 알림은 한 번 발송하면 신청 목록에서 빠져요. 다음 재입고 소식은 다시 신청해 주세요.'}</p>
    {error && <Alert type="danger" title={error}><Button size="S" variant="secondary" disabled={busy} onClick={() => void load(null)}>다시 시도</Button></Alert>}
    {busy && <p role="status">처리하고 있어요.</p>}
    {!busy && !error && !items.length && <p>신청한 {label} 알림이 없어요.</p>}
    <ul className={styles.list}>{items.map(item => <SubscriptionItem key={`${kind}:${item.targetId}`} kind={kind} item={item} busy={busy} onRemove={() => void remove(item.targetId)} />)}</ul>
    {hasNext && <Button variant="secondary" disabled={busy} onClick={() => void load(cursor)}>신청 더 보기</Button>}
  </section>
}
