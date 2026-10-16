import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useApi } from '../../app/apiContext'
import { Alert, Button, Input } from '../../components/ui'
import type { LiveStatus } from '../../domain/types'
import type { PromotionInput } from '../../domain/promotions'
import { useAsync } from '../../hooks/useAsync'
import { useIdempotencyKey } from '../../hooks/useIdempotencyKey'
import { AdminSection } from './components/AdminSection'
import styles from '../live/promotions.module.css'
const labels = { READY: '준비 중', OPEN: '진행 중', CLOSED: '종료' }
const reasons: Record<string, string> = { SELLER_CLOSED: '판매자가 종료', EXPIRED: '시간 만료', BROADCAST_ENDED: '방송 종료', CANCELED: '진행 취소' }
export function PromotionPanel({ liveId, status }: { liveId: string; status: LiveStatus }) {
  const api = useApi(); const items = useAsync(() => api.promotions.list(liveId), [api, liveId])
  const [title, setTitle] = useState(''); const [duration, setDuration] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('')
  const key = useIdempotencyKey(); const lock = useRef(false); const revision = useRef(0)
  useEffect(() => { const timer = setInterval(items.reload, 15000); return () => clearInterval(timer) }, [items.reload])
  const run = async (action: () => Promise<unknown>, message: string) => {
    if (lock.current) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try { await action(); setNotice(message); items.reload() }
    catch (e) { setError(e instanceof Error ? e.message : '방송 이벤트를 처리하지 못했어요.'); items.reload() }
    finally { lock.current = false; setBusy(false) }
  }
  const create = (event: FormEvent) => {
    event.preventDefault()
    const input: PromotionInput = { type: 'ANNOUNCEMENT', title: title.trim(), durationSeconds: duration ? Number(duration) : null }
    if (!input.title || (input.durationSeconds !== null && (!Number.isInteger(input.durationSeconds) || input.durationSeconds! < 10 || input.durationSeconds! > 3600))) { setError('제목과 자동 종료 시간(10~3600초)을 확인해 주세요.'); return }
    void run(async () => { const result = await api.promotions.create(liveId, input, key({ ...input, revision: revision.current })); revision.current++; setTitle(''); setDuration(''); return result }, '방송 이벤트를 준비했어요. 방송 중에 열 수 있어요.')
  }
  return <AdminSection title="방송 이벤트" description="시청 화면에 안내 배너를 노출해요. 쿠폰 발급이나 가격 할인은 별도로 설정해 주세요.">
    <div className={styles.list}>{error && <Alert type="danger" title={error} />}{notice && <Alert type="success" title={notice} />}
      {status !== 'ENDED' && <form onSubmit={create} className={styles.card}><Input label="이벤트 제목" value={title} onChange={event => setTitle(event.target.value)} maxLength={100} required placeholder="예: 오늘 방송의 특별한 소식" /><Input label="자동 종료 시간(초)" helper="10~3600초. 비우면 직접 종료할 때까지 유지돼요." type="number" min={10} max={3600} step={1} value={duration} onChange={event => setDuration(event.target.value)} /><Button type="submit" disabled={busy}>이벤트 준비하기</Button></form>}
      {items.loading && <p role="status">방송 이벤트를 불러오고 있어요.</p>}
      {items.error && <Alert type="danger" title={items.error.message}><Button size="S" variant="secondary" onClick={items.reload}>다시 시도</Button></Alert>}
      {!items.loading && !items.error && !items.data?.length && <p>등록된 이벤트가 없어요. 제목을 입력해 첫 이벤트를 준비해 보세요.</p>}
      {items.data?.map(item => <article key={item.id} className={styles.card}><div className={styles.row}><strong>{item.title}</strong><span className={styles.meta}>{labels[item.status]}</span></div>{item.closesAt && <p className={styles.meta}>자동 종료: {new Date(item.closesAt).toLocaleString('ko-KR')}</p>}{item.closeReason && <p className={styles.meta}>{reasons[item.closeReason] ?? '이벤트 종료'}</p>}<div className={styles.row}>{item.status === 'READY' && <Button size="S" disabled={busy || status !== 'LIVE'} onClick={() => void run(() => api.promotions.open(liveId, item.id), '시청 화면에 이벤트를 표시했어요.')}>이벤트 열기</Button>}{item.status !== 'CLOSED' && <Button size="S" variant="secondary" disabled={busy} onClick={() => void run(() => api.promotions.close(liveId, item.id), item.status === 'READY' ? '이벤트를 취소했어요.' : '이벤트를 종료했어요.')}>{item.status === 'READY' ? '준비 취소' : '이벤트 종료'}</Button>}</div></article>)}
    </div>
  </AdminSection>
}
