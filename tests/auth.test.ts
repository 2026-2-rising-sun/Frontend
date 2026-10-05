import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createMockAuth } from '../src/mocks/mockAuth'
import { requireSeller } from '../src/domain/auth'
import { createHttpAuth } from '../src/api/http/auth'
import { createHttpClient } from '../src/api/http/client'

Object.assign(globalThis, { window: { location: { origin: 'http://localhost:5173' } } })
const envelope = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data, error: null }), { status })
const error = (status: number) => new Response(JSON.stringify({ success: false, data: null,
  error: { code: status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN', message: 'denied' } }), { status })

test('same two mock credentials, wrong password, role boundary and logout notifications', async () => {
  const auth = createMockAuth()
  let changes = 0
  const unsubscribe = auth.subscribe(() => { changes++ })
  assert.throws(() => requireSeller(auth.getSession()), { code: 'UNAUTHORIZED' })
  assert.equal((await auth.login('user', 'user')).role, 'USER')
  assert.throws(() => requireSeller(auth.getSession()), { code: 'FORBIDDEN' })
  assert.equal((await auth.login('seller', 'seller')).role, 'SELLER')
  requireSeller(auth.getSession())
  await assert.rejects(auth.login('seller', 'wrong'), { code: 'UNAUTHORIZED' })
  assert.equal(auth.getSession(), null)
  await auth.logout()
  assert.ok(changes >= 3)
  unsubscribe()
})

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
  assert.deepEqual(await request('/shopping/admin/products'), { items: [] })
  assert.equal(calls[2].headers.get('Authorization'), 'Bearer signed-token')
  denied = 403
  await assert.rejects(request('/shopping/admin/products'), { code: 'FORBIDDEN' })
  assert.equal(auth.getSession()?.role, 'SELLER')
  denied = 401
  await assert.rejects(request('/shopping/admin/products'), { code: 'UNAUTHORIZED' })
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
  await request('/shopping/products')
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
  const oldRequest = request('/commerce/cart/items')
  await auth.login('seller', 'seller')
  release()
  await assert.rejects(oldRequest, { code: 'UNAUTHORIZED' })
  assert.equal(auth.getSession()?.role, 'SELLER')
})
