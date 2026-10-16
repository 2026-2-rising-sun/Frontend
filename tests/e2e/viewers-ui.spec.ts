import { test, expect, type Page } from '@playwright/test'
async function fixture(page: Page, onViewer: (path: string, method: string, body: unknown) => void, failed = false) {
  await page.route(/\/api\/(member|commerce|shopping|notification|live)\//, async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown
    if (path.includes('/auth/')) data = { accessToken: 'token', refreshToken: 'refresh' }
    else if (path.endsWith('/members/me')) data = { memberId: '00000000-0000-0000-0000-000000000001', displayName: '판매자', email: 'seller@test.dev', roles: ['SELLER'] }
    else if (path.endsWith('/unread-count')) data = { unreadCount: 0 }
    else if (path.includes('/viewers')) {
      onViewer(path, route.request().method(), route.request().postDataJSON())
      if (failed) return route.fulfill({ status: 409 })
      data = { broadcastId: 42, total: 2, measuredAt: new Date().toISOString(), expiresAfterSeconds: 60 }
    }
    else if (path.endsWith('/broadcasts')) {
      const requestedStatus = new URL(route.request().url()).searchParams.get('status')
      const content = ['LIVE', 'PREPARING', 'ENDED'].map((status, index) => ({ id: 42 + index, title: '시청자 검증 방송', status, scheduledAt: new Date().toISOString(), playbackUrl: null, version: 0 })).filter(live => !requestedStatus || live.status === requestedStatus)
      data = { content, number: 0, size: 6, totalElements: content.length, totalPages: 1 }
    }
    else if (path.endsWith('/broadcasts/42')) data = { id: 42, title: '시청자 검증 방송', status: 'LIVE', scheduledAt: new Date().toISOString(), playbackUrl: null, channelArn: 'arn:test', version: 0 }
    else if (path.endsWith('/products') && path.includes('/broadcasts/')) data = []
    else if (path === '/api/shopping/v1/products') data = { items: [], nextCursor: null, hasNext: false }
    else if (path.endsWith('/seller/products')) data = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
    else if (path.endsWith('/promotions') || path.endsWith('/chats')) data = []
    else if (path.endsWith('/likes/mine')) data = { broadcastId: 42, total: 0, version: 0, liked: false, stateVersion: 0 }
    else if (path.endsWith('/likes')) data = { broadcastId: 42, total: 0, version: 0 }
    else return route.fulfill({ status: 404 })
    return route.fulfill({ json: { success: true, data } })
  })
}
test('공개 시청은 같은 브라우저 UUID로 갱신하고 판매자는 조회만 한다', async ({ page }) => {
  const requests: { method: string; body: unknown }[] = []
  await fixture(page, (_path, method, body) => requests.push({ method, body }))
  await page.goto('/lives/42')
  await expect(page.getByText('현재 시청 약 2명', { exact: true })).toBeVisible()
  expect(requests.every(item => item.method === 'POST')).toBeTruthy()
  const id = (requests[0].body as { viewerId: string }).viewerId
  expect(id).toMatch(/^[0-9a-f-]{36}$/)
  await page.reload()
  await expect(page.getByText('현재 시청 약 2명', { exact: true })).toBeVisible()
  expect((requests.at(-1)!.body as { viewerId: string }).viewerId).toBe(id)
  await page.goto('/admin/lives/42')
  await page.getByLabel('아이디 또는 이메일').fill('seller@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByText('현재 시청 약 2명', { exact: true })).toBeVisible()
  expect(requests.at(-1)!.method).toBe('GET')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
test('집계 장애를 0명으로 표시하지 않고 다시 확인할 수 있다', async ({ page }) => {
  await fixture(page, () => {}, true)
  await page.goto('/lives/42')
  await expect(page.getByText('시청자 수를 확인하지 못했어요.', { exact: true })).toBeVisible()
  await expect(page.getByText('현재 시청 약 0명', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '시청자 수 다시 확인' })).toBeVisible()
})

test('방송 미리보기는 인원을 조회만 하고 예정·종료 방송에서는 조회하지 않는다', async ({ page }) => {
  const methods: string[] = []
  await fixture(page, (_path, method) => methods.push(method))
  await page.goto('/lives')
  const card = page.getByRole('link').filter({ hasText: '시청자 검증 방송' })
  await expect(card.getByText('현재 시청 약 2명', { exact: true })).toBeVisible()
  expect(methods.length).toBeGreaterThan(0)
  expect(methods.every(method => method === 'GET')).toBeTruthy()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const previous = methods.length
  for (const name of ['예정', '종료']) {
    await page.getByRole('tab', { name, exact: true }).click()
    await expect(card).toBeVisible()
    await expect(card.getByText('현재 시청 약 2명', { exact: true })).toHaveCount(0)
  }
  expect(methods).toHaveLength(previous)
})
test('미리보기 집계 장애에서도 잘못된 0명이나 중첩 버튼 없이 방송으로 이동한다', async ({ page }) => {
  await fixture(page, () => {}, true)
  await page.goto('/lives')
  const card = page.getByRole('link').filter({ hasText: '시청자 검증 방송' })
  await expect(card.getByText('시청자 수 조회 불가')).toBeVisible()
  await expect(card.getByRole('button')).toHaveCount(0)
  await expect(card.getByText('현재 시청 약 0명', { exact: true })).toHaveCount(0)
  await card.click()
  await expect(page).toHaveURL(/\/lives\/42$/)
})

test('홈 방송 카드에도 현재 시청 규모를 표시한다', async ({ page }) => {
  const methods: string[] = []
  await fixture(page, (_path, method) => methods.push(method))
  await page.goto('/')
  const section = page.getByRole('region', { name: '지금 볼 수 있는 방송' })
  await expect(section.getByText('현재 시청 약 2명', { exact: true })).toBeVisible()
  expect(methods.every(method => method === 'GET')).toBeTruthy()
})
