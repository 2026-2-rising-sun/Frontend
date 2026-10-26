import { test, expect } from '@playwright/test'
test('쿠폰 이름만 수정하면 기간의 초 이하와 대상 상품·버전을 그대로 보낸다', async ({ page }) => {
  const instant = (days: number) => new Date(Date.now() + days * 86400000).toISOString().replace(/\.\d{3}Z$/, '.123456Z')
  const coupon = { id: '42', sellerId: 'seller', name: '원래 쿠폰', fixedDiscount: 1000, issuanceLimit: 20, issuedCount: 0, version: 7, productIds: [12], startsAt: instant(1), endsAt: instant(2), expiresAt: instant(3) }
  let patch: { version: number; settings: typeof coupon } | undefined
  await page.route(/\/api\/(member|commerce|shopping|notification)\//, async route => {
    const request = route.request(); const path = new URL(request.url()).pathname
    if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'test-token', refreshToken: 'test-refresh' } } })
    if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: '00000000-0000-0000-0000-000000000001', displayName: '판매자', email: 'seller@test.dev', roles: ['SELLER'] } } })
    if (path.endsWith('/unread-count')) return route.fulfill({ json: { success: true, data: { unreadCount: 0 } } })
    if (path.endsWith('/seller/coupons/42')) {
      if (request.method() === 'PATCH') patch = request.postDataJSON()
      return route.fulfill({ json: coupon })
    }
    if (path.endsWith('/seller/products')) return route.fulfill({ json: { success: true, data: { items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 } } })
    return route.fulfill({ status: 404 })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('seller@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '상품 관리', exact: true })).toBeVisible()
  await page.goto('/seller/coupons/42'); await page.getByLabel('쿠폰명', { exact: true }).fill('새 쿠폰 이름')
  const saved = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith('/seller/coupons/42'))
  await page.getByRole('button', { name: '쿠폰 저장', exact: true }).click(); expect((await saved).ok()).toBeTruthy()
  expect(patch?.version).toBe(7); expect(patch?.settings.name).toBe('새 쿠폰 이름')
  expect(patch?.settings.productIds).toEqual([12])
  for (const field of ['startsAt', 'endsAt', 'expiresAt'] as const) expect(patch?.settings[field]).toBe(coupon[field])
})
