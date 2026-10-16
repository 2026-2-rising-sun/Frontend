// 실제 실행은 이슈 #21의 E2E_MODE=features 설정을 통합한 뒤 수행한다.
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64')
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
  const coupon = await request.post('/api/commerce/v1/seller/coupons', { headers: seller, data: { name, fixedDiscount: 1000, issuanceLimit: 10, startsAt: new Date(now + 3600000).toISOString(), endsAt: new Date(now + 7200000).toISOString(), expiresAt: new Date(now + 10800000).toISOString(), productIds: [productId] } })
  expect(coupon.ok(), await coupon.text()).toBeTruthy()
  return { name, productId, coupon: (await coupon.json()).data, seller }
}
test('kind: 판매자는 발급 전 쿠폰 설정을 수정하고 서버 버전이 증가한다', async ({ page, request }) => {
  const f = await fixture(request)
  await signIn(page, 'seller@local.test', 'seller')
  await page.goto(`/admin/coupons/${f.coupon.id}`)
  await page.getByLabel('쿠폰명', { exact: true }).fill(f.name + ' 수정')
  await page.getByLabel('정액 할인 금액 (원)', { exact: true }).fill('1500')
  const updated = page.waitForResponse(response => response.request().method() === 'PATCH' && response.url().endsWith(`/seller/coupons/${f.coupon.id}`))
  await page.getByRole('button', { name: '쿠폰 저장', exact: true }).click()
  expect((await updated).ok()).toBeTruthy()
  const response = await request.get(`/api/commerce/v1/seller/coupons/${f.coupon.id}`, { headers: f.seller })
  const saved = (await response.json()).data
  expect(saved.name).toBe(f.name + ' 수정'); expect(saved.fixedDiscount).toBe(1500); expect(saved.version).toBe(f.coupon.version + 1)
  expect(saved.productIds).toEqual([f.productId])
  await page.reload(); await expect(page.getByLabel('정액 할인 금액 (원)', { exact: true })).toHaveValue('1500')
})
