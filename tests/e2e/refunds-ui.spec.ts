import { test, expect } from '@playwright/test'
for (const seller of [true, false]) {
  test(`${seller ? '판매자' : '구매자'} 환불 조회가 3초보다 느려도 중복 조회 없이 완료 상태를 반영한다`, async ({ page }) => {
    let requests = 0; let slow = false; let completed = false; let release!: () => void
    const delayed = new Promise<void>(resolve => { release = resolve })
    await page.route(/\/api\/(member|commerce|shopping|notification)\//, async route => {
      const path = new URL(route.request().url()).pathname
      if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'test-token', refreshToken: 'test-refresh' } } })
      if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: [seller ? 'SELLER' : 'USER'] } } })
      if (path.endsWith('/unread-count')) return route.fulfill({ json: { success: true, data: { unreadCount: 0 } } })
      if (path.endsWith('/seller/products')) return route.fulfill({ json: { success: true, data: { items: [], page: 0, size: 20, totalPages: 0, totalElements: 0 } } })
      if (path.endsWith('/payment-groups/PG-SLOW')) return route.fulfill({ json: { groupNumber: 'PG-SLOW', status: 'PAID', totalAmount: 1000, payableAmount: 1000, paymentId: 7, expiresAt: null, orders: [] } })
      if (path.endsWith('/seller/refunds/42') || path.endsWith('/payment-groups/PG-SLOW/refunds')) {
        requests++
        if (slow) await delayed
        const refund = { id: 42, paymentGroupNumber: 'PG-SLOW', status: completed ? 'SUCCESS' : 'PROCESSING', refundAmount: 1000, cumulativeRefundAmount: completed ? 1000 : 0, requestedAt: '2026-10-17T00:00:00Z', resolvedAt: completed ? '2026-10-17T00:00:01Z' : null, targets: [], recovery: null }
        return route.fulfill({ json: seller ? refund : [refund] })
      }
      return route.fulfill({ status: 404 })
    })
    await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page).not.toHaveURL(/\/login$/)
    await page.clock.install()
    await page.goto(seller ? '/admin/refunds/42' : '/payment-groups/PG-SLOW')
    await expect(page.getByRole('heading', { name: '환불 처리 중', exact: true })).toBeVisible()
    const initialRequests = requests; slow = true
    await page.clock.fastForward(3100)
    await expect.poll(() => requests).toBe(initialRequests + 1)
    const refresh = page.getByRole('button', { name: seller ? '상태 새로고침' : '환불 내역 새로고침', exact: true })
    await expect(refresh).toBeDisabled()
    await page.clock.fastForward(15000)
    expect(requests).toBe(initialRequests + 1)
    completed = true; release()
    await expect(page.getByRole('heading', { name: '환불 완료', exact: true })).toBeVisible()
    await expect(refresh).toBeEnabled()
  })
}
