import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route(/\/api\/(live|shopping)\/v1\/(broadcasts|products)\/\d+$/, route => route.fulfill({ status: 404 }))
})

for (const succeeds of [true, false]) {
  test(`읽음 요청 ${succeeds ? '성공' : '실패'} 전에는 목록 조회를 막고 완료 후 다시 허용한다`, async ({ page }) => {
    let release!: () => void
    const pendingRead = new Promise<void>(resolve => { release = resolve })
    let readAt: string | null = null
    let listRequests = 0
    await page.route(/\/api\/(member|notification)\//, async route => {
      const path = new URL(route.request().url()).pathname
      if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'test-token', refreshToken: 'test-refresh' } } })
      if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] } } })
      if (path.endsWith('/unread-count')) return route.fulfill({ json: { success: true, data: { unreadCount: readAt ? 0 : 1 } } })
      if (path.endsWith('/42/read')) {
        await pendingRead
        if (!succeeds) return route.fulfill({ status: 500, json: { code: 'INTERNAL_ERROR', message: '읽음 요청 실패' } })
        readAt = '2026-10-17T00:00:00Z'
        return route.fulfill({ status: 204 })
      }
      if (path.endsWith('/notifications')) {
        listRequests++
        return route.fulfill({ json: { success: true, data: { items: [{ id: 42, eventType: 'Restocked', title: '재입고 소식', body: '상품이 다시 입고됐어요.', linkType: 'PRODUCT', linkValue: '7', occurredAt: '2026-10-16T00:00:00Z', readAt }], hasNext: true, nextCursor: 'next' } } })
      }
      return route.fulfill({ status: 404 })
    })
    await page.goto('/login')
    await page.getByLabel('아이디 또는 이메일').fill('user@test.dev')
    await page.getByLabel('비밀번호', { exact: true }).fill('password')
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
    await page.goto('/notifications')
    await expect(page.getByRole('button', { name: '읽음 처리', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '알림 더 보기', exact: true })).toBeEnabled()
    const initialLists = listRequests
    const readStarted = page.waitForRequest(request => request.url().endsWith('/42/read'))
    await page.getByRole('button', { name: '읽음 처리', exact: true }).click()
    await readStarted
    try {
      await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: '알림 더 보기', exact: true })).toBeDisabled()
      expect(listRequests).toBe(initialLists)
    } finally { release() }
    if (succeeds) {
      await expect(page.getByRole('button', { name: '읽음 처리', exact: true })).toHaveCount(0)
      await expect(page.getByText('새 알림', { exact: true })).toHaveCount(0)
      await expect(page.getByRole('link', { name: '알림함, 안 읽은 알림 0개', exact: true })).toBeVisible()
      expect(listRequests).toBe(initialLists + 1)
    } else {
      await expect(page.getByRole('button', { name: '읽음 처리', exact: true })).toBeEnabled()
      await expect(page.getByText('읽음 요청 실패', { exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '다시 시도', exact: true })).toBeEnabled()
    }
    await expect(page.getByRole('button', { name: '새로고침', exact: true })).toBeEnabled()
    await expect(page.getByRole('button', { name: '알림 더 보기', exact: true })).toBeEnabled()
  })
}

test('내 신청 목록을 다시 접속해도 유지하고 해제 실패는 목록에 남긴다', async ({ page }) => {
  let subscribed = true
  let fails = true
  await page.route(/\/api\/(member|notification)\//, async route => {
    const path = new URL(route.request().url()).pathname
    const method = route.request().method()
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path.includes('/auth/')) return ok({ accessToken: 'token', refreshToken: 'refresh' })
    if (path.endsWith('/members/me')) return ok({ memberId: 'member-a', displayName: '회원', email: 'user@test.dev', roles: ['USER'] })
    if (path.endsWith('/unread-count')) return ok({ unreadCount: 0 })
    if (path.endsWith('/restock-alerts')) return ok({ items: [], nextCursor: null, hasNext: false })
    if (path.endsWith('/broadcast-alerts')) return ok({ items: subscribed ? [{ targetId: 42, createdAt: '2026-10-17T00:00:00Z' }] : [], nextCursor: null, hasNext: false })
    if (path.endsWith('/broadcast-alerts/42') && method === 'DELETE') {
      if (fails) return route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: '해제 요청 실패' } } })
      subscribed = false; return route.fulfill({ status: 204 })
    }
    return route.fulfill({ status: 404 })
  })
  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill('user@test.dev')
  await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.getByRole('link', { name: '내 알림 신청', exact: true }).click()
  const broadcasts = page.getByRole('region', { name: '방송 시작 신청 목록' })
  await expect(broadcasts.getByText('방송 #42', { exact: true })).toBeVisible()
  await page.reload()
  await expect(broadcasts.getByText('방송 #42', { exact: true })).toBeVisible()
  await broadcasts.getByRole('button', { name: '알림 해제', exact: true }).click()
  await expect(broadcasts.getByText('해제 요청 실패', { exact: true })).toBeVisible()
  await expect(broadcasts.getByText('방송 #42', { exact: true })).toBeVisible()
  fails = false
  await broadcasts.getByRole('button', { name: '알림 해제', exact: true }).click()
  await expect(broadcasts.getByText('신청한 방송 시작 알림이 없어요.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(broadcasts.getByText('신청한 방송 시작 알림이 없어요.', { exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('상세 신청 상태 조회 실패를 재시도하고 신청·새로고침·해제를 서버 상태에 맞춘다', async ({ page }) => {
  let subscribed = false
  let stateFails = true
  await page.route(/\/api\/(member|notification|live)\//, async route => {
    const path = new URL(route.request().url()).pathname
    const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path.includes('/auth/')) return ok({ accessToken: 'token', refreshToken: 'refresh' })
    if (path.endsWith('/members/me')) return ok({ memberId: 'member-a', displayName: '회원', email: 'user@test.dev', roles: ['USER'] })
    if (path.endsWith('/unread-count')) return ok({ unreadCount: 0 })
    if (path.endsWith('/broadcast-alerts/42')) {
      if (route.request().method() === 'DELETE') { subscribed = false; return route.fulfill({ status: 204 }) }
      if (stateFails) return route.fulfill({ status: 503, json: { error: { code: 'SERVICE_UNAVAILABLE', message: '상태 조회 지연' } } })
      return ok({ subscribed })
    }
    if (path.endsWith('/broadcast-alerts') && route.request().method() === 'POST') { subscribed = true; return route.fulfill({ status: 201 }) }
    if (path.endsWith('/broadcasts/42')) return ok({ id: 42, title: '방송 테스트', status: 'READY', scheduledAt: '2026-12-01T00:00:00Z', playbackUrl: null, version: 1 })
    if (path.endsWith('/products') || path.endsWith('/promotions')) return ok([])
    return route.fulfill({ status: 404 })
  })
  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill('user@test.dev')
  await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.goto('/lives/42')
  const region = page.getByRole('region', { name: '방송 시작 알림', exact: true })
  await expect(region.getByText('상태 조회 지연', { exact: true })).toBeVisible()
  await expect(region.getByRole('button', { name: '알림 신청', exact: true })).toHaveCount(0)
  stateFails = false
  await region.getByRole('button', { name: '상태 새로고침', exact: true }).click()
  await region.getByRole('button', { name: '알림 신청', exact: true }).click()
  await expect(region.getByText('알림을 신청한 상태예요.', { exact: true })).toBeVisible()
  await page.reload()
  await expect(region.getByRole('button', { name: '알림 해제', exact: true })).toBeEnabled()
  await region.getByRole('button', { name: '알림 해제', exact: true }).click()
  await expect(region.getByText('알림을 신청하지 않았어요.', { exact: true })).toBeVisible()
})

async function namesFixture(page: import('@playwright/test').Page) {
  const state = { productFailed: true, title: '가을 라이브', member: '00000000-0000-0000-0000-000000000001', hold: null as Promise<void> | null, removed: new Set<string>() }
  await page.route(/\/api\/(member|notification|live|shopping)\//, async route => {
    const url = new URL(route.request().url()); const path = url.pathname
    let data: unknown
    if (path.includes('/auth/')) data = { accessToken: 'token', refreshToken: 'refresh' }
    else if (path.endsWith('/members/me')) data = { memberId: state.member, displayName: '회원', email: 'user@test.dev', roles: ['USER'] }
    else if (path.endsWith('/unread-count')) data = { unreadCount: 0 }
    else if (path.endsWith('/broadcast-alerts') || path.endsWith('/restock-alerts')) {
      const broadcast = path.endsWith('/broadcast-alerts')
      const targetId = broadcast ? url.searchParams.has('cursor') ? 43 : 42 : 7
      const items = state.removed.has(String(targetId)) ? [] : [{ targetId, createdAt: '2026-10-17T00:00:00Z' }]
      data = { items, nextCursor: broadcast && targetId === 42 ? 'next' : null, hasNext: broadcast && targetId === 42 }
    } else if (route.request().method() === 'DELETE') {
      state.removed.add(path.split('/').at(-1)!); return route.fulfill({ status: 204 })
    } else if (path.endsWith('/broadcasts/42')) {
      const title = state.title
      if (state.hold) await state.hold
      data = { id: 42, title, status: 'PREPARING', scheduledAt: '2026-10-17T01:00:00Z', playbackUrl: null }
    } else if (path.endsWith('/broadcasts/43')) return route.fulfill({ status: 404 })
    else if (path.endsWith('/products/7')) {
      if (state.productFailed) return route.fulfill({ status: 503 })
      data = { productId: 7, name: '가을 니트', description: '설명', mainImageUrl: null, salesStatus: 'SOLD_OUT', price: 1000, available: 0 }
    } else return route.fulfill({ status: 404 })
    return route.fulfill({ json: { success: true, data } })
  })
  return state
}
async function loginNames(page: import('@playwright/test').Page) {
  await page.goto('/notifications/subscriptions')
  await page.getByLabel('아이디 또는 이메일').fill('user@test.dev')
  await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).toHaveURL(/\/notifications\/subscriptions$/)
}
test('알림 신청 이름·번호, 추가 조회와 삭제 대상 해제, 이름 재조회 복구를 유지한다', async ({ page }) => {
  const state = await namesFixture(page)
  await loginNames(page)
  await expect(page.getByText('가을 라이브', { exact: true })).toBeVisible()
  await expect(page.getByText('방송 #42', { exact: true })).toBeVisible()
  const product = page.getByRole('listitem').filter({ hasText: '상품 #7' })
  await expect(product.getByText('이름을 확인하지 못했어요.', { exact: true })).toBeVisible()
  state.productFailed = false
  await product.getByRole('button', { name: '이름 다시 확인' }).click()
  await expect(page.getByText('가을 니트', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '신청 더 보기', exact: true }).click()
  const deleted = page.getByRole('listitem').filter({ hasText: '방송 #43' })
  await expect(deleted.getByText('삭제되었거나 공개되지 않은 대상이에요.', { exact: true })).toBeVisible()
  await expect(deleted.getByRole('link', { name: '상세 보기' })).toHaveCount(0)
  await deleted.getByRole('button', { name: '알림 해제' }).click()
  await expect(deleted).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
test('이름 조회가 지연되어도 해제할 수 있고 늦은 이름 응답은 행을 복원하지 않는다', async ({ page }) => {
  const state = await namesFixture(page)
  let release!: () => void
  state.hold = new Promise<void>(resolve => { release = resolve })
  await loginNames(page)
  const row = page.getByRole('listitem').filter({ hasText: '방송 #42' })
  await expect(row).toBeVisible()
  await row.getByRole('button', { name: '알림 해제' }).click()
  await expect(row).toHaveCount(0)
  release()
  await expect(page.getByText('가을 라이브', { exact: true })).toHaveCount(0)
})
test('다른 계정으로 로그인한 뒤 이전 계정의 늦은 이름 응답을 표시하지 않는다', async ({ page }) => {
  const state = await namesFixture(page)
  let release!: () => void
  state.title = '이전 계정의 방송'
  state.hold = new Promise<void>(resolve => { release = resolve })
  await loginNames(page)
  await expect(page.getByText('방송 #42', { exact: true })).toBeVisible()
  await page.goto('/account')
  await page.getByRole('banner').getByRole('button', { name: '로그아웃', exact: true }).click()
  state.member = '00000000-0000-0000-0000-000000000002'; state.title = '새 계정의 방송'; state.hold = null
  await loginNames(page)
  await expect(page.getByText('새 계정의 방송', { exact: true })).toBeVisible()
  release()
  await expect(page.getByText('이전 계정의 방송', { exact: true })).toHaveCount(0)
})
