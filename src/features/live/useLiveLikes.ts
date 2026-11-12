import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { LivesPort } from '../../domain/ports'
import { createLikeState } from './likeState'

export function useLiveLikes(api: LivesPort, liveId: string, memberId?: string) {
  const store = useMemo(() => createLikeState(api, liveId, memberId !== undefined), [api, liveId, memberId])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    void store.refresh()
    // 계정·방송이 바뀌면 이전 범위의 응답은 해당 범위의 저장소에만 반영된다.
  }, [store])
  return { ...state, reload: store.refresh, toggle: store.toggle, accept: store.accept }
}
