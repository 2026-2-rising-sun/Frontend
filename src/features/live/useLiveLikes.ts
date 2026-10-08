import { useEffect, useMemo, useSyncExternalStore } from 'react'
import type { LivesPort } from '../../domain/ports'
import { createLikeState } from './likeState'

export function useLiveLikes(api: LivesPort, liveId: string, memberId?: string) {
  const store = useMemo(() => createLikeState(api, liveId, memberId !== undefined), [api, liveId, memberId])
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot)
  useEffect(() => {
    void store.refresh()
    // Old scope responses are isolated in their own store after account/broadcast changes.
  }, [store])
  return { ...state, reload: store.refresh, toggle: store.toggle, accept: store.accept }
}
