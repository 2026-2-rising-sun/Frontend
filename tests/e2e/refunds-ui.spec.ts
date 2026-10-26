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
    await page.goto(seller ? '/seller/refunds/42' : '/payment-groups/PG-SLOW')
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

for (const seller of [false, true]) {
  test(`${seller ? '판매자' : '구매자'} 환불 복구 정보는 처리 중에만 표시하고 완료 시각과 구분한다`, async ({ page }) => {
    let status = 'PROCESSING'; let exhausted = false; let recovery = true
    await page.route(/\/api\/(member|commerce|shopping|notification|live)\//, async route => {
      const path = new URL(route.request().url()).pathname
      let data: unknown
      if (path.includes('/auth/')) data = { accessToken: 'token', refreshToken: 'refresh' }
      else if (path.endsWith('/members/me')) data = { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: [seller ? 'SELLER' : 'USER'] }
      else if (path.endsWith('/unread-count')) data = { unreadCount: 0 }
      else if (path.endsWith('/seller/products')) data = { items: [], page: 0, size: 20, totalElements: 0 }
      else if (path.endsWith('/payment-groups/PG-R')) data = { groupNumber: 'PG-R', status: 'PAID', totalAmount: 1000, payableAmount: 1000, expiresAt: null, orders: [] }
      else if (path.includes('/refunds')) {
        const refund = { id: 42, paymentGroupNumber: 'PG-R', status, refundAmount: 1000, cumulativeRefundAmount: 0, requestedAt: '2026-10-17T00:00:00Z', resolvedAt: null, targets: [], recovery: recovery ? { retryCount: 2, retryExhausted: exhausted, nextActionAt: '2026-10-17T01:00:00Z' } : null }
        data = seller ? refund : [refund]
      } else return route.fulfill({ status: 404 })
      return route.fulfill({ json: { success: true, data } })
    })
    await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click()
    await expect(page).not.toHaveURL(/\/login$/)
    await page.goto(seller ? '/seller/refunds/42' : '/payment-groups/PG-R')
    await expect(page.getByText('추가 재시도 2회', { exact: true })).toBeVisible()
    await expect(page.getByText(/환불 완료 시각이 아닙니다/)).toBeVisible()
    const refresh = page.getByRole('button', { name: seller ? '상태 새로고침' : '환불 내역 새로고침', exact: true })
    status = 'UNKNOWN'; exhausted = true; await refresh.click()
    await expect(page.getByText(/자동 재시도 이후에도 기존 요청의 결과/)).toBeVisible()
    for (const terminal of ['SUCCESS', 'FAILED']) {
      status = terminal; await refresh.click()
      await expect(page.getByRole('heading', { name: terminal === 'SUCCESS' ? '환불 완료' : '환불 실패', exact: true })).toBeVisible()
      await expect(page.getByText(/추가 재시도/)).toHaveCount(0)
    }
    status = 'PROCESSING'; recovery = false; await refresh.click()
    await expect(page.getByRole('heading', { name: '환불 처리 중', exact: true })).toBeVisible()
    await expect(page.getByText(/다음 처리 대상 시각/)).toHaveCount(0)
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  })
}

test('장바구니 삭제·재접속 뒤에도 선택 환불하고 남은 상품을 환불한다', async ({ page }) => {
  let completed = false; const bodies: unknown[] = []
  await page.route(/\/api\/(member|commerce|shopping|notification|live)\//, async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown
    if (path.includes('/auth/')) data = { accessToken: 'token', refreshToken: 'refresh' }
    else if (path.endsWith('/members/me')) data = { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] }
    else if (path.endsWith('/unread-count')) data = { unreadCount: 0 }
    else if (path.endsWith('/payment-groups/PG-SELECT')) data = { groupNumber: 'PG-SELECT', status: 'PAID', totalAmount: 3000, payableAmount: 3000, expiresAt: null, orders: [] }
    else if (path.endsWith('/refundable-targets')) data = [
      { orderId: 1, cartItemId: 101, productName: '첫 상품', quantity: 2, refundAmount: 1000, refundable: !completed, unavailableReason: completed ? 'ALREADY_REQUESTED' : null },
      { orderId: 2, cartItemId: 102, productName: '남은 상품', quantity: 1, refundAmount: 1500, refundable: true, unavailableReason: null },
      { orderId: 3, cartItemId: null, productName: '직접 주문', quantity: 1, refundAmount: 500, refundable: false, unavailableReason: 'CART_ITEM_UNAVAILABLE' },
    ]
    else if (path.endsWith('/refunds')) {
      const refund = { id: 42, paymentGroupNumber: 'PG-SELECT', status: 'SUCCESS', refundAmount: 1000, cumulativeRefundAmount: 1000, requestedAt: '2026-10-17T00:00:00Z', resolvedAt: '2026-10-17T00:01:00Z', targets: [], recovery: null }
      if (route.request().method() === 'POST') { bodies.push(route.request().postDataJSON()); completed = true; data = refund }
      else data = completed ? [refund] : []
    } else return route.fulfill({ status: 404 })
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
  await page.goto('/payment-groups/PG-SELECT')
  await expect(page.getByRole('checkbox', { name: '첫 상품 · 2개' })).toBeEnabled()
  await expect(page.getByRole('checkbox', { name: '직접 주문 · 1개' })).toBeDisabled()
  await page.reload()
  await page.getByRole('checkbox', { name: '첫 상품 · 2개' }).check()
  await page.getByRole('button', { name: '선택 상품 환불 요청', exact: true }).click()
  await expect(page.getByRole('region', { name: '선택 상품 환불 확인' })).toContainText('1개 상품의 전체 수량')
  await page.getByRole('button', { name: '확인하고 선택 상품 환불 요청', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: '첫 상품 · 2개' })).toBeDisabled()
  await expect(page.getByRole('checkbox', { name: '남은 상품 · 1개' })).toBeEnabled()
  expect(bodies).toEqual([{ cartItemIds: [101] }])
  await page.getByRole('checkbox', { name: '남은 상품 · 1개' }).check()
  await page.getByRole('button', { name: '선택 상품 환불 요청', exact: true }).click()
  await page.getByRole('button', { name: '확인하고 선택 상품 환불 요청', exact: true }).click()
  await expect.poll(() => bodies.length).toBe(2)
  expect(bodies[1]).toEqual({ cartItemIds: [102] })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('대상 조회 실패 시 선택 환불을 막고 새로고침으로 복구한다', async ({ page }) => {
  let available = false
  await page.route(/\/api\/(member|commerce|shopping|notification|live)\//, async route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown
    if (path.includes('/auth/')) data = { accessToken: 'token', refreshToken: 'refresh' }
    else if (path.endsWith('/members/me')) data = { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] }
    else if (path.endsWith('/unread-count')) data = { unreadCount: 0 }
    else if (path.endsWith('/payment-groups/PG-FAIL')) data = { groupNumber: 'PG-FAIL', status: 'PAID', totalAmount: 1000, payableAmount: 1000, expiresAt: null, orders: [] }
    else if (path.endsWith('/refundable-targets')) {
      if (!available) return route.fulfill({ status: 503, json: { success: false, data: null, error: { code: 'UNAVAILABLE', message: '조회 실패' } } })
      data = [{ orderId: 1, cartItemId: 101, productName: '복구 상품', quantity: 1, refundAmount: 1000, refundable: true, unavailableReason: null }]
    } else if (path.endsWith('/refunds')) data = []
    else return route.fulfill({ status: 404 })
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
  await page.goto('/payment-groups/PG-FAIL')
  await expect(page.getByText('환불 대상을 확인하지 못했어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '선택 상품 환불 요청', exact: true })).toBeDisabled()
  available = true; await page.getByRole('button', { name: '환불 대상 새로고침', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: '복구 상품 · 1개' })).toBeEnabled()
})
