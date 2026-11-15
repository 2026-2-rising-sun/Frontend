import { test, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import type { CartProductGroupDto } from '../../src/api/http/mappers'

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`격리 실서버 검증 설정 ${name}이 필요합니다.`)
  return value
}

test('실제 Core 그룹 응답에서 선택·수량·삭제·견적·주문 생성의 항목 ID와 가격을 보존한다', async ({ page }, testInfo) => {
  const productIds = required('CART_E2E_PRODUCT_IDS').split(',').map(Number)
  expect(productIds).toHaveLength(2)
  const calls: { method: string; path: string; body: unknown; status: number }[] = []
  page.on('response', response => {
    const request = response.request(); const path = new URL(request.url()).pathname
    if (path.startsWith('/api/commercecore/')) calls.push({ method: request.method(), path, body: request.postDataJSON(), status: response.status() })
  })
  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill(required('CART_E2E_EMAIL'))
  await page.getByLabel('비밀번호', { exact: true }).fill(required('CART_E2E_PASSWORD'))
  const login = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/auth/login'))
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  const loggedIn = await (await login).json()
  const token = loggedIn.data?.accessToken ?? loggedIn.accessToken
  expect(typeof token).toBe('string')
  await expect(page.getByRole('heading', { name: '내 계정', exact: true })).toBeVisible()
  const headers = { Authorization: `Bearer ${token}` }
  const api = '/api/commercecore/v1'
  const createdIds: string[] = []
  let groupNumber: string | undefined
  let wire: CartProductGroupDto[] = []
  try {
    const empty = await page.request.get(`${api}/cart/items`, { headers })
    expect(empty.ok()).toBe(true); expect(await empty.json()).toEqual([])
    for (const [index, productId] of productIds.entries()) {
      const response = await page.request.post(`${api}/cart/items`, { headers, data: { productId, quantity: index === 0 ? 2 : 1 } })
      expect(response.status()).toBe(201)
      createdIds.push(String((await response.json()).id))
    }
    const listed = await page.request.get(`${api}/cart/items`, { headers })
    expect(listed.ok()).toBe(true); wire = await listed.json()
    const firstGroup = wire.find(group => Number(group.productId) === productIds[0])!
    const secondGroup = wire.find(group => Number(group.productId) === productIds[1])!
    const first = firstGroup.items[0]; const second = secondGroup.items[0]
    expect(String(first.id)).not.toBe(String(firstGroup.productId))
    expect(String(first.id)).not.toBe(String(first.skuId))
    const price = first.unitPrice ?? NaN; const secondPrice = second.unitPrice ?? NaN
    expect(Number.isSafeInteger(price)).toBe(true); expect(Number.isSafeInteger(secondPrice)).toBe(true)
    await page.goto('/cart'); await page.reload()
    const total = page.getByRole('region', { name: '장바구니 합계' })
    await expect(total).toContainText((price * 2 + secondPrice).toLocaleString('ko-KR') + '원')
    await page.getByLabel(`${secondGroup.productName} 선택`, { exact: true }).uncheck()
    await expect(total).toContainText((price * 2).toLocaleString('ko-KR') + '원')
    const firstRow = page.locator('section').filter({ has: page.getByRole('heading', { name: firstGroup.productName!, exact: true }) })
    await firstRow.getByRole('button', { name: '수량 늘리기' }).click()
    await expect(total).toContainText((price * 3).toLocaleString('ko-KR') + '원')
    const secondRow = page.locator('section').filter({ has: page.getByRole('heading', { name: secondGroup.productName!, exact: true }) })
    await secondRow.getByRole('button', { name: '삭제', exact: true }).click()
    await expect(secondRow).toHaveCount(0)
    await page.reload(); await expect(total).toContainText((price * 3).toLocaleString('ko-KR') + '원')
    await page.screenshot({ path: testInfo.outputPath('cart-desktop.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await page.screenshot({ path: testInfo.outputPath('cart-mobile.png'), fullPage: true })
    await page.getByRole('link', { name: '선택 상품 주문', exact: true }).click()
    await expect(page.getByRole('heading', { name: '선택 상품 주문서', exact: true })).toBeVisible()
    await expect.poll(() => calls.filter(call => call.path.endsWith('/cart/checkout')).length).toBeGreaterThan(0)
    const expectedItems = [{ itemId: Number(first.id), version: first.version + 1 }]
    expect(calls.find(call => call.path.endsWith('/cart/checkout'))?.body).toEqual({ items: expectedItems })
    const coupon = process.env.CART_E2E_COUPON_ID
    if (coupon) await page.getByRole('combobox', { name: '사용할 보유 쿠폰' }).selectOption(coupon)
    await page.getByLabel('연락처').fill('01012345678')
    await page.getByLabel('상품별 주문과 통합 결제 금액을 확인했습니다').check()
    const response = page.waitForResponse(response => new URL(response.url()).pathname.endsWith('/cart/orders') && response.request().method() === 'POST')
    await page.getByRole('button', { name: '통합 주문 만들기', exact: true }).click()
    const orderResponse = await response
    expect(orderResponse.status()).toBe(201)
    const group = await orderResponse.json(); groupNumber = group.groupNumber
    expect(group.totalAmount).toBe(price * 3)
    expect(group.orders[0].quantity).toBe(3)
    expect(group.orders[0].unitPrice).toBe(price)
    if (coupon) {
      expect(group.couponId).toBe(coupon)
      expect(group.discountAmount).toBeGreaterThan(0)
      expect(group.payableAmount).toBe(group.totalAmount - group.discountAmount)
      expect(calls.some(call => call.path.endsWith('/cart/checkout') && (call.body as { couponId?: string })?.couponId === coupon)).toBe(true)
    }
    const orderCall = calls.find(call => call.path.endsWith('/cart/orders'))!
    expect(orderCall.body).toMatchObject({ items: expectedItems, expectedTotalAmount: price * 3 })
    expect(calls.some(call => call.method === 'PATCH' && call.path.endsWith(`/cart/items/${first.id}`))).toBe(true)
    expect(calls.some(call => call.method === 'DELETE' && call.path.endsWith(`/cart/items/${second.id}`))).toBe(true)
    await expect(page).toHaveURL(new RegExp(`/payment-groups/${groupNumber}`))
    await page.screenshot({ path: testInfo.outputPath('created-order.png'), fullPage: true })
    const evidencePath = testInfo.outputPath('actual-backend-wire-and-calls.json')
    await writeFile(evidencePath, JSON.stringify({ backendSha: required('CART_E2E_BACKEND_SHA'), frontendSha: process.env.CART_E2E_FRONTEND_SHA, wire, calls, group, couponSelected: !!coupon, paymentExecution: false }, null, 2))
    await testInfo.attach('actual-backend-wire-and-calls', { path: evidencePath, contentType: 'application/json' })
  } finally {
    if (groupNumber) {
      const cancelled = await page.request.post(`${api}/payment-groups/${encodeURIComponent(groupNumber)}/cancel`, { headers })
      expect(cancelled.status()).toBe(204)
    }
    for (const itemId of createdIds) {
      const response = await page.request.delete(`${api}/cart/items/${itemId}`, { headers })
      expect([204, 404]).toContain(response.status())
    }
  }
})
