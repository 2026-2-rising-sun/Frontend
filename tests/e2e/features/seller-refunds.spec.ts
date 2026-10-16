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

test('kind: 실제 결제 묶음을 전체 환불 접수하고 구매자 이력과 판매자 상세를 조회한다', async ({ page, request, browser }) => {
  const f = await newProduct(request)
  const member = await newBuyer(request)
  const started = await request.patch(`/api/commerce/v1/sales/${f.salesId}/status`, {
    headers: f.seller, data: { status: 'ON_SALE' },
  })
  expect(started.ok(), await started.text()).toBeTruthy()
  const order = await request.post('/api/commerce/v1/orders', {
    headers: { ...member.headers, 'X-Idempotency-Key': randomUUID() },
    data: { productId: f.productId, quantity: 2, buyerName: '환불 검증 구매자', buyerPhone: '01012345678', expectedTotalAmount: 2400 },
  })
  expect(order.ok(), await order.text()).toBeTruthy()
  const groupNumber = (await order.json()).groupNumber as string
  expect(groupNumber).toMatch(/^PG-/)
  await signIn(page, member.email, buyerPassword)
  await page.goto(`/payment-groups/${encodeURIComponent(groupNumber)}`)
  await page.getByRole('button', { name: '통합 결제하기', exact: true }).click()
  await expect(page.getByText('통합 결제가 완료되었어요', { exact: true })).toBeVisible()
  await expect(page.getByText('환불 내역이 없어요', { exact: true })).toBeVisible()
  const refundRegion = page.getByRole('region', { name: '환불', exact: true })
  await refundRegion.getByRole('button', { name: '전체 환불 요청', exact: true }).click()
  const confirmation = page.getByRole('region', { name: '전체 환불 확인', exact: true })
  await expect(confirmation).toContainText('2,400원')
  const submitted = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().endsWith(`/payment-groups/${encodeURIComponent(groupNumber)}/refunds`))
  await confirmation.getByRole('button', { name: '확인하고 전체 환불 요청', exact: true }).click()
  const response = await submitted
  expect(response.ok(), await response.text()).toBeTruthy()
  expect(response.request().postData()).toBeNull()
  expect(response.request().headers()['idempotency-key']).toBeTruthy()
  const refund = (await response.json()).data
  expect(refund.refundAmount).toBe(2400)
  expect(refund.targets).toHaveLength(1)
  expect(refund.targets[0]).toMatchObject({ productId: f.productId, productName: f.name, quantity: 2, refundAmount: 2400 })
  expect(['PROCESSING', 'UNKNOWN', 'SUCCESS']).toContain(refund.status)
  const buyerRefund = page.getByRole('article', { name: `환불 ${refund.id}`, exact: true })
  await expect(buyerRefund).toContainText(f.name)
  await expect(buyerRefund).toContainText('2,400원')
  await page.reload()
  await expect(buyerRefund).toBeVisible()
  await expect(refundRegion.getByRole('button', { name: '전체 환불 요청', exact: true })).toHaveCount(0)
  const history = await request.get(`/api/commerce/v1/payment-groups/${encodeURIComponent(groupNumber)}/refunds`, { headers: member.headers })
  expect(history.ok(), await history.text()).toBeTruthy()
  const persisted = (await history.json()).data.find((item: { id: number }) => item.id === refund.id)
  expect(persisted).toMatchObject({ id: refund.id, refundAmount: 2400 })
  // Kafka 유무와 무관하게 접수·영속화가 완료 조건이며 비동기 완료를 강제로 기다리지 않는다.
  test.info().annotations.push({ type: 'refund-status', description: `접수 및 이력 검증 시점 상태: ${persisted.status}. 비동기 최종 완료는 이 테스트의 필수 조건이 아님.` })

  const sellerContext = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 } })
  try {
    const sellerPage = await sellerContext.newPage()
    await signIn(sellerPage, 'seller@local.test', 'seller')
    await sellerPage.goto('/admin/refunds')
    const sellerRefund = sellerPage.getByRole('article', { name: `환불 ${refund.id}`, exact: true })
    await expect(sellerRefund).toContainText(f.name)
    await expect(sellerRefund).toContainText('2,400원')
    await sellerRefund.locator('..').getByRole('link', { name: '환불 상세 보기', exact: true }).click()
    await expect(sellerPage).toHaveURL(new RegExp(`/admin/refunds/${refund.id}$`))
    await expect(sellerPage.getByRole('heading', { name: '환불 상세', exact: true })).toBeVisible()
    await expect(sellerPage.getByRole('article', { name: `환불 ${refund.id}`, exact: true })).toContainText(f.name)
    await expect.poll(() => sellerPage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  } finally { await sellerContext.close() }
})
