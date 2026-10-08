import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createHttpApi } from '../src/api/http'
import { ApiError } from '../src/domain/errors'
import type { MyLike } from '../src/domain/ports'
import { createLikeState, mergeLike } from '../src/features/live/likeState'

Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
const snapshot = (liked: boolean, stateVersion = 0, total = Number(liked), version = stateVersion): MyLike => ({ broadcastId: 1, liked, stateVersion, total, version })
const deferred = <T>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}

test('likes adapter uses public versioned totals, member GET and explicit PUT UUID intent', async () => {
  const calls: { url: string; options?: RequestInit }[] = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options })
    return new Response(JSON.stringify({ success: true, data: snapshot(true, 1), error: null }))
  }
  const api = createHttpApi('/api')
  assert.equal((await api.lives.likes('1')).version, 1)
  assert.equal(new Headers(calls[0].options?.headers).has('Authorization'), false)
  await api.lives.myLike('1')
  assert.ok(calls[1].url.endsWith('/likes/mine'))
  await api.lives.setLike('1', false, 'a9f6fcf3-cd00-4a79-8dff-55047b090077')
  assert.equal(calls[2].options?.method, 'PUT')
  assert.equal(new Headers(calls[2].options?.headers).get('Idempotency-Key'), 'a9f6fcf3-cd00-4a79-8dff-55047b090077')
  assert.deepEqual(JSON.parse(String(calls[2].options?.body)), { liked: false })
})

test('aggregate decreases at newer version; old aggregate replay still applies newer personal clock', () => {
  let state = mergeLike({ busy: false, loading: false, error: '' }, snapshot(false))
  state = mergeLike(state, { broadcastId: 1, total: 7, version: 10 })
  state = mergeLike(state, snapshot(true, 1, 2, 2))
  assert.equal(state.aggregate?.total, 7)
  assert.equal(state.personal?.liked, true)
  state = mergeLike(state, { broadcastId: 1, total: 6, version: 11 })
  assert.equal(state.aggregate?.total, 6)
  state = mergeLike(state, snapshot(false, 0, 0, 0))
  assert.equal(state.personal?.liked, true)
  assert.equal(state.aggregate?.total, 6)
})

test('response loss preserves exact intent/key; successful cancel uses a fresh key; ended only allows replay', async () => {
  const calls: { liked: boolean; key: string }[] = []
  let next = 0
  const store = createLikeState({ likes: async () => snapshot(false), myLike: async () => snapshot(false),
    setLike: async (_, liked, key) => {
      calls.push({ liked, key })
      if (calls.length === 1) throw new ApiError('NETWORK', 'response lost after commit')
      return snapshot(liked, calls.length - 1)
    },
  }, '1', true, () => `key-${++next}`)
  await store.refresh()
  await store.toggle(true)
  assert.equal(store.getSnapshot().pending?.key, 'key-1')
  await store.toggle(false)
  assert.deepEqual(calls.slice(0, 2), [{ liked: true, key: 'key-1' }, { liked: true, key: 'key-1' }])
  assert.equal(store.getSnapshot().personal?.liked, true)
  await store.toggle(false)
  assert.equal(calls.length, 2)
  await store.toggle(true)
  assert.deepEqual(calls[2], { liked: false, key: 'key-2' })
  assert.equal(store.getSnapshot().personal?.liked, false)
})

test('rapid double clicks create one mutation, timeout retains intent and refresh never resends', async () => {
  const response = deferred<MyLike>()
  let writes = 0
  const store = createLikeState({ likes: async () => snapshot(false), myLike: async () => snapshot(false),
    setLike: () => { writes++; return response.promise },
  }, '1', true, () => 'one-key', 10)
  await store.refresh()
  const write = store.toggle(true)
  await store.toggle(true)
  await write
  assert.equal(writes, 1)
  assert.equal(store.getSnapshot().pending?.key, 'one-key')
  assert.equal(store.getSnapshot().busy, false)
  await store.refresh()
  assert.equal(writes, 1)
  response.resolve(snapshot(true, 1))
})

test('delayed old reads cannot overwrite mutation, different account/broadcast scopes share no retry key', async () => {
  const old = deferred<MyLike>()
  let reads = 0
  const calls: string[] = []
  const api = { likes: async () => snapshot(false), myLike: () => ++reads === 1 ? Promise.resolve(snapshot(false)) : old.promise,
    setLike: async (id: string, liked: boolean, key: string) => { calls.push(`${id}:${key}`); return snapshot(liked, 1) },
  }
  const first = createLikeState(api, '1', true, () => 'account-a')
  await first.refresh()
  const refresh = first.refresh()
  await first.toggle(true)
  old.resolve(snapshot(false, 0))
  await refresh
  assert.equal(first.getSnapshot().personal?.liked, true)
  const second = createLikeState({ ...api, myLike: async () => snapshot(false) }, '2', true, () => 'account-b')
  await second.refresh(); await second.toggle(true)
  assert.deepEqual(calls, ['1:account-a', '2:account-b'])
})

test('definitive 409 clears pending; anonymous state never calls private endpoints', async () => {
  let privateCalls = 0
  const api = { likes: async () => snapshot(false), myLike: async () => { privateCalls++; return snapshot(false) },
    setLike: async () => { privateCalls++; throw new ApiError('CONFLICT', '방송이 종료되었어요.') },
  }
  const anonymous = createLikeState(api, '1', false)
  await anonymous.refresh(); await anonymous.toggle(true)
  assert.equal(privateCalls, 0)
  const member = createLikeState(api, '1', true)
  await member.refresh(); await member.toggle(true)
  assert.equal(member.getSnapshot().pending, undefined)
  assert.equal(member.getSnapshot().error, '방송이 종료되었어요.')
})
