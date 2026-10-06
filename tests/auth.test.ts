import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createHttpAuth } from '../src/api/http/auth'
import { createHttpClient } from '../src/api/http/client'

Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
const envelope = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data, error: null }), { status })
const error = (status: number) => new Response(JSON.stringify({ success: false, data: null,
  error: { code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: 'denied' } }), { status })
const refreshKey = 'shoppinglive:refresh:http://localhost:5173/api'
const profile = { memberId: 'id', email: 'user@local.test', displayName: 'user', roles: ['USER'] }
function refreshStorage(token?: string) {
  const values = new Map<string, string>(token ? [[refreshKey, token]] : [])
  return { values, storage: { getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } } }
}

test('local alias uses email API, authenticates /me and passes bearer; 403 retains session, 401 clears it', async () => {
  const calls: { path: string; headers: Headers; body: unknown }[] = []
  let denied = 0
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname
    calls.push({ path, headers: new Headers(init?.headers), body: init?.body ? JSON.parse(String(init.body)) : undefined })
    if (path.endsWith('/auth/login')) return envelope({ accessToken: 'signed-token', refreshToken: 'refresh-token' })
    if (path.endsWith('/members/me')) return envelope({ memberId: 'member-id', email: 'seller@local.test', displayName: 'Seller', roles: ['SELLER'] })
    return denied ? error(denied) : envelope({ items: [] })
  }
  const { auth, request } = createHttpAuth('/api', true)
  await auth.login('seller', 'seller')
  assert.deepEqual(calls[0].body, { email: 'seller@local.test', password: 'seller' })
  assert.equal(calls[0].headers.get('Authorization'), null)
  assert.equal(calls[1].headers.get('Authorization'), 'Bearer signed-token')
  assert.deepEqual(await request('/shopping/v1/admin/products'), { items: [] })
  assert.equal(calls[2].headers.get('Authorization'), 'Bearer signed-token')
  denied = 403
  await assert.rejects(request('/shopping/v1/admin/products'), { code: 'FORBIDDEN' })
  assert.equal(auth.getSession()?.role, 'SELLER')
  denied = 401
  await assert.rejects(request('/shopping/v1/admin/products'), { code: 'UNAUTHORIZED' })
  assert.equal(auth.getSession(), null)
})

test('production never aliases short names and rejected old ADMIN profile creates no session', async () => {
  const emails: string[] = []
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/login')) {
      emails.push(JSON.parse(String(init?.body)).email)
      return envelope({ accessToken: 'old-admin', refreshToken: 'old-refresh' })
    }
    return envelope({ memberId: 'id', email: 'email', displayName: 'name', roles: ['ADMIN'] })
  }
  const { auth } = createHttpAuth('/api')
  await assert.rejects(auth.login('seller', 'seller'), { code: 'FORBIDDEN' })
  assert.deepEqual(emails, ['seller'])
  assert.equal(auth.testAccounts, false)
  assert.equal(auth.getSession(), null)
})

test('logout during login cannot resurrect a session', async () => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  globalThis.fetch = async (input) => {
    if (String(input).endsWith('/login')) {
      await pending
      return envelope({ accessToken: 'access', refreshToken: 'refresh' })
    }
    return envelope({ memberId: 'id', email: 'user@local.test', displayName: 'user', roles: ['USER'] })
  }
  const { auth } = createHttpAuth('/api', true)
  const login = auth.login('user', 'user')
  await auth.logout()
  release()
  await assert.rejects(login, { code: 'UNAUTHORIZED' })
  assert.equal(auth.getSession(), null)
})

test('logout clears local state even when session revocation is unavailable; no bearer after logout', async () => {
  let fail = false
  let lastAuthorization: string | null = null
  globalThis.fetch = async (input, init) => {
    lastAuthorization = new Headers(init?.headers).get('Authorization')
    if (String(input).endsWith('/login')) return envelope({ accessToken: 'access', refreshToken: 'refresh' })
    if (String(input).endsWith('/me')) return envelope({ memberId: 'id', email: 'user@local.test', displayName: 'user', roles: ['USER'] })
    if (fail && String(input).endsWith('/logout')) throw new Error('offline')
    return envelope([])
  }
  const { auth, request } = createHttpAuth('/api', true)
  await auth.login('user', 'user')
  fail = true
  await assert.rejects(auth.logout(), { code: 'NETWORK' })
  assert.equal(auth.getSession(), null)
  await request('/shopping/v1/products')
  assert.equal(lastAuthorization, null)
})

test('anonymous request and 204 do not assume a JSON response', async () => {
  let authorization: string | null = null
  globalThis.fetch = async (_input, init) => { authorization = new Headers(init?.headers).get('Authorization'); return new Response(null, { status: 204 }) }
  const request = createHttpClient('/api', { accessToken: () => 'token', unauthorized: () => {} })
  assert.equal(await request('/auth/logout', { anonymous: true }), undefined)
  assert.equal(authorization, null)
})

test('late 401 from the previous account cannot clear a newly authenticated seller session', async () => {
  let account = 'user'
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => { release = resolve })
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/login')) {
      account = JSON.parse(String(init?.body)).email.split('@')[0]
      return envelope({ accessToken: account + '-access', refreshToken: account + '-refresh' })
    }
    if (String(input).endsWith('/me')) return envelope({ memberId: account, email: account + '@local.test',
      displayName: account, roles: [account === 'seller' ? 'SELLER' : 'USER'] })
    await pending
    return error(401)
  }
  const { auth, request } = createHttpAuth('/api', true)
  await auth.login('user', 'user')
  const oldRequest = request('/commerce/v1/cart/items')
  await auth.login('seller', 'seller')
  release()
  await assert.rejects(oldRequest, { code: 'UNAUTHORIZED' })
  assert.equal(auth.getSession()?.role, 'SELLER')
})

test('near-expiry access token rotates once for concurrent requests and uses the replacement bearer', async () => {
  let refreshCalls = 0; const seen: string[] = []
  const jwt = (exp: number) => 'header.' + Buffer.from(JSON.stringify({ exp })).toString('base64url') + '.signature'
  const old = jwt(Math.floor(Date.now()/1000) + 10); const next = jwt(Math.floor(Date.now()/1000) + 900)
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/login')) return envelope({ accessToken: old, refreshToken: 'refresh' })
    if (String(input).endsWith('/members/me')) return envelope({ memberId: 'id', email: 'user@local.test', displayName: 'user', roles: ['USER'] })
    if (String(input).endsWith('/auth/refresh')) { refreshCalls++; await new Promise(resolve => setTimeout(resolve, 20)); return envelope({ accessToken: next, refreshToken: 'rotated' }) }
    seen.push(new Headers(init?.headers).get('Authorization') ?? ''); return envelope([])
  }
  const { auth, request } = createHttpAuth('/api', true); await auth.login('user', 'user')
  await Promise.all([request('/commerce/v1/cart/items'), request('/commerce/v1/orders')])
  assert.equal(refreshCalls, 1); assert.deepEqual(seen, ['Bearer ' + next, 'Bearer ' + next])
})

test('profile edit updates the session when its request first refreshes an expiring token', async () => {
  const jwt = (exp: number) => 'header.' + Buffer.from(JSON.stringify({ exp })).toString('base64url') + '.signature'
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/login')) return envelope({ accessToken: jwt(Math.floor(Date.now()/1000) + 10), refreshToken: 'refresh' })
    if (String(input).endsWith('/auth/refresh')) return envelope({ accessToken: jwt(Math.floor(Date.now()/1000) + 900), refreshToken: 'rotated' })
    return envelope({ memberId: 'id', email: 'user@local.test', displayName: init?.method === 'PATCH' ? 'edited' : 'user', roles: ['USER'] })
  }
  const { auth } = createHttpAuth('/api', true)
  await auth.login('user', 'user'); await auth.updateName('edited')
  assert.equal(auth.getSession()?.displayName, 'edited')
})

test('reload rotates the stored refresh token once and restores only the server-verified profile', async () => {
  const { storage, values } = refreshStorage(); let refreshCalls = 0; let profiles = 0
  globalThis.fetch = async (input, init) => {
    if (String(input).endsWith('/login')) return envelope({ accessToken: 'original-access', refreshToken: 'original-refresh' })
    if (String(input).endsWith('/refresh')) { refreshCalls++; return envelope({ accessToken: 'restored-access', refreshToken: 'rotated-refresh' }) }
    profiles++; if (profiles === 2) assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer restored-access')
    return envelope(profile)
  }
  await createHttpAuth('/api', true, storage).auth.login('user', 'user')
  assert.deepEqual([...values], [[refreshKey, 'original-refresh']])
  const { auth } = createHttpAuth('/api', true, storage)
  assert.equal(auth.getSession(), null)
  await Promise.all([auth.restore(), auth.restore()])
  assert.equal(refreshCalls, 1); assert.equal(profiles, 2); assert.equal(auth.getSession()?.email, profile.email)
  assert.deepEqual([...values], [[refreshKey, 'rotated-refresh']])
})

test('revoked refresh token is removed rather than restoring a cached login', async () => {
  const { storage, values } = refreshStorage('revoked')
  globalThis.fetch = async () => error(401)
  const { auth } = createHttpAuth('/api', true, storage); await auth.restore()
  assert.equal(auth.getSession(), null); assert.equal(values.size, 0)
})

test('temporary restore failure retains the refresh token for a verified retry', async () => {
  const { storage, values } = refreshStorage('valid'); let offline = true
  globalThis.fetch = async input => {
    if (offline) throw new Error('offline')
    return String(input).endsWith('/refresh') ? envelope({ accessToken: 'access', refreshToken: 'rotated' }) : envelope(profile)
  }
  const { auth } = createHttpAuth('/api', true, storage)
  await assert.rejects(auth.restore(), { code: 'NETWORK' }); assert.equal(auth.getSession(), null); assert.equal(values.get(refreshKey), 'valid')
  offline = false; await auth.restore(); assert.equal(auth.getSession()?.memberId, profile.memberId)
})

test('logout during restoration cannot write a delayed token back into browser storage', async () => {
  const { storage, values } = refreshStorage('valid'); let release: () => void = () => {}
  const pending = new Promise<void>(resolve => { release = resolve })
  globalThis.fetch = async input => {
    if (String(input).endsWith('/refresh')) { await pending; return envelope({ accessToken: 'late-access', refreshToken: 'late-refresh' }) }
    return new Response(null, { status: 204 })
  }
  const { auth } = createHttpAuth('/api', true, storage); const restore = auth.restore()
  await auth.logout(); release(); await restore
  assert.equal(auth.getSession(), null); assert.equal(values.size, 0)
})

test('delayed restore from the old account cannot overwrite a newly signed-in seller', async () => {
  const { storage, values } = refreshStorage('old'); let release: () => void = () => {}
  const pending = new Promise<void>(resolve => { release = resolve })
  globalThis.fetch = async input => {
    if (String(input).endsWith('/refresh')) { await pending; return envelope({ accessToken: 'old-access', refreshToken: 'old-rotated' }) }
    if (String(input).endsWith('/login')) return envelope({ accessToken: 'seller-access', refreshToken: 'seller-refresh' })
    return envelope({ ...profile, memberId: 'seller', roles: ['SELLER'] })
  }
  const { auth } = createHttpAuth('/api', true, storage); const restore = auth.restore()
  await auth.login('seller', 'seller'); release(); await restore
  assert.equal(auth.getSession()?.role, 'SELLER'); assert.equal(values.get(refreshKey), 'seller-refresh')
})

test('unsupported server role during restore clears tokens and leaves no authenticated profile', async () => {
  const { storage, values } = refreshStorage('old')
  globalThis.fetch = async input => String(input).endsWith('/refresh') ? envelope({ accessToken: 'access', refreshToken: 'rotated' }) : envelope({ ...profile, roles: ['ADMIN'] })
  const { auth } = createHttpAuth('/api', true, storage); await auth.restore()
  assert.equal(auth.getSession(), null); assert.equal(values.size, 0)
})

test('public startup without a saved token makes no authentication requests', async () => {
  const { storage } = refreshStorage()
  globalThis.fetch = async () => { throw new Error('unexpected auth request') }
  const { auth } = createHttpAuth('/api', true, storage); await auth.restore(); assert.equal(auth.getSession(), null)
})
