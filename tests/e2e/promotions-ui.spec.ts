import { test, expect, type Page } from '@playwright/test'
const firstCoupon = '12345678-1234-4321-8765-123456789abc'
const nextCoupon = '87654321-1234-4321-8765-123456789abc'
const promo = { id: 8, broadcastId: 42, type: 'COUPON_DROP', title: '방송 쿠폰', attributes: { couponPolicyId: firstCoupon }, status: 'OPEN', version: 0, closesAt: null }
async function login(page: Page) {
  await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click(); await expect(page).not.toHaveURL(/\/login$/)
}
async function fixture(page: Page, options: { seller?: boolean; claim?: () => Promise<number>; id?: unknown; closeAt?: string; couponError?: boolean; created?: (input: unknown) => void } = {}) {
  const promotions: unknown[] = []
  await page.route(/\/api\/(member|commerce|shopping|notification|live)\//, async route => {
    const url = new URL(route.request().url()); const path = url.pathname
    let data: unknown
    if (path.includes('/auth/')) data = { accessToken: 'token', refreshToken: 'refresh' }
    else if (path.endsWith('/members/me')) data = { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: [options.seller ? 'SELLER' : 'USER'] }
    else if (path.endsWith('/unread-count')) data = { unreadCount: 0 }
    else if (path.endsWith(`/coupons/${firstCoupon}/claims`)) {
      const code = await options.claim?.() ?? 200
      if (code !== 200) return route.fulfill({ status: code, json: { success: false, error: { code: 'INVALID_STATE', message: '쿠폰 발급 수량이 소진됐어요.' } } })
      data = { id: 10, couponId: firstCoupon }
    }
    else if (path.endsWith('/seller/coupons')) {
      if (options.couponError) return route.fulfill({ status: 503 })
      const next = url.searchParams.get('page') === '1'
      data = { items: [{ id: next ? nextCoupon : firstCoupon, name: next ? '두 번째 쿠폰' : '천원 쿠폰', fixedDiscount: 1000, issuanceLimit: 100, issuedCount: 0 }], page: next ? 1 : 0, size: 1, totalElements: 2 }
    }
    else if (path.includes('/seller/') && path.endsWith('/promotions')) {
      if (route.request().method() === 'POST') { const input = route.request().postDataJSON(); options.created?.(input); data = { ...promo, ...input, status: 'READY' }; promotions.push(data) }
      else data = promotions
    }
    else if (path.endsWith('/promotions')) data = [{ ...promo, attributes: { couponPolicyId: options.id === undefined ? firstCoupon : options.id }, closesAt: options.closeAt ?? null }]
    else if (path.endsWith('/broadcasts/42')) data = { id: 42, title: '검증 방송', status: 'LIVE', scheduledAt: '2026-10-17T00:00:00Z', channelArn: 'arn:test', playbackUrl: null, version: 0 }
    else if (path.endsWith('/products') && path.includes('/broadcasts/')) data = []
    else if (path.endsWith('/seller/products')) data = { items: [], page: 0, size: 20, totalElements: 0, totalPages: 0 }
    else if (path.endsWith('/chats')) data = []
    else if (path.endsWith('/likes/mine')) data = { broadcastId: 42, total: 0, version: 0, liked: false, stateVersion: 0 }
    else if (path.endsWith('/likes')) data = { broadcastId: 42, total: 0, version: 0 }
    else return route.fulfill({ status: 404 })
    return route.fulfill({ json: { success: true, data } })
  })
}

test('판매자는 여러 페이지의 기존 쿠폰을 선택하고 공지와 구분해 이벤트를 생성한다', async ({ page }) => {
  const inputs: unknown[] = []
  await fixture(page, { seller: true, created: input => inputs.push(input) })
  await page.goto('/admin/lives/42'); await login(page)
  const panel = page.getByRole('region', { name: '방송 이벤트', exact: true })
  await panel.getByLabel('이벤트 유형').selectOption('COUPON_DROP')
  await expect(panel.getByRole('button', { name: '이벤트 준비하기' })).toBeDisabled()
  await panel.getByRole('button', { name: '다음 쿠폰' }).click()
  await panel.getByLabel('이벤트 쿠폰').selectOption(nextCoupon)
  await panel.getByLabel('이벤트 제목', { exact: true }).fill('둘째 페이지 이벤트')
  await panel.getByRole('button', { name: '이벤트 준비하기' }).click()
  await expect.poll(() => inputs.length).toBe(1)
  expect(inputs[0]).toEqual({ type: 'COUPON_DROP', title: '둘째 페이지 이벤트', attributes: { couponPolicyId: nextCoupon }, durationSeconds: null })
  await expect(panel.getByText('방송 이벤트를 준비했어요. 방송 중에 열 수 있어요.', { exact: true })).toBeVisible()
  await panel.getByLabel('이벤트 유형').selectOption('ANNOUNCEMENT')
  await panel.getByLabel('이벤트 제목', { exact: true }).fill('일반 공지')
  await panel.getByRole('button', { name: '이벤트 준비하기' }).click()
  await expect.poll(() => inputs.length).toBe(2)
  expect(inputs[1]).toEqual({ type: 'ANNOUNCEMENT', title: '일반 공지', attributes: {}, durationSeconds: null })
})

test('쿠폰 조회 실패 시 재조회 안내와 생성 차단을 제공한다', async ({ page }) => {
  await fixture(page, { seller: true, couponError: true })
  await page.goto('/admin/lives/42'); await login(page)
  await page.getByLabel('이벤트 유형').selectOption('COUPON_DROP')
  await expect(page.getByText('쿠폰을 불러오지 못했어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '이벤트 준비하기' })).toBeDisabled()
})

test('시청자는 로그인 후 방송으로 복귀하고 느린 쿠폰 발급을 중복 요청하지 않는다', async ({ page }) => {
  let claims = 0; let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  await fixture(page, { claim: async () => { claims++; await delayed; return 200 } })
  await page.goto('/lives/42')
  await page.getByRole('link', { name: '로그인하고 쿠폰 받기' }).click(); await login(page)
  await expect(page).toHaveURL(/\/lives\/42$/)
  await page.getByRole('button', { name: '쿠폰 받기', exact: true }).click()
  await expect(page.getByRole('button', { name: '받는 중…' })).toBeDisabled()
  expect(claims).toBe(1); release()
  await expect(page.getByRole('button', { name: '쿠폰 받기 완료' })).toBeDisabled()
  await expect(page.getByRole('link', { name: '내 쿠폰 확인' })).toHaveAttribute('href', '/coupons')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-artifacts/coupon-promotion-mobile.png', fullPage: true })
})

test('발급 실패는 서버 안내를 표시하고 다시 시도할 수 있다', async ({ page }) => {
  await fixture(page, { claim: async () => 409 })
  await page.goto('/lives/42'); await page.getByRole('link', { name: '로그인하고 쿠폰 받기' }).click(); await login(page)
  await page.getByRole('button', { name: '쿠폰 받기', exact: true }).click()
  await expect(page.getByText('쿠폰 발급 수량이 소진됐어요.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '쿠폰 받기', exact: true })).toBeEnabled()
})

test('잘못된 쿠폰 참조와 만료 이벤트에는 발급 버튼을 표시하지 않는다', async ({ page }) => {
  await fixture(page, { id: 'invalid' }); await page.goto('/lives/42')
  await expect(page.getByText('쿠폰 정보를 확인할 수 없어요.', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '로그인하고 쿠폰 받기' })).toHaveCount(0)
  await page.unroute(/\/api\/(member|commerce|shopping|notification|live)\//)
  await fixture(page, { closeAt: '2020-01-01T00:00:00Z' }); await page.reload()
  await expect(page.getByRole('heading', { name: '검증 방송', exact: true })).toBeVisible()
  await expect(page.getByText('방송 중 이벤트 · 방송 쿠폰', { exact: true })).toHaveCount(0)
})
