import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useApi } from '../../../app/apiContext'
import { Alert, Button, ButtonLink, Input } from '../../../components/ui'
import { useAsync } from '../../../hooks/useAsync'
import { useLiveLikes } from '../useLiveLikes'
import type { LikeTotal } from '../../../domain/ports'
import { useSession } from '../../auth/useSession'
import type { LiveStatus } from '../../../domain/types'
import styles from './LiveInteraction.module.css'
export function LiveInteraction({ liveId, liveStatus, showChat, onEnded }: { liveId: string; liveStatus: LiveStatus; showChat: boolean; onEnded: () => void }) {
  const api = useApi(); const session = useSession()
  const chats = useAsync(() => api.lives.chats(liveId), [api, liveId])
  const likes = useLiveLikes(api.lives, liveId, session?.memberId)
  const [content, setContent] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState<'chat' | null>(null)
  const [connected, setConnected] = useState(false); const list = useRef<HTMLUListElement>(null)
  const reloadChats = chats.reload; const reloadLikes = likes.reload; const acceptLike = likes.accept
  useEffect(() => {
    if (liveStatus !== 'LIVE') return
    let stopped = false; let pending: ReturnType<typeof setTimeout> | undefined
    const recover = () => { if (!stopped) { reloadChats(); reloadLikes() } }
    const schedule = () => { if (!pending) pending = setTimeout(() => { pending = undefined; recover() }, 300) }
    const events = new EventSource(api.lives.eventsUrl(liveId))
    const ready = () => { setConnected(true); recover() }
    events.addEventListener('stream.ready', ready)
    events.addEventListener('chat.created', schedule)
    events.addEventListener('likes.updated', event => {
      try {
        const value = JSON.parse((event as MessageEvent).data) as LikeTotal
        if (value.broadcastId === Number(liveId) && Number.isSafeInteger(value.total) && value.total >= 0 && Number.isSafeInteger(value.version) && value.version >= 0) acceptLike(value)
      } catch { /* REST recovers malformed or missing event payloads. */ }
      schedule()
    })
    events.addEventListener('broadcast.ended', () => { events.close(); setConnected(false); recover(); onEnded() })
    events.onerror = () => { setConnected(false); recover() }
    // SSE has no replay. REST recovers missed events and is also the fallback while reconnecting.
    const timer = setInterval(() => { if (document.visibilityState === 'visible') recover() }, 15000)
    document.addEventListener('visibilitychange', recover)
    return () => { stopped = true; events.close(); clearInterval(timer); clearTimeout(pending); document.removeEventListener('visibilitychange', recover) }
  }, [api, liveId, liveStatus, reloadChats, reloadLikes, acceptLike, onEnded])
  useEffect(() => { if (list.current) list.current.scrollTop = list.current.scrollHeight }, [chats.data])
  async function send(e: FormEvent) {
    e.preventDefault()
    if (busy || likes.busy || !session || liveStatus !== 'LIVE') return
    const value = content.trim()
    if ([...value].length < 1 || [...value].length > 200) { setError('채팅은 1~200자로 입력해 주세요.'); return }
    setBusy('chat'); setError('')
    try { await api.lives.sendChat(liveId, value); setContent(''); reloadChats() }
    catch (e) { setError(e instanceof Error ? e.message : '전송하지 못했어요.') }
    finally { setBusy(null) }
  }
  return <section className={styles.panel} aria-label="라이브 참여">
    <div className={styles.actions}><span aria-live="polite">좋아요 {likes.aggregate?.total.toLocaleString() ?? '—'}</span>
      <Button size="S" variant="secondary" disabled={!session || likes.busy || busy !== null || !likes.personal || (liveStatus !== 'LIVE' && !likes.pending)} aria-pressed={likes.personal?.liked ?? false} onClick={() => { void likes.toggle(liveStatus === 'LIVE') }}>{likes.busy ? '확인 중…' : likes.pending ? '같은 요청 다시 확인' : likes.personal?.liked ? '좋아요 취소' : '좋아요 보내기'}</Button>
    </div>
    {likes.error && <Alert type="warning" title="좋아요 상태를 확인해 주세요">{likes.error}<Button size="S" variant="secondary" onClick={() => { void reloadLikes() }} disabled={likes.busy}>상태 다시 조회</Button></Alert>}
    {error && <Alert type="danger" title="처리하지 못했어요">{error}</Alert>}
    {showChat && <>
      <p className="t-caption">최근 50개 채팅 · {liveStatus === 'LIVE' && connected ? '실시간 연결됨' : '조회로 갱신'}</p>
      {chats.error && <Alert type="warning" title="채팅을 갱신하지 못했어요"><Button variant="secondary" onClick={reloadChats}>다시 조회</Button></Alert>}
      <ul ref={list} className={styles.messages} aria-label="최근 채팅">
        {chats.data?.map(c => <li key={c.messageId}><strong>{c.displayName}</strong><p>{c.content}</p></li>)}
      </ul>
      {chats.data?.length === 0 && <p>아직 채팅이 없어요.</p>}
      {session ? <form onSubmit={send} className={styles.form}><Input label="채팅 입력" value={content} onChange={e => setContent(e.target.value)} maxLength={400} disabled={liveStatus !== 'LIVE' || busy !== null || likes.busy} helper="최대 200자" />
        <Button type="submit" disabled={liveStatus !== 'LIVE' || busy !== null || likes.busy}>{busy === 'chat' ? '전송 중…' : '전송'}</Button></form>
        : <ButtonLink to="/login" state={{ from: `/lives/${liveId}` }} variant="secondary">로그인하고 참여하기</ButtonLink>}
      {liveStatus !== 'LIVE' && <p className="t-caption">방송 진행 중에 채팅과 좋아요를 보낼 수 있어요.</p>}
    </>}
  </section>
}
