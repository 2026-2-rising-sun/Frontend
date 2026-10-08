import { test, expect } from '@playwright/test'
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
