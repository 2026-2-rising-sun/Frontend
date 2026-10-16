import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64')
const buyerPassword = 'RefundTest123!'
async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel(/아이디 또는 이메일|^이메일$/).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill(password)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}
async function token(request: APIRequestContext, email: string, password: string) {
  const response = await request.post('/api/member/v1/auth/login', { data: { email, password } })
  expect(response.ok(), await response.text()).toBeTruthy()
  return { Authorization: `Bearer ${(await response.json()).data.accessToken}` }
}
async function newBuyer(request: APIRequestContext) {
  const email = `refund-${randomUUID()}@local.test`
  const response = await request.post('/api/member/v1/auth/signup', {
    data: { email, password: buyerPassword, displayName: '환불 검증 구매자' },
  })
  expect(response.ok(), await response.text()).toBeTruthy()
  return { email, headers: await token(request, email, buyerPassword) }
}
async function newProduct(request: APIRequestContext) {
  const seller = await token(request, 'seller@local.test', 'seller')
  const name = `판매·환불 검증 ${randomUUID().slice(0, 8)}`
  const image = await request.post('/api/shopping/v1/seller/product-images', {
    headers: seller, multipart: { file: { name: 'refund.png', mimeType: 'image/png', buffer: png } },
  })
  expect(image.ok(), await image.text()).toBeTruthy()
  const product = await request.post('/api/shopping/v1/seller/products', {
    headers: { ...seller, 'X-Idempotency-Key': randomUUID() },
    data: { name, description: '기존 데이터와 분리한 판매 설정·환불 검증 전용 상품', mainImageId: (await image.json()).data.imageId },
  })
  expect(product.ok(), await product.text()).toBeTruthy()
  const productId = Number((await product.json()).data.productId)
  const sale = await request.post('/api/commerce/v1/sales', {
    headers: seller, data: { productId, price: 1200, initialStock: 7 },
  })
  expect(sale.ok(), await sale.text()).toBeTruthy()
  const salesId = (await sale.json()).id
  return { seller, productId, salesId, name }
}

test('kind: 두 상품을 결제한 뒤 재접속하여 선택 환불하고 남은 상품을 환불한다', async ({ page, request }) => {
  test.setTimeout(180000)
  const first = await newProduct(request)
  const second = await newProduct(request)
  const member = await newBuyer(request)
  for (const item of [first, second]) {
    const started = await request.patch(`/api/commerce/v1/sales/${item.salesId}/status`, { headers: item.seller, data: { status: 'ON_SALE' } })
    expect(started.ok(), await started.text()).toBeTruthy()
    const cart = await request.post('/api/commerce/v1/cart/items', { headers: member.headers, data: { productId: item.productId, quantity: 1 } })
    expect(cart.ok(), await cart.text()).toBeTruthy()
  }
  await signIn(page, member.email, buyerPassword)
  await page.goto('/cart')
  await page.getByRole('link', { name: '선택 상품 주문', exact: true }).click()
  await page.getByLabel('연락처').fill('01012345678')
  await page.getByLabel('상품별 주문과 통합 결제 금액을 확인했습니다').check()
  await page.getByRole('button', { name: '통합 주문 만들기', exact: true }).click()
  await page.getByRole('button', { name: '통합 결제하기', exact: true }).click()
  await expect(page.getByText('통합 결제가 완료되었어요', { exact: true })).toBeVisible({ timeout: 30000 })
  const groupNumber = new URL(page.url()).pathname.split('/').pop()!
  const cart = await request.get('/api/commerce/v1/cart/items', { headers: member.headers })
  expect(await cart.json()).toEqual([])
  await page.reload()
  const firstCheckbox = page.getByRole('checkbox', { name: `${first.name} · 1개`, exact: true })
  const secondCheckbox = page.getByRole('checkbox', { name: `${second.name} · 1개`, exact: true })
  await expect(firstCheckbox).toBeEnabled()
  const other = await newBuyer(request)
  const hidden = await request.get(`/api/commerce/v1/payment-groups/${groupNumber}/refundable-targets`, { headers: other.headers })
  expect(hidden.status()).toBe(404)
  const ids: number[] = []
  for (const checkbox of [firstCheckbox, secondCheckbox]) {
    await checkbox.check()
    await page.getByRole('button', { name: '선택 상품 환불 요청', exact: true }).click()
    const responsePromise = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/payment-groups/${groupNumber}/refunds`))
    await page.getByRole('button', { name: '확인하고 선택 상품 환불 요청', exact: true }).click()
    const response = await responsePromise
    expect(response.ok(), await response.text()).toBeTruthy()
    const refund = (await response.json()).data
    expect(refund.refundAmount).toBe(1200)
    expect(refund.targets).toHaveLength(1)
    ids.push(refund.id)
    await expect.poll(async () => {
      const state = await request.get(`/api/commerce/v1/payment-groups/${groupNumber}/refunds/${refund.id}`, { headers: member.headers })
      return (await state.json()).data.status
    }, { timeout: 60000, intervals: [1000, 2000, 3000] }).toBe('SUCCESS')
    await page.reload()
    await expect(checkbox).toBeDisabled()
  }
  const history = await request.get(`/api/commerce/v1/payment-groups/${groupNumber}/refunds`, { headers: member.headers })
  const refunds = (await history.json()).data
  expect(refunds).toHaveLength(2)
  expect(Math.max(...refunds.map((refund: { cumulativeRefundAmount: number }) => refund.cumulativeRefundAmount))).toBe(2400)
  const duplicate = await request.post(`/api/commerce/v1/payment-groups/${groupNumber}/refunds`, {
    headers: { ...member.headers, 'Idempotency-Key': randomUUID() }, data: { cartItemIds: [refunds[0].targets[0].cartItemId] },
  })
  expect(duplicate.status()).toBe(409)
  expect(new Set(ids).size).toBe(2)
})
