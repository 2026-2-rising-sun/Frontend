import { test, expect, type Page, type Route } from '@playwright/test'
import type { Notification } from '../../src/domain/notifications'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}
async function fixture(page: Page, total = 45) {
  const items: Notification[] = Array.from({ length: total }, (_, n) => ({
    id: String(n + 1), eventType: 'LiveBroadcastStarted', title: `방송 시작 알림 ${n + 1}`, body: '신청하신 방송이 시작되었습니다.',
    linkType: 'BROADCAST', linkValue: '42', occurredAt: '2026-10-26T00:00:00Z', readAt: n === 0 ? '2026-10-26T00:01:00Z' : null,
  }))
  const state = {
    items, member: 'A', posts: 0, individual: 0, listCalls: 0,
    bulk: null as ((route: Route) => Promise<void>) | null,
    list: null as ((route: Route) => Promise<void>) | null,
    count: null as ((route: Route) => Promise<void>) | null,
  }
  await page.route(/\/api\/(member|notification|commerce|shopping|live)\//, async route => {
    const req = route.request(); const url = new URL(req.url()); const path = url.pathname
    const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path.endsWith('/auth/login')) state.member = req.postDataJSON().email.startsWith('b@') ? 'B' : 'A'
    if (path.includes('/auth/')) return json({ accessToken: 'fixture-' + state.member, refreshToken: 'fixture-refresh' })
    if (path.endsWith('/members/me')) return json({ memberId: state.member, email: `${state.member}@test.dev`, displayName: `회원 ${state.member}`, roles: ['USER'] })
    if (path.endsWith('/notifications/unread-count')) {
      if (state.count) return state.count(route)
      return json({ unreadCount: state.member === 'A' ? items.filter(item => !item.readAt).length : 7 })
    }
    if (path.endsWith('/notifications/read-all')) {
      state.posts++
      expect(req.method()).toBe('POST'); expect(req.postData()).toBeNull()
      if (state.bulk) return state.bulk(route)
      items.forEach(item => { item.readAt ??= '2026-10-26T01:00:00Z' })
      return route.fulfill({ status: 204 })
    }
    if (/\/notifications\/[^/]+\/read$/.test(path)) state.individual++
    if (path.endsWith('/notifications')) {
      state.listCalls++
      if (state.list) return state.list(route)
      if (state.member === 'B') return json({ items: [{ ...items[0], id: 'b-1', title: 'B의 알림', readAt: null }], nextCursor: null, hasNext: false })
      const start = Number(url.searchParams.get('cursor') ?? 0); const end = start + 20
      return json({ items: items.slice(start, end), nextCursor: end < items.length ? String(end) : null, hasNext: end < items.length })
    }
    return route.fulfill({ status: 404, json: { message: path } })
  })
  return state
}
async function login(page: Page, email = 'a@test.dev') {
  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '알림함 새로운 소식과 알림 확인' }).click()
  await expect(page.getByRole('button', { name: '전체 읽음', exact: true })).toBeEnabled()
}
const unread = (page: Page) => page.getByText('새 알림', { exact: true })
const badge = (page: Page, n: number) => page.getByRole('link', { name: `알림함, 안 읽은 알림 ${n}개`, exact: true })

test('fixture UI: 단일 bulk 제출, 미조회 페이지, 배지 역전 방지와 모바일 화면', async ({ page }) => {
  const state = await fixture(page); await login(page)
  await expect(unread(page)).toHaveCount(19); await expect(badge(page, 44)).toBeVisible()
  await expect(page.getByRole('button', { name: '읽음 처리', exact: true })).toHaveCount(0)
  await page.screenshot({ path: 'test-artifacts/notifications-read-all-desktop-before.png', fullPage: false })
  const stale = deferred(); const counted = deferred()
  state.count = async route => { counted.resolve(); await stale.promise; await route.fulfill({ json: { success: true, data: { unreadCount: 44 } } }) }
  await page.evaluate(() => window.dispatchEvent(new Event('focus'))); await counted.promise
  state.count = null
  const submitted = deferred(); const finish = deferred()
  state.bulk = async route => {
    submitted.resolve(); await finish.promise
    state.items.forEach(item => { item.readAt ??= '2026-10-26T01:00:00Z' })
    await route.fulfill({ status: 204 })
  }
  await page.getByRole('button', { name: '전체 읽음', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click() })
  await submitted.promise
  await expect(page.getByRole('button', { name: '처리 중…' })).toBeDisabled()
  await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeDisabled()
  await expect(page.getByRole('button', { name: '알림 더 보기' })).toBeDisabled()
  expect(state.posts).toBe(1)
  finish.resolve(); await expect(badge(page, 0)).toBeVisible(); await expect(unread(page)).toHaveCount(0)
  const oldCount = page.waitForResponse(response => response.url().endsWith('/notifications/unread-count'))
  stale.resolve(); await (await oldCount).finished()
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
  await expect(badge(page, 0)).toBeVisible()
  await page.getByRole('button', { name: '알림 더 보기' }).click(); await expect(page.getByText('방송 시작 알림 40', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '알림 더 보기' }).click(); await expect(page.getByText('방송 시작 알림 45', { exact: true })).toBeVisible()
  await expect(unread(page)).toHaveCount(0); expect(state.individual).toBe(0)
  expect(state.items[0].readAt).toBe('2026-10-26T00:01:00Z')
  await page.screenshot({ path: 'test-artifacts/notifications-read-all-desktop-after.png', fullPage: false })
  await page.setViewportSize({ width: 390, height: 844 }); await page.evaluate(() => window.scrollTo(0, 0))
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await expect(page.getByRole('button', { name: '전체 읽음', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-artifacts/notifications-read-all-mobile.png', fullPage: false })
})

test('fixture UI: 실패는 미읽음을 보존하고 전체 읽음 재제출로 복구한다', async ({ page }) => {
  const state = await fixture(page, 3); await login(page)
  state.bulk = route => route.fulfill({ status: 500, json: { message: '전체 읽음 처리에 실패했어요.' } })
  await page.getByRole('button', { name: '전체 읽음', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('전체 읽음 처리에 실패했어요.')
  await expect(unread(page)).toHaveCount(2); await expect(badge(page, 2)).toBeVisible()
  state.bulk = null
  await page.getByRole('button', { name: '전체 읽음', exact: true }).click()
  await expect(unread(page)).toHaveCount(0); await expect(badge(page, 0)).toBeVisible(); expect(state.posts).toBe(2)
})

test('fixture UI: bulk 성공 후 목록 재조회 실패에도 배지는 갱신하고 조회 재시도만 한다', async ({ page }) => {
  const state = await fixture(page, 3); await login(page)
  state.list = route => route.fulfill({ status: 500, json: { message: '목록 조회 실패' } })
  await page.getByRole('button', { name: '전체 읽음', exact: true }).click()
  await expect(page.getByText('알림을 모두 읽음 처리했어요.', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('목록 조회 실패'); await expect(badge(page, 0)).toBeVisible()
  state.list = null
  await page.getByRole('button', { name: '다시 시도', exact: true }).click()
  await expect(unread(page)).toHaveCount(0); expect(state.posts).toBe(1)
})

test('fixture UI: 후속 페이지 조회 중 전체 읽음을 막고 완료 후 최신 목록으로 갱신한다', async ({ page }) => {
  const state = await fixture(page); await login(page)
  const pending = deferred(); const started = deferred()
  state.list = async route => {
    started.resolve(); await pending.promise
    await route.fulfill({ json: { success: true, data: { items: state.items.slice(20, 40), nextCursor: '40', hasNext: true } } })
  }
  await page.getByRole('button', { name: '알림 더 보기' }).click(); await started.promise
  await expect(page.getByRole('button', { name: '전체 읽음', exact: true })).toBeDisabled(); expect(state.posts).toBe(0)
  state.list = null; pending.resolve()
  await expect(page.getByText('방송 시작 알림 40', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '전체 읽음', exact: true }).click()
  await expect(unread(page)).toHaveCount(0); await expect(badge(page, 0)).toBeVisible()
  await expect(page.getByText('방송 시작 알림 40', { exact: true })).toHaveCount(0)
})

for (const pendingRequest of ['bulk', 'list'] as const) {
  test(`fixture UI: ${pendingRequest} 지연 응답은 로그아웃·다른 회원 로그인 후 무시한다`, async ({ page }) => {
    const state = await fixture(page, 3); await login(page)
    const pending = deferred(); const started = deferred()
    const listCalls = state.listCalls
    const handler = async (route: Route) => {
      started.resolve(); await pending.promise
      if (pendingRequest === 'bulk') await route.fulfill({ status: 204 })
      else await route.fulfill({ json: { success: true, data: { items: state.items, nextCursor: null, hasNext: false } } })
    }
    state[pendingRequest] = handler
    await page.getByRole('button', { name: pendingRequest === 'bulk' ? '전체 읽음' : '새로고침', exact: true }).click(); await started.promise
    await page.getByRole('link', { name: '내 계정', exact: true }).click()
    await page.getByRole('button', { name: '로그아웃', exact: true }).last().click()
    state[pendingRequest] = null
    // 문서 재로드 없이 같은 앱에서 계정을 바꿔 이전 요청이 실제로 남아 있게 한다.
    await page.getByLabel('아이디 또는 이메일').fill('b@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await page.getByRole('link', { name: '알림함 새로운 소식과 알림 확인' }).click()
    await expect(page.getByText('B의 알림', { exact: true })).toBeVisible(); await expect(badge(page, 7)).toBeVisible()
    const beforeRelease = state.listCalls
    const response = page.waitForResponse(response => response.url().includes('/notifications') && response.request().method() === (pendingRequest === 'bulk' ? 'POST' : 'GET'))
    pending.resolve()
    // 이전 응답 처리 뒤에도 다른 계정에 재조회나 성공 안내를 전파하지 않는다.
    await response
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())))
    await expect(page.getByText('알림을 모두 읽음 처리했어요.', { exact: true })).toHaveCount(0)
    await expect(page.getByText('방송 시작 알림 1', { exact: true })).toHaveCount(0)
    await expect(badge(page, 7)).toBeVisible(); expect(state.listCalls).toBe(beforeRelease); expect(state.listCalls).toBeGreaterThan(listCalls)
    await expect(page.getByRole('button', { name: '전체 읽음', exact: true })).toBeEnabled()
  })
}

test('fixture UI: 빈 알림함에서도 전체 읽음을 반복할 수 있다', async ({ page }) => {
  const state = await fixture(page, 0); await login(page)
  await expect(page.getByRole('heading', { name: '아직 받은 알림이 없어요' })).toBeVisible()
  for (let index = 0; index < 2; index++) {
    await page.getByRole('button', { name: '전체 읽음', exact: true }).click()
    await expect(page.getByRole('button', { name: '전체 읽음', exact: true })).toBeEnabled()
  }
  await expect(badge(page, 0)).toBeVisible(); expect(state.posts).toBe(2)
})

test('fixture UI: 배지 조회 실패를 표시하고 재조회로 전체 읽음 결과를 복구한다', async ({ page }) => {
  const state = await fixture(page, 3); await login(page)
  state.count = route => route.fulfill({ status: 500, json: { message: '배지 조회 실패' } })
  await page.getByRole('button', { name: '전체 읽음', exact: true }).click()
  await expect(page.getByRole('link', { name: '알림함, 미확인 개수 조회 실패', exact: true })).toBeVisible()
  await expect(unread(page)).toHaveCount(0)
  state.count = null
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(badge(page, 0)).toBeVisible(); expect(state.posts).toBe(1)
})
