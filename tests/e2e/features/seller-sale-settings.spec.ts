import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64')
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

test('kind: 새 브라우저에서 기존 READY·PRIVATE 상품 가격·재고·판매 상태를 변경한다', async ({ page, request, browser }) => {
  const f = await newProduct(request)
  await signIn(page, 'seller@local.test', 'seller')
  await page.goto(`/admin/products/${f.productId}`)
  await expect(page.getByRole('region', { name: '판매 상태', exact: true })).toContainText('판매 준비')
  const price = page.getByLabel(/^판매 가격\(원\)/)
  await expect(price).toHaveValue('1200')
  await price.fill('1450')
  await page.getByRole('button', { name: '가격 변경', exact: true }).click()
  await expect(price).toHaveValue('1450')
  await expect(page.getByRole('region', { name: '판매 설정', exact: true })).toContainText('현재 1,450원')
  await page.getByLabel(/^재고 증감량/).fill('3')
  await page.getByRole('button', { name: '재고 수정', exact: true }).click()
  await expect(page.getByRole('region', { name: '판매 설정', exact: true })).toContainText('현재 10')
  await page.getByRole('button', { name: '판매 시작', exact: true }).click()
  await expect(page.getByRole('button', { name: '비공개로 전환', exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '비공개로 전환', exact: true }).click()
  await expect(page.getByRole('button', { name: '공개 재개', exact: true })).toBeEnabled()

  // 별도 브라우저 저장소에는 상품을 생성할 때의 salesId 기록이 없다.
  const context = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: { width: 390, height: 844 } })
  try {
    const fresh = await context.newPage()
    await signIn(fresh, 'seller@local.test', 'seller')
    await fresh.goto(`/admin/products/${f.productId}`)
    await expect(fresh.getByRole('button', { name: '공개 재개', exact: true })).toBeEnabled()
    await expect(fresh.getByLabel(/^판매 가격\(원\)/)).toHaveValue('1450')
    await fresh.getByLabel(/^판매 가격\(원\)/).fill('1600')
    await fresh.getByRole('button', { name: '가격 변경', exact: true }).click()
    await expect(fresh.getByRole('region', { name: '판매 설정', exact: true })).toContainText('현재 1,600원')
    await fresh.getByRole('button', { name: '공개 재개', exact: true }).click()
    await expect(fresh.getByRole('button', { name: '비공개로 전환', exact: true })).toBeEnabled()
    await expect.poll(() => fresh.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  } finally { await context.close() }
  const checkout = await request.get(`/api/commerce/v1/orders/checkout?productId=${f.productId}&quantity=1`, { headers: f.seller })
  expect(checkout.ok(), await checkout.text()).toBeTruthy()
  expect(await checkout.json()).toMatchObject({ salesId: f.salesId, unitPrice: 1600, available: 10, salesStatus: 'ON_SALE' })
})
