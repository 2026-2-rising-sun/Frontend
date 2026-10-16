import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1cAAAAASUVORK5CYII=', 'base64')

test('kind: 구매자는 전체 검색 결과를 가격순으로 이어 보고 판매자는 품절 상품만 조회한다', async ({ page, request }) => {
  test.setTimeout(180000)
  const login = await request.post('/api/member/v1/auth/login', { data: { email: 'seller@local.test', password: 'seller' } })
  expect(login.ok(), await login.text()).toBeTruthy()
  const headers = { Authorization: `Bearer ${(await login.json()).data.accessToken}` }
  const prefix = `목록 검증 ${randomUUID().slice(0, 8)}`
  const upload = await request.post('/api/shopping/v1/seller/product-images', { headers, multipart: { file: { name: 'catalog.png', mimeType: 'image/png', buffer: png } } })
  expect(upload.ok(), await upload.text()).toBeTruthy()
  const imageId = (await upload.json()).data.imageId
  const products: { id: number; name: string; price: number; salesId: number }[] = []
  for (let i = 0; i < 14; i++) {
    const name = `${prefix} ${String(i).padStart(2, '0')}`
    const response = await request.post('/api/shopping/v1/seller/products', { headers: { ...headers, 'X-Idempotency-Key': randomUUID() }, data: { name, description: '전체 목록 검색·정렬·페이지 이동 검증', mainImageId: imageId } })
    expect(response.ok(), await response.text()).toBeTruthy()
    const id = (await response.json()).data.productId
    const price = (i % 3 + 1) * 1000
    const sale = await request.post('/api/commerce/v1/sales', { headers, data: { productId: id, price, initialStock: 1 } })
    expect(sale.ok(), await sale.text()).toBeTruthy()
    const salesId = (await sale.json()).id
    const visible = await request.patch(`/api/commerce/v1/sales/${salesId}/status`, { headers, data: { status: 'ON_SALE' } })
    expect(visible.ok(), await visible.text()).toBeTruthy()
    products.push({ id, name, price, salesId })
  }
  // 판매정보 이벤트가 목록 읽기 모델에 반영된 뒤 사용자 흐름을 시작한다.
  await expect.poll(async () => {
    const response = await request.get('/api/shopping/v1/products', { params: { q: prefix, sort: 'PRICE_ASC', size: 50 } })
    expect(response.ok(), await response.text()).toBeTruthy()
    return (await response.json()).data.items.length
  }, { timeout: 30000 }).toBe(14)
  await page.goto(`/?q=${encodeURIComponent(prefix)}`)
  await page.getByLabel('정렬 기준').selectOption('PRICE_ASC')
  const cards = page.locator('a[href^="/products/"]').filter({ hasText: prefix })
  await expect(cards).toHaveCount(12)
  await page.getByRole('button', { name: '더 보기', exact: true }).click()
  await expect(cards).toHaveCount(14)
  const sorted = products.toSorted((a, b) => a.price - b.price || a.id - b.id)
  expect(await cards.locator('p').filter({ hasText: prefix }).allTextContents()).toEqual(sorted.map(item => item.name))
  await page.getByLabel('정렬 기준').selectOption('PRICE_DESC')
  await expect(cards).toHaveCount(12)
  await expect(cards.first()).toContainText(products.toSorted((a, b) => b.price - a.price || b.id - a.id)[0].name)

  for (const product of products.slice(-2)) {
    const response = await request.patch(`/api/commerce/v1/sales/${product.salesId}/stock`, { headers, data: { delta: -1 } })
    expect(response.ok(), await response.text()).toBeTruthy()
  }
  await expect.poll(async () => {
    const response = await request.get('/api/shopping/v1/products', { params: { q: prefix, sort: 'LATEST', status: 'SOLD_OUT', size: 50 } })
    return response.ok() ? (await response.json()).data.items.length : -1
  }, { timeout: 30000 }).toBe(2)
  await page.getByRole('button', { name: '품절', exact: true }).click()
  await expect(cards).toHaveCount(2)
  await expect(page.getByRole('button', { name: '더 보기', exact: true })).toHaveCount(0)

  await page.goto('/login')
  await page.getByLabel('아이디 또는 이메일').fill('seller@local.test')
  await page.getByLabel('비밀번호', { exact: true }).fill('seller')
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login$/)
  await page.goto('/admin/products')
  const filtered = page.waitForResponse(response => response.url().includes('/seller/products?') && new URL(response.url()).searchParams.get('status') === 'SOLD_OUT')
  await page.getByRole('button', { name: '품절', exact: true }).click()
  const filteredResponse = await filtered
  expect(filteredResponse.ok(), await filteredResponse.text()).toBeTruthy()
  const data = (await filteredResponse.json()).data
  expect(data.items.every((item: { salesStatus: string }) => item.salesStatus === 'SOLD_OUT')).toBe(true)
  for (const product of products.slice(-2)) await expect(page.getByRole('link', { name: product.name, exact: true })).toBeVisible()
})
