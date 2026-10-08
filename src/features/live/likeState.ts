import type { LikeTotal, LivesPort, MyLike } from '../../domain/ports'
import { ApiError } from '../../domain/errors'

export interface LikeState {
  aggregate?: LikeTotal
  personal?: MyLike
  busy: boolean
  loading: boolean
  error: string
  pending?: { liked: boolean; key: string }
}

/** Aggregate and member state have independent clocks. A newer total may decrease. */
export function mergeLike(state: LikeState, incoming: LikeTotal | MyLike): LikeState {
  const aggregate = !state.aggregate || incoming.version >= state.aggregate.version ? incoming : state.aggregate
  const personal = 'liked' in incoming && (!state.personal || incoming.stateVersion >= state.personal.stateVersion)
    ? incoming : state.personal
  return { ...state, aggregate, personal }
}

function withTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new ApiError('NETWORK', '응답이 지연되고 있어요. 같은 요청으로 다시 확인해 주세요.')), timeoutMs)
    request.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

/** One instance owns one account/broadcast scope; no automatic mutation retries. */
export function createLikeState(
  api: Pick<LivesPort, 'likes' | 'myLike' | 'setLike'>,
  liveId: string,
  authenticated: boolean,
  newKey: () => string = () => crypto.randomUUID(),
  timeoutMs = 10000,
) {
  let state: LikeState = { busy: false, loading: true, error: '' }
  let disposed = false
  let refreshSequence = 0
  const listeners = new Set<() => void>()
  const publish = (next: LikeState) => {
    if (disposed) return
    state = next
    listeners.forEach(listener => listener())
  }
  const accept = (value: LikeTotal | MyLike) => { if (!disposed) publish(mergeLike(state, value)) }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    dispose() { disposed = true; listeners.clear() },
    accept,
    async refresh() {
      const sequence = ++refreshSequence
      const results = await Promise.allSettled([
        withTimeout(api.likes(liveId), timeoutMs),
        ...(authenticated ? [withTimeout(api.myLike(liveId), timeoutMs)] : []),
      ])
      if (disposed) return
      for (const result of results) if (result.status === 'fulfilled') accept(result.value)
      if (sequence !== refreshSequence) return
      const failure = results.find(result => result.status === 'rejected')
      publish({ ...state, loading: false, error: failure ? '최신 좋아요 상태를 확인하지 못했어요.' : state.pending ? state.error : '' })
    },
    async toggle(live: boolean) {
      if (disposed || !authenticated || state.busy || !state.personal || (!live && !state.pending)) return
      const pending = state.pending ?? { liked: !state.personal.liked, key: newKey() }
      publish({ ...state, busy: true, error: '', pending })
      try {
        const result = await withTimeout(api.setLike(liveId, pending.liked, pending.key), timeoutMs)
        if (disposed) return
        accept(result)
        publish({ ...state, busy: false, pending: undefined, error: '' })
      } catch (error) {
        if (disposed) return
        // Network/5xx failures may have committed. Keep the exact intent and key.
        const uncertain = !(error instanceof ApiError) || error.code === 'NETWORK' || error.code === 'UNKNOWN'
        publish({ ...state, busy: false, pending: uncertain ? pending : undefined,
          error: error instanceof Error ? error.message : '좋아요 상태를 변경하지 못했어요.' })
      }
    },
  }
}
