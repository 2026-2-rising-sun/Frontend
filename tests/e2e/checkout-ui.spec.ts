import { test, expect } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  await page.route('**/api/notification/**', route => route.fulfill({ json: { success: true, data: { unreadCount: 0 } } }))
})
test('바로 구매 수량 변경 중에는 이전 견적으로 주문하지 않는다', async ({ page }) => {
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  let creates = 0
  await page.route(/\/api\/(member|commerce|shopping|live)\//, async route => {
    const request = route.request(); const url = new URL(request.url())
    if (url.pathname.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'token', refreshToken: 'refresh' } } })
    if (url.pathname.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: 'buyer', email: 'buyer@test.dev', displayName: '회원', roles: ['USER'] } } })
    if (url.pathname.endsWith('/payment-groups/active')) return route.fulfill({ status: 204 })
    if (url.pathname.endsWith('/products/1')) return route.fulfill({ json: { productId: 1, name: '상품', mainImageUrl: null, salesStatus: 'ON_SALE', price: 10000, available: 5 } })
    if (url.pathname.endsWith('/orders/checkout')) {
      if (url.searchParams.get('quantity') === '2') {
        await delayed
        return route.fulfill({ status: 409, json: { code: 'CONFLICT', message: '최신 가격을 확인해 주세요.' } })
      }
      return route.fulfill({ json: { unitPrice: 10000, totalAmount: 10000, orderable: true, reason: null } })
    }
    if (url.pathname.endsWith('/orders') && request.method() === 'POST') creates++
    return route.fulfill({ status: 404 })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('buyer@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password')
  await page.getByRole('button', { name: '로그인', exact: true }).click(); await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.goto('/checkout?productId=1&quantity=1')
  await page.getByLabel('연락처').fill('01012345678'); await page.getByLabel('주문 내용을 확인했으며 결제에 동의합니다').check()
  const submit = page.getByRole('button', { name: '결제하기', exact: true })
  await expect(submit).toBeEnabled()
  await page.getByRole('button', { name: '수량 늘리기' }).click()
  await expect(submit).toBeDisabled()
  release()
  await expect(page.getByRole('alert').filter({ hasText: '최신 금액을 확인하지 못했어요' })).toBeVisible()
  await expect(submit).toBeDisabled()
  expect(creates).toBe(0)
})
test('contract UI: selected products, one payment, reload recovery, mobile layout', async ({ page }) => {
  let status = 'PENDING_PAYMENT'; let starts = 0; let quoteBodies: unknown[] = []
  const cart = [{ id: 1, productId: 1, quantity: 2, version: 0 }, { id: 2, productId: 2, quantity: 1, version: 0 }]
  const orders = [1, 2].map(n => ({ orderNumber: 'OD-' + n, groupNumber: 'PG-1', status, productName: '상품 ' + n, quantity: n === 1 ? 2 : 1, unitPrice: n === 1 ? 10000 : 5000, totalAmount: n === 1 ? 20000 : 5000, buyerName: '회원', createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 900000).toISOString() }))
  const group = () => ({ groupNumber: 'PG-1', status, totalAmount: 25000, expiresAt: orders[0].expiresAt, orders: orders.map(o => ({ ...o, status })), paymentId: starts ? 9 : null })
  let created = false
  await page.route(/\/api\/(member|commerce|shopping|live)\//, async route => {
    const request = route.request(); const path = new URL(request.url()).pathname
    const json = (body: unknown) => route.fulfill({ json: body })
    if (path.includes('/auth/')) return json({ success: true, data: { accessToken: 'test-token', refreshToken: 'test-refresh' } })
    if (path.endsWith('/members/me')) return json({ success: true, data: { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] } })
    if (path.endsWith('/payment-groups/active')) return created ? json(group()) : route.fulfill({ status: 204 })
    if (path.endsWith('/cart/items/1') && request.method() === 'PATCH') { cart[0].quantity = request.postDataJSON().quantity; cart[0].version++; return json(cart[0]) }
    if (path.endsWith('/cart/items')) return json(cart)
    if (path.includes('/shopping/v1/products/')) { const n = Number(path.split('/').pop()); return json({ success: true, data: { productId: n, name: '상품 ' + n, mainImageUrl: null, salesStatus: 'ON_SALE', price: n === 1 ? 10000 : 5000, available: 10 } }) }
    if (path.endsWith('/cart/checkout')) { quoteBodies.push(request.postDataJSON()); return json({ items: cart.map(i => ({ itemId: i.id, version: i.version, productId: i.productId, productName: '상품 ' + i.productId, quantity: i.quantity, unitPrice: i.id === 1 ? 10000 : 5000, totalAmount: i.id === 1 ? 20000 : 5000 })), totalAmount: 25000 }) }
    if (path.endsWith('/cart/orders')) { expect(request.headers()['x-idempotency-key']).toBeTruthy(); created = true; return route.abort('connectionreset') }
    if (path.endsWith('/payments')) { expect(request.headers()['x-idempotency-key']).toBeTruthy(); starts++; status = 'PAYMENT_CONFIRMING'; return route.abort('connectionreset') }
    if (path.endsWith('/payment-groups/PG-1')) return json(group())
    return route.fulfill({ status: 404, json: { message: path } })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click(); await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.goto('/cart'); await expect(page.getByRole('region', { name: '장바구니 합계' })).toContainText('25,000원')
  await page.getByLabel('상품 2 선택').uncheck(); await expect(page.getByRole('region', { name: '장바구니 합계' })).toContainText('20,000원')
  const row = page.locator('section').filter({ has: page.getByRole('heading', { name: '상품 1', exact: true }) })
  await row.getByRole('button', { name: '수량 늘리기' }).click(); await expect(page.getByRole('region', { name: '장바구니 합계' })).toContainText('30,000원')
  await expect(page.getByLabel('상품 2 선택')).not.toBeChecked()
  await row.getByRole('button', { name: '수량 줄이기' }).click(); await expect(page.getByRole('region', { name: '장바구니 합계' })).toContainText('20,000원')
  await page.getByLabel('전체 선택').check(); await page.getByRole('link', { name: '선택 상품 주문', exact: true }).click()
  await expect(page.getByRole('heading', { name: '선택 상품 주문서', exact: true })).toBeVisible()
  expect(quoteBodies[0]).toEqual({ items: [{ itemId: 1, version: 2 }, { itemId: 2, version: 0 }] })
  await page.getByLabel('연락처').fill('01012345678'); await page.getByLabel('상품별 주문과 통합 결제 금액을 확인했습니다').check()
  await page.getByRole('button', { name: '통합 주문 만들기' }).click(); await expect(page.getByRole('button', { name: '통합 결제하기' })).toBeVisible()
  await page.getByRole('button', { name: '통합 결제하기' }).click(); await expect(page.getByText('결제 결과를 확인하고 있어요', { exact: true })).toBeVisible()
  await page.reload(); await expect(page.getByText('결제 결과를 확인하고 있어요', { exact: true })).toBeVisible(); expect(starts).toBe(1)
  status = 'PAID'; await page.getByRole('button', { name: '결과 다시 확인' }).click(); await expect(page.getByText('통합 결제가 완료되었어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: '주문 OD-1', exact: true })).toBeVisible(); await expect(page.getByRole('link', { name: '주문 OD-2', exact: true })).toBeVisible()
  await page.screenshot({ path: 'test-artifacts/checkout-group-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.evaluate(() => window.scrollTo(0, 0))
  await expect.poll(() => page.getByRole('banner').evaluate(e => e.getBoundingClientRect().top)).toBe(0)
  await page.screenshot({ path: 'test-artifacts/checkout-group-mobile.png', fullPage: true })
})

test('changing payment group route clears previous purchase actions while the new group fails', async ({ page }) => {
  let mutations = 0
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  const expiresAt = new Date(Date.now() + 900000).toISOString()
  await page.route(/\/api\/(member|commerce|shopping|live)\//, async route => {
    const request = route.request(); const path = new URL(request.url()).pathname
    if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'test-token', refreshToken: 'test-refresh' } } })
    if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] } } })
    if (path.endsWith('/payment-groups/PG-A')) return route.fulfill({ json: { groupNumber: 'PG-A', status: 'PENDING_PAYMENT', totalAmount: 10000, expiresAt, orders: [], paymentId: null } })
    if (path.endsWith('/payment-groups/PG-B')) { await delayed; return route.fulfill({ status: 404, json: { code: 'NOT_FOUND', message: '새 결제 묶음을 찾을 수 없어요.' } }) }
    if (request.method() === 'POST' && (path.endsWith('/payments') || path.endsWith('/cancel'))) mutations++
    return route.fulfill({ status: 404, json: { message: path } })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click(); await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.goto('/payment-groups/PG-A')
  await expect(page.getByRole('button', { name: '통합 결제하기' })).toBeVisible()
  await expect(page.getByRole('button', { name: '전체 주문 취소' })).toBeVisible()
  // 마운트된 앱과 로그인 계정은 유지한 채 경로만 변경한다.
  await page.evaluate(() => { history.pushState({}, '', '/payment-groups/PG-B'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await expect(page).toHaveURL(/\/payment-groups\/PG-B$/)
  await expect(page.getByRole('button', { name: '통합 결제하기' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전체 주문 취소' })).toHaveCount(0)
  await expect(page.getByText('결제 묶음 PG-A', { exact: true })).toHaveCount(0)
  release()
  await expect(page.getByText('새 결제 묶음을 찾을 수 없어요.', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '통합 결제하기' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '전체 주문 취소' })).toHaveCount(0)
  expect(mutations).toBe(0)
})

test('부분 환불 성공 이력이 있으면 잔여 상품 전체 환불 대신 제한을 안내한다', async ({ page }) => {
  await page.route(/\/api\/(member|commerce|notification)\//, async route => {
    const path = new URL(route.request().url()).pathname
    if (path.includes('/auth/')) return route.fulfill({ json: { success: true, data: { accessToken: 'test-token', refreshToken: 'test-refresh' } } })
    if (path.endsWith('/members/me')) return route.fulfill({ json: { success: true, data: { memberId: '00000000-0000-0000-0000-000000000001', displayName: '회원', email: 'user@test.dev', roles: ['USER'] } } })
    if (path.endsWith('/unread-count')) return route.fulfill({ json: { success: true, data: { unreadCount: 0 } } })
    if (path.endsWith('/refunds')) return route.fulfill({ json: [{ id: 1, paymentGroupNumber: 'PG-PARTIAL', refundAmount: 5000, cumulativeRefundAmount: 5000, status: 'SUCCESS', requestedAt: '2026-10-17T00:00:00Z', resolvedAt: '2026-10-17T00:00:01Z', targets: [], recovery: null }] })
    if (path.endsWith('/payment-groups/PG-PARTIAL')) return route.fulfill({ json: { groupNumber: 'PG-PARTIAL', status: 'PAID', totalAmount: 10000, payableAmount: 10000, discountAmount: 0, paymentId: 7, expiresAt: null, orders: [] } })
    return route.fulfill({ status: 404 })
  })
  await page.goto('/login'); await page.getByLabel('아이디 또는 이메일').fill('user@test.dev'); await page.getByLabel('비밀번호', { exact: true }).fill('password'); await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  await page.goto('/payment-groups/PG-PARTIAL')
  await expect(page.getByText('일부 상품의 환불 이력이 있어요', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: '전체 환불 요청', exact: true })).toHaveCount(0)
  await expect(page.getByText('현재 화면에서는 남은 상품을 선택해 환불할 수 없어요. 환불 내역을 확인해 주세요.', { exact: true })).toBeVisible()
})
