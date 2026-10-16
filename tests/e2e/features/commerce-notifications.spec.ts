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

async function notification(request: APIRequestContext, headers: Record<string, string>, eventType: string) {
  let found: { id: string; body: string; linkType: string; linkValue: string; readAt: string | null } | undefined
  await expect.poll(async () => {
    const response = await request.get('/api/notification/v1/notifications', { headers })
    expect(response.ok(), await response.text()).toBeTruthy()
    found = (await response.json()).data.items.find((item: { eventType: string }) => item.eventType === eventType)
    return !!found
  }, { timeout: 45000, intervals: [500, 1000, 2000] }).toBeTruthy()
  return found!
}
async function openNotification(page: Page, title: string) {
  await page.goto('/notifications')
  const card = page.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) })
  await expect(card).toBeVisible()
  await card.getByRole('link', { name: '자세히 보기', exact: true }).click()
}

test('kind: 쿠폰 발급·구매·환불 결과가 알림함에 전달되고 해당 화면으로 이동한다', async ({ page, request }) => {
  test.setTimeout(180000)
  const product = await newProduct(request)
  const buyer = await newBuyer(request)
  const started = await request.patch(`/api/commerce/v1/sales/${product.salesId}/status`, { headers: product.seller, data: { status: 'ON_SALE' } })
  expect(started.ok(), await started.text()).toBeTruthy()
  const now = Date.now()
  const created = await request.post('/api/commerce/v1/seller/coupons', { headers: product.seller,
    data: { name: product.name, fixedDiscount: 100, issuanceLimit: 10, startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + 3600000).toISOString(), expiresAt: new Date(now + 7200000).toISOString(), productIds: [product.productId] } })
  expect(created.ok(), await created.text()).toBeTruthy()
  const coupon = (await created.json()).data
  const claim = await request.post(`/api/commerce/v1/coupons/${coupon.id}/claims`, { headers: buyer.headers })
  expect(claim.ok(), await claim.text()).toBeTruthy()
  const couponNotice = await notification(request, buyer.headers, 'CouponIssued')
  expect(couponNotice.linkType).toBe('COUPON'); expect(couponNotice.body).toContain(product.name)
  const replay = await request.post(`/api/commerce/v1/coupons/${coupon.id}/claims`, { headers: buyer.headers })
  expect(replay.ok()).toBeTruthy()
  await signIn(page, buyer.email, buyerPassword)
  await openNotification(page, '쿠폰이 발급되었습니다')
  await expect(page).toHaveURL(/\/coupons$/)
  const added = await request.post('/api/commerce/v1/cart/items', { headers: buyer.headers, data: { productId: product.productId, quantity: 1 } })
  expect(added.ok(), await added.text()).toBeTruthy()
  const itemId = (await added.json()).id
  await page.goto(`/checkout/cart?itemIds=${itemId}`)
  await page.getByLabel('연락처', { exact: true }).fill('01012345678')
  await page.getByLabel('상품별 주문과 통합 결제 금액을 확인했습니다').check()
  await page.getByRole('button', { name: '통합 주문 만들기', exact: true }).click()
  await expect(page).toHaveURL(/\/payment-groups\/PG-/)
  const groupNumber = new URL(page.url()).pathname.split('/').pop()!
  await page.getByRole('button', { name: '통합 결제하기', exact: true }).click()
  await expect(page.getByText('통합 결제가 완료되었어요', { exact: true })).toBeVisible({ timeout: 30000 })
  const paymentNotice = await notification(request, buyer.headers, 'PaymentSucceeded')
  expect(paymentNotice.linkValue).toBe(groupNumber); expect(paymentNotice.body).toContain(product.name)
  await openNotification(page, '결제가 완료되었습니다')
  await expect(page).toHaveURL(new RegExp(`/payment-groups/${groupNumber}$`))
  await page.getByRole('checkbox', { name: `${product.name} · 1개`, exact: true }).check()
  await page.getByRole('button', { name: '선택 상품 환불 요청', exact: true }).click()
  await page.getByRole('button', { name: '확인하고 선택 상품 환불 요청', exact: true }).click()
  const refundNotice = await notification(request, buyer.headers, 'RefundCompleted')
  expect(refundNotice.linkValue).toMatch(new RegExp(`^${groupNumber}/[1-9]\\d*$`))
  expect(refundNotice.body).toContain('1,200원')
  await openNotification(page, '환불이 완료되었습니다')
  await expect(page).toHaveURL(new RegExp(`/payment-groups/${refundNotice.linkValue.replace('/', '/refunds/')}$`))
  const list = await request.get('/api/notification/v1/notifications', { headers: buyer.headers })
  const items = (await list.json()).data.items
  expect(items.filter((item: { eventType: string }) => item.eventType === 'CouponIssued')).toHaveLength(1)
  expect(items.filter((item: { eventType: string }) => item.eventType === 'PaymentSucceeded')).toHaveLength(1)
  const read = await request.post(`/api/notification/v1/notifications/${paymentNotice.id}/read`, { headers: buyer.headers })
  expect(read.ok(), await read.text()).toBeTruthy()
  await page.goto('/notifications'); await page.reload()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  const other = await newBuyer(request)
  const hidden = await request.get(`/api/commerce/v1/payment-groups/${groupNumber}`, { headers: other.headers })
  expect(hidden.status()).toBe(404)
  const otherList = await request.get('/api/notification/v1/notifications', { headers: other.headers })
  expect((await otherList.json()).data.items).toHaveLength(0)
})

test('kind: 결제 전 전체 주문 취소는 취소 알림 한 건과 주문 상세로 연결된다', async ({ page, request }) => {
  const product = await newProduct(request)
  const buyer = await newBuyer(request)
  const started = await request.patch(`/api/commerce/v1/sales/${product.salesId}/status`, { headers: product.seller, data: { status: 'ON_SALE' } })
  expect(started.ok()).toBeTruthy()
  await signIn(page, buyer.email, buyerPassword)
  await page.goto(`/checkout?productId=${product.productId}&quantity=1`)
  await page.getByLabel('연락처', { exact: true }).fill('01012345678')
  await page.getByLabel('주문 내용을 확인했으며 결제에 동의합니다').check()
  await page.getByRole('button', { name: '결제하기', exact: true }).click()
  await expect(page).toHaveURL(/\/payment-groups\/PG-/)
  const groupNumber = new URL(page.url()).pathname.split('/').pop()!
  await page.getByRole('button', { name: '전체 주문 취소', exact: true }).click()
  await expect(page.getByText('주문이 취소되었어요', { exact: true })).toBeVisible()
  const notice = await notification(request, buyer.headers, 'OrderCancelled')
  expect(notice.linkValue).toBe(groupNumber); expect(notice.body).toContain(product.name)
  await openNotification(page, '주문이 취소되었습니다')
  await expect(page).toHaveURL(new RegExp(`/payment-groups/${groupNumber}$`))
})

test('kind: 재입고 알림은 상품 이름을 표시하고 상품 상세로 연결된다', async ({ page, request }) => {
  const product = await newProduct(request)
  const buyer = await newBuyer(request)
  const started = await request.patch(`/api/commerce/v1/sales/${product.salesId}/status`, { headers: product.seller, data: { status: 'ON_SALE' } })
  expect(started.ok()).toBeTruthy()
  const empty = await request.patch(`/api/commerce/v1/sales/${product.salesId}/stock`, { headers: product.seller, data: { delta: -7 } })
  expect(empty.ok()).toBeTruthy()
  for (const status of ['PRIVATE', 'ON_SALE']) {
    const changed = await request.patch(`/api/commerce/v1/sales/${product.salesId}/status`, { headers: product.seller, data: { status } })
    expect(changed.ok(), await changed.text()).toBeTruthy()
  }
  await expect.poll(async () => (await request.post('/api/notification/v1/restock-alerts', { headers: buyer.headers, data: { productId: product.productId } })).status(), { timeout: 45000 }).toBe(201)
  const refill = await request.patch(`/api/commerce/v1/sales/${product.salesId}/stock`, { headers: product.seller, data: { delta: 2 } })
  expect(refill.ok()).toBeTruthy()
  const notice = await notification(request, buyer.headers, 'Restocked')
  expect(notice.body).toContain(product.name)
  expect(notice.linkValue).toBe(String(product.productId))
  await signIn(page, buyer.email, buyerPassword)
  await openNotification(page, '재입고되었습니다')
  await expect(page).toHaveURL(new RegExp(`/products/${product.productId}$`))
})
