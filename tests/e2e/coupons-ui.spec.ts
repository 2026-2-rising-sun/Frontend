import { test, expect } from '@playwright/test'
for (const target of ['tab', 'page']) {
  test(`쿠폰 ${target === 'tab' ? '탭' : '페이지'} 조회 실패 시 이전 쿠폰과 수령 버튼을 숨기고 재시도한다`, async ({ page }) => {
    let failed = false; let recover = false
    const coupons = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 1), name: `이전 쿠폰 ${i}`, fixedDiscount: 1000, remaining: 5, endsAt: '2027-01-01T00:00:00Z', expiresAt: '2027-01-02T00:00:00Z' }))
    await page.route(/\/api\/(member|commerce|notification)\//, async route => {
      const url = new URL(route.request().url()); const path = url.pathname
      if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'test-token', refreshToken: 'test-refresh' } } })
      if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] } } })
      if (path.endsWith('/unread-count')) return route.fulfill({ json: { success: true, data: { unreadCount: 0 } } })
      if (path.endsWith('/coupons')) {
        if (failed && !recover) return route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: '쿠폰 조회 실패' } })
        return route.fulfill({ json: failed || path.includes('/me/') ? [] : coupons })
      }
      return route.fulfill({ status: 404 })
    })
    await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
    await page.goto('/coupons'); await page.getByRole('button', { name: '받을 수 있는 쿠폰', exact: true }).click()
    await expect(page.getByRole('heading', { name: '이전 쿠폰 0', exact: true })).toBeVisible()
    failed = true
    await page.getByRole('button', { name: target === 'tab' ? '내 쿠폰' : '다음', exact: true }).click()
    await expect(page.getByText('불러오지 못했어요', { exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: '이전 쿠폰 0', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: '쿠폰 받기', exact: true })).toHaveCount(0)
    recover = true; await page.getByRole('button', { name: '다시 시도', exact: true }).click()
    await expect(page.getByText(target === 'tab' ? '보유한 쿠폰이 없어요' : '지금 받을 수 있는 쿠폰이 없어요', { exact: true })).toBeVisible()
  })
}
