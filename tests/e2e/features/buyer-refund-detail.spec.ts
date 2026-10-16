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

test('kind: 구매자 환불 상세를 실제 결제·환불 후 직접 링크로 조회한다', async ({ page, request }) => {
  test.setTimeout(120000)
  const f = await newProduct(request)
  const member = await newBuyer(request)
  const started = await request.patch(`/api/commerce/v1/sales/${f.salesId}/status`, { headers: f.seller, data: { status: 'ON_SALE' } })
  expect(started.ok(), await started.text()).toBeTruthy()
  const order = await request.post('/api/commerce/v1/orders', {
    headers: { ...member.headers, 'X-Idempotency-Key': randomUUID() },
    data: { productId: f.productId, quantity: 1, buyerName: '환불 상세 검증', buyerPhone: '01012345678', expectedTotalAmount: 1200 },
  })
  expect(order.ok(), await order.text()).toBeTruthy()
  const groupNumber = (await order.json()).groupNumber as string
  await signIn(page, member.email, buyerPassword)
  await page.goto(`/payment-groups/${encodeURIComponent(groupNumber)}`)
  await page.getByRole('button', { name: '통합 결제하기', exact: true }).click()
  await expect(page.getByText('통합 결제가 완료되었어요', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '전체 환불 요청', exact: true }).click()
  const submitted = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith(`/payment-groups/${encodeURIComponent(groupNumber)}/refunds`))
  await page.getByRole('button', { name: '확인하고 전체 환불 요청', exact: true }).click()
  const response = await submitted
  expect(response.ok(), await response.text()).toBeTruthy()
  const refund = (await response.json()).data
  await page.getByRole('link', { name: `환불 ${refund.id} 상세 보기`, exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/refunds/${refund.id}$`))
  await expect(page.getByRole('heading', { name: '환불 상세', exact: true })).toBeVisible()
  const card = page.getByRole('article', { name: `환불 ${refund.id}`, exact: true })
  await expect(card).toContainText(f.name)
  await expect(card).toContainText('1,200원')
  await page.reload()
  await expect(card).toContainText(f.name)
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const actual = await request.get(`/api/commerce/v1/payment-groups/${groupNumber}/refunds/${refund.id}`, { headers: member.headers })
  expect(actual.ok(), await actual.text()).toBeTruthy()
  expect((await actual.json()).data.refundAmount).toBe(1200)
  const other = await newBuyer(request)
  const forbidden = await request.get(`/api/commerce/v1/payment-groups/${groupNumber}/refunds/${refund.id}`, { headers: other.headers })
  expect([403, 404]).toContain(forbidden.status())
  await page.getByRole('link', { name: '← 결제·환불 내역' }).click()
  await expect(page).toHaveURL(new RegExp(`/payment-groups/${groupNumber}$`))
})
