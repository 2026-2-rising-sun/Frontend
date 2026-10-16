// 실제 실행은 이슈 #21의 E2E_MODE=features 설정을 통합한 뒤 수행한다.
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64')
const password = 'CouponTest123!'
async function token(request: APIRequestContext, email: string, secret: string) {
  const response = await request.post('/api/member/v1/auth/login', { data: { email, password: secret } })
  expect(response.ok(), await response.text()).toBeTruthy()
  return { Authorization: `Bearer ${(await response.json()).data.accessToken}` }
}
async function signIn(page: Page, email: string, secret: string) {
  await page.goto('/login')
  await page.getByLabel(/아이디 또는 이메일|^이메일$/).fill(email)
  await page.getByLabel('비밀번호', { exact: true }).fill(secret)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
}
async function fixture(request: APIRequestContext) {
  const seller = await token(request, 'seller@local.test', 'seller')
  const suffix = randomUUID().slice(0, 8)
  const name = `쿠폰 검증 ${suffix}`
  const image = await request.post('/api/shopping/v1/seller/product-images', { headers: seller, multipart: { file: { name: 'coupon.png', mimeType: 'image/png', buffer: png } } })
  expect(image.ok(), await image.text()).toBeTruthy()
  const product = await request.post('/api/shopping/v1/seller/products', { headers: { ...seller, 'X-Idempotency-Key': randomUUID() }, data: { name, description: '쿠폰 연동 검증 전용 상품', mainImageId: (await image.json()).data.imageId } })
  expect(product.ok(), await product.text()).toBeTruthy()
  const productId = Number((await product.json()).data.productId)
  const sale = await request.post('/api/commerce/v1/sales', { headers: seller, data: { productId, price: 1000, initialStock: 10 } })
  expect(sale.ok(), await sale.text()).toBeTruthy()
  const salesId = (await sale.json()).id
  const started = await request.patch(`/api/commerce/v1/sales/${salesId}/status`, { headers: seller, data: { status: 'ON_SALE' } })
  expect(started.ok(), await started.text()).toBeTruthy()
  const now = Date.now()
  const coupon = await request.post('/api/commerce/v1/seller/coupons', { headers: seller, data: { name, fixedDiscount: 1000, issuanceLimit: 10, startsAt: new Date(now - 60000).toISOString(), endsAt: new Date(now + 7200000).toISOString(), expiresAt: new Date(now + 10800000).toISOString(), productIds: [productId] } })
  expect(coupon.ok(), await coupon.text()).toBeTruthy()
  return { name, productId, coupon: (await coupon.json()).data, seller }
}
async function newMember(request: APIRequestContext) {
  const email = `coupon-${randomUUID()}@local.test`
  const response = await request.post('/api/member/v1/auth/signup', { data: { email, password, displayName: '쿠폰 구매자' } })
  expect(response.ok(), await response.text()).toBeTruthy()
  return { email, headers: await token(request, email, password) }
}
test('kind: 상품 쿠폰 표시, 쿠폰함 수령, 직접 주문 0원 결제를 실제 API로 확인한다', async ({ page, request }) => {
  test.setTimeout(120000)
  const f = await fixture(request); const member = await newMember(request)
  await expect.poll(async () => {
    const response = await request.get(`/api/shopping/v1/products/${f.productId}/coupons`)
    if (!response.ok()) return false
    return (await response.json()).data.some((coupon: { couponId: string }) => coupon.couponId === f.coupon.id)
  }, { timeout: 45000, intervals: [1000] }).toBeTruthy()
  await page.goto(`/products/${f.productId}`)
  await expect(page.getByRole('region', { name: '상품 쿠폰' })).toContainText(f.name)
  await signIn(page, member.email, password)
  await page.goto('/coupons')
  await page.getByRole('button', { name: '받을 수 있는 쿠폰', exact: true }).click()
  // The claimable catalogue is paginated and may contain preserved test data.
  let targetPage = 0
  for (; targetPage < 100; targetPage++) {
    const response = await request.get(`/api/commerce/v1/coupons?page=${targetPage}&size=20`, { headers: member.headers })
    expect(response.ok()).toBeTruthy()
    const items = (await response.json()).data
    if (items.some((coupon: { id: string }) => coupon.id === f.coupon.id)) break
    expect(items.length).toBe(20)
  }
  expect(targetPage).toBeLessThan(100)
  for (let pageIndex = 0; pageIndex < targetPage; pageIndex++) {
    await page.getByRole('button', { name: '다음', exact: true }).click()
    await expect(page.getByText(`${pageIndex + 2} 페이지`, { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '이전', exact: true })).toBeEnabled()
  }
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: f.name, exact: true }) })
  await card.getByRole('button', { name: '쿠폰 받기', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('쿠폰을 받았어요')
  await page.getByRole('button', { name: '내 쿠폰', exact: true }).click()
  await expect(card).toContainText('사용 가능')
  await page.goto(`/checkout?productId=${f.productId}&quantity=1`)
  await page.getByRole('combobox', { name: '사용할 보유 쿠폰' }).selectOption(f.coupon.id)
  await expect(page.getByText('0원 주문도 결제 완료 확인이 필요해요.', { exact: true })).toBeVisible()
  await page.getByLabel('연락처', { exact: true }).fill('01012345678')
  await page.getByLabel('주문 내용을 확인했으며 결제에 동의합니다').check()
  await page.getByRole('button', { name: '결제하기', exact: true }).click()
  await expect(page).toHaveURL(/\/payment-groups\/PG-/)
  await page.getByRole('button', { name: '통합 결제하기', exact: true }).click()
  await expect(page.getByText('통합 결제가 완료되었어요', { exact: true })).toBeVisible()
  const groupNumber = decodeURIComponent(new URL(page.url()).pathname.split('/').pop()!)
  const response = await request.get(`/api/commerce/v1/payment-groups/${encodeURIComponent(groupNumber)}`, { headers: member.headers })
  const saved = await response.json()
  expect(saved.status).toBe('PAID'); expect(saved.couponId).toBe(f.coupon.id)
  expect(saved.totalAmount).toBe(1000); expect(saved.discountAmount).toBe(1000); expect(saved.payableAmount).toBe(0)
  await page.goto('/coupons'); await expect(card).toContainText('사용 완료')
})
test('kind: 장바구니 주문서 쿠폰 재견적과 0원 통합 결제가 서버 결과와 일치한다', async ({ page, request }) => {
  const f = await fixture(request); const member = await newMember(request)
  const claim = await request.post(`/api/commerce/v1/coupons/${f.coupon.id}/claims`, { headers: member.headers })
  expect(claim.ok(), await claim.text()).toBeTruthy()
  const cart = await request.post('/api/commerce/v1/cart/items', { headers: member.headers, data: { productId: f.productId, quantity: 1 } })
  expect(cart.ok(), await cart.text()).toBeTruthy()
  const itemId = (await cart.json()).id
  await signIn(page, member.email, password)
  await page.goto(`/checkout/cart?itemIds=${itemId}`)
  await page.getByRole('combobox', { name: '사용할 보유 쿠폰' }).selectOption(f.coupon.id)
  await expect(page.getByText('0원 주문도 결제 완료 확인이 필요해요.', { exact: true })).toBeVisible()
  await page.getByLabel('연락처', { exact: true }).fill('01012345678')
  await page.getByLabel('상품별 주문과 통합 결제 금액을 확인했습니다').check()
  await page.getByRole('button', { name: '통합 주문 만들기', exact: true }).click()
  await page.getByRole('button', { name: '통합 결제하기', exact: true }).click()
  await expect(page.getByText('통합 결제가 완료되었어요', { exact: true })).toBeVisible()
  const number = decodeURIComponent(new URL(page.url()).pathname.split('/').pop()!)
  const result = await request.get(`/api/commerce/v1/payment-groups/${encodeURIComponent(number)}`, { headers: member.headers })
  const saved = await result.json()
  expect(saved.status).toBe('PAID'); expect(saved.totalAmount).toBe(1000); expect(saved.payableAmount).toBe(0)
  expect(saved.couponId).toBe(f.coupon.id); expect(saved.orders).toHaveLength(1)
})
