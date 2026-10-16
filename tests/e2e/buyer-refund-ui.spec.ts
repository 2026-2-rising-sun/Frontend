import { test, expect, type Page } from '@playwright/test'

async function signIn(page: Page) {
  await page.getByLabel('아이디 또는 이메일').fill('user@test.dev')
  await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}
const refund = (id = 42, status = 'PROCESSING') => ({ id, paymentGroupNumber: 'PG-R', status, refundAmount: 1000, cumulativeRefundAmount: status === 'SUCCESS' ? 1000 : 0, requestedAt: '2026-10-17T00:00:00Z', resolvedAt: null, targets: [{ orderId: 2, cartItemId: 3, productId: 4, productName: '검증 상품', quantity: 1, refundAmount: 1000 }], recovery: null })
async function fixtures(page: Page, get: (path: string) => Promise<unknown>) {
  await page.route(/\/api\/(member|commerce|shopping|notification|live)\//, async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown
    if (path.includes('/auth/')) data = { accessToken: 'token', refreshToken: 'refresh' }
    else if (path.endsWith('/members/me')) data = { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] }
    else if (path.endsWith('/unread-count')) data = { unreadCount: 0 }
    else if (path.endsWith('/payment-groups/PG-R')) data = { groupNumber: 'PG-R', status: 'PAID', totalAmount: 1000, payableAmount: 1000, expiresAt: null, orders: [] }
    else if (path.endsWith('/refunds')) data = [refund()]
    else if (path.includes('/refunds/')) {
      data = await get(path)
      if (typeof data === 'number') return route.fulfill({ status: data, json: { success: false, error: { code: data === 404 ? 'NOT_FOUND' : 'FORBIDDEN', message: '이 환불을 조회할 수 없어요.' } } })
    } else return route.fulfill({ status: 404 })
    return route.fulfill({ json: { success: true, data } })
  })
}

test('직접 링크는 로그인 후 복귀하고 내역 링크와 모바일 상세를 제공한다', async ({ page }) => {
  await fixtures(page, async () => refund())
  await page.goto('/payment-groups/PG-R/refunds/42')
  await expect(page).toHaveURL(/\/login$/)
  await signIn(page)
  await expect(page).toHaveURL(/PG-R\/refunds\/42$/)
  await expect(page.getByRole('heading', { name: '환불 상세', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByText('검증 상품 · 1개')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: 'test-artifacts/buyer-refund-detail-mobile.png', fullPage: true })
  await page.getByRole('link', { name: '← 결제·환불 내역' }).click()
  await page.getByRole('link', { name: '환불 42 상세 보기' }).click()
  await expect(page).toHaveURL(/PG-R\/refunds\/42$/)
})

test('느린 자동 갱신을 중복하지 않고 실패 후 복구하며 완료되면 갱신을 멈춘다', async ({ page }) => {
  let calls = 0; let status = 'PROCESSING'; let failure = false; let slow = false; let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  await fixtures(page, async () => { calls++; if (slow) await delayed; return failure ? 403 : refund(42, status) })
  await page.goto('/payment-groups/PG-R/refunds/42'); await signIn(page)
  await expect(page.getByRole('heading', { name: '환불 처리 중', exact: true })).toBeVisible()
  await page.clock.install()
  slow = true; const before = calls
  await page.clock.fastForward(3100)
  await expect.poll(() => calls).toBe(before + 1)
  await page.clock.fastForward(15000)
  expect(calls).toBe(before + 1)
  await expect(page.getByRole('button', { name: '상태 새로고침' })).toBeDisabled()
  failure = true; release(); slow = false
  await expect(page.getByText('최신 환불 상태를 확인하지 못했어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '환불 처리 중', exact: true })).toBeVisible()
  failure = false; status = 'SUCCESS'
  await page.getByRole('button', { name: '상태 새로고침' }).click()
  await expect(page.getByRole('heading', { name: '환불 완료', exact: true })).toBeVisible()
  const completed = calls; await page.clock.fastForward(15000); expect(calls).toBe(completed)
})

for (const code of [403, 404]) {
  test(`${code} 환불 상세는 오류를 표시하고 다른 환불의 정보를 남기지 않는다`, async ({ page }) => {
    await fixtures(page, async path => path.endsWith('/42') ? refund(42, 'SUCCESS') : code)
    await page.goto('/payment-groups/PG-R/refunds/42'); await signIn(page)
    await expect(page.getByRole('heading', { name: '환불 완료', exact: true })).toBeVisible()
    await page.goto('/payment-groups/PG-R/refunds/99')
    await expect(page.getByText(code === 404 ? '찾을 수 없어요' : '불러오지 못했어요', { exact: true })).toBeVisible()
    await expect(page.getByText('검증 상품 · 1개')).toHaveCount(0)
    await expect(page.getByRole('link', { name: '← 결제·환불 내역' })).toBeVisible()
  })
}
