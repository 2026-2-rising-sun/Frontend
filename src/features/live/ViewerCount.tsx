import { useEffect, useState } from 'react'
import { useApi } from '../../app/apiContext'
import { Button } from '../../components/ui'
import type { ViewerTotal } from '../../domain/ports'
import type { LiveStatus } from '../../domain/types'

let fallbackId: string | undefined
function browserViewerId() {
  const key = 'shoppinglive:viewer-id'
  try {
    const saved = localStorage.getItem(key)
    if (saved && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(saved)) return saved
    const id = crypto.randomUUID()
    localStorage.setItem(key, id)
    return id
  } catch { return fallbackId ??= crypto.randomUUID() }
}
export function ViewerCount({ liveId, status, watching = true }: { liveId: string; status: LiveStatus; watching?: boolean }) {
  return status === 'LIVE' ? <ViewerCountScope key={`${liveId}:${watching}`} liveId={liveId} watching={watching} /> : null
}
function ViewerCountScope({ liveId, watching }: { liveId: string; watching: boolean }) {
  const api = useApi()
  const [data, setData] = useState<ViewerTotal>()
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    let busy = false
    let timer: ReturnType<typeof setTimeout> | undefined
    async function refresh() {
      if (!active || busy) return
      clearTimeout(timer)
      if (document.visibilityState !== 'visible') { timer = setTimeout(() => void refresh(), 15000); return }
      busy = true
      try {
        const result = watching ? await api.lives.heartbeatViewer(liveId, browserViewerId()) : await api.lives.viewerCount(liveId)
        if (active) { setData(result); setFailed(false) }
      } catch { if (active) setFailed(true) }
      finally { busy = false; if (active) timer = setTimeout(() => void refresh(), 15000) }
    }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    void refresh()
    document.addEventListener('visibilitychange', onVisible)
    return () => { active = false; clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible) }
  }, [api, liveId, watching, revision])
  return <div aria-label="현재 시청 규모">
    {failed ? <><span>시청자 수를 확인하지 못했어요.</span><Button size="S" variant="secondary" onClick={() => setRevision(value => value + 1)}>시청자 수 다시 확인</Button></>
      : <span title="최근 60초 내 시청 화면을 연 브라우저 기준 추정치입니다. 같은 브라우저의 여러 탭은 하나로 집계해요." aria-live="polite">{data ? `현재 시청 약 ${data.total.toLocaleString()}명` : '시청자 수 확인 중…'}</span>}
  </div>
}
