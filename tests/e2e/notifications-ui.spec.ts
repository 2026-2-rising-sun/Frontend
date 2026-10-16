import { test, expect } from '@playwright/test'

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
